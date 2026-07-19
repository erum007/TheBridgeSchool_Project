from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from ..dependencies import get_current_user, get_db
from ..models import ActionItem, ActionItemStatus, Meeting, User, UserRole
from ..schemas import MeetingTranscriptRequest
from ..services.ai_service import AIServiceError, generate_meeting_summary, generate_meeting_workspace
from ..services.serialization import serialize_meeting


router = APIRouter(prefix='/api/meetings', tags=['ai'])


def _parse_due_date(value: str | None) -> date | None:
    if not value:
        return None
    if isinstance(value, date):
        return value
    text = str(value).strip()
    if not text:
        return None
    for pattern in ('%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y'):
        try:
            return datetime.strptime(text, pattern).date()
        except ValueError:
            continue
    return None


def _resolve_assignee_id(db: Session, owner: str | None, fallback_id: int) -> int:
    if not owner:
        return fallback_id
    owner_text = str(owner).strip()
    if not owner_text:
        return fallback_id
    assignee = db.query(User).filter(User.name.ilike(owner_text)).first()
    if assignee:
        return assignee.id
    assignee = db.query(User).filter(User.email.ilike(owner_text)).first()
    if assignee:
        return assignee.id
    return fallback_id


@router.post('/{meeting_id}/summarise')
async def summarise_meeting(meeting_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    meeting = db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Meeting not found')
    if current_user.role != UserRole.admin and meeting.created_by != current_user.id and not any(attendee.id == current_user.id for attendee in meeting.attendees):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')
    try:
        summary = generate_meeting_summary(meeting.notes)
    except AIServiceError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    meeting.ai_summary = summary
    db.commit()
    return {'summary': summary, 'meeting': serialize_meeting(meeting)}


@router.post('/{meeting_id}/ai-workspace')
async def generate_meeting_workspace_endpoint(
    meeting_id: int,
    payload: MeetingTranscriptRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Meeting not found')
    if current_user.role != UserRole.admin and meeting.created_by != current_user.id and not any(attendee.id == current_user.id for attendee in meeting.attendees):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')
    if not payload.transcript or not payload.transcript.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Transcript is required')

    try:
        ai_result = await generate_meeting_workspace(payload.transcript)
    except AIServiceError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    summary_lines = [f'Summary: {ai_result.get("summary", "").strip()}']
    for decision in ai_result.get('key_decisions', []) or []:
        summary_lines.append(f'Key decision: {decision}')
    meeting.ai_summary = '\n'.join(summary_lines).strip()

    for action_payload in ai_result.get('action_items', []) or []:
        action_item = ActionItem(
            meeting_id=meeting.id,
            description=str(action_payload.get('task') or '').strip(),
            assigned_to=_resolve_assignee_id(db, action_payload.get('owner'), current_user.id),
            due_date=_parse_due_date(action_payload.get('due_date')),
            status=ActionItemStatus.todo,
        )
        if action_item.description:
            db.add(action_item)

    db.commit()
    db.refresh(meeting)
    meeting = (
        db.query(Meeting)
        .options(selectinload(Meeting.attendees), selectinload(Meeting.action_items).selectinload(ActionItem.assigned_to_user))
        .filter(Meeting.id == meeting.id)
        .first()
    )
    return {
        'summary': ai_result.get('summary', '').strip(),
        'key_decisions': ai_result.get('key_decisions', []),
        'action_items': ai_result.get('action_items', []),
        'meeting': serialize_meeting(meeting),
    }
