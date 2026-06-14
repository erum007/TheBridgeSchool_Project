from __future__ import annotations

from .common import ORMBaseModel


class WhatsAppSendRequest(ORMBaseModel):
    recipient_name: str
    phone_number: str
    message: str


class WhatsAppLogRead(ORMBaseModel):
    id: int
    recipient_name: str
    phone_number: str
    message: str
    status: str
    sent_at: str
    sent_by: int
    sent_by_name: str | None = None
