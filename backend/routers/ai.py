from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..dependencies import get_current_user, get_db
from ..models import Meeting, User, UserRole
from ..services.ai_service import generate_meeting_summary
from ..services.serialization import serialize_meeting


router = APIRouter(prefix='/api/meetings', tags=['ai'])


@router.post('/{meeting_id}/summarise')
def summarise_meeting(meeting_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    meeting = db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Meeting not found')
    if current_user.role != UserRole.admin and meeting.created_by != current_user.id and not any(attendee.id == current_user.id for attendee in meeting.attendees):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')
    summary = generate_meeting_summary(meeting.notes)
    meeting.ai_summary = summary
    db.commit()
    return {'summary': summary, 'meeting': serialize_meeting(meeting)}
