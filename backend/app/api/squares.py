import uuid
import random
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select
from app.database import async_session
from app.models import Board, BoardStatus, Square

router = APIRouter()

PRICE_TIERS = [0.50, 1, 2, 5, 10, 20, 50, 100, 1000, 10000]


def get_current_user(request):
    pass  # TODO: implement session auth


@router.get("/board/{board_id}")
async def get_board_squares(board_id: str):
    async with async_session() as session:
        result = await session.execute(select(Board).where(Board.id == board_id))
        board = result.scalar_one_or_none()
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")

        squares_result = await session.execute(
            select(Square).where(Square.board_id == board_id).order_by(Square.position)
        )
        squares = squares_result.scalars().all()
        return {
            "board_id": board.id,
            "board_status": board.status,
            "squares": [
                {
                    "id": s.id,
                    "position": s.position,
                    "number": s.number,
                    "owner_id": s.owner_id,
                    "owner_name": s.owner.display_name if s.owner else None,
                }
                for s in squares
            ],
        }


@router.post("/board/{board_id}/purchase")
async def purchase_square(
    board_id: str,
    position: int,
    user_id: str,  # TODO: from session
):
    async with async_session() as session:
        result = await session.execute(select(Board).where(Board.id == board_id))
        board = result.scalar_one_or_none()
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        if board.status != BoardStatus.OPEN:
            raise HTTPException(status_code=400, detail="Board is not open for purchases")

        square_result = await session.execute(
            select(Square).where(Square.board_id == board_id, Square.position == position)
        )
        square = square_result.scalar_one_or_none()
        if not square:
            raise HTTPException(status_code=404, detail="Square not found")
        if square.owner_id is not None:
            raise HTTPException(status_code=400, detail="Square already taken")

        square.owner_id = user_id
        square.purchased_at = datetime.utcnow()
        await session.commit()

        # Check if board is now full
        all_squares = await session.execute(
            select(Square).where(Square.board_id == board_id)
        )
        all_owned = all(s.owner_id is not None for s in all_squares.scalars().all())
        if all_owned:
            numbers = list(range(10))
            random.shuffle(numbers)
            for i, sq in enumerate(all_squares.scalars().all()):
                sq.number = numbers[i]
            board.status = BoardStatus.LOCKED
            await session.commit()

        return {"ok": True, "board_status": board.status}
