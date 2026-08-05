import sys
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

def _cookie_secure() -> bool:
    return settings.cookie_secure or _same_site() == 'none'

def _cookie_partitioned() -> bool:
    if sys.version_info < (3, 14):
        return False
    if _same_site() != 'none':
        return False
    return settings.cookie_partitioned

def session_cookie_max_age() -> int:
    return settings.session_ttl_days * 24 * 60 * 60

def set_session_cookie(response: Response, token: str) -> None:
    kwargs = dict(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        path='/',
        max_age=session_cookie_max_age(),
        samesite=_same_site(),
        secure=_cookie_secure(),
    )
    if _cookie_partitioned():
        kwargs['partitioned'] = True
    try:
        response.set_cookie(**kwargs)
    except (ValueError, TypeError):
        kwargs.pop('partitioned', None)
        try:
            response.set_cookie(**kwargs)
        except (ValueError, TypeError):
            pass


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=COOKIE_NAME,
        path='/',
        samesite=_same_site(),
        secure=_cookie_secure(),
    )

def auth_session_expires_at() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=settings.session_ttl_days)