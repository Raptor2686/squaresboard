import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Response, Cookie
from typing import Annotated
from pydantic import BaseModel, EmailStr
import bcrypt
from sqlalchemy import select, delete

from app.database import async_session
from app.models import User, Session

router = APIRouter(dependencies=[])
SESSION_MAX_AGE_DAYS = 7


def generate_token() -> str:
    return f"sb_{uuid.uuid4().hex}{uuid.uuid4().hex}"


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
            password_hash=bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()),
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
        return {"user_id": user.id, "display_name": user.display_name}


@router.post("/login")
async def login(data: LoginRequest, response: Response):
    async with async_session() as session:
        result = await session.execute(select(User).where(User.email == data.email))
        user = result.scalar_one_or_none()

        if not user or not bcrypt.checkpw(data.password.encode(), user.password_hash.encode()):
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
        return {"user_id": user.id, "display_name": user.display_name}


@router.post("/logout")
async def logout(response: Response, session_token: Annotated[str | None, Cookie()] = None):
    if session_token:
        async with async_session() as session:
            await session.execute(delete(Session).where(Session.token == session_token))
            await session.commit()
    response.delete_cookie("session")
    return {"ok": True}


@router.get("/me")
async def get_me(session_token: Annotated[str | None, Cookie()] = None):
    user = await _get_user_from_token(session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"user_id": user.id, "display_name": user.display_name, "email": user.email}


async def _get_user_from_token(token: str | None) -> User | None:
    if not token:
        return None
    async with async_session() as session:
        result = await session.execute(
            select(Session).where(Session.token == token)
        )
        db_session = result.scalar_one_or_none()
        if not db_session or db_session.expires_at < datetime.utcnow():
            return None
        user_result = await session.execute(
            select(User).where(User.id == db_session.user_id)
        )
        return user_result.scalar_one_or_none()


def _set_cookie(response: Response, token: str):
    response.set_cookie(
        key="session",
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=60 * 60 * 24 * SESSION_MAX_AGE_DAYS,
    )


def get_current_user(token: Annotated[str | None, Cookie()] = None):
    """Dependency for endpoints that require authentication."""
    return _get_user_from_token(token)
