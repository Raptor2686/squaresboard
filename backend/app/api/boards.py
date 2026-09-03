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
    price_tier: float | None = None,
    entry_currency: str | None = None,
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
        if price_tier is not None:
            query = query.where(Board.price_tier == price_tier)
        if entry_currency:
            query = query.where(Board.entry_currency == entry_currency.upper())
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
                "payout_sc": int(b.price_tier * 10 * 0.90) if (b.price_tier * 10 * 0.90).is_integer() else round(b.price_tier * 10 * 0.90, 2),
                "status": b.status.value,
                "is_private": b.is_private,
                "created_at": b.created_at.isoformat(),
            }
            for b in boards
        ]


@router.get("/next-available")
async def get_next_available_board(
    game_id: str,
    quarter: str,
    price_tier: float,
    entry_currency: str = "GC",
):
    currency = entry_currency.upper()
    if quarter not in [q.value for q in Quarter]:
        raise HTTPException(status_code=400, detail="Invalid quarter")

    async with async_session() as session:
        # Check game exists
        game_res = await session.execute(select(Game).where(Game.id == game_id))
        game = game_res.scalar_one_or_none()
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")

        # Find first OPEN board with <10 squares claimed
        boards_res = await session.execute(
            select(Board)
            .options(joinedload(Board.game))
            .where(
                Board.game_id == game_id,
                Board.quarter == Quarter(quarter),
                Board.price_tier == price_tier,
                Board.entry_currency == currency,
                Board.is_private == False,
                Board.status == BoardStatus.OPEN,
            )
            .order_by(Board.created_at.asc())
        )
        candidates = boards_res.scalars().unique().all()
        target_board = None
        target_squares = None

        for b in candidates:
            sq_res = await session.execute(
                select(Square)
                .options(joinedload(Square.owner))
                .where(Square.board_id == b.id)
                .order_by(Square.position)
            )
            squares = sq_res.scalars().all()
            unclaimed = [s for s in squares if s.owner_id is None]
            if len(unclaimed) > 0:
                target_board = b
                target_squares = squares
                break

        # If no open board with empty squares exists, create a new one automatically
        if not target_board:
            target_board = Board(
                id=str(uuid.uuid4()),
                game_id=game_id,
                quarter=Quarter(quarter),
                price_tier=price_tier,
                entry_currency=currency,
                status=BoardStatus.OPEN,
                is_private=False,
            )
            session.add(target_board)
            await session.flush()

            target_squares = []
            for pos in range(10):
                square = Square(
                    id=str(uuid.uuid4()),
                    board_id=target_board.id,
                    position=pos,
                )
                session.add(square)
                target_squares.append(square)
            await session.commit()

            # Re-fetch with relationships loaded
            refetched = await session.execute(
                select(Board)
                .options(joinedload(Board.game))
                .where(Board.id == target_board.id)
            )
            target_board = refetched.scalar_one()

        total_pot_gc = target_board.price_tier * 10
        raw_payout = total_pot_gc * 0.90
        payout_sc = int(raw_payout) if raw_payout.is_integer() else round(raw_payout, 2)

        return {
            "board_id": target_board.id,
            "game": {
                "id": target_board.game.id,
                "home_team": target_board.game.home_team,
                "away_team": target_board.game.away_team,
                "home_team_logo": target_board.game.home_team_logo,
                "away_team_logo": target_board.game.away_team_logo,
                "event_time": target_board.game.event_time.isoformat(),
                "status": target_board.game.status,
                "home_score": target_board.game.home_score,
                "away_score": target_board.game.away_score,
            },
            "quarter": target_board.quarter.value,
            "price_tier_gc": target_board.price_tier,
            "entry_currency": target_board.entry_currency,
            "payout_sc": payout_sc,
            "board_status": target_board.status.value,
            "is_private": target_board.is_private,
            "share_link": target_board.share_link,
            "winning_number": next((s.number for s in target_squares if s.id == target_board.winning_square_id), None),
            "squares": [
                {
                    "id": s.id,
                    "position": s.position,
                    "number": s.number,
                    "owner_id": s.owner_id,
                    "owner_name": s.owner.display_name if s.owner else None,
                }
                for s in target_squares
            ],
        }


@router.get("/game/{game_id}")
async def list_game_boards(game_id: str):
    async with async_session() as session:
        query = (
            select(Board)
            .options(joinedload(Board.game))
            .where(Board.game_id == game_id, Board.is_private == False)
            .order_by(Board.quarter, Board.price_tier)
        )
        result = await session.execute(query)
        boards = result.scalars().unique().all()

        board_summaries = []
        for b in boards:
            sq_result = await session.execute(
                select(Square).where(Square.board_id == b.id)
            )
            squares = sq_result.scalars().all()
            claimed_count = sum(1 for s in squares if s.owner_id is not None)
            raw_payout = b.price_tier * 10 * 0.90
            payout_sc = int(raw_payout) if raw_payout.is_integer() else round(raw_payout, 2)
            board_summaries.append({
                "id": b.id,
                "quarter": b.quarter.value,
                "price_tier": b.price_tier,
                "entry_currency": b.entry_currency,
                "payout_sc": payout_sc,
                "status": b.status.value,
                "claimed_count": claimed_count,
                "created_at": b.created_at.isoformat(),
            })
        return board_summaries


@router.get("/{board_id}")
async def get_board(board_id: str):
    async with async_session() as session:
        result = await session.execute(
            select(Board).options(joinedload(Board.game)).where(Board.id == board_id)
        )
        board = result.scalars().first()
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        raw_payout = board.price_tier * 10 * 0.90
        payout_sc = int(raw_payout) if raw_payout.is_integer() else round(raw_payout, 2)
        return {
            "id": board.id,
            "game_id": board.game_id,
            "home_team": board.game.home_team,
            "away_team": board.game.away_team,
            "sport": board.game.sport.value,
            "quarter": board.quarter.value,
            "price_tier_gc": board.price_tier,
            "entry_currency": board.entry_currency,
            "payout_sc": payout_sc,
            "status": board.status.value,
            "is_private": board.is_private,
            "share_link": board.share_link,
            "created_at": board.created_at.isoformat(),
        }


# Valid coin price tiers per square
VALID_GC_TIERS = [0.5, 1, 5, 10, 20, 50, 100, 250, 500, 1000, 2000, 5000, 10000, 100000]
VALID_SC_TIERS = [0.5, 1, 5, 10, 20, 50, 100, 1000]

@router.post("/")
async def create_board(
    game_id: str,
    quarter: str,
    price_tier: float,
    entry_currency: str = "GC",
    is_private: bool = False,
    token: Annotated[str | None, Cookie(alias="session")] = None,
):
    user = await _get_user_from_token(token)
    if is_private and not user:
        raise HTTPException(status_code=401, detail="Must be logged in to create a private board")

    if quarter not in [q.value for q in Quarter]:
        raise HTTPException(status_code=400, detail="Invalid quarter")

    currency = entry_currency.upper()
    if currency == "SC":
        if price_tier not in VALID_SC_TIERS:
            raise HTTPException(status_code=400, detail=f"Invalid SC price tier. Choose from: {VALID_SC_TIERS}")
    elif currency == "GC":
        if price_tier not in VALID_GC_TIERS:
            raise HTTPException(status_code=400, detail=f"Invalid GC price tier. Choose from: {VALID_GC_TIERS}")
    else:
        raise HTTPException(status_code=400, detail="Invalid currency. Must be GC or SC")

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
            entry_currency=currency,
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
        return {"id": board.id, "share_link": board.share_link, "entry_currency": board.entry_currency}
