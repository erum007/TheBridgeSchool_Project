from __future__ import annotations

import logging
from datetime import datetime, timezone

from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger

from ..database import SessionLocal
from ..models import ActionItem, ActionItemEmailReminder, ActionItemStatus, User
from .email_service import send_plain_email
from .scheduler_service import ensure_scheduler_started, scheduler


VALID_FREQUENCIES = {'hourly', 'daily', 'weekly', 'custom'}

logger = logging.getLogger(__name__)


def parse_run_at(value: str | None) -> datetime:
    if not value:
        raise ValueError('A reminder date and time is required')
    run_at = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if run_at.tzinfo is None:
        run_at = run_at.replace(tzinfo=timezone.utc)
    return run_at.astimezone(timezone.utc)


def reminder_job_id(reminder_id: int) -> str:
    return f'action-item-email-reminder-{reminder_id}'


def cancel_reminder(reminder_id: int) -> None:
    try:
        scheduler.remove_job(reminder_job_id(reminder_id))
    except Exception:
        pass


def _build_reminder_email(assignee_name: str, description: str, due_date) -> tuple[str, str, str]:
    due_label = due_date.isoformat() if due_date else 'No due date'
    subject = 'Reminder: Action item assigned to you'
    body = f"""Dear {assignee_name},

This is a reminder about the following action item assigned to you:

{description}

Due date: {due_label}

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
        <p>Dear <strong>{assignee_name}</strong>,</p>
        <p>This is a reminder about the following action item assigned to you:</p>
        <div class="task-box">
            <p class="task-text">{description}</p>
        </div>
        <p>Due date: <strong>{due_label}</strong></p>
        <p>Please ensure this is completed on time.</p>
        <div class="footer">
            <strong>The Bridge School Portal</strong><br>
            This is an automated reminder.
        </div>
    </div>
</body>
</html>
"""
    return subject, body, html_body


def _deliver_reminder(reminder_id: int) -> None:
    db = SessionLocal()
    try:
        reminder = db.get(ActionItemEmailReminder, reminder_id)
        if not reminder or not reminder.is_active:
            return
        action_item = db.get(ActionItem, reminder.action_item_id)
        if not action_item or action_item.status == ActionItemStatus.done:
            reminder.is_active = False
            db.commit()
            cancel_reminder(reminder_id)
            return
        assignee = db.get(User, action_item.assigned_to)
        if not assignee or not assignee.email:
            logger.warning('Skipping reminder %s because assignee %s has no email address', reminder_id, action_item.assigned_to)
            return
        subject, body, html_body = _build_reminder_email(
            assignee.name,
            action_item.description,
            action_item.due_date,
        )
        sent = send_plain_email(assignee.email, subject, body, html_body=html_body)
        if not sent:
            logger.warning('Reminder email %s could not be sent to %s', reminder_id, assignee.email)
            return
        reminder.last_sent_at = datetime.now(timezone.utc)
        if reminder.frequency == 'custom':
            reminder.is_active = False
        db.commit()
    except Exception:
        logger.exception('Failed to deliver reminder %s', reminder_id)
    finally:
        db.close()


def schedule_reminder(reminder: ActionItemEmailReminder) -> None:
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
        reminders = db.query(ActionItemEmailReminder).filter(ActionItemEmailReminder.is_active == True).all()
        for reminder in reminders:
            schedule_reminder(reminder)
    finally:
        db.close()
