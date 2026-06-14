from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from ..database import Base


class Opportunity(Base):
    __tablename__ = 'opportunities'

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    eligibility = Column(String(255), nullable=False)
    deadline = Column(Date, nullable=True)
    link = Column(String(500), nullable=True)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    created_by_user = relationship('User', back_populates='opportunities_created', foreign_keys=[created_by])
