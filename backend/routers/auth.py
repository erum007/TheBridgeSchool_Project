from __future__ import annotations

from datetime import datetime, timedelta, timezone
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..dependencies import get_current_user, get_db
from ..models import User
from ..schemas import ForgotPasswordRequest, LoginRequest, ResetPasswordRequest
from ..services.auth_service import create_access_token, get_password_hash, verify_password
from ..services.email_service import send_plain_email
from ..services.serialization import serialize_user


router = APIRouter(prefix='/api/auth', tags=['auth'])


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
                token = secrets.token_urlsafe(32)
                user.password_reset_token = token
                user.password_reset_expires = datetime.now(timezone.utc) + timedelta(hours=1)
                db.commit()
                subject = 'Reset your Bridge School Portal password'
                reset_link = f'http://localhost:5173/reset-password?token={token}'
                html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 0; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 32px 24px; }}
        .header {{ border-bottom: 3px solid #C0392B; padding-bottom: 16px; margin-bottom: 24px; }}
        .school-name {{ color: #1B2B6B; font-size: 20px; font-weight: bold; margin: 0; }}
        .btn {{ display: inline-block; background: #C0392B; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }}
        .footer {{ margin-top: 32px; padding-top: 16px; border-top: 1px solid #e8e4dc; font-size: 13px; color: #8a8a8a; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <p class="school-name">The Bridge School</p>
        </div>
        <p>Dear {user.name},</p>
        <p>We received a request to reset your password. Click the button below to set a new password. This link expires in 1 hour.</p>
        <a href="{reset_link}" class="btn">Reset Password</a>
        <p>If you did not request this, ignore this email — your password will not be changed.</p>
        <div class="footer">
            <strong>The Bridge School Portal</strong><br>
            This is an automated message.
        </div>
    </div>
</body>
</html>
"""
                plain_body = f'Reset your password here: {reset_link}\n\nThis link expires in 1 hour.'
                send_plain_email(user.email, subject, plain_body, html_body=html_body)
        return {'message': 'If an account exists with that email, a reset link has been sent.'}


@router.post('/reset-password')
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
        user = db.query(User).filter(User.password_reset_token == payload.token).first()
        if not user or not user.password_reset_expires or user.password_reset_expires <= datetime.now(timezone.utc):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid or expired reset token')
        user.hashed_password = get_password_hash(payload.new_password)
        user.password_reset_token = None
        user.password_reset_expires = None
        db.commit()
        return {'message': 'Password reset successfully'}
