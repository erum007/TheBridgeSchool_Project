from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi import UploadFile, File
import uuid
import os
from sqlalchemy.orm import Session, selectinload

from ..database import SessionLocal
from ..dependencies import get_current_user, get_db, require_roles
from ..models import EmailStatus, EmailTemplate, ScheduledEmail, User, UserRole
from ..schemas import EmailSendRequest, EmailTemplateCreate, ScheduledEmailCreate
from ..services.email_service import send_email_record, send_plain_email
from ..services.scheduler_service import ensure_scheduler_started
from ..services.serialization import serialize_email_template, serialize_scheduled_email


router = APIRouter(prefix='/api', tags=['emails'])


def _parse_datetime(value: str | None):
    if not value:
        return None
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def _resolve_recipients(db: Session, recipient_group: str) -> list[str]:
    """
    Resolve recipient_group to a list of email addresses.
    recipient_group can be: 'all_parents', 'all_students', 'all_teachers',
    'all', or a raw email address.
    """
    role_map = {
        'all_parents': UserRole.parent,
        'all_students': UserRole.student,
        'all_teachers': UserRole.teacher,
    }
    if recipient_group in role_map:
        users = db.query(User).filter(
            User.role == role_map[recipient_group],
            User.is_active == True,
        ).all()
        return [user.email for user in users if user.email]
    if recipient_group == 'all':
        users = db.query(User).filter(User.is_active == True).all()
        return [user.email for user in users if user.email]
    return [recipient_group]


def _schedule_delivery(email_id: int, run_at: datetime):
    scheduler = ensure_scheduler_started()

    def _deliver():
        db = SessionLocal()
        try:
            email_record = db.get(ScheduledEmail, email_id)
            if not email_record:
                return
            recipients = _resolve_recipients(db, email_record.recipient_group)
            sent = 0
            failed = 0
            for to_email in recipients:
                success = send_plain_email(to_email, email_record.subject, email_record.body)
                if success:
                    sent += 1
                else:
                    failed += 1
            email_record.status = EmailStatus.sent
            email_record.sent_at = datetime.now(timezone.utc)
            db.commit()
        except Exception:
            pass
        finally:
            db.close()

    scheduler.add_job(_deliver, 'date', run_date=run_at, id=f'email-{email_id}', replace_existing=True)


@router.get('/emails')
def list_emails(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(ScheduledEmail).options(selectinload(ScheduledEmail.created_by_user), selectinload(ScheduledEmail.template)).order_by(ScheduledEmail.created_at.desc())
    if current_user.role != UserRole.admin:
        query = query.filter(ScheduledEmail.created_by == current_user.id)
    return [serialize_scheduled_email(email) for email in query.all()]


@router.post('/emails/send')
def send_email(payload: EmailSendRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    email_record = ScheduledEmail(
        recipient_group=payload.recipient_group,
        subject=payload.subject,
        body=payload.body,
        template_id=payload.template_id,
        scheduled_at=_parse_datetime(payload.scheduled_at),
        created_by=current_user.id,
        status=EmailStatus.draft,
    )
    db.add(email_record)
    db.flush()
    if payload.scheduled_at:
        email_record.status = EmailStatus.scheduled
        db.commit()
        db.refresh(email_record)
        _schedule_delivery(email_record.id, email_record.scheduled_at)
    else:
        recipients = _resolve_recipients(db, payload.recipient_group)
        for to_email in recipients:
            send_plain_email(to_email, payload.subject, payload.body)
        email_record.status = EmailStatus.sent
        email_record.sent_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(email_record)
    return serialize_scheduled_email(email_record)


@router.post('/emails/schedule')
def schedule_email(payload: ScheduledEmailCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not payload.scheduled_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='scheduled_at is required')
    email_record = ScheduledEmail(
        recipient_group=payload.recipient_group,
        subject=payload.subject,
        body=payload.body,
        template_id=payload.template_id,
        scheduled_at=_parse_datetime(payload.scheduled_at),
        created_by=current_user.id,
        status=EmailStatus.scheduled,
    )
    db.add(email_record)
    db.commit()
    db.refresh(email_record)
    _schedule_delivery(email_record.id, email_record.scheduled_at)
    return serialize_scheduled_email(email_record)


@router.delete('/emails/{email_id}')
def delete_email(email_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    email_record = db.get(ScheduledEmail, email_id)
    if not email_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Email not found')
    if current_user.role != UserRole.admin and email_record.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')
    db.delete(email_record)
    db.commit()
    return {'detail': 'Email deleted'}


@router.get('/email-templates')
def list_templates(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(EmailTemplate).options(selectinload(EmailTemplate.created_by_user)).order_by(EmailTemplate.created_at.desc())
    if current_user.role != UserRole.admin:
        query = query.filter(EmailTemplate.created_by == current_user.id)
    return [serialize_email_template(template) for template in query.all()]


@router.post('/email-templates')
def create_template(payload: EmailTemplateCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    template = EmailTemplate(name=payload.name, subject=payload.subject, body=payload.body, created_by=current_user.id)
    db.add(template)
    db.commit()
    db.refresh(template)
    template = db.query(EmailTemplate).options(selectinload(EmailTemplate.created_by_user)).filter(EmailTemplate.id == template.id).first()
    return serialize_email_template(template)


@router.delete('/email-templates/{template_id}')
def delete_template(template_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    template = db.get(EmailTemplate, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Template not found')
    if current_user.role != UserRole.admin and template.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')
    db.delete(template)
    db.commit()
    return {'detail': 'Template deleted'}

UPLOAD_FOLDER = "uploads"

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@router.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    extension = file.filename.split(".")[-1]

    filename = f"{uuid.uuid4()}.{extension}"

    filepath = os.path.join(UPLOAD_FOLDER, filename)

    with open(filepath, "wb") as buffer:
        buffer.write(await file.read())

    return {
        "url": f"http://localhost:8000/uploads/{filename}"
    }

@router.put("/email-templates/{template_id}")
def update_template(
    template_id: int,
    payload: EmailTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    template = db.get(EmailTemplate, template_id)

    if not template:
        raise HTTPException(404, "Template not found")

    if (
        current_user.role != UserRole.admin
        and template.created_by != current_user.id
    ):
        raise HTTPException(403, "Insufficient permissions")

    template.name = payload.name
    template.subject = payload.subject
    template.body = payload.body

    db.commit()
    db.refresh(template)

    return serialize_email_template(template)