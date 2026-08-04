from __future__ import annotations

from datetime import date

from pydantic import Field, field_validator

from .common import ORMBaseModel


class OpportunityCreate(ORMBaseModel):
    title: str = Field(min_length=1)
    eligibility: str = Field(min_length=1)
    deadline: date
    link: str = Field(min_length=1)

    @field_validator('title', 'eligibility', 'link')
    @classmethod
    def required_values_cannot_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError('This field is required')
        return value


class OpportunityRead(ORMBaseModel):
    id: int
    title: str
    eligibility: str
    deadline: str | None = None
    link: str | None = None
    created_by: int
    created_by_name: str | None = None
    created_at: str
