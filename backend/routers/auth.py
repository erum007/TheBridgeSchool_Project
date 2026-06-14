from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..dependencies import get_current_user, get_db
from ..models import User
from ..schemas import LoginRequest
from ..services.auth_service import create_access_token, verify_password
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
