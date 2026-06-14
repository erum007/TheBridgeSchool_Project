from __future__ import annotations

from typing import Optional

from pydantic import Field

from .common import ORMBaseModel


class MeetingCreate(ORMBaseModel):
    title: str
    scheduled_at: str
    department: str
    attendee_ids: list[int] = Field(default_factory=list)
    notes: Optional[str] = None


class MeetingUpdate(ORMBaseModel):
    notes: Optional[str] = None
    status: Optional[str] = None
    attendee_ids: Optional[list[int]] = None
    scheduled_at: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None


class MeetingRead(ORMBaseModel):
    id: int
    title: str
    scheduled_at: str
    department: str
    status: str
    notes: Optional[str] = None
    ai_summary: Optional[str] = None
    created_by: int
    created_at: str
    attendees: list[dict] = Field(default_factory=list)
    action_items: list[dict] = Field(default_factory=list)
