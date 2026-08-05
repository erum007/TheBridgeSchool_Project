from __future__ import annotations

from .common import ORMBaseModel


class NotificationRead(ORMBaseModel):
    id: int
    title: str
    body: str
    notification_type: str
    link: str | None = None
    is_read: bool
    created_at: str
