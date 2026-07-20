from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..dependencies import get_current_user, get_db, require_roles
from ..models import Department, User, UserRole
from ..schemas import UserAdminUpdate, UserCreate, UserUpdateSettings
from ..services.auth_service import get_password_hash
from ..services.email_service import send_plain_email
from ..services.serialization import serialize_user


router = APIRouter(prefix='/api/users', tags=['users'])


def _valid_password(password: str) -> bool:
    return len(password) >= 12 and any(char.islower() for char in password) and any(char.isupper() for char in password) and any(char.isdigit() for char in password) and any(not char.isalnum() for char in password)


@router.get('')
def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.admin))):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [serialize_user(user) for user in users]


@router.post('')
def create_user(payload: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.admin))):
    email = payload.email.strip().lower()
    if not payload.name.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Name is required')
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Enter a valid email address')
    if not _valid_password(payload.password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Temporary password must be 12+ characters with uppercase, lowercase, a number, and a symbol')
    if db.query(User).filter(func.lower(User.email) == email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Email already exists')
    try:
        role = UserRole(payload.role)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid role') from exc
    department_name = payload.department.strip() if payload.department else None
    if role == UserRole.staff and not department_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Department/domain is required for staff')
    user = User(
        name=payload.name.strip(),
        email=email,
        hashed_password=get_password_hash(payload.password),
        role=role,
        head_teacher=payload.head_teacher,
        whatsapp_number=payload.whatsapp_number,
        department=department_name if role == UserRole.staff else None,
        is_active=payload.is_active,
    )
    db.add(user)
    if department_name and role == UserRole.staff:
        department = db.query(Department).filter(Department.name == department_name).first()
        if not department:
            department = Department(name=department_name)
            db.add(department)
        user.departments.append(department)
    db.commit()
    db.refresh(user)

    subject = 'Welcome to The Bridge School Portal'
    plain_body = f"""Dear {user.name},

Your account has been created on The Bridge School Portal.

Email: {user.email}
Password: {payload.password}
Role: {user.role.value.title()}

Login at: http://localhost:5173

Please change your password after logging in for the first time.

Regards,
The Bridge School"""
    html_body = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset=\"UTF-8\">
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
  <div class=\"container\">
    <div class=\"header\">
      <p class=\"school-name\">The Bridge School</p>
    </div>
    <p>Dear <strong>{user.name}</strong>,</p>
    <p>Your account has been created on The Bridge School Portal. Here are your login credentials:</p>
    <div style=\"background:#f7f8fc;border:1px solid #e2e5f0;border-radius:8px;margin:20px 0;overflow:hidden;\">
      <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"border-collapse:collapse;\">
        <tr><td style=\"padding:12px 16px;border-bottom:1px solid #e2e5f0;color:#6b7280;font-size:14px;width:38%;\">Email</td><td style=\"padding:12px 16px;border-bottom:1px solid #e2e5f0;color:#1B2B6B;font-size:14px;font-weight:600;\">{user.email}</td></tr>
        <tr><td style=\"padding:12px 16px;border-bottom:1px solid #e2e5f0;color:#6b7280;font-size:14px;\">Password</td><td style=\"padding:12px 16px;border-bottom:1px solid #e2e5f0;color:#1B2B6B;font-size:14px;font-weight:600;\">{payload.password}</td></tr>
        <tr><td style=\"padding:12px 16px;color:#6b7280;font-size:14px;\">Role</td><td style=\"padding:12px 16px;color:#1B2B6B;font-size:14px;font-weight:600;\">{user.role.value.title()}</td></tr>
      </table>
    </div>
    <a href=\"http://localhost:5173\" class=\"btn\">Login to Portal</a>
    <p style=\"font-size: 13px; color: #8a8a8a;\">For your security, please change your password after you sign in.</p>
    <div class=\"footer\">
      <strong>The Bridge School Portal</strong><br>
      This is an automated message.
    </div>
  </div>
</body>
</html>
"""
    invitation_sent = send_plain_email(user.email, subject, plain_body, html_body=html_body)
    response = serialize_user(user)
    response['invitation_sent'] = invitation_sent
    return response


@router.patch('/{user_id}')
def update_user(user_id: int, payload: UserAdminUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.admin))):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='User not found')
    if 'department' in payload.model_fields_set:
        user.department = payload.department.strip() if payload.department else None
    db.commit()
    db.refresh(user)
    return serialize_user(user)


@router.delete('/{user_id}')
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.admin))):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='User not found')
    db.delete(user)
    db.commit()
    return {'detail': 'User deleted'}


@router.patch('/me/settings')
def update_my_settings(payload: UserUpdateSettings, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    current_user.whatsapp_number = payload.whatsapp_number
    db.commit()
    db.refresh(current_user)
    return serialize_user(current_user)
