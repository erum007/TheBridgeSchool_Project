from __future__ import annotations

import logging
import mimetypes
import os
import re
import smtplib
from pathlib import Path
from urllib.parse import urlparse
from datetime import datetime, timezone
from collections import defaultdict
from datetime import date, datetime, timezone
from email.message import EmailMessage
from email.utils import formataddr

from ..config import settings
from ..models import EmailStatus


logger = logging.getLogger(__name__)


_ALIGNMENTS = {
    'ql-align-center': 'center',
    'ql-align-right': 'right',
    'ql-align-justify': 'justify',
}


def _add_style(tag: str, style: str) -> str:
    style_match = re.search(r'style=("|\')([^"\']*)("|\')', tag, flags=re.IGNORECASE)
    if style_match:
        existing = style_match.group(2).rstrip(';')
        replacement = f'style="{existing}; {style}"'
        return tag[:style_match.start()] + replacement + tag[style_match.end():]
    return f'{tag[:-1]} style="{style}">'


def _inline_quill_styles(html_body: str) -> str:
    """Translate Quill CSS classes to inline styles supported by email clients."""
    def aligned_paragraph(match: re.Match) -> str:
        attributes = match.group('attributes')
        class_match = re.search(r'class=("|\')([^"\']*)("|\')', attributes, flags=re.IGNORECASE)
        classes = class_match.group(2).split() if class_match else []
        alignment = next((value for name, value in _ALIGNMENTS.items() if name in classes), None)
        if not alignment:
            return match.group(0)

        # Tables give Gmail and Outlook a dependable full-width alignment context.
        return (
            f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" '
            f'style="width:100%; border-collapse:collapse;"><tr>'
            f'<td align="{alignment}" style="padding:0 0 12px; text-align:{alignment};">'
            f'{match.group("content")}</td></tr></table>'
        )

    html_body = re.sub(
        r'<p(?P<attributes>[^>]*)>(?P<content>.*?)</p>',
        aligned_paragraph,
        html_body,
        flags=re.IGNORECASE | re.DOTALL,
    )

    def format_tag(match: re.Match) -> str:
        tag = match.group(0)
        class_match = re.search(r'class=("|\')([^"\']*)("|\')', tag, flags=re.IGNORECASE)
        if not class_match:
            return tag
        classes = class_match.group(2).split()
        alignment = next((value for name, value in _ALIGNMENTS.items() if name in classes), None)
        if not alignment:
            return tag
        formatted = _add_style(tag, f'text-align: {alignment}')
        if alignment in {'left', 'center', 'right'}:
            formatted = formatted[:-1] + f' align="{alignment}">'
        return formatted

    html_body = re.sub(r'<(?:p|div|h[1-6]|li|blockquote)\b[^>]*>', format_tag, html_body, flags=re.IGNORECASE)
    html_body = re.sub(
        r'<img\b[^>]*>',
        lambda match: _add_style(match.group(0), 'max-width: 100%; height: auto;'),
        html_body,
        flags=re.IGNORECASE,
    )

    def email_table(match: re.Match) -> str:
        tag = _add_style(match.group(0), 'width: 100%; border-collapse: collapse; margin: 12px 0;')
        if not re.search(r'\bwidth=', tag, flags=re.IGNORECASE):
            tag = tag[:-1] + ' width="100%">'
        if not re.search(r'\bcellpadding=', tag, flags=re.IGNORECASE):
            tag = tag[:-1] + ' cellpadding="0">'
        if not re.search(r'\bcellspacing=', tag, flags=re.IGNORECASE):
            tag = tag[:-1] + ' cellspacing="0">'
        return tag

    html_body = re.sub(r'<table\b[^>]*>', email_table, html_body, flags=re.IGNORECASE)
    html_body = re.sub(
        r'<t[dh]\b[^>]*>',
        lambda match: _add_style(match.group(0), 'border: 1px solid #d9dce6; padding: 10px; vertical-align: top; text-align: left;'),
        html_body,
        flags=re.IGNORECASE,
    )
    return html_body


