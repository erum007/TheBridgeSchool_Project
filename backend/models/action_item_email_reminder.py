from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from ..database import Base


class ActionItemEmailReminder(Base):
    __tablename__ = 'action_item_email_reminders'

    id = Column(Integer, primary_key=True, index=True)
    action_item_id = Column(Integer, ForeignKey('action_items.id', ondelete='CASCADE'), nullable=False, unique=True)
    frequency = Column(String(16), nullable=False)  # hourly, daily, weekly, custom
    run_at = Column(DateTime, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    last_sent_at = Column(DateTime, nullable=True)
    created_by = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    action_item = relationship('ActionItem', back_populates='email_reminder')
    created_by_user = relationship('User', foreign_keys=[created_by])
