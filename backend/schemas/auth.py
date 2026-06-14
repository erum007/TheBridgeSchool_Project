from __future__ import annotations

from .common import ORMBaseModel


class LoginRequest(ORMBaseModel):
    email: str
    password: str


class TokenResponse(ORMBaseModel):
    access_token: str
    token_type: str
    user: dict
