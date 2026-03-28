from fastapi import APIRouter
from sqlalchemy import select
from app.database import async_session
from app.models import User

router = APIRouter()


@router.get("/me")
async def get_me(user_id: str):  # TODO: from session
    async with async_session() as session:
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            return {"error": "Not found"}
        return {
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name,
            "stripe_customer_id": user.stripe_customer_id,
        }
