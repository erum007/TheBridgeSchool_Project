from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..config import settings
from ..dependencies import get_current_user, get_db
from ..models import DevicePushToken, PushSubscription, User
from ..schemas import DevicePushTokenCreate, PushSubscriptionCreate
from ..services.notification_service import _send_device_push, _send_web_push, notification_link


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


@router.post('/device-tokens')
def save_device_token(payload: DevicePushTokenCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    device = db.query(DevicePushToken).filter(DevicePushToken.token == payload.token).first()
    if device:
        device.user_id, device.platform = current_user.id, payload.platform
    else:
        db.add(DevicePushToken(user_id=current_user.id, token=payload.token, platform=payload.platform))
    db.commit()
    return {'detail': 'This device is registered for this account'}


@router.delete('/device-tokens')
def remove_device_token(payload: DevicePushTokenCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(DevicePushToken).filter(DevicePushToken.token == payload.token, DevicePushToken.user_id == current_user.id).delete(synchronize_session=False)
    db.commit()
    return {'detail': 'This device is no longer registered for this account'}


@router.post('/test')
def send_test_push(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Send a real push request to the current user's browsers and native devices."""
    has_web = db.query(PushSubscription.id).filter(PushSubscription.user_id == current_user.id).first()
    has_native = db.query(DevicePushToken.id).filter(DevicePushToken.user_id == current_user.id).first()
    if not has_web and not has_native:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='This device is not registered for notifications')
    web_result = _send_web_push(
        db,
        current_user.id,
        'Device notification test',
        'Your browser is registered and the server has sent this test notification.',
        notification_link(current_user.role, '/settings'),
    )
    native_result = _send_device_push(db, current_user.id, 'Device notification test', 'Your device is registered and the server has sent this test notification.', notification_link(current_user.role, '/settings'))
    db.commit()
    if web_result['sent'] + native_result['sent'] == 0:
        removed = web_result['removed'] + native_result['removed']
        detail = 'The saved notification registration is no longer valid. Enable device notifications again to repair it.' if removed else 'The push service rejected the notification. Check the server push configuration.'
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)
    return {'detail': 'A test notification was sent to this account\'s registered device(s).'}
