from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from ..dependencies import get_current_user, get_db, require_roles
from ..models import ActionItem, Meeting, MeetingStatus, User, UserRole
from ..schemas import MeetingCreate, MeetingUpdate
from ..services.serialization import serialize_meeting


router = APIRouter(prefix='/api/meetings', tags=['meetings'])


def _parse_datetime(value: str | None):
    if not value:
        return None
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def _has_meeting_access(meeting: Meeting, user: User) -> bool:
    if user.role == UserRole.admin:
        return True
    attendee_ids = {attendee.id for attendee in meeting.attendees}
    return meeting.created_by == user.id or user.id in attendee_ids


@router.get('')
def list_meetings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = (
        db.query(Meeting)
        .options(selectinload(Meeting.attendees), selectinload(Meeting.action_items).selectinload(ActionItem.assigned_to_user))
        .order_by(Meeting.scheduled_at.desc())
    )
    if current_user.role != UserRole.admin:
        query = query.filter(or_(Meeting.created_by == current_user.id, Meeting.attendees.any(User.id == current_user.id)))
    meetings = query.all()
    return [serialize_meeting(meeting) for meeting in meetings]


@router.post('')
def create_meeting(payload: MeetingCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.admin, UserRole.teacher))):
    if current_user.role == UserRole.teacher and not current_user.head_teacher:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Head teacher permission required')
    meeting = Meeting(
        title=payload.title,
        scheduled_at=_parse_datetime(payload.scheduled_at),
        department=payload.department,
        notes=payload.notes,
        created_by=current_user.id,
        status=MeetingStatus.upcoming,
    )
    if payload.attendee_ids:
        attendees = db.query(User).filter(User.id.in_(payload.attendee_ids)).all()
        meeting.attendees = attendees
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return serialize_meeting(meeting)


@router.get('/{meeting_id}')
def get_meeting(meeting_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    meeting = (
        db.query(Meeting)
        .options(selectinload(Meeting.attendees), selectinload(Meeting.action_items).selectinload(ActionItem.assigned_to_user))
        .filter(Meeting.id == meeting_id)
        .first()
    )
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Meeting not found')
    if not _has_meeting_access(meeting, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')
    return serialize_meeting(meeting)


@router.patch('/{meeting_id}')
def update_meeting(meeting_id: int, payload: MeetingUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    meeting = db.query(Meeting).options(selectinload(Meeting.attendees), selectinload(Meeting.action_items)).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Meeting not found')
    if current_user.role != UserRole.admin and meeting.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')
    if payload.notes is not None:
        meeting.notes = payload.notes
    if payload.title is not None:
        meeting.title = payload.title
    if payload.department is not None:
        meeting.department = payload.department
    if payload.status is not None:
        meeting.status = MeetingStatus(payload.status)
    if payload.scheduled_at is not None:
        meeting.scheduled_at = _parse_datetime(payload.scheduled_at)
    if payload.attendee_ids is not None:
        meeting.attendees = db.query(User).filter(User.id.in_(payload.attendee_ids)).all()
    db.commit()
    db.refresh(meeting)
    return serialize_meeting(meeting)


@router.delete('/{meeting_id}')
def delete_meeting(meeting_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.admin))):
    meeting = db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Meeting not found')
    db.delete(meeting)
    db.commit()
    return {'detail': 'Meeting deleted'}
