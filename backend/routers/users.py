from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..dependencies import get_current_user, get_db, require_roles
from ..models import User, UserRole
from ..schemas import UserCreate, UserUpdateSettings
from ..services.auth_service import get_password_hash
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
        is_active=payload.is_active,
    )
    db.add(user)
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
