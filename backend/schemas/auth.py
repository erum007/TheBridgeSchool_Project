from __future__ import annotations

from .common import ORMBaseModel


class LoginRequest(ORMBaseModel):
    email: str
    password: str


class TokenResponse(ORMBaseModel):
    access_token: str
    token_type: str
    user: dict


class ForgotPasswordRequest(ORMBaseModel):
    email: str


class ResetPasswordRequest(ORMBaseModel):
    token: str
    new_password: str
