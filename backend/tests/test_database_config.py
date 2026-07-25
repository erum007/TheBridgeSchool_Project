import pytest
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from backend.config import Settings


def test_database_url_resolves_relative_ssl_ca_from_backend_directory():
    url = Settings(
        database_url='mysql+pymysql://user:pass@db.example/test?ssl_ca=ca.pem'
    ).sqlalchemy_url

    ssl_ca = parse_qs(urlsplit(url).query)['ssl_ca'][0]
    assert Path(ssl_ca).is_absolute()
    assert Path(ssl_ca).name == 'ca.pem'


def test_database_url_reports_missing_ssl_ca():
    settings = Settings(
        database_url='mysql+pymysql://user:pass@db.example/test?ssl_ca=missing-ca.pem'
    )

    with pytest.raises(RuntimeError, match='SSL CA certificate not found'):
        settings.sqlalchemy_url


def test_sqlalchemy_url_requires_explicit_database_url(monkeypatch):
    monkeypatch.delenv('DATABASE_URL', raising=False)

    with pytest.raises(RuntimeError, match='DATABASE_URL'):
        Settings().sqlalchemy_url
