import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Response, Cookie, Header
from typing import Annotated
from pydantic import BaseModel, EmailStr
import bcrypt
from sqlalchemy import select, delete

from app.database import async_session
from app.models import User, Session
from app.config import settings

router = APIRouter(dependencies=[])
SESSION_MAX_AGE_DAYS = 7


def generate_token() -> str:
    return f"sb_{uuid.uuid4().hex}{uuid.uuid4().hex}"


def _resolve_token(
    session_token: str | None = None,
    authorization: str | None = None,
    x_session_token: str | None = None,
) -> str | None:
    if session_token:
        return session_token
    if x_session_token:
        return x_session_token
    if authorization:
        if authorization.lower().startswith("bearer "):
            return authorization[7:].strip()
        return authorization.strip()
    return None


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/signup")
async def signup(data: SignupRequest, response: Response):
    async with async_session() as session:
        existing = await session.execute(select(User).where(User.email == data.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already registered")

        user = User(
            id=str(uuid.uuid4()),
            email=data.email,
            password_hash=bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode('utf-8'),
            display_name=data.display_name,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

        token = generate_token()
        db_session = Session(
            token=token,
            user_id=user.id,
            expires_at=datetime.utcnow() + timedelta(days=SESSION_MAX_AGE_DAYS),
        )
        session.add(db_session)
        await session.commit()

        _set_cookie(response, token)
        return {"user_id": user.id, "display_name": user.display_name, "token": token}


@router.post("/login")
async def login(data: LoginRequest, response: Response):
    async with async_session() as session:
        result = await session.execute(select(User).where(User.email == data.email))
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        pwd_hash = user.password_hash
        if isinstance(pwd_hash, str):
            pwd_hash = pwd_hash.encode('utf-8')

        if not bcrypt.checkpw(data.password.encode('utf-8'), pwd_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        token = generate_token()
        db_session = Session(
            token=token,
            user_id=user.id,
            expires_at=datetime.utcnow() + timedelta(days=SESSION_MAX_AGE_DAYS),
        )
        session.add(db_session)
        await session.commit()

        _set_cookie(response, token)
        return {"user_id": user.id, "display_name": user.display_name, "token": token}


@router.post("/logout")
async def logout(
    response: Response,
    session_token: Annotated[str | None, Cookie(alias="session")] = None,
    authorization: Annotated[str | None, Header(alias="authorization")] = None,
    x_session_token: Annotated[str | None, Header(alias="x-session-token")] = None,
):
    token = _resolve_token(session_token, authorization, x_session_token)
    if token:
        async with async_session() as session:
            await session.execute(delete(Session).where(Session.token == token))
            await session.commit()
    response.delete_cookie("session")
    return {"ok": True}


@router.get("/me")
async def get_me(
    session_token: Annotated[str | None, Cookie(alias="session")] = None,
    authorization: Annotated[str | None, Header(alias="authorization")] = None,
    x_session_token: Annotated[str | None, Header(alias="x-session-token")] = None,
):
    token = _resolve_token(session_token, authorization, x_session_token)
    user = await _get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"id": user.id, "user_id": user.id, "display_name": user.display_name, "email": user.email}


async def _get_user_from_token(
    token: str | None = None,
    authorization: str | None = None,
    x_session_token: str | None = None,
) -> User | None:
    t = _resolve_token(token, authorization, x_session_token)
    if not t:
        return None
    async with async_session() as session:
        result = await session.execute(
            select(Session).where(Session.token == t)
        )
        db_session = result.scalar_one_or_none()
        if not db_session or db_session.expires_at < datetime.utcnow():
            return None
        user_result = await session.execute(
            select(User).where(User.id == db_session.user_id)
        )
        return user_result.scalar_one_or_none()


def _set_cookie(response: Response, token: str):
    is_dev = "localhost" in settings.FRONTEND_URL or "127.0.0.1" in settings.FRONTEND_URL
    response.set_cookie(
        key="session",
        value=token,
        httponly=True,
        secure=not is_dev,
        samesite="lax" if is_dev else "none",
        max_age=60 * 60 * 24 * SESSION_MAX_AGE_DAYS,
    )
