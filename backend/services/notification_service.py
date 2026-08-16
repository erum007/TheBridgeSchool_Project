from __future__ import annotations

import json
import logging
import time

from ..config import settings
from ..models import DevicePushToken, Notification, PushSubscription


logger = logging.getLogger(__name__)


def notification_link(role, destination: str) -> str:
    role_name = getattr(role, 'value', role)
    return f'/{role_name}{destination}'


def create_notification(db, recipient_id: int, title: str, body: str, notification_type: str, link: str | None = None) -> Notification:
    notification = Notification(
        recipient_id=recipient_id,
        title=title.strip()[:255],
        body=body.strip(),
        notification_type=notification_type,
        link=link,
    )
    db.add(notification)
    _send_web_push(db, recipient_id, title, body, link)
    _send_device_push(db, recipient_id, title, body, link)
    return notification


def _send_web_push(db, recipient_id: int, title: str, body: str, link: str | None) -> dict[str, int]:
    """Best-effort delivery: a push outage must never block the portal action."""
    if not settings.vapid_public_key or not settings.vapid_private_key:
        return {'sent': 0, 'failed': 0, 'removed': 0}
    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        logger.warning('Web push is configured but pywebpush is not installed')
        return {'sent': 0, 'failed': 0, 'removed': 0}
    subject = settings.vapid_subject.strip()
    # VAPID requires a contact URI. Accepting a bare email keeps local setup
    # forgiving while still sending the standards-compliant mailto form.
    if '@' in subject and ':' not in subject:
        subject = f'mailto:{subject}'
    # Every event needs its own notification tag. Reusing the title caused a
    # later action reminder to replace an earlier one in the operating-system
    # notification centre, which made scheduled reminders appear to vanish.
    payload = json.dumps({
        'title': title,
        'body': body,
        'link': link or '/',
        'tag': f'bridge-{recipient_id}-{time.time_ns()}',
    })
    result = {'sent': 0, 'failed': 0, 'removed': 0}
    for subscription in db.query(PushSubscription).filter(PushSubscription.user_id == recipient_id).all():
        try:
            webpush(
                subscription_info={'endpoint': subscription.endpoint, 'keys': {'p256dh': subscription.p256dh, 'auth': subscription.auth}},
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={'sub': subject},
                timeout=10,
            )
            result['sent'] += 1
        except WebPushException as exc:
            status_code = getattr(getattr(exc, 'response', None), 'status_code', None)
            if status_code in {404, 410}:
                db.delete(subscription)
                result['removed'] += 1
            else:
                result['failed'] += 1
                logger.warning('Web push delivery failed for subscription %s: %s', subscription.id, exc)
        except Exception:
            result['failed'] += 1
            logger.exception('Unexpected web push delivery failure for subscription %s', subscription.id)
    return result


def _send_device_push(db, recipient_id: int, title: str, body: str, link: str | None) -> dict[str, int]:
    """Best-effort Firebase delivery to installed mobile apps."""
    devices = db.query(DevicePushToken).filter(DevicePushToken.user_id == recipient_id).all()
    result = {'sent': 0, 'failed': 0, 'removed': 0}
    if not devices or not settings.firebase_service_account_json:
        return result
    try:
        import firebase_admin
        from firebase_admin import credentials, messaging
        if not firebase_admin._apps:
            service_account = json.loads(settings.firebase_service_account_json)
            firebase_admin.initialize_app(credentials.Certificate(service_account))
    except Exception:
        logger.exception('Firebase Admin could not be initialized')
        result['failed'] = len(devices)
        return result
    for device in devices:
        try:
            messaging.send(messaging.Message(
                notification=messaging.Notification(title=title[:255], body=body),
                data={
                    'link': link or '/',
                    # Firebasex deliberately suppresses tray notifications while
                    # the app is open unless this string flag is present.
                    'notification_foreground': 'true',
                    'notification_title': title[:255],
                    'notification_body': body,
                },
                token=device.token,
                android=messaging.AndroidConfig(priority='high'),
            ))
            result['sent'] += 1
        except (messaging.UnregisteredError, messaging.SenderIdMismatchError):
            db.delete(device)
            result['removed'] += 1
        except Exception:
            result['failed'] += 1
            logger.exception('Firebase push delivery failed for device %s', device.id)
    return result
