from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, DateTime, Enum as SQLEnum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from ..database import Base
from .common import WhatsAppStatus


class WhatsAppLog(Base):
    __tablename__ = 'whatsapp_logs'

    id = Column(Integer, primary_key=True, index=True)
    recipient_name = Column(String(120), nullable=False)
    phone_number = Column(String(32), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(SQLEnum(WhatsAppStatus), nullable=False, default=WhatsAppStatus.sent)
    sent_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    sent_by = Column(Integer, ForeignKey('users.id'), nullable=False)

    sent_by_user = relationship('User', back_populates='whatsapp_logs_sent', foreign_keys=[sent_by])
