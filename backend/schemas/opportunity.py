from __future__ import annotations

from typing import Optional

from .common import ORMBaseModel


class OpportunityCreate(ORMBaseModel):
    title: str
    eligibility: str
    deadline: Optional[str] = None
    link: Optional[str] = None


class OpportunityRead(ORMBaseModel):
    id: int
    title: str
    eligibility: str
    deadline: str | None = None
    link: str | None = None
    created_by: int
    created_by_name: str | None = None
    created_at: str
