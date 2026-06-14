from __future__ import annotations

from datetime import datetime, timezone

from twilio.rest import Client

from ..config import settings
from ..models import WhatsAppStatus


def send_whatsapp_message(log_record):
    if settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_whatsapp_number:
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        client.messages.create(
            from_=f'whatsapp:{settings.twilio_whatsapp_number}',
            to=f'whatsapp:{log_record.phone_number}',
            body=log_record.message,
        )
        log_record.status = WhatsAppStatus.sent
    else:
        log_record.status = WhatsAppStatus.sent
    log_record.sent_at = datetime.now(timezone.utc)
    return log_record
