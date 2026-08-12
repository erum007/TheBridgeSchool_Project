from __future__ import annotations

import json
import logging
import time

from ..config import settings
from ..models import Notification, PushSubscription


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
    return notification


def _send_web_push(db, recipient_id: int, title: str, body: str, link: str | None) -> None:
    """Best-effort delivery: a push outage must never block the portal action."""
    if not settings.vapid_public_key or not settings.vapid_private_key:
        return
    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        logger.warning('Web push is configured but pywebpush is not installed')
        return
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
    for subscription in db.query(PushSubscription).filter(PushSubscription.user_id == recipient_id).all():
        try:
            webpush(
                subscription_info={'endpoint': subscription.endpoint, 'keys': {'p256dh': subscription.p256dh, 'auth': subscription.auth}},
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={'sub': subject},
                timeout=10,
            )
        except WebPushException as exc:
            status_code = getattr(getattr(exc, 'response', None), 'status_code', None)
            if status_code in {404, 410}:
                db.delete(subscription)
            else:
                logger.warning('Web push delivery failed for subscription %s: %s', subscription.id, exc)
        except Exception:
            logger.exception('Unexpected web push delivery failure for subscription %s', subscription.id)
