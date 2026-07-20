from __future__ import annotations

from datetime import datetime, timezone
import json

from twilio.rest import Client

from ..config import settings
from ..models import WhatsAppStatus


def send_whatsapp_message(log_record, content_sid: str | None = None, content_variables: dict | None = None):
    if not (settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_whatsapp_number):
        log_record.status = WhatsAppStatus.failed
        log_record.sent_at = datetime.now(timezone.utc)
        return log_record
    try:
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        message_args = {
            'from_': f'whatsapp:{settings.twilio_whatsapp_number}',
            'to': f'whatsapp:{log_record.phone_number}',
        }
        if content_sid:
            message_args['content_sid'] = content_sid
            message_args['content_variables'] = json.dumps(content_variables or {})
        else:
            message_args['body'] = log_record.message
        client.messages.create(**message_args)
        log_record.status = WhatsAppStatus.sent
    except Exception:
        log_record.status = WhatsAppStatus.failed
    log_record.sent_at = datetime.now(timezone.utc)
    return log_record
