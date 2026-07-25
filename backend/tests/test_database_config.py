import pytest

from backend.config import Settings


def test_sqlalchemy_url_requires_explicit_database_url(monkeypatch):
    monkeypatch.delenv('DATABASE_URL', raising=False)

    with pytest.raises(RuntimeError, match='DATABASE_URL'):
        Settings().sqlalchemy_url
