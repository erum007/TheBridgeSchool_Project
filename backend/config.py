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
    twilio_account_sid: str = os.getenv('TWILIO_ACCOUNT_SID', '')
    twilio_auth_token: str = os.getenv('TWILIO_AUTH_TOKEN', '')
    twilio_whatsapp_number: str = os.getenv('TWILIO_WHATSAPP_NUMBER', '')
    gemini_api_key: str = os.getenv('GEMINI_API_KEY', '')

    @property
    def sqlalchemy_url(self) -> str:
        if self.db_password:
            return f'mysql+pymysql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}?charset=utf8mb4'
        return f'mysql+pymysql://{self.db_user}@{self.db_host}:{self.db_port}/{self.db_name}?charset=utf8mb4'


settings = Settings()
