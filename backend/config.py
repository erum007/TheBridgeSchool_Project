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
    gemini_model: str = os.getenv('GEMINI_MODEL', 'gemini-3.1-flash-lite')
    db_ssl_ca: str = os.getenv('DB_SSL_CA', '')

    @property
    def sqlalchemy_url(self) -> str:
        from urllib.parse import quote_plus
        
        user_part = quote_plus(self.db_user)
        pass_part = f":{quote_plus(self.db_password)}" if self.db_password else ""
        
        base_url = f"mysql+pymysql://{user_part}{pass_part}@{self.db_host}:{self.db_port}/{self.db_name}?charset=utf8mb4"
        if self.db_ssl_ca:
            ca_path = Path(self.db_ssl_ca)
            if not ca_path.is_absolute():
                resolved_path = Path(__file__).parent / ca_path
                if resolved_path.exists():
                    ca_path = resolved_path
            base_url += f"&ssl_ca={ca_path.as_posix()}"
        return base_url


settings = Settings()
