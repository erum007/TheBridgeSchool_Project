from __future__ import annotations

from typing import Optional

from .common import ORMBaseModel


class ActionItemCreate(ORMBaseModel):
    meeting_id: int
    description: str
    assigned_to: int
    due_date: Optional[str] = None
    email_reminder_frequency: Optional[str] = None
    email_reminder_at: Optional[str] = None


class ActionItemUpdate(ORMBaseModel):
    status: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[int] = None
    due_date: Optional[str] = None
    email_reminder_frequency: Optional[str] = None
    email_reminder_at: Optional[str] = None


class ActionItemRead(ORMBaseModel):
    id: int
    meeting_id: int
    description: str
    assigned_to: int
    assigned_to_name: str | None = None
    status: str
    due_date: str | None = None
    created_at: str
