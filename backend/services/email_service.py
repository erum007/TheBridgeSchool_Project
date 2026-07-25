from __future__ import annotations

import logging
import mimetypes
import os
import re
import smtplib
from pathlib import Path
from urllib.parse import urlparse
from datetime import datetime, timezone
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
    return re.sub(
        r'<img\b[^>]*>',
        lambda match: _add_style(match.group(0), 'max-width: 100%; height: auto;'),
        html_body,
        flags=re.IGNORECASE,
    )


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
