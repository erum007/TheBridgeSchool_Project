from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from ..database import Base


class Result(Base):
    __tablename__ = 'results'

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    subject = Column(String(120), nullable=False)
    grade = Column(Float, nullable=False)
    class_average = Column(Float, nullable=False)
    attendance = Column(Float, nullable=False)
    term = Column(String(80), nullable=False)
    uploaded_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    batch_id = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    student = relationship('User', back_populates='results', foreign_keys=[student_id])
    uploaded_by_user = relationship('User', back_populates='uploaded_results', foreign_keys=[uploaded_by])
