from sqlalchemy import Text

from backend.models import User, UserRole
from backend.routers.users import update_my_settings
from backend.schemas.user import UserUpdateSettings


class DummyDB:
    def __init__(self):
        self.commit_calls = 0
        self.refreshed = []

    def commit(self):
        self.commit_calls += 1

    def refresh(self, instance):
        self.refreshed.append(instance)


def test_update_my_settings_persists_profile_values():
    user = User(
        name='Old Name',
        email='old@example.com',
        hashed_password='hashed',
        role=UserRole.teacher,
    )
    db = DummyDB()

    payload = UserUpdateSettings(
        name='New Name',
        whatsapp_number='+1234567890',
        email_notifications_enabled=False,
        whatsapp_notifications_enabled=True,
    )

    result = update_my_settings(payload, db=db, current_user=user)

    assert user.name == 'New Name'
    assert user.whatsapp_number == '+1234567890'
    assert user.email_notifications_enabled is False
    assert user.whatsapp_notifications_enabled is True
    assert result['name'] == 'New Name'
    assert db.commit_calls == 1


def test_profile_picture_url_column_allows_image_data_urls():
    column = User.__table__.columns['profile_picture_url']
    assert isinstance(column.type, Text)


def test_update_my_settings_accepts_a_normal_profile_image_data_url():
    user = User(
        name='Profile User',
        email='profile@example.com',
        hashed_password='hashed',
        role=UserRole.student,
    )
    db = DummyDB()
    image_data_url = 'data:image/jpeg;base64,' + ('a' * 10_000)

    result = update_my_settings(
        UserUpdateSettings(profile_picture_url=image_data_url),
        db=db,
        current_user=user,
    )

    assert user.profile_picture_url == image_data_url
    assert result['profile_picture_url'] == image_data_url
    assert db.commit_calls == 1
