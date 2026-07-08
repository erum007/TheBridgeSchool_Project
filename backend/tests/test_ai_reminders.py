from __future__ import annotations

import asyncio
import sys
from datetime import date, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.services import ai_service, email_service


@pytest.fixture(autouse=True)
def set_gemini_api_key(monkeypatch):
    monkeypatch.setattr(ai_service.settings, 'gemini_api_key', 'test-key')


def test_generate_meeting_workspace_parses_valid_json_response():
    mock_response = SimpleNamespace(text='{"summary": "The team aligned on the launch plan.", "key_decisions": ["Approve the revised plan"], "action_items": [{"task": "Send the follow-up email", "owner": "Nadia", "due_date": "2026-07-15"}] }')

    with patch('backend.services.ai_service.genai.Client') as mock_client_cls:
        mock_client = mock_client_cls.return_value
        mock_client.models.generate_content.return_value = mock_response

        result = asyncio.run(ai_service.generate_meeting_workspace('A meeting transcript'))

    assert result['summary'] == 'The team aligned on the launch plan.'
    assert result['key_decisions'] == ['Approve the revised plan']
    assert result['action_items'][0]['task'] == 'Send the follow-up email'
    assert result['action_items'][0]['owner'] == 'Nadia'
    assert result['action_items'][0]['due_date'] == '2026-07-15'


def test_generate_meeting_workspace_parses_markdown_fenced_json():
    fenced_response = '```json\n{"summary": "The team agreed on a timeline.", "key_decisions": ["Start outreach on Monday"], "action_items": [{"task": "Prepare the slide deck", "owner": "Sam", "due_date": "2026-07-10"}]}\n```'

    parsed = ai_service.parse_ai_response(fenced_response)

    assert parsed['summary'] == 'The team agreed on a timeline.'
    assert parsed['key_decisions'] == ['Start outreach on Monday']
    assert parsed['action_items'][0]['task'] == 'Prepare the slide deck'


def test_generate_meeting_workspace_raises_clear_error_for_malformed_json():
    with patch('backend.services.ai_service.genai.Client') as mock_client_cls:
        mock_client = mock_client_cls.return_value
        mock_client.models.generate_content.return_value = SimpleNamespace(text='{not valid json}')

        with pytest.raises(ai_service.AIServiceError, match='Malformed JSON response'):
            asyncio.run(ai_service.generate_meeting_workspace('A meeting transcript'))


def test_send_action_item_reminders_filters_due_items_and_skips_completed():
    today = date.today()
    assignee = SimpleNamespace(id=2, name='Nadia', email='nadia@example.com')
    items = [
        SimpleNamespace(id=1, description='Prepare the report', assigned_to=2, assigned_to_user=assignee, due_date=today - timedelta(days=1), status='todo'),
        SimpleNamespace(id=2, description='Submit attendance', assigned_to=2, assigned_to_user=assignee, due_date=today, status='todo'),
        SimpleNamespace(id=3, description='Completed already', assigned_to=2, assigned_to_user=assignee, due_date=today, status='done'),
        SimpleNamespace(id=4, description='No due date', assigned_to=2, assigned_to_user=assignee, due_date=None, status='todo'),
        SimpleNamespace(id=5, description='Future task', assigned_to=2, assigned_to_user=assignee, due_date=today + timedelta(days=2), status='todo'),
    ]

    with patch('backend.services.email_service.send_gmail_message') as mock_send:
        sent = email_service.send_action_item_reminders(items)

    assert sent == 2
    assert mock_send.call_count == 1
    assert mock_send.call_args.args[0] == 'nadia@example.com'
    assert mock_send.call_args.args[1] == 'Action item reminder'
    assert 'Prepare the report' in mock_send.call_args.args[2]
    assert 'Submit attendance' in mock_send.call_args.args[2]


def test_send_action_item_reminders_groups_multiple_items_per_assignee_into_one_email():
    today = date.today()
    assignee = SimpleNamespace(id=3, name='Sam', email='sam@example.com')
    other_assignee = SimpleNamespace(id=4, name='Tina', email='tina@example.com')
    items = [
        SimpleNamespace(id=1, description='Review lesson plans', assigned_to=3, assigned_to_user=assignee, due_date=today, status='todo'),
        SimpleNamespace(id=2, description='Confirm parent meeting', assigned_to=3, assigned_to_user=assignee, due_date=today - timedelta(days=1), status='todo'),
        SimpleNamespace(id=3, description='Update attendance sheet', assigned_to=4, assigned_to_user=other_assignee, due_date=today, status='todo'),
    ]

    with patch('backend.services.email_service.send_gmail_message') as mock_send:
        sent = email_service.send_action_item_reminders(items)

    assert sent == 3
    assert mock_send.call_count == 2
    first_call = mock_send.call_args_list[0]
    second_call = mock_send.call_args_list[1]
    assert first_call.args[0] == 'sam@example.com'
    assert first_call.args[1] == 'Action item reminder'
    assert 'Review lesson plans' in first_call.args[2]
    assert 'Confirm parent meeting' in first_call.args[2]
    assert second_call.args[0] == 'tina@example.com'
