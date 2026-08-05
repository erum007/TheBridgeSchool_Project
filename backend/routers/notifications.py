from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..dependencies import get_current_user, get_db
from ..models import Notification, User
from ..services.serialization import serialize_notification


router = APIRouter(prefix='/api/notifications', tags=['notifications'])


@router.get('')
def list_notifications(
    limit: int | None = Query(default=None, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Notification).filter(Notification.recipient_id == current_user.id).order_by(Notification.created_at.desc())
    if limit:
        query = query.limit(limit)
    notifications = query.all()
    return {
        'notifications': [serialize_notification(notification) for notification in notifications],
        'unread_count': db.query(Notification).filter(Notification.recipient_id == current_user.id, Notification.is_read == False).count(),
    }


@router.patch('/{notification_id}/read')
def mark_notification_read(notification_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    notification = db.query(Notification).filter(Notification.id == notification_id, Notification.recipient_id == current_user.id).first()
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Notification not found')
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return serialize_notification(notification)


@router.post('/read-all')
def mark_all_notifications_read(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(Notification).filter(Notification.recipient_id == current_user.id, Notification.is_read == False).update({'is_read': True}, synchronize_session=False)
    db.commit()
    return {'detail': 'All notifications marked as read'}
