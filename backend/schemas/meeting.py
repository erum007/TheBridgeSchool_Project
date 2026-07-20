from __future__ import annotations

from typing import Optional

from pydantic import Field

from .common import ORMBaseModel


class MeetingCreate(ORMBaseModel):
    title: str = Field(min_length=1)
    scheduled_at: str
    department: str
    attendee_ids: list[int] = Field(default_factory=list)
    audience_departments: list[str] = Field(default_factory=list)
    external_emails: list[str] = Field(default_factory=list)
    agenda: Optional[str] = None
    meeting_mode: str = 'in_person'
    meeting_link: Optional[str] = None
    location: Optional[str] = None


class MeetingUpdate(ORMBaseModel):
    notes: Optional[str] = None
    status: Optional[str] = None
    attendee_ids: Optional[list[int]] = None
    scheduled_at: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    agenda: Optional[str] = None
    meeting_mode: Optional[str] = None
    meeting_link: Optional[str] = None
    location: Optional[str] = None


class MeetingTranscriptRequest(ORMBaseModel):
    transcript: str
    notes: Optional[str] = None


class MeetingRead(ORMBaseModel):
    id: int
    title: str
    scheduled_at: str
    department: str
    status: str
    notes: Optional[str] = None
    agenda: Optional[str] = None
    meeting_mode: str
    meeting_link: Optional[str] = None
    location: Optional[str] = None
    ai_summary: Optional[str] = None
    created_by: int
    created_at: str
    attendees: list[dict] = Field(default_factory=list)
    action_items: list[dict] = Field(default_factory=list)
