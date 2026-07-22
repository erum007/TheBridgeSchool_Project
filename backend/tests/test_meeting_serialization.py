from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import unittest

from backend.services.serialization import serialize_meeting


def meeting_with(status, scheduled_at):
    return SimpleNamespace(
        id=1,
        title='Planning meeting',
        scheduled_at=scheduled_at,
        department='Academic',
        status=status,
        notes=None,
        agenda=None,
        meeting_mode='in_person',
        meeting_link=None,
        location=None,
        ai_summary=None,
        created_by=1,
        created_at=datetime.now(timezone.utc),
        attendees=[],
        action_items=[],
    )


class MeetingSerializationTests(unittest.TestCase):
    def test_past_scheduled_meeting_is_serialized_as_past(self):
        meeting = meeting_with('upcoming', datetime.now(timezone.utc) - timedelta(minutes=1))

        self.assertEqual(serialize_meeting(meeting)['status'], 'past')

    def test_future_meeting_keeps_its_stored_status(self):
        meeting = meeting_with('upcoming', datetime.now(timezone.utc) + timedelta(minutes=1))

        self.assertEqual(serialize_meeting(meeting)['status'], 'upcoming')

    def test_cancelled_meeting_is_not_overridden_by_date(self):
        meeting = meeting_with('cancelled', datetime.now(timezone.utc) - timedelta(minutes=1))

        self.assertEqual(serialize_meeting(meeting)['status'], 'cancelled')
