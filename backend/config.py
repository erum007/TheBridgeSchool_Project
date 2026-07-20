from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
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
    secret_key: str = os.getenv('SECRET_KEY', 'bridge-school-secret')
    algorithm: str = os.getenv('ALGORITHM', 'HS256')
    access_token_expire_minutes: int = int(os.getenv('ACCESS_TOKEN_EXPIRE_MINUTES', '60'))
    gmail_client_id: str = os.getenv('GMAIL_CLIENT_ID', '')
    gmail_client_secret: str = os.getenv('GMAIL_CLIENT_SECRET', '')
    gmail_sender: str = os.getenv('GMAIL_SENDER', '')
    gmail_app_password: str = os.getenv('GMAIL_APP_PASSWORD', '')
    twilio_account_sid: str = os.getenv('TWILIO_ACCOUNT_SID', '')
    twilio_auth_token: str = os.getenv('TWILIO_AUTH_TOKEN', '')
    twilio_whatsapp_number: str = os.getenv('TWILIO_WHATSAPP_NUMBER', '')
    twilio_whatsapp_reminder_content_sid: str = os.getenv('TWILIO_WHATSAPP_REMINDER_CONTENT_SID', '')
    gemini_api_key: str = os.getenv('GEMINI_API_KEY', '')
    gemini_model: str = os.getenv('GEMINI_MODEL', 'gemini-3.1-flash-lite')
    db_ssl_ca: str = os.getenv('DB_SSL_CA', '')
    database_url: str = os.getenv('DATABASE_URL', '')
    demo_password: str = os.getenv('DEMO_PASSWORD', '')

    @property
    def sqlalchemy_url(self) -> str:
        database_url = self.database_url or os.getenv('DATABASE_URL', '')
        if database_url:
            return database_url
        raise RuntimeError(
            'DATABASE_URL is not set. Configure the database connection string in the environment before starting the app.'
        )


settings = Settings()
