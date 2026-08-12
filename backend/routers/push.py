from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..config import settings
from ..dependencies import get_current_user, get_db
from ..models import PushSubscription, User
from ..schemas import PushSubscriptionCreate
from ..services.notification_service import create_notification, notification_link


router = APIRouter(prefix='/api/push', tags=['push notifications'])


@router.get('/public-key')
def public_key():
    if not settings.vapid_public_key or not settings.vapid_private_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail='Web push is not configured')
    return {'public_key': settings.vapid_public_key}


@router.post('/subscriptions')
def save_subscription(payload: PushSubscriptionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p256dh, auth = payload.keys.get('p256dh'), payload.keys.get('auth')
    if not p256dh or not auth:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid push subscription')
    subscription = db.query(PushSubscription).filter(PushSubscription.endpoint == payload.endpoint).first()
    if subscription:
        subscription.user_id, subscription.p256dh, subscription.auth = current_user.id, p256dh, auth
    else:
        db.add(PushSubscription(user_id=current_user.id, endpoint=payload.endpoint, p256dh=p256dh, auth=auth))
    db.commit()
    return {'detail': 'This browser is registered for this account'}


@router.delete('/subscriptions')
def remove_subscription(payload: PushSubscriptionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(PushSubscription).filter(PushSubscription.endpoint == payload.endpoint, PushSubscription.user_id == current_user.id).delete(synchronize_session=False)
    db.commit()
    return {'detail': 'This browser is no longer registered for this account'}


@router.post('/test')
def send_test_push(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Send a real web-push request to the current user's saved devices."""
    if not db.query(PushSubscription.id).filter(PushSubscription.user_id == current_user.id).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='This browser is not registered for device notifications')
    create_notification(
        db,
        current_user.id,
        'Device notification test',
        'Your browser is registered and the server has sent this test notification.',
        'device_test',
        notification_link(current_user.role, '/settings'),
    )
    db.commit()
    return {'detail': 'A test notification was sent to this account\'s registered device(s).'}
