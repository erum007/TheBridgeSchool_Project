from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from ..dependencies import get_current_user, get_db, require_roles
from ..models import User, UserRole, WhatsAppLog
from ..schemas import WhatsAppSendRequest
from ..services.serialization import serialize_whatsapp_log
from ..services.whatsapp_service import send_whatsapp_message


router = APIRouter(prefix='/api/whatsapp', tags=['whatsapp'])


@router.post('/send')
def send_whatsapp(payload: WhatsAppSendRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    log = WhatsAppLog(
        recipient_name=payload.recipient_name,
        phone_number=payload.phone_number,
        message=payload.message,
        sent_by=current_user.id,
    )
    db.add(log)
    db.flush()
    send_whatsapp_message(log)
    db.commit()
    db.refresh(log)
    log = db.query(WhatsAppLog).options(selectinload(WhatsAppLog.sent_by_user)).filter(WhatsAppLog.id == log.id).first()
    return serialize_whatsapp_log(log)


@router.get('/log')
def list_log(db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.admin))):
    logs = db.query(WhatsAppLog).options(selectinload(WhatsAppLog.sent_by_user)).order_by(WhatsAppLog.sent_at.desc()).all()
    return [serialize_whatsapp_log(log) for log in logs]
