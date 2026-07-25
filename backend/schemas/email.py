from __future__ import annotations

import html
import re
from typing import Optional

from pydantic import field_validator

from .common import ORMBaseModel


class EmailTemplateCreate(ORMBaseModel):
    name: str
    subject: str
    body: str
    attachments: list[dict[str, str]] = []

    @field_validator('name', 'subject')
    @classmethod
    def require_text(cls, value: str, info):
        if not value.strip():
            raise ValueError(f'{info.field_name.capitalize()} is required')
        return value.strip()

    @field_validator('body')
    @classmethod
    def require_body_text(cls, value: str):
        # Rich-text editors represent an empty document as markup such as
        # <p><br></p>, so checking the raw HTML string is not sufficient.
        visible_text = html.unescape(re.sub(r'<[^>]*>', '', value)).replace('\xa0', ' ')
        if not visible_text.strip():
            raise ValueError('Body is required')
        return value


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
