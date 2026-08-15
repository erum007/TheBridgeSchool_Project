from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from urllib.parse import parse_qsl, quote_plus, urlencode, urlsplit, urlunsplit
import os

from dotenv import load_dotenv


load_dotenv(Path(__file__).with_name('.env'))


@dataclass(slots=True)
class Settings:
    db_host: str = os.getenv('DB_HOST', 'localhost')
    db_port: str = os.getenv('DB_PORT', '3306')
    db_name: str = os.getenv('DB_NAME', 'bridge_school')
    db_user: str = os.getenv('DB_USER', 'root')
    db_password: str = os.getenv('DB_PASSWORD', '')
    db_ssl_ca: str = os.getenv('DB_SSL_CA', '')
    database_url: str = os.getenv('DATABASE_URL', '')
    secret_key: str = os.getenv('SECRET_KEY', 'bridge-school-secret')
    algorithm: str = os.getenv('ALGORITHM', 'HS256')
    access_token_expire_minutes: int = int(os.getenv('ACCESS_TOKEN_EXPIRE_MINUTES', '60'))
    app_timezone: str = os.getenv('APP_TIMEZONE', 'Asia/Karachi')
    demo_password: str = os.getenv('DEMO_PASSWORD', 'password123')
    gmail_client_id: str = os.getenv('GMAIL_CLIENT_ID', '')
    gmail_client_secret: str = os.getenv('GMAIL_CLIENT_SECRET', '')
    gmail_sender: str = os.getenv('GMAIL_SENDER', '')
    gmail_app_password: str = os.getenv('GMAIL_APP_PASSWORD', '')
    brevo_api_key: str = os.getenv('BREVO_API_KEY', '')
    brevo_sender_email: str = os.getenv('BREVO_SENDER_EMAIL', '')
    brevo_sender_name: str = os.getenv('BREVO_SENDER_NAME', 'The Bridge School')
    brevo_reply_to: str = os.getenv('BREVO_REPLY_TO', '')
    gemini_api_key: str = os.getenv('GEMINI_API_KEY', '')
    gemini_model: str = os.getenv('GEMINI_MODEL', 'gemini-3.1-flash-lite')
    vapid_public_key: str = os.getenv('VAPID_PUBLIC_KEY', '')
    vapid_private_key: str = os.getenv('VAPID_PRIVATE_KEY', '')
    vapid_subject: str = os.getenv('VAPID_SUBJECT', 'mailto:admin@bridge.school')

    @staticmethod
    def _resolve_ssl_ca(value: str) -> str:
        ca_path = Path(value).expanduser()
        if not ca_path.is_absolute():
            ca_path = Path(__file__).parent / ca_path
        ca_path = ca_path.resolve()
        if not ca_path.is_file():
            raise RuntimeError(f'Database SSL CA certificate not found: {ca_path}')
        return ca_path.as_posix()

    def _normalized_database_url(self) -> str:
        parts = urlsplit(self.database_url)
        query = parse_qsl(parts.query, keep_blank_values=True)
        normalized_query = [
            (key, self._resolve_ssl_ca(value) if key.lower() == 'ssl_ca' and value else value)
            for key, value in query
        ]
        return urlunsplit((
            parts.scheme,
            parts.netloc,
            parts.path,
            urlencode(normalized_query),
            parts.fragment,
        ))

    @property
    def sqlalchemy_url(self) -> str:
        if self.database_url:
            return self._normalized_database_url()

        if not self.db_host or not self.db_user:
            raise RuntimeError(
                'Database connection is not configured. Set either DATABASE_URL, '
                'or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME in the environment.'
            )

        user_part = quote_plus(self.db_user)
        pass_part = f":{quote_plus(self.db_password)}" if self.db_password else ""
        base_url = (
            f"mysql+pymysql://{user_part}{pass_part}@{self.db_host}:{self.db_port}"
            f"/{self.db_name}?charset=utf8mb4"
        )

        if self.db_ssl_ca:
            base_url += f"&ssl_ca={quote_plus(self._resolve_ssl_ca(self.db_ssl_ca))}"

        return base_url


settings = Settings()
