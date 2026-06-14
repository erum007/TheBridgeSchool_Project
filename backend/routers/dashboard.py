from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from ..dependencies import get_current_user, get_db
from ..models import ActionItem, EmailStatus, Meeting, ScheduledEmail, User, UserRole, ActionItemStatus


router = APIRouter(prefix='/api/dashboard', tags=['dashboard'])


@router.get('/summary')
def summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    today = date.today()
    if current_user.role == UserRole.admin:
        pending_actions = db.query(ActionItem).filter(ActionItem.status != ActionItemStatus.done).count()
        scheduled_emails = db.query(ScheduledEmail).filter(ScheduledEmail.status.in_([EmailStatus.draft, EmailStatus.scheduled])).count()
        overdue_tasks = (
            db.query(ActionItem)
            .filter(ActionItem.due_date.isnot(None), ActionItem.due_date < today, ActionItem.status != ActionItemStatus.done)
            .count()
        )
        upcoming_meetings = db.query(Meeting).filter(Meeting.scheduled_at >= func.now()).count()
    else:
        pending_actions = db.query(ActionItem).filter(ActionItem.assigned_to == current_user.id, ActionItem.status != ActionItemStatus.done).count()
        scheduled_emails = db.query(ScheduledEmail).filter(ScheduledEmail.created_by == current_user.id).count()
        overdue_tasks = (
            db.query(ActionItem)
            .filter(
                ActionItem.assigned_to == current_user.id,
                ActionItem.due_date.isnot(None),
                ActionItem.due_date < today,
                ActionItem.status != ActionItemStatus.done,
            )
            .count()
        )
        upcoming_meetings = (
            db.query(Meeting)
            .filter(or_(Meeting.created_by == current_user.id, Meeting.attendees.any(User.id == current_user.id)))
            .filter(Meeting.scheduled_at >= func.now())
            .count()
        )
    return {
        'pending_actions': pending_actions,
        'scheduled_emails': scheduled_emails,
        'overdue_tasks': overdue_tasks,
        'upcoming_meetings': upcoming_meetings,
    }
