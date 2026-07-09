import uuid
import random
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Cookie
from pydantic import BaseModel, EmailStr
from typing import Annotated
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.database import async_session
from app.models import Game, Board, Square, User, Transaction, Sport, Quarter, BoardStatus, GameStatus
from app.services.score_polling import resolve_board

router = APIRouter()


class MockGameRequest(BaseModel):
    home_team: str
    away_team: str
    sport: str  # football, basketball, baseball


@router.post("/games/mock")
async def create_mock_game(data: MockGameRequest):
    if data.sport not in [s.value for s in Sport]:
        raise HTTPException(status_code=400, detail="Invalid sport")

    event_time = datetime.now(timezone.utc) + timedelta(hours=1)
    # Define simple start times for quarters
    q_deltas = [0, 15, 30, 45]

    async with async_session() as session:
        # Create a mock game
        game = Game(
            id=str(uuid.uuid4()),
            external_id=f"mock_{uuid.uuid4().hex[:10]}",
            sport=Sport(data.sport),
            home_team=data.home_team,
            away_team=data.away_team,
            event_time=event_time,
            q1_start=event_time,
            q2_start=event_time + timedelta(minutes=q_deltas[1]),
            q3_start=event_time + timedelta(minutes=q_deltas[2]),
            q4_start=event_time + timedelta(minutes=q_deltas[3]),
            status=GameStatus.UPCOMING,
        )
        session.add(game)
        await session.commit()
        await session.refresh(game)

        # Create one Q1 board and Q2 board for testing at $1, $5 price tiers
        PRICE_TIERS = [1.0, 5.0]
        for quarter in [Quarter.Q1, Quarter.Q2]:
            for price in PRICE_TIERS:
                board = Board(
                    id=str(uuid.uuid4()),
                    game_id=game.id,
                    quarter=quarter,
                    price_tier=price,
                    status=BoardStatus.OPEN,
                    is_private=False,
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

    return {"ok": True, "game_id": game.id}


@router.post("/boards/{board_id}/fill-mock")
async def fill_mock_players(board_id: str):
    """Fill all remaining empty squares on a board with mock users."""
    async with async_session() as session:
        # Get board
        board_result = await session.execute(
            select(Board).where(Board.id == board_id)
        )
        board = board_result.scalar_one_or_none()
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        if board.status != BoardStatus.OPEN:
            raise HTTPException(status_code=400, detail="Board is not open for purchases")

        # Get empty squares
        squares_result = await session.execute(
            select(Square).where(Square.board_id == board_id).order_by(Square.position)
        )
        squares = squares_result.scalars().all()
        empty_squares = [s for s in squares if s.owner_id is None]

        if not empty_squares:
            raise HTTPException(status_code=400, detail="Board is already full")

        # Setup 10 mock users
        mock_user_emails = [f"mock_player_{i}@example.com" for i in range(1, 11)]
        mock_users = []

        for email in mock_user_emails:
            # Find or create mock user
            user_result = await session.execute(
                select(User).where(User.email == email)
            )
            user = user_result.scalar_one_or_none()
            if not user:
                user = User(
                    id=str(uuid.uuid4()),
                    email=email,
                    password_hash="mock-pass",
                    display_name=f"Player {email.split('_')[2].split('@')[0].upper()}",
                    balance_cents=10000,  # $100 starting balance
                )
                session.add(user)
                await session.flush()
            mock_users.append(user)

        # Assign remaining empty squares to mock users
        # Filter mock users who do not already own a square on this board to keep it interesting,
        # or just pick randomly.
        random.shuffle(mock_users)
        for i, sq in enumerate(empty_squares):
            sq.owner_id = mock_users[i % len(mock_users)].id
            sq.purchased_at = datetime.utcnow()

        # Shuffle numbers 0-9 and assign them since it's full now
        all_squares_filled = all(s.owner_id is not None for s in squares)
        if all_squares_filled:
            numbers = list(range(10))
            random.shuffle(numbers)
            for i, sq in enumerate(squares):
                sq.number = numbers[i]
            board.status = BoardStatus.LOCKED

        await session.commit()

    return {"ok": True, "board_status": board.status}


class UpdateScoreRequest(BaseModel):
    home_score: int
    away_score: int
    status: str  # upcoming, live, completed


@router.post("/games/{game_id}/update-score")
async def update_game_score(game_id: str, data: UpdateScoreRequest):
    if data.status not in [s.value for s in GameStatus]:
        raise HTTPException(status_code=400, detail="Invalid status")

    async with async_session() as session:
        game_result = await session.execute(
            select(Game).where(Game.id == game_id)
        )
        game = game_result.scalar_one_or_none()
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")

        game.home_score = data.home_score
        game.away_score = data.away_score
        game.status = GameStatus(data.status)
        await session.commit()

    return {"ok": True}


class ResolveBoardRequest(BaseModel):
    home_score: int
    away_score: int


@router.post("/boards/{board_id}/resolve-mock")
async def resolve_board_manually(board_id: str, data: ResolveBoardRequest):
    """Manually trigger resolve_board logic using specified scores."""
    async with async_session() as session:
        # Load board and game
        board_result = await session.execute(
            select(Board).options(joinedload(Board.game)).where(Board.id == board_id)
        )
        board = board_result.scalar_one_or_none()
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        if board.status != BoardStatus.LOCKED:
            raise HTTPException(status_code=400, detail="Board must be LOCKED to resolve")

        # Update parent game score
        game = board.game
        game.home_score = data.home_score
        game.away_score = data.away_score
        game.status = GameStatus.COMPLETED if board.quarter == Quarter.Q4 else GameStatus.LIVE
        await session.commit()

    # Call the services resolution function
    await resolve_board(board_id, data.home_score, data.away_score)

    return {"ok": True}


class CreditRequest(BaseModel):
    amount_cents: int


@router.post("/wallet/credit")
async def credit_wallet_sandbox(data: CreditRequest, token: Annotated[str | None, Cookie(alias="session")] = None):
    user = await _get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if data.amount_cents <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    async with async_session() as session:
        db_user = await session.get(User, user.id)
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")

        db_user.balance_cents += data.amount_cents
        tx = Transaction(
            id=str(uuid.uuid4()),
            user_id=user.id,
            amount_cents=data.amount_cents,
            type="sandbox_credit",
            reference_id=str(uuid.uuid4()),
        )
        session.add(tx)
        await session.commit()

    return {"ok": True, "new_balance_cents": db_user.balance_cents}
