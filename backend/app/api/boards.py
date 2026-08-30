import uuid
from fastapi import APIRouter, HTTPException, Query, Cookie
from typing import Annotated
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.database import async_session
from app.models import Board, BoardStatus, Quarter, Game, Sport, Square
from app.api.auth import _get_user_from_token

router = APIRouter()


@router.get("/")
async def list_boards(
    sport: str | None = None,
    quarter: str | None = None,
    price_tier: int | None = None,
    status: str | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
):
    async with async_session() as session:
        query = (
            select(Board)
            .options(joinedload(Board.game))
            .where(Board.is_private == False)
        )
        if sport:
            query = query.join(Game).where(Game.sport == Sport(sport))
        if quarter:
            query = query.where(Board.quarter == Quarter(quarter))
        if price_tier:
            query = query.where(Board.price_tier == price_tier)
        if status:
            query = query.where(Board.status == BoardStatus(status))
        query = query.limit(limit).offset(offset).order_by(Board.created_at.desc())
        result = await session.execute(query)
        boards = result.scalars().unique().all()
        return [
            {
                "id": b.id,
                "game_id": b.game_id,
                "home_team": b.game.home_team,
                "away_team": b.game.away_team,
                "home_team_logo": b.game.home_team_logo,
                "away_team_logo": b.game.away_team_logo,
                "sport": b.game.sport.value,
                "quarter": b.quarter.value,
                "price_tier_gc": b.price_tier,
                "entry_currency": b.entry_currency,
                "payout_sc": int(b.price_tier * 10 * 0.90),
                "status": b.status.value,
                "is_private": b.is_private,
                "created_at": b.created_at.isoformat(),
            }
            for b in boards
        ]


@router.get("/{board_id}")
async def get_board(board_id: str):
    async with async_session() as session:
        result = await session.execute(
            select(Board).options(joinedload(Board.game)).where(Board.id == board_id)
        )
        board = result.scalars().first()
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        return {
            "id": board.id,
            "game_id": board.game_id,
            "home_team": board.game.home_team,
            "away_team": board.game.away_team,
            "sport": board.game.sport.value,
            "quarter": board.quarter.value,
            "price_tier_gc": board.price_tier,
            "entry_currency": board.entry_currency,
            "payout_sc": int(board.price_tier * 10 * 0.90),
            "status": board.status.value,
            "is_private": board.is_private,
            "share_link": board.share_link,
            "created_at": board.created_at.isoformat(),
        }


# Valid Gold Coin price tiers per square
VALID_GC_TIERS = [50, 100, 250, 500, 1000, 2500]

@router.post("/")
async def create_board(
    game_id: str,
    quarter: str,
    price_tier: int,
    is_private: bool = False,
    token: Annotated[str | None, Cookie(alias="session")] = None,
):
    user = await _get_user_from_token(token)
    if is_private and not user:
        raise HTTPException(status_code=401, detail="Must be logged in to create a private board")

    if quarter not in [q.value for q in Quarter]:
        raise HTTPException(status_code=400, detail="Invalid quarter")
    if price_tier not in VALID_GC_TIERS:
        raise HTTPException(status_code=400, detail=f"Invalid price tier. Choose from: {VALID_GC_TIERS}")

    async with async_session() as session:
        game_result = await session.execute(select(Game).where(Game.id == game_id))
        game = game_result.scalar_one_or_none()
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")

        share_link = str(uuid.uuid4()) if is_private else None
        board = Board(
            id=str(uuid.uuid4()),
            game_id=game_id,
            quarter=Quarter(quarter),
            price_tier=price_tier,
            status=BoardStatus.OPEN,
            is_private=is_private,
            share_link=share_link,
            created_by=user.id if user else None,
        )
        session.add(board)
        await session.flush()

        # Pre-create 10 empty squares
        for pos in range(10):
            square = Square(
                id=str(uuid.uuid4()),
                board_id=board.id,
                position=pos,
            )
            session.add(square)

        await session.commit()
        return {"id": board.id, "share_link": board.share_link}
