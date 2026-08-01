from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, DateTime, Enum as SQLEnum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from ..database import Base
from .common import NoticeStatus, notice_department_groups, notice_user_groups


class Notice(Base):
    __tablename__ = 'notices'

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    # Comma-separated legacy single-recipient field kept for migration compatibility.
    # New code uses recipient_roles (JSON list) and recipient_departments (relationship).
    recipient_roles = Column(JSON, nullable=False, default=list)
    status = Column(SQLEnum(NoticeStatus), nullable=False, default=NoticeStatus.draft)
    publish_datetime = Column(DateTime, nullable=True)
    created_by = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    created_by_user = relationship('User', back_populates='notices_created', foreign_keys=[created_by])
    recipient_departments = relationship('Department', secondary=notice_department_groups, lazy='selectin')
    recipient_users = relationship('User', secondary=notice_user_groups, lazy='selectin')
