from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..dependencies import get_current_user, get_db
from ..models import User
from ..schemas import ChangePasswordRequest, ForgotPasswordRequest, LoginRequest, ResetPasswordRequest
from ..config import settings
from ..services.auth_service import create_access_token, get_password_hash, verify_password
from ..services.email_service import send_plain_email
from ..services.serialization import serialize_user


router = APIRouter(prefix='/api/auth', tags=['auth'])


def _password_is_strong(password: str) -> bool:
    return len(password) >= 12 and any(char.islower() for char in password) and any(char.isupper() for char in password) and any(char.isdigit() for char in password) and any(not char.isalnum() for char in password)


def _otp_hash(otp: str) -> str:
    return hashlib.sha256(f'{settings.secret_key}:{otp}'.encode()).hexdigest()


def _send_password_otp(user: User, purpose: str) -> bool:
    otp = f'{secrets.randbelow(1_000_000):06d}'
    user.password_reset_token = _otp_hash(otp)
    user.password_reset_expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    subject = 'Your Bridge School Portal password verification code'
    body = f'Dear {user.name},\n\nYour {purpose} verification code is: {otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.\n\nThe Bridge School'
    return send_plain_email(user.email, subject, body)


def _confirm_password_otp(user: User, otp: str, new_password: str) -> None:
    if not _password_is_strong(new_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Use at least 12 characters with uppercase, lowercase, a number, and a symbol')
    expires_at = user.password_reset_expires
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if not user.password_reset_token or not expires_at or expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid or expired verification code')
    if not secrets.compare_digest(user.password_reset_token, _otp_hash(otp)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid or expired verification code')
    user.hashed_password = get_password_hash(new_password)
    user.password_reset_token = None
    user.password_reset_expires = None


@router.post('/login')
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid credentials')
    return {
        'access_token': create_access_token(str(user.id)),
        'token_type': 'bearer',
        'user': serialize_user(user),
    }


@router.get('/me')
def me(current_user: User = Depends(get_current_user)):
    return serialize_user(current_user)


@router.post('/forgot-password')
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if user:
        if not _send_password_otp(user, 'password reset'):
            user.password_reset_token = None
            user.password_reset_expires = None
        db.commit()
    return {'message': 'If an account exists with that email, a verification code has been sent.'}


@router.post('/reset-password')
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid or expired verification code')
    _confirm_password_otp(user, payload.otp, payload.new_password)
    db.commit()
    return {'message': 'Password reset successfully'}


@router.post('/change-password/request')
def request_change_password(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not _send_password_otp(current_user, 'password change'):
        current_user.password_reset_token = None
        current_user.password_reset_expires = None
        db.commit()
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail='Could not send a verification email. Contact an administrator.')
    db.commit()
    return {'message': 'A verification code has been sent to your email.'}


@router.post('/change-password/confirm')
def confirm_change_password(payload: ChangePasswordRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _confirm_password_otp(current_user, payload.otp, payload.new_password)
    db.commit()
    return {'message': 'Password changed successfully'}
