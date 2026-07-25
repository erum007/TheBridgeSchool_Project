from __future__ import annotations

from datetime import datetime, timezone
import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from ..dependencies import get_current_user, get_db, require_roles
from ..models import ActionItem, Department, Meeting, MeetingStatus, User, UserRole
from ..schemas import MeetingCreate, MeetingUpdate
from ..services.email_service import send_plain_email
from ..services.serialization import serialize_meeting


router = APIRouter(prefix='/api/meetings', tags=['meetings'])


def _parse_datetime(value: str | None):
    if not value:
        return None
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        return parsed
    return parsed.astimezone(timezone.utc).replace(tzinfo=None)


def _has_meeting_access(meeting: Meeting, user: User) -> bool:
    if user.role == UserRole.admin:
        return True
    attendee_ids = {attendee.id for attendee in meeting.attendees}
    return meeting.created_by == user.id or user.id in attendee_ids


def _validate_meeting_details(payload) -> None:
    if not payload.title or not payload.title.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Meeting title is required')
    if payload.meeting_mode not in {'online', 'in_person', 'choice'}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid meeting mode')
    if payload.meeting_mode in {'online', 'choice'} and not payload.meeting_link:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='A meeting link is required for online or attendee-choice meetings')
    if payload.meeting_mode in {'in_person', 'choice'} and not payload.location:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='A location is required for in-person or attendee-choice meetings')


def _validate_end_time(scheduled_at: datetime | None, end_time: datetime | None) -> None:
    if not scheduled_at or not end_time:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Start and end times are required')
    if end_time <= scheduled_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='End time must be after the start time')


def _resolve_audience(db: Session, payload: MeetingCreate) -> list[User]:
    if payload.department == 'Custom':
        departments = [name.strip() for name in payload.audience_departments if name.strip()]
        conditions = []
        if departments:
            conditions.append(User.departments.any(Department.name.in_(departments)))
        if payload.attendee_ids:
            conditions.append(User.id.in_(payload.attendee_ids))
        if not conditions:
            return []
        return db.query(User).filter(User.is_active == True, or_(*conditions)).all()
    return db.query(User).filter(User.is_active == True, User.departments.any(Department.name == payload.department)).all()


def _validated_external_emails(payload: MeetingCreate) -> list[str]:
    if payload.department != 'Custom':
        return []
    emails = []
    for email in payload.external_emails:
        normalized = email.strip().lower()
        if not normalized:
            continue
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', normalized):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Invalid external email address: {email}')
        if normalized not in emails:
            emails.append(normalized)
    return emails


def _send_meeting_invites(meeting: Meeting, attendees: list[User], external_emails: list[str]) -> tuple[int, int]:
    sent = failed = 0
    mode_label = {'online': 'Online', 'in_person': 'In-person', 'choice': 'Online or in-person (your choice)'}[meeting.meeting_mode]
    recipients = [(attendee.email, attendee.name) for attendee in attendees]
    known_emails = {email.lower() for email, _ in recipients}
    recipients.extend((email, 'Guest') for email in external_emails if email.lower() not in known_emails)
    for recipient_email, recipient_name in recipients:
        body = '\n'.join(filter(None, [
            f'Dear {recipient_name},',
            f'You are invited to: {meeting.title}',
            f'Date & time: {meeting.scheduled_at.strftime("%d %b %Y, %I:%M %p")}',
            f'Mode: {mode_label}',
            f'Agenda: {meeting.agenda}' if meeting.agenda else None,
            f'Meeting link: {meeting.meeting_link}' if meeting.meeting_link else None,
            f'Location: {meeting.location}' if meeting.location else None,
            'Regards,\nThe Bridge School',
        ]))
        if send_plain_email(recipient_email, f'Meeting invitation: {meeting.title}', body):
            sent += 1
        else:
            failed += 1
    return sent, failed


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
    _validate_meeting_details(payload)
    scheduled_at = _parse_datetime(payload.scheduled_at)
    end_time = _parse_datetime(payload.end_time)
    _validate_end_time(scheduled_at, end_time)
    attendees = _resolve_audience(db, payload)
    external_emails = _validated_external_emails(payload)
    meeting = Meeting(
        title=payload.title.strip(),
        scheduled_at=scheduled_at,
        end_time=end_time,
        department='Custom audience' if payload.department == 'Custom' else payload.department,
        agenda=payload.agenda.strip() if payload.agenda else None,
        meeting_mode=payload.meeting_mode,
        meeting_link=payload.meeting_link.strip() if payload.meeting_link else None,
        location=payload.location.strip() if payload.location else None,
        created_by=current_user.id,
        status=MeetingStatus.upcoming,
    )
    meeting.attendees = attendees
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    invitations_sent, invitations_failed = _send_meeting_invites(meeting, attendees, external_emails)
    response = serialize_meeting(meeting)
    response.update({'invitations_sent': invitations_sent, 'invitations_failed': invitations_failed})
    return response


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
    next_scheduled_at = _parse_datetime(payload.scheduled_at) if payload.scheduled_at is not None else meeting.scheduled_at
    next_end_time = _parse_datetime(payload.end_time) if payload.end_time is not None else meeting.end_time
    if payload.scheduled_at is not None or payload.end_time is not None:
        _validate_end_time(next_scheduled_at, next_end_time)
        meeting.scheduled_at = next_scheduled_at
        meeting.end_time = next_end_time
    if payload.agenda is not None:
        meeting.agenda = payload.agenda
    if payload.meeting_mode is not None:
        if payload.meeting_mode not in {'online', 'in_person', 'choice'}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid meeting mode')
        meeting.meeting_mode = payload.meeting_mode
    if payload.meeting_link is not None:
        meeting.meeting_link = payload.meeting_link
    if payload.location is not None:
        meeting.location = payload.location
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
