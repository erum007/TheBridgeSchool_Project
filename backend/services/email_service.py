from __future__ import annotations

import logging
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import formataddr

from ..config import settings
from ..models import EmailStatus


logger = logging.getLogger(__name__)


# def send_plain_email(to_email: str, subject: str, body: str, html_body: str = None) -> bool:
#     """
#     Send a plain text email via Gmail SMTP using App Password.
#     Returns True on success, False on failure.
#     Logs the error but does not raise - one failure must not stop others.
#     """
#     if not settings.gmail_sender or not settings.gmail_app_password:
#         logger.warning('Gmail sender or app password is not configured')
#         return False

#     message = EmailMessage()
#     message['From'] = formataddr(('The Bridge School', settings.gmail_sender))
#     message['To'] = to_email
#     message['Subject'] = subject
#     message['Reply-To'] = settings.gmail_sender
#     message.set_content(body)
#     if html_body:
#         message.add_alternative(html_body, subtype='html')

#     try:
#         with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
#             server.login(settings.gmail_sender, settings.gmail_app_password)
#             server.send_message(message)
#         return True
#     except Exception:
#         logger.exception('Failed to send email to %s', to_email)
#         return False

def send_plain_email(
    to_email: str,
    subject: str,
    body: str,
    html_body: str = None,
) -> bool:
    """
    Sends an email through Gmail SMTP.

    If html_body is supplied, the recipient receives a proper HTML email
    while plain-text clients fall back to 'body'.
    """
    if not settings.gmail_sender or not settings.gmail_app_password:
        logger.warning("Gmail sender or app password is not configured")
        return False

    message = EmailMessage()

    message["From"] = formataddr(("The Bridge School", settings.gmail_sender))
    message["To"] = to_email
    message["Subject"] = subject
    message["Reply-To"] = settings.gmail_sender

    # Plain-text fallback
    message.set_content(body or "Please view this email in an HTML-compatible email client.")

    # HTML version
    if html_body:
        message.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(settings.gmail_sender, settings.gmail_app_password)
            server.send_message(message)

        return True

    except Exception:
        logger.exception("Failed to send email to %s", to_email)
        return False


def send_email_record(email_record, immediate: bool = True):
    if immediate:
        email_record.status = EmailStatus.sent
        email_record.sent_at = datetime.now(timezone.utc)
    else:
        email_record.status = EmailStatus.scheduled
    return email_record
