from datetime import datetime, timedelta, timezone
from typing import Literal, cast
from fastapi import Response
from app.config import settings

COOKIE_NAME = 'session_token'
SameSite = Literal['lax', 'strict', 'none']

def _same_site() -> SameSite:
    value = settings.cookie_samesite
    if value in ('lax', 'strict', 'none'):
        return cast(SameSite, value)
    return 'lax'

def session_cookie_max_age() -> int:
    return settings.session_ttl_days * 24 * 60 * 60

def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        path='/',
        max_age=session_cookie_max_age(),
        samesite=_same_site(),
        secure=settings.cookie_secure,
    )

def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=COOKIE_NAME,
        path='/',
        samesite=_same_site(),
        secure=settings.cookie_secure,
    )

def auth_session_expires_at() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=settings.session_ttl_days)