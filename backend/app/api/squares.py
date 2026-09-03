import uuid
import random
from datetime import datetime
from fastapi import APIRouter, HTTPException, Cookie
from pydantic import BaseModel
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

        # Payout is 90% of total pot
        total_pot_gc = board.price_tier * 10  # 10 squares
        raw_payout = total_pot_gc * 0.90
        payout_sc = int(raw_payout) if raw_payout.is_integer() else round(raw_payout, 2)

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
                "home_score": board.game.home_score,
                "away_score": board.game.away_score,
            },
            "quarter": board.quarter,
            "price_tier_gc": board.price_tier,
            "entry_currency": board.entry_currency,
            "payout_sc": payout_sc,
            "board_status": board.status,
            "is_private": board.is_private,
            "share_link": board.share_link,
            "winning_number": next((s.number for s in squares if s.id == board.winning_square_id), None),
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


class PurchaseRequest(BaseModel):
    position: int


@router.post("/board/{board_id}/purchase")
async def purchase_square(
    board_id: str,
    req: PurchaseRequest,
    session: Annotated[str, Cookie(alias="session")] = None,
):
    """Purchase a square using Gold Coins from the user's wallet."""
    position = req.position
    user = await _get_user_from_token(session)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with async_session() as db:
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

        square_result = await db.execute(
            select(Square).where(Square.board_id == board_id, Square.position == position)
        )
        square = square_result.scalar_one_or_none()
        if not square:
            raise HTTPException(status_code=404, detail="Square not found")
        if square.owner_id is not None:
            raise HTTPException(status_code=400, detail="Square already taken")

        # Load user and check balance for the board's entry currency
        user_result = await db.execute(select(User).where(User.id == user.id))
        db_user = user_result.scalar_one_or_none()

        entry_currency = board.entry_currency  # "GC" or "SC"
        cost = board.price_tier

        if entry_currency == "SC":
            if db_user.sweep_coins < cost:
                cost_str = f"{int(cost):,}" if cost.is_integer() else f"{cost}"
                bal_str = f"{int(db_user.sweep_coins):,}" if db_user.sweep_coins.is_integer() else f"{db_user.sweep_coins}"
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient Sweepstakes Coins. Need {cost_str} SC, you have {bal_str} SC."
                )
            db_user.sweep_coins -= cost
            tx = Transaction(
                id=str(uuid.uuid4()),
                user_id=user.id,
                amount=-cost,
                type="sc_spend",
                currency="SC",
                reference_id=board_id,
            )
        else:  # default GC
            if db_user.gold_coins < cost:
                cost_str = f"{int(cost):,}" if cost.is_integer() else f"{cost}"
                bal_str = f"{int(db_user.gold_coins):,}" if db_user.gold_coins.is_integer() else f"{db_user.gold_coins}"
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient Gold Coins. Need {cost_str} GC, you have {bal_str} GC."
                )
            db_user.gold_coins -= cost
            tx = Transaction(
                id=str(uuid.uuid4()),
                user_id=user.id,
                amount=-cost,
                type="gc_spend",
                currency="GC",
                reference_id=board_id,
            )
        db.add(tx)

        # Assign square
        square.owner_id = user.id
        square.purchased_at = datetime.utcnow()

        # Check if board is now full — assign numbers and lock
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
        "entry_currency": entry_currency,
        "cost_charged": cost,
        "new_gold_coins": db_user.gold_coins,
        "new_sweep_coins": db_user.sweep_coins,
    }


@router.get("/my-boards")
async def get_my_boards(session: Annotated[str, Cookie(alias="session")] = None):
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
                "price_tier_gc": s.board.price_tier,
                "entry_currency": s.board.entry_currency,
                "payout_sc": int(s.board.price_tier * 10 * 0.90),
                "winning_square_id": s.board.winning_square_id,
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
