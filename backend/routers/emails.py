from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi import UploadFile, File
import uuid
import os
import re
import logging
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session, selectinload

from ..database import SessionLocal
from ..dependencies import get_current_user, get_db, require_roles
from ..models import EmailStatus, EmailTemplate, ScheduledEmail, User, UserRole
from ..schemas import EmailSendRequest, EmailTemplateCreate, ScheduledEmailCreate
from ..services.email_service import send_email_record, send_plain_email
from ..services.scheduler_service import ensure_scheduler_started
from ..services.serialization import serialize_email_template, serialize_scheduled_email


router = APIRouter(prefix='/api', tags=['emails'])
APP_TIMEZONE = ZoneInfo(os.getenv('APP_TIMEZONE', 'Asia/Karachi'))
logger = logging.getLogger(__name__)


def _parse_datetime(value: str | None):
    if not value:
        return None
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo:
        parsed = parsed.astimezone(APP_TIMEZONE).replace(tzinfo=None)
    return parsed


def _schedule_run_time(value: datetime) -> datetime:
    """Interpret database datetime values in the app timezone before APScheduler runs them."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=APP_TIMEZONE)
    return value.astimezone(timezone.utc)


def _validate_scheduled_at(value: str | None) -> datetime:
    scheduled_at = _parse_datetime(value)
    if not scheduled_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='scheduled_at is required')
    if scheduled_at <= datetime.now(APP_TIMEZONE).replace(tzinfo=None):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Schedule time must be in the future')
    return scheduled_at


def _resolve_recipients(db: Session, recipient_group: str) -> list[str]:
    """
    Resolve recipient_group to a list of email addresses.
    recipient_group can be: 'all_parents', 'all_students', 'all_teachers',
    'all', or a raw email address.
    """
    role_map = {
        'parents': UserRole.parent,
        'students': UserRole.student,
        'teachers': UserRole.teacher,
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
    recipients = [email.strip() for email in re.split(r'[\s,;]+', recipient_group) if email.strip()]
    return list(dict.fromkeys(recipients))


def _attachment_files(attachments: list[dict] | None) -> list[tuple[str, str]]:
    files = []
    for attachment in attachments or []:
        stored_filename = os.path.basename(str(attachment.get("stored_filename", "")))
        display_name = os.path.basename(str(attachment.get("filename", stored_filename)))
        if not stored_filename or stored_filename != attachment.get("stored_filename"):
            continue
        path = os.path.join(UPLOAD_FOLDER, stored_filename)
        if os.path.isfile(path):
            files.append((path, display_name or stored_filename))
    return files


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
                success = send_plain_email(
                    to_email=to_email,
                    subject=email_record.subject,
                    body="Please view this email in an HTML-compatible email client.",
                    html_body=email_record.body,
                    attachments=_attachment_files(email_record.attachments),
                )
                if success:
                    sent += 1
                else:
                    failed += 1
            email_record.status = EmailStatus.sent
            email_record.sent_at = datetime.now(timezone.utc)
            db.commit()
        except Exception:
            logger.exception('Scheduled email delivery failed for email id %s', email_id)
        finally:
            db.close()

    scheduler.add_job(_deliver, 'date', run_date=_schedule_run_time(run_at), id=f'email-{email_id}', replace_existing=True)


def restore_scheduled_emails() -> None:
    """Re-register queued emails after an application restart."""
    db = SessionLocal()
    try:
        now = datetime.now(APP_TIMEZONE).replace(tzinfo=None)
        queued_emails = db.query(ScheduledEmail).filter(
            ScheduledEmail.status == EmailStatus.scheduled,
            ScheduledEmail.scheduled_at > now,
        ).all()
        for email_record in queued_emails:
            _schedule_delivery(email_record.id, email_record.scheduled_at)
    finally:
        db.close()


@router.get('/emails')
def list_emails(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(ScheduledEmail).options(selectinload(ScheduledEmail.created_by_user), selectinload(ScheduledEmail.template)).order_by(ScheduledEmail.created_at.desc())
    if current_user.role != UserRole.admin:
        query = query.filter(ScheduledEmail.created_by == current_user.id)
    return [serialize_scheduled_email(email) for email in query.all()]


@router.post('/emails/draft')
def save_email_draft(payload: EmailSendRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    email_record = ScheduledEmail(
        recipient_group=payload.recipient_group,
        subject=payload.subject,
        body=payload.body,
        attachments=payload.attachments,
        template_id=payload.template_id,
        created_by=current_user.id,
        status=EmailStatus.draft,
    )
    db.add(email_record)
    db.commit()
    db.refresh(email_record)
    return serialize_scheduled_email(email_record)


@router.put('/emails/draft/{email_id}')
def update_email_draft(email_id: int, payload: EmailSendRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    email_record = db.get(ScheduledEmail, email_id)
    if not email_record or email_record.status != EmailStatus.draft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Draft not found')
    if current_user.role != UserRole.admin and email_record.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')
    email_record.recipient_group = payload.recipient_group
    email_record.subject = payload.subject
    email_record.body = payload.body
    email_record.attachments = payload.attachments
    email_record.template_id = payload.template_id
    db.commit()
    db.refresh(email_record)
    return serialize_scheduled_email(email_record)


@router.post('/emails/send')
def send_email(payload: EmailSendRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    scheduled_at = _validate_scheduled_at(payload.scheduled_at) if payload.scheduled_at else None
    email_record = ScheduledEmail(
        recipient_group=payload.recipient_group,
        subject=payload.subject,
        body=payload.body,
        attachments=payload.attachments,
        template_id=payload.template_id,
        scheduled_at=scheduled_at,
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
            send_plain_email(
                to_email=to_email,
                subject=payload.subject,
                body="Please view this email in an HTML-compatible email client.",
                html_body=payload.body,
                attachments=_attachment_files(payload.attachments),
            )
        email_record.status = EmailStatus.sent
        email_record.sent_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(email_record)
    return serialize_scheduled_email(email_record)


@router.post('/emails/schedule')
def schedule_email(payload: ScheduledEmailCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    scheduled_at = _validate_scheduled_at(payload.scheduled_at)
    email_record = ScheduledEmail(
        recipient_group=payload.recipient_group,
        subject=payload.subject,
        body=payload.body,
        attachments=payload.attachments,
        template_id=payload.template_id,
        scheduled_at=scheduled_at,
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
    template = EmailTemplate(name=payload.name, subject=payload.subject, body=payload.body, attachments=payload.attachments, created_by=current_user.id)
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
ALLOWED_DOCUMENT_EXTENSIONS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv"}
MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@router.post("/upload-image")
async def upload_image(request: Request, file: UploadFile = File(...)):
    extension = file.filename.split(".")[-1]

    filename = f"{uuid.uuid4()}.{extension}"

    filepath = os.path.join(UPLOAD_FOLDER, filename)

    with open(filepath, "wb") as buffer:
        buffer.write(await file.read())

    return {
        # PUBLIC_BASE_URL is useful behind a reverse proxy. Otherwise, use the
        # host that accepted the upload request, which works for same-origin deployments.
        "url": f"{os.getenv('PUBLIC_BASE_URL', str(request.base_url)).rstrip('/')}/uploads/{filename}"
    }


@router.post("/upload-email-document")
async def upload_email_document(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    original_name = os.path.basename(file.filename or "document")
    extension = os.path.splitext(original_name)[1].lower()
    if extension not in ALLOWED_DOCUMENT_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF, Office, text, and CSV documents can be uploaded.",
        )

    content = await file.read()
    if len(content) > MAX_DOCUMENT_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Documents must be 10 MB or smaller.",
        )

    filename = f"{uuid.uuid4()}{extension}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    with open(filepath, "wb") as buffer:
        buffer.write(content)

    public_base_url = os.getenv("PUBLIC_BASE_URL", str(request.base_url)).rstrip("/")
    return {
        "url": f"{public_base_url}/uploads/{filename}",
        "filename": original_name,
        "stored_filename": filename,
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
    template.attachments = payload.attachments

    db.commit()
    db.refresh(template)

    return serialize_email_template(template)
