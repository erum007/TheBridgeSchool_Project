from __future__ import annotations

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from ..dependencies import get_current_user, get_db, require_roles
from ..models import Department, Notice, NoticeStatus, User, UserRole
from ..schemas import NoticeCreate, NoticeUpdate
from ..services.serialization import serialize_notice
from ..services.notification_service import create_notification, notification_link


router = APIRouter(prefix='/api/notices', tags=['notices'])


def _user_matches_notice(user: User, notice: Notice) -> bool:
    """Return True if this user is allowed to see the notice."""
    roles = notice.recipient_roles or []
    dept_ids = {d.id for d in (notice.recipient_departments or [])}
    user_ids = {u.id for u in (getattr(notice, 'recipient_users', None) or [])}

    # Admin always sees everything
    if user.role == UserRole.admin:
        return True

    # Check if specifically included as a user
    if getattr(user, 'id', None) in user_ids:
        return True

    # If recipient_roles is empty and no departments and no users → treat as 'all'
    if not roles and not dept_ids and not user_ids:
        return True

    # Check role-based recipients
    role_value = user.role.value if hasattr(user.role, 'value') else str(user.role)
    if 'all' in roles:
        return True
    
    # Frontend sends plural roles (e.g., 'students', 'parents', 'teachers'), but UserRole is singular
    if role_value in roles or f"{role_value}s" in roles:
        return True

    # Check department-based recipients
    if dept_ids:
        user_dept_ids = {d.id for d in getattr(user, 'departments', [])}
        if user_dept_ids & dept_ids:
            return True

    return False


def _is_notice_visible(user: User, notice: Notice) -> bool:
    """Return True when the notice has been published and matches the user."""
    if user.role == UserRole.admin:
        return True

    status_value = getattr(notice.status, 'value', notice.status)
    if status_value != NoticeStatus.published.value:
        return False

    # If there is a scheduled publish_datetime, check it is in the past
    if notice.publish_datetime is not None:
        publish_dt = notice.publish_datetime
        # Ensure timezone-aware comparison
        if publish_dt.tzinfo is None:
            publish_dt = publish_dt.replace(tzinfo=timezone.utc)
        if publish_dt > datetime.now(timezone.utc):
            return False

    # No publish_datetime means "publish immediately" — always visible once status is published

    return _user_matches_notice(user, notice)


def _parse_publish_datetime(value: str | None) -> datetime | None:
    """Parse an ISO datetime string to a UTC datetime.

    The frontend sends datetime-local values without timezone info.
    We treat them as UTC so the visibility comparison is consistent.
    Returns None for empty/null values (meaning "publish immediately").
    """
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Invalid publish_datetime format. Use ISO 8601 (e.g. 2026-08-05T09:00).',
        )
    # Store as UTC — the frontend sends local time which we treat as UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _validate_notice_payload(payload):
    """Validate required fields for a notice."""
    if not payload.title or not payload.title.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Title is required.',
        )
    has_roles = bool(payload.recipient_roles)
    has_depts = bool(payload.recipient_department_ids)
    has_users = bool(getattr(payload, 'recipient_user_ids', None))
    if not has_roles and not has_depts and not has_users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='At least one recipient (role, department, or user) is required.',
        )


def _load_departments(db: Session, ids: List[int]) -> List[Department]:
    if not ids:
        return []
    departments = db.query(Department).filter(Department.id.in_(ids)).all()
    found_ids = {d.id for d in departments}
    missing = set(ids) - found_ids
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f'Departments not found: {sorted(missing)}',
        )
    return departments


def _load_users(db: Session, ids: List[int]) -> List[User]:
    if not ids:
        return []
    users = db.query(User).filter(User.id.in_(ids)).all()
    found_ids = {u.id for u in users}
    missing = set(ids) - found_ids
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f'Users not found: {sorted(missing)}',
        )
    return users


def _notice_query(db: Session):
    return (
        db.query(Notice)
        .options(
            selectinload(Notice.created_by_user),
            selectinload(Notice.recipient_departments),
            selectinload(Notice.recipient_users),
        )
        .order_by(Notice.created_at.desc())
    )


@router.get('')
def list_notices(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    notices = _notice_query(db).all()
    notices = [n for n in notices if _is_notice_visible(current_user, n)]
    return [serialize_notice(n) for n in notices]


@router.post('')
def create_notice(
    payload: NoticeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin)),
):
    _validate_notice_payload(payload)
    pub_dt = _parse_publish_datetime(payload.publish_datetime)
    departments = _load_departments(db, payload.recipient_department_ids or [])
    users = _load_users(db, payload.recipient_user_ids or [])

    notice = Notice(
        title=payload.title.strip(),
        body=payload.body,
        recipient_roles=payload.recipient_roles or [],
        status=NoticeStatus(payload.status),
        publish_datetime=pub_dt,
        created_by=current_user.id,
    )
    notice.recipient_departments = departments
    notice.recipient_users = users
    db.add(notice)
    is_published_now = notice.status == NoticeStatus.published and (
        pub_dt is None or pub_dt <= datetime.now(timezone.utc)
    )
    if is_published_now:
        for recipient in db.query(User).filter(User.is_active == True).all():
            if recipient.id != current_user.id and _user_matches_notice(recipient, notice):
                create_notification(
                    db,
                    recipient.id,
                    'New notice published',
                    notice.title,
                    'notice',
                    notification_link(recipient.role, '/notices'),
                )
    db.commit()
    db.refresh(notice)
    notice = _notice_query(db).filter(Notice.id == notice.id).first()
    return serialize_notice(notice)


@router.patch('/{notice_id}')
def update_notice(
    notice_id: int,
    payload: NoticeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin)),
):
    notice = db.get(Notice, notice_id)
    if not notice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Notice not found')

    if payload.title is not None:
        notice.title = payload.title
    if payload.body is not None:
        notice.body = payload.body
    if payload.recipient_roles is not None:
        notice.recipient_roles = payload.recipient_roles
    if payload.recipient_department_ids is not None:
        notice.recipient_departments = _load_departments(db, payload.recipient_department_ids)
    if payload.recipient_user_ids is not None:
        notice.recipient_users = _load_users(db, payload.recipient_user_ids)
    if payload.status is not None:
        notice.status = NoticeStatus(payload.status)
    if payload.publish_datetime is not None:
        notice.publish_datetime = _parse_publish_datetime(payload.publish_datetime)

    db.commit()
    db.refresh(notice)
    notice = _notice_query(db).filter(Notice.id == notice.id).first()
    return serialize_notice(notice)


@router.delete('/{notice_id}')
def delete_notice(
    notice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin)),
):
    notice = db.get(Notice, notice_id)
    if not notice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Notice not found')
    db.delete(notice)
    db.commit()
    return {'detail': 'Notice deleted'}
