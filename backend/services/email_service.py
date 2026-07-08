from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timezone

from ..config import settings
from ..models import EmailStatus


def send_email_record(email_record, immediate: bool = True):
    """Update an email record to reflect whether it was sent immediately or scheduled."""
    if immediate:
        email_record.status = EmailStatus.sent
        email_record.sent_at = datetime.now(timezone.utc)
    else:
        email_record.status = EmailStatus.scheduled
    return email_record


def send_gmail_message(to_email: str, subject: str, body: str) -> bool:
    """Placeholder Gmail sender used by reminder logic in local/offline tests."""
    if not settings.gmail_client_id or not settings.gmail_client_secret:
        return False
    return True


def _is_completed(status) -> bool:
    """Return True when an action-item status indicates completion."""
    if status is None:
        return False
    if hasattr(status, 'value'):
        status_value = status.value
    else:
        status_value = status
    return str(status_value).lower() in {'done', 'completed', 'complete'}


def send_action_item_reminders(action_items) -> int:
    """Send reminders for due or overdue action items, grouped by assignee."""
    today = date.today()
    grouped: dict[int, list] = defaultdict(list)

    for action_item in action_items or []:
        if _is_completed(getattr(action_item, 'status', None)):
            continue
        due_date = getattr(action_item, 'due_date', None)
        if due_date is None:
            continue
        if isinstance(due_date, str):
            try:
                due_date = datetime.fromisoformat(due_date).date()
            except ValueError:
                continue
        if due_date > today:
            continue
        assignee_id = getattr(action_item, 'assigned_to', None)
        if assignee_id is None:
            continue
        grouped[assignee_id].append(action_item)

    reminder_items = 0
    for assignee_id, items in grouped.items():
        assignee = getattr(items[0], 'assigned_to_user', None)
        if not assignee:
            continue
        body_lines = [f'Hello {assignee.name}, here are your pending action items:']
        for item in items:
            due_label = item.due_date.isoformat() if hasattr(item.due_date, 'isoformat') else str(item.due_date)
            body_lines.append(f'- {item.description} (due {due_label})')
        send_gmail_message(assignee.email, 'Action item reminder', '\n'.join(body_lines))
        reminder_items += len(items)
    return reminder_items
