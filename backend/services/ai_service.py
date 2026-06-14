from __future__ import annotations

import requests

from ..config import settings


def generate_meeting_summary(notes: str | None) -> str:
    text = (notes or '').strip()
    if not text:
        return 'No notes were captured for this meeting.'

    if not settings.gemini_api_key:
        return f'Summary: {text[:240]}'

    endpoint = (
        'https://generativelanguage.googleapis.com/v1beta/models/'
        'gemini-2.0-flash:generateContent'
    )
    response = requests.post(
        endpoint,
        params={'key': settings.gemini_api_key},
        json={
            'contents': [
                {
                    'parts': [
                        {'text': 'Summarise these meeting notes in 3 concise bullet points:\n' + text},
                    ],
                }
            ]
        },
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    candidates = payload.get('candidates') or []
    if not candidates:
        return f'Summary: {text[:240]}'
    parts = candidates[0].get('content', {}).get('parts', [])
    return ''.join(part.get('text', '') for part in parts).strip() or f'Summary: {text[:240]}'
