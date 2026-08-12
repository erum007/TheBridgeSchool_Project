from __future__ import annotations

from pydantic import Field

from .common import ORMBaseModel


class PushSubscriptionCreate(ORMBaseModel):
    endpoint: str = Field(min_length=1, max_length=512)
    keys: dict[str, str]
