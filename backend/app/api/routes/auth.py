from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.auth.cookies import COOKIE_NAME, auth_session_expires_at, clear_session_cookie, set_session_cookie
from app.auth.passwords import hash_password, verify_password
from app.auth.tokens import generate_session_token, hash_session_token
from app.db import crud
from app.db.models import User
from app.db.session import get_db
from app.schemas import AuthCredentials, UserOut

router = APIRouter(prefix='/api/auth', tags=['auth'])

def _user_out(user: User) -> UserOut:
    return UserOut(id=user.id, email=user.email)

async def _issue_session(db: AsyncSession, response: Response, user: User) -> UserOut:
    token = generate_session_token()
    await crud.create_auth_session(
        db,
        user_id=user.id,
        token_hash=hash_session_token(token),
        expires_at=auth_session_expires_at(),
    )
    set_session_cookie(response, token)
    return _user_out(user)

@router.post('/register', response_model=UserOut)
async def register(body: AuthCredentials, response: Response, db: AsyncSession = Depends(get_db)):
    existing = await crud.get_user_by_email(db, str(body.email))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Email already registered')
    user = await crud.create_user(db, email=str(body.email), password_hash=hash_password(body.password))
    return await _issue_session(db, response, user)

@router.post('/login', response_model=UserOut)
async def login(body: AuthCredentials, response: Response, db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_email(db, str(body.email))
    if not user or not verify_password(user.password_hash, body.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid email or password')
    return await _issue_session(db, response, user)

@router.post('/logout')
async def logout(
    response: Response,
    db: AsyncSession = Depends(get_db),
    session_token: str | None = Cookie(default=None, alias=COOKIE_NAME),
):
    if session_token:
        await crud.revoke_auth_session_by_token_hash(db, hash_session_token(session_token))
    clear_session_cookie(response)
    return {'ok': True}

@router.get('/me', response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return _user_out(user)