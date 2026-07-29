from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, Enum as SQLEnum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from ..database import Base
from .common import EmailStatus


class ScheduledEmail(Base):
    __tablename__ = 'scheduled_emails'

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey('email_templates.id', ondelete='SET NULL'), nullable=True)
    recipient_group = Column(String(120), nullable=False)
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    preheader = Column(String(255), nullable=True)
    attachments = Column(JSON, nullable=True, default=list)
    scheduled_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    status = Column(SQLEnum(EmailStatus), nullable=False, default=EmailStatus.draft)
    created_by = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    template = relationship('EmailTemplate')
    created_by_user = relationship('User', back_populates='scheduled_emails_created', foreign_keys=[created_by])
