import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from backend.config import settings

ALGORITHM = "HS256"

router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer(auto_error=False)


class LoginRequest(BaseModel):
    access_code: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class AuthStatus(BaseModel):
    auth_required: bool


def create_access_token() -> TokenResponse:
    expires_in = settings.access_token_expire_minutes * 60
    now = datetime.now(UTC)
    payload = {"iat": now, "exp": now + timedelta(seconds=expires_in)}
    token = jwt.encode(
        payload, settings.jwt_secret.get_secret_value(), algorithm=ALGORITHM
    )
    return TokenResponse(access_token=token, expires_in=expires_in)


def require_auth(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
) -> None:
    """Dependency for routes behind the login gate. No-op when the gate is off."""
    if not settings.auth_enabled:
        return

    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    try:
        jwt.decode(
            credentials.credentials,
            settings.jwt_secret.get_secret_value(),
            algorithms=[ALGORITHM],
        )
    except jwt.InvalidTokenError as exc:
        raise unauthorized from exc


@router.get("/status")
def auth_status() -> AuthStatus:
    return AuthStatus(auth_required=settings.auth_enabled)


@router.get(
    "/verify",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_auth)],
)
def verify() -> None:
    """Lets the client check that a stored token is still valid, e.g. after a backend restart."""


@router.post("/login")
def login(body: LoginRequest) -> TokenResponse:
    # With the gate off, any code gets a token so the frontend flow stays the same.
    if settings.auth_enabled:
        expected = settings.access_code.get_secret_value().encode()  # type: ignore[union-attr]
        # Constant-time comparison so response timing doesn't leak the code.
        if not secrets.compare_digest(body.access_code.encode(), expected):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid access code.",
            )
    return create_access_token()
