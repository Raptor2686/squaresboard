from fastapi import APIRouter, HTTPException, Cookie
from typing import Annotated
from sqlalchemy import select
from app.database import async_session
from app.models import User, Board, Square
from app.api.auth import _get_user_from_token

router = APIRouter()


@router.get("/me")
async def get_me(token: Annotated[str | None, Cookie()] = None):
    user = await _get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"user_id": user.id, "display_name": user.display_name, "email": user.email}


@router.get("/me/boards")
async def get_my_boards(token: Annotated[str | None, Cookie()] = None):
    user = await _get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with async_session() as session:
        squares_result = await session.execute(
            select(Square, Board)
            .join(Board, Square.board_id == Board.id)
            .where(Square.owner_id == user.id)
            .order_by(Square.purchased_at.desc())
        )
        rows = squares_result.all()
        return [
            {
                "square_id": sq.id,
                "position": sq.position,
                "number": sq.number,
                "board_id": board.id,
                "board_status": board.status,
                "quarter": board.quarter,
                "price_tier": board.price_tier,
                "purchased_at": sq.purchased_at.isoformat() if sq.purchased_at else None,
            }
            for sq, board in rows
        ]
