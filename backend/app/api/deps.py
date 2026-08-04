from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth.cookies import COOKIE_NAME
from app.auth.tokens import hash_session_token
from app.db import crud
from app.db.models import User
from app.db.session import get_db

def _bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, value = authorization.partition(' ')
    if scheme.lower() != 'bearer' or not value.strip():
        return None
    return value.strip()

async def get_current_user_optional(
    request: Request,
    db: AsyncSession = Depends(get_db),
    session_token: str | None = Cookie(default=None, alias=COOKIE_NAME),
    authorization: str | None = Header(default=None),
) -> User | None:
    """Resolve user from Bearer header, SSE ?access_token=, or session cookie."""
    raw = (
        _bearer_token(authorization)
        or request.query_params.get('access_token')
        or session_token
    )
    if not raw:
        return None
    return await crud.get_user_by_session_token_hash(db, hash_session_token(raw))

async def get_current_user(user: User | None = Depends(get_current_user_optional)) -> User:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Not authenticated')
    return user