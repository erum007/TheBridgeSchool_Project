from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from ..database import Base


class EmailTemplate(Base):
    __tablename__ = 'email_templates'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    attachments = Column(JSON, nullable=True, default=list)
    created_by = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    created_by_user = relationship('User', back_populates='email_templates_created', foreign_keys=[created_by])
