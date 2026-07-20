from __future__ import annotations

from typing import Optional

from pydantic import Field

from .common import ORMBaseModel


class UserCreate(ORMBaseModel):
    name: str = Field(min_length=1)
    email: str = Field(min_length=3)
    password: str = Field(min_length=12)
    role: str = Field(min_length=1)
    head_teacher: bool = False
    whatsapp_number: Optional[str] = None
    department: Optional[str] = None
    is_active: bool = True


class UserUpdateSettings(ORMBaseModel):
    whatsapp_number: Optional[str] = None


class UserAdminUpdate(ORMBaseModel):
    department: Optional[str] = None


class UserRead(ORMBaseModel):
    id: int
    name: str
    email: str
    role: str
    head_teacher: bool
    whatsapp_number: Optional[str] = None
    department: Optional[str] = None
    is_active: bool
    created_at: str
