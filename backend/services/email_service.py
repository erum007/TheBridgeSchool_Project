from __future__ import annotations

from datetime import datetime, timezone

from ..models import EmailStatus, ScheduledEmail


def send_email_record(email_record, immediate: bool = True):
    if immediate:
        email_record.status = EmailStatus.sent
        email_record.sent_at = datetime.now(timezone.utc)
    else:
        email_record.status = EmailStatus.scheduled
    return email_record
