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
    department: Optional[str] = None
    is_active: bool = True


class UserUpdateSettings(ORMBaseModel):
    name: Optional[str] = None
    profile_picture_url: Optional[str] = None
    email_notifications_enabled: Optional[bool] = None


class UserAdminUpdate(ORMBaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    email: Optional[str] = Field(default=None, min_length=3)
    role: Optional[str] = None
    head_teacher: Optional[bool] = None
    is_active: Optional[bool] = None
    department: Optional[str] = None


class GuardianRegistration(ORMBaseModel):
    """A guardian is either created with the student or matched by email."""
    name: str = Field(min_length=1)
    email: str = Field(min_length=3)


class StudentRegistration(ORMBaseModel):
    name: str = Field(min_length=1)
    email: str = Field(min_length=3)
    password: str = Field(min_length=12)
    guardians: list[GuardianRegistration] = Field(min_length=1, max_length=2)


class ParentLinkCreate(ORMBaseModel):
    parent_id: int


class TeacherLinkCreate(ORMBaseModel):
    teacher_id: int


class UserRead(ORMBaseModel):
    id: int
    name: str
    email: str
    role: str
    head_teacher: bool
    department: Optional[str] = None
    is_active: bool
    created_at: str
