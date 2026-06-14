from __future__ import annotations

from typing import Optional

from .common import ORMBaseModel


class NoticeCreate(ORMBaseModel):
    title: str
    body: str
    recipients: str
    status: str = 'draft'
    publish_date: Optional[str] = None


class NoticeUpdate(ORMBaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    recipients: Optional[str] = None
    status: Optional[str] = None
    publish_date: Optional[str] = None


class NoticeRead(ORMBaseModel):
    id: int
    title: str
    body: str
    recipients: str
    status: str
    publish_date: str | None = None
    created_by: int
    created_by_name: str | None = None
    created_at: str
