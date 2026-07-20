from __future__ import annotations

import asyncio
import json
import re
from typing import Any

from google import genai
from google.genai import types

from ..config import settings


class AIServiceError(RuntimeError):
    """Raised when the AI service cannot produce a valid response."""


def _strip_markdown_fences(text: str) -> str:
    """Remove common markdown code fences around JSON-like model output."""
    cleaned = text.strip()
    if not cleaned:
        return cleaned
    if cleaned.startswith('```'):
        cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\s*```$', '', cleaned)
    return cleaned.strip()


def parse_ai_response(raw_response: str | dict[str, Any] | None) -> dict[str, Any]:
    """Normalize raw AI output into the meeting summary/action-item structure used by the API."""
    if not raw_response:
        return {'summary': '', 'key_decisions': [], 'action_items': []}

    if isinstance(raw_response, dict):
        payload = raw_response
    else:
        text = str(raw_response).strip()
        if not text:
            return {'summary': '', 'key_decisions': [], 'action_items': []}
        cleaned_text = _strip_markdown_fences(text)
        try:
            payload = json.loads(cleaned_text)
        except json.JSONDecodeError as exc:
            raise AIServiceError(f'Malformed JSON response from AI service: {cleaned_text}') from exc

    summary = payload.get('summary') or payload.get('meeting_summary') or ''
    decisions = payload.get('key_decisions') or payload.get('decisions') or []
    action_items = payload.get('action_items') or payload.get('actions') or []

    if isinstance(decisions, str):
        decisions = [decisions]
    if not isinstance(decisions, list):
        decisions = []

    if isinstance(action_items, dict):
        action_items = [action_items]
    if not isinstance(action_items, list):
        action_items = []

    normalized_actions: list[dict[str, Any]] = []
    for item in action_items:
        if isinstance(item, dict):
            normalized_actions.append(
                {
                    'task': item.get('task') or item.get('description') or item.get('title') or '',
                    'owner': item.get('owner') or item.get('assigned_to') or '',
                    'due_date': item.get('due_date') or item.get('date') or None,
                }
            )
        elif isinstance(item, str) and item.strip():
            normalized_actions.append({'task': item.strip(), 'owner': '', 'due_date': None})

    return {
        'summary': str(summary).strip(),
        'key_decisions': [str(item).strip() for item in decisions if str(item).strip()],
        'action_items': normalized_actions,
    }


def _build_gemini_client() -> genai.Client:
    """Create a Gemini client using the configured API key."""
    if not settings.gemini_api_key:
        raise AIServiceError('Gemini API key is not configured. Set GEMINI_API_KEY in the backend environment.')
    return genai.Client(api_key=settings.gemini_api_key)


def _build_generate_content_config(response_mime_type: str | None = None) -> Any:
    """Build a Gemini config object compatible with the installed SDK version."""
    config_kwargs: dict[str, Any] = {}
    if response_mime_type:
        config_kwargs['response_mime_type'] = response_mime_type

    try:
        return types.GenerateContentConfig(**config_kwargs, thinking_config={'thinking_level': 'low'})
    except Exception:
        return types.GenerateContentConfig(**config_kwargs)


def _call_gemini_model(prompt: str, response_mime_type: str | None = None) -> str:
    """Send a prompt to Gemini and return the text response body."""
    client = _build_gemini_client()
    config = _build_generate_content_config(response_mime_type)
    try:
        response = client.models.generate_content(
            model='gemini-3.1-flash-lite',
            contents=prompt,
            config=config,
        )
    except Exception as exc:
        raise AIServiceError(f'Gemini API request failed: {exc}') from exc

    text = getattr(response, 'text', None)
    if isinstance(text, str) and text.strip():
        return text.strip()
    if hasattr(response, 'candidates') and response.candidates:
        candidate = response.candidates[0]
        parts = getattr(getattr(candidate, 'content', None), 'parts', None) or []
        if parts:
            return ''.join(getattr(part, 'text', '') or '' for part in parts).strip()
    return ''


def generate_meeting_summary(notes: str | None) -> str:
    """Create a short meeting summary from transcript or note text."""
    text = (notes or '').strip()
    if not text:
        return 'No notes were captured for this meeting.'

    prompt = 'Summarise these meeting notes in 3 concise bullet points:\n' + text
    summary = _call_gemini_model(prompt)
    return summary or f'Summary: {text[:240]}'


def _call_gemini_workspace_api(transcript: str) -> dict[str, Any]:
    """Ask Gemini for structured meeting data from a transcript."""
    prompt = (
        'You are summarising a school meeting transcript. '
        'Return JSON only with these keys: summary, key_decisions, action_items. '
        'The action_items list should contain objects with task, owner, due_date. '
        'Keep the summary concise.\n\nTranscript:\n' + transcript
    )
    response_text = _call_gemini_model(prompt, response_mime_type='application/json')
    return parse_ai_response(response_text or '{}')


async def generate_meeting_workspace(transcript: str) -> dict[str, Any]:
    """Run the Gemini-based meeting workspace extraction asynchronously."""
    if not transcript or not transcript.strip():
        raise AIServiceError('Transcript is required for AI meeting processing.')

    try:
        return await asyncio.to_thread(_call_gemini_workspace_api, transcript.strip())
    except AIServiceError:
        raise
    except Exception as exc:
        raise AIServiceError(f'Unexpected AI service error: {exc}') from exc
