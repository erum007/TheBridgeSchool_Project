import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from backend.models.common import NoticeStatus, UserRole
from backend.routers.notices import _is_notice_visible, _user_matches_notice


class NoticeVisibilityTests(unittest.TestCase):
    def test_user_matches_notice_for_multiple_roles_and_departments(self):
        notice = SimpleNamespace(
            recipient_roles=['teachers', 'parents'],
            recipient_departments=[SimpleNamespace(id=7)],
            publish_datetime=None,
            status=NoticeStatus.published,
        )
        user = SimpleNamespace(role=UserRole.teacher, departments=[SimpleNamespace(id=7)])

        self.assertTrue(_user_matches_notice(user, notice))

    def test_notice_is_hidden_before_publish_datetime_for_non_admins(self):
        future_notice = SimpleNamespace(
            recipient_roles=[],
            recipient_departments=[],
            publish_datetime=datetime.now(timezone.utc) + timedelta(minutes=10),
            status=NoticeStatus.published,
        )
        user = SimpleNamespace(role=UserRole.student, departments=[])

        self.assertFalse(_is_notice_visible(user, future_notice))

    def test_notice_is_visible_after_publish_datetime(self):
        past_notice = SimpleNamespace(
            recipient_roles=[],
            recipient_departments=[],
            publish_datetime=datetime.now(timezone.utc) - timedelta(minutes=10),
            status=NoticeStatus.published,
        )
        user = SimpleNamespace(role=UserRole.student, departments=[])

        self.assertTrue(_is_notice_visible(user, past_notice))


if __name__ == '__main__':
    unittest.main()
