from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from ..dependencies import get_current_user, get_db, require_roles
from ..models import ActionItem, ActionItemEmailReminder, ActionItemStatus, User, UserRole
from ..schemas import ActionItemCreate, ActionItemUpdate
from ..services.action_item_email_reminder_service import VALID_FREQUENCIES, cancel_reminder, parse_run_at, schedule_reminder, send_manual_reminder
from ..services.notification_service import create_notification, notification_link
from ..services.serialization import serialize_action_item


router = APIRouter(prefix='/api/action-items', tags=['action-items'])

ASSIGNABLE_ROLES = {UserRole.admin, UserRole.teacher, UserRole.staff}


def _validate_assignee(db: Session, user_id: int) -> User:
    assignee = db.get(User, user_id)
    if not assignee or not assignee.is_active or assignee.role not in ASSIGNABLE_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Action items can only be assigned to active administrators, teachers, or staff')
    return assignee


def _set_email_reminder(action_item, frequency: str | None, run_at_value: str | None, created_by: int, db: Session):
    existing = action_item.email_reminder
    if not frequency or frequency == 'none':
        if existing:
            existing.is_active = False
            db.flush()
            cancel_reminder(existing.id)
        return
    if frequency not in VALID_FREQUENCIES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid email reminder frequency')
    try:
        run_at = parse_run_at(run_at_value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if existing:
        existing.frequency, existing.run_at, existing.is_active = frequency, run_at, True
    else:
        existing = ActionItemEmailReminder(action_item_id=action_item.id, frequency=frequency, run_at=run_at, created_by=created_by)
        db.add(existing)
    db.flush()


def _deactivate_email_reminder(action_item) -> None:
    reminder = action_item.email_reminder
    if not reminder:
        return
    reminder.is_active = False
    cancel_reminder(reminder.id)


@router.get('')
def list_action_items(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(ActionItem).options(selectinload(ActionItem.assigned_to_user), selectinload(ActionItem.email_reminder)).order_by(ActionItem.created_at.desc())
    if current_user.role != UserRole.admin:
        query = query.filter(ActionItem.assigned_to == current_user.id)
    return [serialize_action_item(action_item) for action_item in query.all()]


@router.post('')
def create_action_item(payload: ActionItemCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.admin, UserRole.teacher))):
    if current_user.role == UserRole.teacher and not current_user.head_teacher:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Head teacher permission required')
    due_date = date.fromisoformat(payload.due_date) if payload.due_date else None
    if due_date and due_date < date.today():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Due date cannot be in the past')
    assignee = _validate_assignee(db, payload.assigned_to)
    action_item = ActionItem(
        meeting_id=payload.meeting_id,
        description=payload.description,
        assigned_to=payload.assigned_to,
        due_date=due_date,
    )
    db.add(action_item)
    create_notification(
        db,
        assignee.id,
        'New action item assigned',
        f'You have been assigned: {action_item.description}',
        'action_item',
        notification_link(assignee.role, '/meetings?tab=board'),
    )
    db.commit()
    db.refresh(action_item)
    _set_email_reminder(action_item, payload.email_reminder_frequency, payload.email_reminder_at, current_user.id, db)
    db.commit()
    db.refresh(action_item)
    reminder = db.query(ActionItemEmailReminder).filter(ActionItemEmailReminder.action_item_id == action_item.id).first()
    if reminder:
        schedule_reminder(reminder)
    action_item = db.query(ActionItem).options(selectinload(ActionItem.assigned_to_user), selectinload(ActionItem.email_reminder)).filter(ActionItem.id == action_item.id).first()
    return serialize_action_item(action_item)


@router.patch('/{action_item_id}')
def update_action_item(action_item_id: int, payload: ActionItemUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    action_item = db.query(ActionItem).options(selectinload(ActionItem.assigned_to_user), selectinload(ActionItem.email_reminder)).filter(ActionItem.id == action_item_id).first()
    if not action_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Action item not found')
    if current_user.role != UserRole.admin and action_item.assigned_to != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')
    if payload.status is not None:
        action_item.status = ActionItemStatus(payload.status)
    if payload.description is not None:
        action_item.description = payload.description
    if payload.assigned_to is not None:
        _validate_assignee(db, payload.assigned_to)
        action_item.assigned_to = payload.assigned_to
    if payload.due_date is not None:
        due_date = date.fromisoformat(payload.due_date) if payload.due_date else None
        if due_date and due_date < date.today():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Due date cannot be in the past')
        action_item.due_date = due_date
    if 'email_reminder_frequency' in payload.model_fields_set:
        _set_email_reminder(action_item, payload.email_reminder_frequency, payload.email_reminder_at, current_user.id, db)
    db.commit()
    db.refresh(action_item)
    reminder = db.query(ActionItemEmailReminder).filter(ActionItemEmailReminder.action_item_id == action_item.id).first()
    if reminder:
        schedule_reminder(reminder)
    if action_item.status == ActionItemStatus.done:
        _deactivate_email_reminder(action_item)
        db.commit()
    action_item = db.query(ActionItem).options(selectinload(ActionItem.assigned_to_user), selectinload(ActionItem.email_reminder)).filter(ActionItem.id == action_item_id).first()
    return serialize_action_item(action_item)


@router.post('/{action_item_id}/send-reminder-now')
def send_reminder_now(action_item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    action_item = db.query(ActionItem).options(selectinload(ActionItem.assigned_to_user), selectinload(ActionItem.email_reminder)).filter(ActionItem.id == action_item_id).first()
    if not action_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Action item not found')
    if current_user.role != UserRole.admin and action_item.assigned_to != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')
    sent, message = send_manual_reminder(action_item_id)
    if not sent:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
    return {'detail': message, 'sent': True}


@router.post('/{action_item_id}/complete')
async def complete_action_item(action_item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    action_item = db.query(ActionItem).options(selectinload(ActionItem.assigned_to_user), selectinload(ActionItem.email_reminder)).filter(ActionItem.id == action_item_id).first()
    if not action_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Action item not found')
    if current_user.role != UserRole.admin and action_item.assigned_to != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')
    action_item.status = ActionItemStatus.done
    _deactivate_email_reminder(action_item)
    db.commit()
    db.refresh(action_item)
    return serialize_action_item(action_item)


@router.delete('/{action_item_id}')
def delete_action_item(action_item_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.admin))):
    action_item = db.get(ActionItem, action_item_id)
    if not action_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Action item not found')
    if action_item.email_reminder:
        cancel_reminder(action_item.email_reminder.id)
    db.delete(action_item)
    db.commit()
    return {'detail': 'Action item deleted'}
