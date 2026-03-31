import uuid
import random
from datetime import datetime
from fastapi import APIRouter, HTTPException, Cookie
from typing import Annotated
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.database import async_session
from app.models import Board, BoardStatus, Square, User, Transaction
from app.api.auth import _get_user_from_token

router = APIRouter()


@router.get("/board/{board_id}")
async def get_board_squares(board_id: str):
    async with async_session() as session:
        result = await session.execute(
            select(Board)
            .options(joinedload(Board.game))
            .options(joinedload(Board.winning_square))
            .where(Board.id == board_id)
        )
        board = result.scalar_one_or_none()
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")

        squares_result = await session.execute(
            select(Square)
            .options(joinedload(Square.owner))
            .where(Square.board_id == board_id)
            .order_by(Square.position)
        )
        squares = squares_result.scalars().all()
        return {
            "board_id": board.id,
            "game": {
                "id": board.game.id,
                "home_team": board.game.home_team,
                "away_team": board.game.away_team,
                "home_team_logo": board.game.home_team_logo,
                "away_team_logo": board.game.away_team_logo,
                "event_time": board.game.event_time.isoformat(),
                "status": board.game.status,
            },
            "quarter": board.quarter,
            "price_tier": board.price_tier,
            "board_status": board.status,
            "winning_number": board.winning_square.s.number if board.winning_square else None,
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
    session: Annotated[str, Cookie()] = None,
):
    """Purchase a square using wallet balance."""
    user = await _get_user_from_token(session)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with async_session() as db:
        # Load board with game
        result = await db.execute(
            select(Board)
            .options(joinedload(Board.game))
            .where(Board.id == board_id)
        )
        board = result.scalar_one_or_none()
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        if board.status != BoardStatus.OPEN:
            raise HTTPException(status_code=400, detail="Board is not open for purchases")

        # Check square
        square_result = await db.execute(
            select(Square).where(Square.board_id == board_id, Square.position == position)
        )
        square = square_result.scalar_one_or_none()
        if not square:
            raise HTTPException(status_code=404, detail="Square not found")
        if square.owner_id is not None:
            raise HTTPException(status_code=400, detail="Square already taken")

        # Check balance
        user_result = await db.execute(select(User).where(User.id == user.id))
        db_user = user_result.scalar_one_or_none()

        price_cents = int(board.price_tier * 100)
        if db_user.balance_cents < price_cents:
            raise HTTPException(status_code=400, detail=f"Insufficient balance. Need ${board.price_tier:.2f}")

        # Deduct balance
        db_user.balance_cents -= price_cents

        # Record transaction
        tx = Transaction(
            id=str(uuid.uuid4()),
            user_id=user.id,
            amount_cents=-price_cents,
            type="purchase",
            reference_id=board_id,
        )
        db.add(tx)

        # Assign square
        square.owner_id = user.id
        square.purchased_at = datetime.utcnow()

        # Check if board is now full
        all_squares_result = await db.execute(
            select(Square).where(Square.board_id == board_id)
        )
        all_squares = all_squares_result.scalars().all()

        if all(s.owner_id is not None for s in all_squares):
            numbers = list(range(10))
            random.shuffle(numbers)
            for i, sq in enumerate(all_squares):
                sq.number = numbers[i]
            board.status = BoardStatus.LOCKED

        await db.commit()

    return {
        "ok": True,
        "board_status": board.status,
        "price_charged_cents": price_cents,
        "new_balance_cents": db_user.balance_cents,
    }


@router.get("/my-boards")
async def get_my_boards(session: Annotated[str, Cookie()] = None):
    user = await _get_user_from_token(session)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with async_session() as db:
        squares_result = await db.execute(
            select(Square)
            .options(
                joinedload(Square.board).joinedload(Board.game)
            )
            .where(Square.owner_id == user.id)
            .order_by(Square.purchased_at.desc())
            .limit(50)
        )
        squares = squares_result.scalars().all()

    return [
        {
            "square_id": s.id,
            "position": s.position,
            "number": s.number,
            "board": {
                "id": s.board.id,
                "status": s.board.status,
                "quarter": s.board.quarter,
                "price_tier": s.board.price_tier,
                "game": {
                    "id": s.board.game.id,
                    "home_team": s.board.game.home_team,
                    "away_team": s.board.game.away_team,
                },
            },
            "purchased_at": s.purchased_at.isoformat() if s.purchased_at else None,
        }
        for s in squares
    ]
