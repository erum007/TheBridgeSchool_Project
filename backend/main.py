from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, selectinload

from .database import Base, SessionLocal, engine
from .models import (
    ActionItem,
    ActionItemStatus,
    ActionItemWhatsAppReminder,
    Department,
    EmailStatus,
    EmailTemplate,
    Meeting,
    MeetingStatus,
    Notice,
    NoticeRecipients,
    NoticeStatus,
    Opportunity,
    Result,
    ScheduledEmail,
    User,
    UserRole,
    WhatsAppLog,
    meeting_attendees,
    parent_student_links,
)
from .routers import (
    action_items_router,
    ai_router,
    auth_router,
    dashboard_router,
    departments_router,
    emails_router,
    meetings_router,
    notices_router,
    opportunities_router,
    results_router,
    users_router,
    whatsapp_router,
    restore_scheduled_emails,
)
from .services.auth_service import get_password_hash
from .services.scheduler_service import ensure_scheduler_started
from .services.action_item_whatsapp_reminder_service import restore_reminders
from .services.schema_migration_service import apply_additive_schema_updates


app = FastAPI(title='Bridge School Portal API')
app.mount(
    "/uploads",
    StaticFiles(directory="uploads"),
    name="uploads"
)

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv('CORS_ORIGINS', 'http://localhost:5173').split(',')
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


app.include_router(auth_router)
app.include_router(users_router)
app.include_router(meetings_router)
app.include_router(action_items_router)
app.include_router(emails_router)
app.include_router(results_router)
app.include_router(notices_router)
app.include_router(opportunities_router)
app.include_router(whatsapp_router)
app.include_router(dashboard_router)
app.include_router(departments_router)
app.include_router(ai_router)


def _seed_demo_data(db: Session) -> None:
    def ensure_user(name: str, email: str, role: UserRole, head_teacher: bool = False):
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            return existing
        user = User(
            name=name,
            email=email,
            hashed_password=get_password_hash('password123'),
            role=role,
            head_teacher=head_teacher,
        )
        db.add(user)
        db.flush()
        return user

    admin = ensure_user('Bridge Admin', 'admin@bridge.school', UserRole.admin)
    teacher = ensure_user('Head Teacher', 'teacher@bridge.school', UserRole.teacher, head_teacher=True)
    student = ensure_user('Aisha Khan', 'student@bridge.school', UserRole.student)
    parent = ensure_user('Aisha Parent', 'parent@bridge.school', UserRole.parent)

    if student not in parent.children:
        parent.children.append(student)
    db.flush()

    if db.query(Meeting).first():
        db.commit()
        return

    meeting = Meeting(
        title='Term Planning Meeting',
        scheduled_at=datetime.now(timezone.utc) + timedelta(days=2),
        department='Academic',
        status=MeetingStatus.upcoming,
        notes='Review term milestones, intervention plans, and parent outreach.',
        created_by=admin.id,
    )
    meeting.attendees.extend([admin, teacher])
    db.add(meeting)
    db.flush()

    action_item = ActionItem(
        meeting_id=meeting.id,
        description='Prepare intervention summary for Year 9.',
        assigned_to=teacher.id,
        status=ActionItemStatus.todo,
        due_date=date.today() + timedelta(days=5),
    )
    db.add(action_item)

    template = EmailTemplate(name='Parent Update', subject='Weekly Progress Update', body='Hello [Student Name], your weekly update is attached.', created_by=admin.id)
    db.add(template)
    db.flush()

    scheduled_email = ScheduledEmail(
        template_id=template.id,
        recipient_group='parents',
        subject='Weekly Progress Update',
        body='Hello parents, here is this week\'s update.',
        scheduled_at=datetime.now(timezone.utc) + timedelta(days=1),
        status=EmailStatus.scheduled,
        created_by=admin.id,
    )
    db.add(scheduled_email)

    notice = Notice(
        title='Sports Day Notice',
        body='Sports day is scheduled for next Friday. Please ensure students arrive by 8:00 AM.',
        recipients=NoticeRecipients.all,
        status=NoticeStatus.published,
        publish_date=date.today(),
        created_by=admin.id,
    )
    db.add(notice)

    opportunity = Opportunity(
        title='Science Olympiad',
        eligibility='Students in Years 8-11',
        deadline=date.today() + timedelta(days=12),
        link='https://example.com/science-olympiad',
        created_by=admin.id,
    )
    db.add(opportunity)

    result = Result(
        student_id=student.id,
        subject='Mathematics',
        grade=87.5,
        class_average=78.2,
        attendance=96.0,
        term='Term 1',
        uploaded_by=teacher.id,
        batch_id='demo-batch-1',
    )
    db.add(result)

    log = WhatsAppLog(
        recipient_name=parent.name,
        phone_number='+15555550123',
        message='Aisha achieved 87.5 in Mathematics this term.',
        status='sent',
        sent_by=teacher.id,
    )
    db.add(log)
    db.commit()


def _backfill_department_memberships(db: Session) -> None:
    legacy_users = db.query(User).filter(User.department.isnot(None)).all()
    for user in legacy_users:
        name = user.department.strip() if user.department else ''
        if not name:
            continue
        department = db.query(Department).filter(Department.name == name).first()
        if not department:
            department = Department(name=name)
            db.add(department)
            db.flush()
        if department not in user.departments:
            user.departments.append(department)
    db.commit()


@app.on_event('startup')
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    apply_additive_schema_updates(engine)
    ensure_scheduler_started()
    restore_scheduled_emails()
    restore_reminders()
    db = SessionLocal()
    try:
        _seed_demo_data(db)
        _backfill_department_memberships(db)
    finally:
        db.close()


@app.get('/api/health')
def health_check():
    return {'status': 'ok'}
