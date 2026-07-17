from __future__ import annotations

from pydantic import Field

from .common import ORMBaseModel


class DepartmentCreate(ORMBaseModel):
    name: str = Field(min_length=1, max_length=120)


class DepartmentMemberUpdate(ORMBaseModel):
    user_id: int
