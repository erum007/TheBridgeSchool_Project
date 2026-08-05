from __future__ import annotations

from ..models import Notification


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
    return notification
