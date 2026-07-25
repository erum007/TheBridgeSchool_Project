from __future__ import annotations

from typing import Optional

from .common import ORMBaseModel


class EmailTemplateCreate(ORMBaseModel):
    name: str
    subject: str
    body: str
    attachments: list[dict[str, str]] = []


class EmailTemplateRead(ORMBaseModel):
    id: int
    name: str
    subject: str
    body: str
    attachments: list[dict[str, str]] = []
    created_by: int
    created_by_name: str | None = None
    created_at: str


class ScheduledEmailCreate(ORMBaseModel):
    recipient_group: str
    subject: str
    body: str
    attachments: list[dict[str, str]] = []
    template_id: Optional[int] = None
    scheduled_at: Optional[str] = None


class EmailSendRequest(ORMBaseModel):
    recipient_group: str
    subject: str
    body: str
    attachments: list[dict[str, str]] = []
    template_id: Optional[int] = None
    scheduled_at: Optional[str] = None


class ScheduledEmailRead(ORMBaseModel):
    id: int
    template_id: Optional[int] = None
    recipient_group: str
    subject: str
    body: str
    attachments: list[dict[str, str]] = []
    scheduled_at: Optional[str] = None
    sent_at: Optional[str] = None
    status: str
    created_by: int
    created_by_name: str | None = None
    created_at: str
