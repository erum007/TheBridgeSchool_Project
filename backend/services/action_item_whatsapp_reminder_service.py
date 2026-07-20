from __future__ import annotations

from datetime import datetime, timezone

from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger

from ..database import SessionLocal
from ..config import settings
from ..models import ActionItem, ActionItemStatus, ActionItemWhatsAppReminder, User, WhatsAppLog
from .scheduler_service import ensure_scheduler_started, scheduler
from .whatsapp_service import send_whatsapp_message


VALID_FREQUENCIES = {'hourly', 'daily', 'weekly', 'custom'}


def parse_run_at(value: str | None) -> datetime:
    if not value:
        raise ValueError('A reminder date and time is required')
    run_at = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if run_at.tzinfo is None:
        run_at = run_at.replace(tzinfo=timezone.utc)
    return run_at.astimezone(timezone.utc)


def reminder_job_id(reminder_id: int) -> str:
    return f'action-item-whatsapp-reminder-{reminder_id}'


def cancel_reminder(reminder_id: int) -> None:
    try:
        scheduler.remove_job(reminder_job_id(reminder_id))
    except Exception:
        pass


def _deliver_reminder(reminder_id: int) -> None:
    db = SessionLocal()
    try:
        reminder = db.get(ActionItemWhatsAppReminder, reminder_id)
        if not reminder or not reminder.is_active:
            return
        action_item = db.get(ActionItem, reminder.action_item_id)
        if not action_item or action_item.status == ActionItemStatus.done:
            reminder.is_active = False
            db.commit()
            cancel_reminder(reminder_id)
            return
        assignee = db.get(User, action_item.assigned_to)
        if not assignee or not assignee.whatsapp_number:
            return
        due = f' Due: {action_item.due_date.isoformat()}.' if action_item.due_date else ''
        log = WhatsAppLog(
            recipient_name=assignee.name,
            phone_number=assignee.whatsapp_number,
            message=f'Reminder: action item assigned to you — {action_item.description}.{due}',
            sent_by=reminder.created_by,
        )
        db.add(log)
        db.flush()
        content_sid = settings.twilio_whatsapp_reminder_content_sid or None
        send_whatsapp_message(
            log,
            content_sid=content_sid,
            content_variables={
                '1': action_item.description,
                '2': action_item.due_date.isoformat() if action_item.due_date else 'No due date',
            } if content_sid else None,
        )
        reminder.last_sent_at = datetime.now(timezone.utc)
        if reminder.frequency == 'custom':
            reminder.is_active = False
        db.commit()
    finally:
        db.close()


def schedule_reminder(reminder: ActionItemWhatsAppReminder) -> None:
    cancel_reminder(reminder.id)
    if not reminder.is_active:
        return
    scheduler_instance = ensure_scheduler_started()
    run_at = reminder.run_at
    if run_at.tzinfo is None:
        run_at = run_at.replace(tzinfo=timezone.utc)
    if reminder.frequency == 'custom':
        if run_at <= datetime.now(timezone.utc):
            return
        trigger = DateTrigger(run_date=run_at)
    else:
        kwargs = {'hourly': {'hours': 1}, 'daily': {'days': 1}, 'weekly': {'weeks': 1}}[reminder.frequency]
        trigger = IntervalTrigger(start_date=run_at, timezone='UTC', **kwargs)
    scheduler_instance.add_job(_deliver_reminder, trigger, args=[reminder.id], id=reminder_job_id(reminder.id), replace_existing=True)


def restore_reminders() -> None:
    db = SessionLocal()
    try:
        reminders = db.query(ActionItemWhatsAppReminder).filter(ActionItemWhatsAppReminder.is_active == True).all()
        for reminder in reminders:
            schedule_reminder(reminder)
    finally:
        db.close()
