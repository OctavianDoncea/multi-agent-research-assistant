from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth.cookies import COOKIE_NAME
from app.auth.tokens import hash_session_token
from app.db import crud
from app.db.models import User
from app.db.session import get_db

async def get_current_user_optional(
    db: AsyncSession = Depends(get_db),
    session_token: str | None = Cookie(default=None, alias=COOKIE_NAME),
) -> User | None:
    if not session_token:
        return None
    user = await crud.get_user_by_session_token_hash(db, hash_session_token(session_token))
    return user

async def get_current_user(user: User | None = Depends(get_current_user_optional)) -> User:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Not authenticated')
    return user