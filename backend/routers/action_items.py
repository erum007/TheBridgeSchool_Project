from __future__ import annotations

from datetime import date
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from ..dependencies import get_current_user, get_db, require_roles
from ..models import ActionItem, ActionItemStatus, ActionItemWhatsAppReminder, User, UserRole
from ..schemas import ActionItemCreate, ActionItemUpdate
from ..services.email_service import send_plain_email
from ..services.scheduler_service import ensure_scheduler_started
from ..services.action_item_whatsapp_reminder_service import VALID_FREQUENCIES, cancel_reminder, parse_run_at, schedule_reminder
from ..services.serialization import serialize_action_item


router = APIRouter(prefix='/api/action-items', tags=['action-items'])


def _set_whatsapp_reminder(action_item, frequency: str | None, run_at_value: str | None, created_by: int, db: Session):
    existing = action_item.whatsapp_reminder
    if not frequency or frequency == 'none':
        if existing:
            existing.is_active = False
            db.flush()
            cancel_reminder(existing.id)
        return
    if frequency not in VALID_FREQUENCIES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid WhatsApp reminder frequency')
    try:
        run_at = parse_run_at(run_at_value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if existing:
        existing.frequency, existing.run_at, existing.is_active = frequency, run_at, True
    else:
        existing = ActionItemWhatsAppReminder(action_item_id=action_item.id, frequency=frequency, run_at=run_at, created_by=created_by)
        db.add(existing)
    db.flush()
    schedule_reminder(existing)


def _schedule_reminder(action_item, db):
        """Schedule a reminder email 24 hours before the due date."""
        if not action_item.due_date or not action_item.assigned_to:
                return
        from ..database import SessionLocal
        from ..models import User

        run_at = datetime.combine(action_item.due_date, datetime.min.time()).replace(
                tzinfo=timezone.utc
        ) - timedelta(hours=24)

        if run_at <= datetime.now(timezone.utc):
                return  # Due date already passed or less than 24 hours away

        action_item_id = action_item.id
        assigned_to_id = action_item.assigned_to
        description = action_item.description

        def _send_reminder():
                reminder_db = SessionLocal()
                try:
                        user = reminder_db.get(User, assigned_to_id)
                        if not user:
                                return
                        subject = 'Reminder: Action item due tomorrow'
                        body = f"""Dear {user.name},

This is a reminder that the following action item is due tomorrow:

{description}

Please ensure this is completed on time.

Regards,
The Bridge School Portal"""
                        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 0; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 32px 24px; }}
        .header {{ border-bottom: 3px solid #C0392B; padding-bottom: 16px; margin-bottom: 24px; }}
        .school-name {{ color: #1B2B6B; font-size: 20px; font-weight: bold; margin: 0; }}
        .task-box {{ background: #f7f8fc; border-left: 4px solid #C0392B; padding: 16px; border-radius: 4px; margin: 20px 0; }}
        .task-text {{ font-size: 15px; color: #1a1a1a; margin: 0; }}
        .footer {{ margin-top: 32px; padding-top: 16px; border-top: 1px solid #e8e4dc; font-size: 13px; color: #8a8a8a; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <p class="school-name">The Bridge School</p>
        </div>
        <p>Dear <strong>{user.name}</strong>,</p>
        <p>This is a reminder that the following action item is due <strong>tomorrow</strong>:</p>
        <div class="task-box">
            <p class="task-text">{description}</p>
        </div>
        <p>Please ensure this is completed on time.</p>
        <div class="footer">
            <strong>The Bridge School Portal</strong><br>
            This is an automated reminder.
        </div>
    </div>
</body>
</html>
"""
                        send_plain_email(user.email, subject, body, html_body=html_body)
                except Exception:
                        pass
                finally:
                        reminder_db.close()

        scheduler = ensure_scheduler_started()
        scheduler.add_job(
                _send_reminder,
                'date',
                run_date=run_at,
                id=f'reminder-action-{action_item_id}',
                replace_existing=True,
        )


@router.get('')
def list_action_items(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(ActionItem).options(selectinload(ActionItem.assigned_to_user), selectinload(ActionItem.whatsapp_reminder)).order_by(ActionItem.created_at.desc())
    if current_user.role != UserRole.admin:
        query = query.filter(ActionItem.assigned_to == current_user.id)
    return [serialize_action_item(action_item) for action_item in query.all()]


@router.post('')
def create_action_item(payload: ActionItemCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.admin, UserRole.teacher))):
    if current_user.role == UserRole.teacher and not current_user.head_teacher:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Head teacher permission required')
    action_item = ActionItem(
        meeting_id=payload.meeting_id,
        description=payload.description,
        assigned_to=payload.assigned_to,
        due_date=date.fromisoformat(payload.due_date) if payload.due_date else None,
    )
    db.add(action_item)
    db.commit()
    db.refresh(action_item)
    _set_whatsapp_reminder(action_item, payload.whatsapp_reminder_frequency, payload.whatsapp_reminder_at, current_user.id, db)
    db.commit()
    _schedule_reminder(action_item, db)
    action_item = db.query(ActionItem).options(selectinload(ActionItem.assigned_to_user), selectinload(ActionItem.whatsapp_reminder)).filter(ActionItem.id == action_item.id).first()
    return serialize_action_item(action_item)


@router.patch('/{action_item_id}')
def update_action_item(action_item_id: int, payload: ActionItemUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    action_item = db.query(ActionItem).options(selectinload(ActionItem.assigned_to_user), selectinload(ActionItem.whatsapp_reminder)).filter(ActionItem.id == action_item_id).first()
    if not action_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Action item not found')
    if current_user.role != UserRole.admin and action_item.assigned_to != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')
    if payload.status is not None:
        action_item.status = ActionItemStatus(payload.status)
    if payload.description is not None:
        action_item.description = payload.description
    if payload.assigned_to is not None:
        action_item.assigned_to = payload.assigned_to
    if payload.due_date is not None:
        action_item.due_date = date.fromisoformat(payload.due_date) if payload.due_date else None
    if 'whatsapp_reminder_frequency' in payload.model_fields_set:
        _set_whatsapp_reminder(action_item, payload.whatsapp_reminder_frequency, payload.whatsapp_reminder_at, current_user.id, db)
    db.commit()
    db.refresh(action_item)
    _schedule_reminder(action_item, db)
    if action_item.status == ActionItemStatus.done and action_item.whatsapp_reminder:
        action_item.whatsapp_reminder.is_active = False
        cancel_reminder(action_item.whatsapp_reminder.id)
        db.commit()
    action_item = db.query(ActionItem).options(selectinload(ActionItem.assigned_to_user), selectinload(ActionItem.whatsapp_reminder)).filter(ActionItem.id == action_item_id).first()
    return serialize_action_item(action_item)


@router.post('/{action_item_id}/complete')
async def complete_action_item(action_item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    action_item = db.query(ActionItem).options(selectinload(ActionItem.assigned_to_user)).filter(ActionItem.id == action_item_id).first()
    if not action_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Action item not found')
    if current_user.role != UserRole.admin and action_item.assigned_to != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')
    action_item.status = ActionItemStatus.done
    db.commit()
    db.refresh(action_item)
    return serialize_action_item(action_item)


@router.delete('/{action_item_id}')
def delete_action_item(action_item_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.admin))):
    action_item = db.get(ActionItem, action_item_id)
    if not action_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Action item not found')
    if action_item.whatsapp_reminder:
        cancel_reminder(action_item.whatsapp_reminder.id)
    db.delete(action_item)
    db.commit()
    return {'detail': 'Action item deleted'}
