from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..dependencies import get_current_user, get_db, require_roles
from ..models import User, UserRole
from ..schemas import UserAdminUpdate, UserCreate, UserUpdateSettings
from ..services.auth_service import get_password_hash
from ..services.email_service import send_plain_email
from ..services.serialization import serialize_user


router = APIRouter(prefix='/api/users', tags=['users'])


@router.get('')
def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.admin))):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [serialize_user(user) for user in users]


@router.post('')
def create_user(payload: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.admin))):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Email already exists')
    try:
        role = UserRole(payload.role)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid role') from exc
    user = User(
        name=payload.name,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role=role,
        head_teacher=payload.head_teacher,
        whatsapp_number=payload.whatsapp_number,
        department=payload.department,
        is_active=payload.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    subject = 'Welcome to The Bridge School Portal'
    plain_body = f"""Dear {user.name},

Your account has been created on The Bridge School Portal.

Email: {user.email}
Temporary Password: {payload.password}
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
    .credentials {{ background: #f7f8fc; border: 1px solid #e2e5f0; border-radius: 8px; padding: 16px; margin: 20px 0; }}
    .cred-row {{ display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e8e4dc; font-size: 14px; }}
    .cred-row:last-child {{ border-bottom: none; }}
    .cred-label {{ color: #8a8a8a; }}
    .cred-value {{ font-weight: 600; color: #1B2B6B; }}
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
    <div class=\"credentials\">
      <div class=\"cred-row\"><span class=\"cred-label\">Email</span><span class=\"cred-value\">{user.email}</span></div>
      <div class=\"cred-row\"><span class=\"cred-label\">Temporary Password</span><span class=\"cred-value\">{payload.password}</span></div>
      <div class=\"cred-row\"><span class=\"cred-label\">Role</span><span class=\"cred-value\">{user.role.value.title()}</span></div>
    </div>
    <a href=\"http://localhost:5173\" class=\"btn\">Login to Portal</a>
    <p style=\"font-size: 13px; color: #8a8a8a;\">Please change your password after your first login.</p>
    <div class=\"footer\">
      <strong>The Bridge School Portal</strong><br>
      This is an automated message.
    </div>
  </div>
</body>
</html>
"""
    try:
        send_plain_email(user.email, subject, plain_body, html_body=html_body)
    except Exception:
        pass
    return serialize_user(user)


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
