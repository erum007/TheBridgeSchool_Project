from __future__ import annotations

from collections.abc import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from .config import settings
from .database import SessionLocal
from .models import User, UserRole
from .services.auth_service import decode_access_token


oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/api/auth/login')


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    credentials_error = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Could not validate credentials')
    try:
        payload = decode_access_token(token)
        user_id = payload.get('sub')
        if user_id is None:
            raise credentials_error
    except JWTError as exc:
        raise credentials_error from exc

    user = db.get(User, int(user_id))
    if not user or not user.is_active:
        raise credentials_error
    return user


def require_roles(*allowed_roles: UserRole):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')
        return current_user

    return dependency
