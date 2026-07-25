from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, DateTime, Enum as SQLEnum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from ..database import Base
from .common import MeetingStatus, meeting_attendees


class Meeting(Base):
    __tablename__ = 'meetings'

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    scheduled_at = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)
    department = Column(String(120), nullable=False)
    agenda = Column(Text, nullable=True)
    meeting_mode = Column(String(24), nullable=False, default='in_person')
    meeting_link = Column(String(1000), nullable=True)
    location = Column(String(500), nullable=True)
    status = Column(SQLEnum(MeetingStatus), nullable=False, default=MeetingStatus.upcoming)
    notes = Column(Text, nullable=True)
    ai_summary = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    created_by_user = relationship('User', back_populates='created_meetings', foreign_keys=[created_by])
    attendees = relationship('User', secondary=meeting_attendees, back_populates='attended_meetings')
    action_items = relationship('ActionItem', back_populates='meeting', cascade='all, delete-orphan')
