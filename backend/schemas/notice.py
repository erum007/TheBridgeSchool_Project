from __future__ import annotations

from typing import List, Optional

from .common import ORMBaseModel


class NoticeCreate(ORMBaseModel):
    title: str
    body: str
    recipient_roles: List[str] = []
    recipient_department_ids: List[int] = []
    recipient_user_ids: List[int] = []
    status: str = 'draft'
    publish_datetime: Optional[str] = None


class NoticeUpdate(ORMBaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    recipient_roles: Optional[List[str]] = None
    recipient_department_ids: Optional[List[int]] = None
    recipient_user_ids: Optional[List[int]] = None
    status: Optional[str] = None
    publish_datetime: Optional[str] = None


class NoticeRead(ORMBaseModel):
    id: int
    title: str
    body: str
    recipient_roles: List[str] = []
    recipient_department_ids: List[int] = []
    recipient_department_names: List[str] = []
    recipient_users: List[dict] = []
    status: str
    publish_datetime: Optional[str] = None
    created_by: int
    created_by_name: Optional[str] = None
    created_at: str
