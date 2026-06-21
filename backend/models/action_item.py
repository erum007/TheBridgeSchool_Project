from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Column, Date, DateTime, Enum as SQLEnum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from ..database import Base
from .common import ActionItemStatus


class ActionItem(Base):
    __tablename__ = 'action_items'

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey('meetings.id', ondelete='CASCADE'), nullable=False)
    description = Column(String(500), nullable=False)
    assigned_to = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    status = Column(SQLEnum(ActionItemStatus), nullable=False, default=ActionItemStatus.todo)
    due_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    meeting = relationship('Meeting', back_populates='action_items')
    assigned_to_user = relationship('User', back_populates='assigned_action_items', foreign_keys=[assigned_to])
