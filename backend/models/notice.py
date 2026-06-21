from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, Date, DateTime, Enum as SQLEnum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from ..database import Base
from .common import NoticeRecipients, NoticeStatus


class Notice(Base):
    __tablename__ = 'notices'

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    recipients = Column(SQLEnum(NoticeRecipients), nullable=False, default=NoticeRecipients.all)
    status = Column(SQLEnum(NoticeStatus), nullable=False, default=NoticeStatus.draft)
    publish_date = Column(Date, nullable=True)
    created_by = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    created_by_user = relationship('User', back_populates='notices_created', foreign_keys=[created_by])
