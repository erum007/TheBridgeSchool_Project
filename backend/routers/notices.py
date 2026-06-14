from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from datetime import date

from ..dependencies import get_current_user, get_db, require_roles
from ..models import Notice, NoticeRecipients, NoticeStatus, User, UserRole
from ..schemas import NoticeCreate, NoticeUpdate
from ..services.serialization import serialize_notice


router = APIRouter(prefix='/api/notices', tags=['notices'])


def _role_allows_notice(user: User, notice: Notice) -> bool:
    if user.role == UserRole.admin:
        return True
    if notice.recipients == NoticeRecipients.all:
        return True
    return notice.recipients.value == user.role.value or notice.recipients == user.role.value


@router.get('')
def list_notices(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Notice).options(selectinload(Notice.created_by_user)).order_by(Notice.created_at.desc())
    notices = [notice for notice in query.all() if _role_allows_notice(current_user, notice)]
    return [serialize_notice(notice) for notice in notices]


@router.post('')
def create_notice(payload: NoticeCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.admin))):
    notice = Notice(
        title=payload.title,
        body=payload.body,
        recipients=NoticeRecipients(payload.recipients),
        status=NoticeStatus(payload.status),
        publish_date=date.fromisoformat(payload.publish_date) if payload.publish_date else None,
        created_by=current_user.id,
    )
    db.add(notice)
    db.commit()
    db.refresh(notice)
    notice = db.query(Notice).options(selectinload(Notice.created_by_user)).filter(Notice.id == notice.id).first()
    return serialize_notice(notice)


@router.patch('/{notice_id}')
def update_notice(notice_id: int, payload: NoticeUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.admin))):
    notice = db.get(Notice, notice_id)
    if not notice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Notice not found')
    if payload.title is not None:
        notice.title = payload.title
    if payload.body is not None:
        notice.body = payload.body
    if payload.recipients is not None:
        notice.recipients = NoticeRecipients(payload.recipients)
    if payload.status is not None:
        notice.status = NoticeStatus(payload.status)
    if payload.publish_date is not None:
        notice.publish_date = date.fromisoformat(payload.publish_date) if payload.publish_date else None
    db.commit()
    db.refresh(notice)
    notice = db.query(Notice).options(selectinload(Notice.created_by_user)).filter(Notice.id == notice.id).first()
    return serialize_notice(notice)


@router.delete('/{notice_id}')
def delete_notice(notice_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.admin))):
    notice = db.get(Notice, notice_id)
    if not notice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Notice not found')
    db.delete(notice)
    db.commit()
    return {'detail': 'Notice deleted'}
