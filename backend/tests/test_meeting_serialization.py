from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import unittest

from backend.services.serialization import serialize_meeting


def meeting_with(status, scheduled_at, end_time=None):
    return SimpleNamespace(
        id=1,
        title='Planning meeting',
        scheduled_at=scheduled_at,
        end_time=end_time,
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

    def test_meeting_with_a_future_end_time_is_ongoing_after_its_start(self):
        now = datetime.now(timezone.utc)
        meeting = meeting_with('upcoming', now - timedelta(minutes=30), now + timedelta(minutes=30))

        self.assertEqual(serialize_meeting(meeting)['status'], 'ongoing')

    def test_meeting_is_past_after_its_end_time(self):
        now = datetime.now(timezone.utc)
        meeting = meeting_with('upcoming', now - timedelta(hours=2), now - timedelta(minutes=1))

        self.assertEqual(serialize_meeting(meeting)['status'], 'past')

    def test_future_meeting_with_an_end_time_is_upcoming(self):
        now = datetime.now(timezone.utc)
        meeting = meeting_with('ongoing', now + timedelta(minutes=1), now + timedelta(hours=1))

        self.assertEqual(serialize_meeting(meeting)['status'], 'upcoming')

    def test_meeting_timestamps_are_serialized_as_utc(self):
        meeting = meeting_with('upcoming', datetime(2026, 7, 24, 10, 0), datetime(2026, 7, 24, 11, 0))
        payload = serialize_meeting(meeting)

        self.assertEqual(payload['scheduled_at'], '2026-07-24T10:00:00Z')
        self.assertEqual(payload['end_time'], '2026-07-24T11:00:00Z')

    def test_cancelled_meeting_is_not_overridden_by_date(self):
        meeting = meeting_with('cancelled', datetime.now(timezone.utc) - timedelta(minutes=1))

        self.assertEqual(serialize_meeting(meeting)['status'], 'cancelled')
