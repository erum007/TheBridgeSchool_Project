from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum as SQLEnum, Integer, String, Text
from sqlalchemy.orm import relationship

from ..database import Base
from .common import UserRole, meeting_attendees, parent_student_links, teacher_student_links, user_departments


class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.teacher)
    head_teacher = Column(Boolean, default=False, nullable=False)
    department = Column(String(120), nullable=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    # Profile images are stored as data URLs.  A VARCHAR column is too small for
    # ordinary phone photos, even after client-side resizing.
    profile_picture_url = Column(Text, nullable=True)
    email_notifications_enabled = Column(Boolean, default=True, nullable=False)
    pending_email = Column(String(255), nullable=True)
    email_change_current_token = Column(String(64), nullable=True)
    email_change_new_token = Column(String(64), nullable=True)
    email_change_expires_at = Column(DateTime, nullable=True)
    password_reset_token = Column(String(64), nullable=True)
    password_reset_expires = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    created_meetings = relationship('Meeting', back_populates='created_by_user', foreign_keys='Meeting.created_by')
    attended_meetings = relationship('Meeting', secondary=meeting_attendees, back_populates='attendees')
    assigned_action_items = relationship('ActionItem', back_populates='assigned_to_user', foreign_keys='ActionItem.assigned_to')
    uploaded_results = relationship('Result', back_populates='uploaded_by_user', foreign_keys='Result.uploaded_by')
    results = relationship('Result', back_populates='student', foreign_keys='Result.student_id')
    notices_created = relationship('Notice', back_populates='created_by_user', foreign_keys='Notice.created_by')
    opportunities_created = relationship('Opportunity', back_populates='created_by_user', foreign_keys='Opportunity.created_by')
    email_templates_created = relationship('EmailTemplate', back_populates='created_by_user', foreign_keys='EmailTemplate.created_by')
    scheduled_emails_created = relationship('ScheduledEmail', back_populates='created_by_user', foreign_keys='ScheduledEmail.created_by')
    notifications = relationship('Notification', back_populates='recipient', cascade='all, delete-orphan')
    push_subscriptions = relationship('PushSubscription', back_populates='user', cascade='all, delete-orphan')
    children = relationship(
        'User',
        secondary=parent_student_links,
        primaryjoin=id == parent_student_links.c.parent_id,
        secondaryjoin=id == parent_student_links.c.student_id,
        backref='guardians',
    )
    students_taught = relationship(
        'User',
        secondary=teacher_student_links,
        primaryjoin=id == teacher_student_links.c.teacher_id,
        secondaryjoin=id == teacher_student_links.c.student_id,
        backref='teachers',
    )
    departments = relationship('Department', secondary=user_departments, back_populates='members')
