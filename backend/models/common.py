from __future__ import annotations

from enum import Enum

from sqlalchemy import Column, ForeignKey, Integer, Table

from ..database import Base


class UserRole(str, Enum):
    admin = 'admin'
    teacher = 'teacher'
    staff = 'staff'
    student = 'student'
    parent = 'parent'


class MeetingStatus(str, Enum):
    upcoming = 'upcoming'
    ongoing = 'ongoing'
    past = 'past'


class ActionItemStatus(str, Enum):
    todo = 'todo'
    in_progress = 'in_progress'
    done = 'done'


class EmailStatus(str, Enum):
    draft = 'draft'
    scheduled = 'scheduled'
    sent = 'sent'
    failed = 'failed'


class NoticeStatus(str, Enum):
    published = 'published'
    draft = 'draft'


class NoticeRecipients(str, Enum):
    all = 'all'
    students = 'students'
    parents = 'parents'
    teachers = 'teachers'
    staff = 'staff'
    department = 'department'


class WhatsAppStatus(str, Enum):
    sent = 'sent'
    delivered = 'delivered'
    read = 'read'
    failed = 'failed'


meeting_attendees = Table(
    'meeting_attendees',
    Base.metadata,
    Column('meeting_id', ForeignKey('meetings.id', ondelete='CASCADE'), primary_key=True),
    Column('user_id', ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
)


parent_student_links = Table(
    'parent_student_links',
    Base.metadata,
    Column('parent_id', ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    Column('student_id', ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
)


teacher_student_links = Table(
    'teacher_student_links',
    Base.metadata,
    Column('teacher_id', ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    Column('student_id', ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
)


user_departments = Table(
    'user_departments',
    Base.metadata,
    Column('user_id', ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    Column('department_id', ForeignKey('departments.id', ondelete='CASCADE'), primary_key=True),
)


notice_department_groups = Table(
    'notice_department_groups',
    Base.metadata,
    Column('notice_id', ForeignKey('notices.id', ondelete='CASCADE'), primary_key=True),
    Column('department_id', ForeignKey('departments.id', ondelete='CASCADE'), primary_key=True),
)


notice_user_groups = Table(
    'notice_user_groups',
    Base.metadata,
    Column('notice_id', ForeignKey('notices.id', ondelete='CASCADE'), primary_key=True),
    Column('user_id', ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
)