def _embed_uploaded_images(html_body: str) -> tuple[str, list[tuple[bytes, str, str, str]]]:
    """Replace locally uploaded image URLs with CID references for reliable delivery."""
    inline_images = []

    def replace_source(match: re.Match) -> str:
        source = match.group(2)
        parsed = urlparse(source)
        if '/uploads/' not in parsed.path:
            return match.group(0)
        filename = os.path.basename(parsed.path)
        path = Path('uploads') / filename
        if not path.is_file():
            return match.group(0)
        mime_type, _ = mimetypes.guess_type(filename)
        if not mime_type or not mime_type.startswith('image/'):
            return match.group(0)
        try:
            content_id = f'image-{filename}'
            with path.open('rb') as image_file:
                inline_images.append((image_file.read(), mime_type.split('/', 1)[1], content_id, filename))
            quote = match.group(1)
            return f'src={quote}cid:{content_id}{quote}'
        except OSError:
            logger.warning('Inline email image is unavailable: %s', path)
            return match.group(0)

    return re.sub(r'src=("|\')([^"\']+)("|\')', replace_source, html_body, flags=re.IGNORECASE), inline_images


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
    attachments: list[tuple[str, str]] | None = None,
) -> bool:
    logger.info("[reminder-debug] send_plain_email entered for %s", to_email)
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
        rendered_html = _inline_quill_styles(html_body)
        rendered_html, inline_images = _embed_uploaded_images(rendered_html)
        message.add_alternative(rendered_html, subtype="html")
        html_part = message.get_payload()[-1]
        for image_data, subtype, content_id, filename in inline_images:
            html_part.add_related(
                image_data,
                maintype='image',
                subtype=subtype,
                cid=f'<{content_id}>',
                filename=filename,
            )

    for path, filename in attachments or []:
        try:
            with open(path, "rb") as attachment_file:
                data = attachment_file.read()
            mime_type, _ = mimetypes.guess_type(filename)
            maintype, subtype = (mime_type or "application/octet-stream").split("/", 1)
            message.add_attachment(data, maintype=maintype, subtype=subtype, filename=filename)
        except OSError:
            logger.warning("Email attachment is unavailable: %s", path)

    try:
        logger.info("[reminder-debug] about to call smtplib.send_message for %s", to_email)
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(settings.gmail_sender, settings.gmail_app_password)
            server.send_message(message)

        return True

    except Exception:
        logger.exception("Failed to send email to %s", to_email)
        return False


def send_email_record(email_record, immediate: bool = True):
    """Update an email record to reflect whether it was sent immediately or scheduled."""
    if immediate:
        email_record.status = EmailStatus.sent
        email_record.sent_at = datetime.now(timezone.utc)
    else:
        email_record.status = EmailStatus.scheduled
    return email_record


def send_gmail_message(to_email: str, subject: str, body: str) -> bool:
    """Send a reminder email using the SMTP helper when credentials are present."""
    if settings.gmail_sender and settings.gmail_app_password:
        return send_plain_email(to_email, subject, body)
    if not settings.gmail_client_id or not settings.gmail_client_secret:
        return False
    return True


def _is_completed(status) -> bool:
    """Return True when an action-item status indicates completion."""
    if status is None:
        return False
    if hasattr(status, 'value'):
        status_value = status.value
    else:
        status_value = status
    return str(status_value).lower() in {'done', 'completed', 'complete'}


def send_action_item_reminders(action_items) -> int:
    """Send reminders for due or overdue action items, grouped by assignee."""
    today = date.today()
    grouped: dict[int, list] = defaultdict(list)
    total_items = len(action_items or [])
    completed_skipped = 0
    missing_due_date_skipped = 0
    future_due_date_skipped = 0
    missing_assignee_skipped = 0
    missing_email_skipped = 0

    logger.info('[reminder-debug] send_action_item_reminders received %s action items', total_items)

    for action_item in action_items or []:
        if _is_completed(getattr(action_item, 'status', None)):
            completed_skipped += 1
            continue
        due_date = getattr(action_item, 'due_date', None)
        if due_date is None:
            missing_due_date_skipped += 1
            continue
        if isinstance(due_date, str):
            try:
                due_date = datetime.fromisoformat(due_date).date()
            except ValueError:
                missing_due_date_skipped += 1
                continue
        if due_date > today:
            future_due_date_skipped += 1
            continue
        assignee_id = getattr(action_item, 'assigned_to', None)
        if assignee_id is None:
            missing_assignee_skipped += 1
            continue
        grouped[assignee_id].append(action_item)

    logger.info(
        '[reminder-debug] summary skipped completed=%s missing_due_date=%s future_due_date=%s missing_assignee=%s',
        completed_skipped,
        missing_due_date_skipped,
        future_due_date_skipped,
        missing_assignee_skipped,
    )

    reminder_items = 0
    for assignee_id, items in grouped.items():
        assignee = getattr(items[0], 'assigned_to_user', None)
        if not assignee:
            missing_email_skipped += 1
            continue
        if not assignee.email:
            missing_email_skipped += 1
            continue
        body_lines = [f'Hello {assignee.name}, here are your pending action items:']
        for item in items:
            due_label = item.due_date.isoformat() if hasattr(item.due_date, 'isoformat') else str(item.due_date)
            body_lines.append(f'- {item.description} (due {due_label})')
        send_gmail_message(assignee.email, 'Action item reminder', '\n'.join(body_lines))
        reminder_items += len(items)

    logger.info('[reminder-debug] final send count=%s', reminder_items)
    logger.info('[reminder-debug] skipped missing_email=%s', missing_email_skipped)
    return reminder_items
