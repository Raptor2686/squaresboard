import uuid
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from passlib.hash import bcrypt

from app.database import async_session
from app.models import User

router = APIRouter()


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
            password_hash=bcrypt.hash(data.password),
            display_name=data.display_name,
        )
        session.add(user)
        await session.commit()

        token = f"sb_{user.id}_{uuid.uuid4().hex}"
        response.set_cookie(
            key="session",
            value=token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=60 * 60 * 24 * 7,
        )
        return {"user_id": user.id, "display_name": user.display_name}


@router.post("/login")
async def login(data: LoginRequest, response: Response):
    async with async_session() as session:
        result = await session.execute(select(User).where(User.email == data.email))
        user = result.scalar_one_or_none()

        if not user or not bcrypt.verify(data.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        token = f"sb_{user.id}_{uuid.uuid4().hex}"
        response.set_cookie(
            key="session",
            value=token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=60 * 60 * 24 * 7,
        )
        return {"user_id": user.id, "display_name": user.display_name}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("session")
    return {"ok": True}
