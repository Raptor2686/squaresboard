import uuid
import httpx
from datetime import datetime, timezone
from sqlalchemy import select
from app.database import async_session
from app.models import Game, Board, Square, BoardStatus, GameStatus, Quarter, User, Transaction, Payout
from app.services.payout import send_payout


async def fetch_live_scores(external_id: str) -> tuple[int | None, int | None, bool]:
    """
    Fetch current scores from TheSportsDB.
    Returns (home_score, away_score, is_final).
    is_final=True means the game/quarter has ended.
    """
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://www.thesportsdb.com/api/v1/json/1/eventsummary.php",
                params={"id": external_id},
                timeout=10.0,
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("error") or not data.get("events"):
                return None, None, False
            event = data["events"][0]
            home = int(event.get("intHomeScore") or 0)
            away = int(event.get("intAwayScore") or 0)
            # strStatus like "2nd Quarter", "Half", "Final", "Final/OT"
            status: str = event.get("strStatus", "")
            is_final = "final" in status.lower()
            return home, away, is_final
    except Exception as e:
        print(f"[score_polling] fetch failed for {external_id}: {e}")
        return None, None, False


def determine_winning_number(home_score: int, away_score: int) -> int:
    """Last digit of sum of both teams' scores."""
    return (home_score + away_score) % 10


def get_quarter_from_time(game: Game, now: datetime) -> Quarter | None:
    """Determine which quarter the game is currently in based on wall-clock time."""
    if now < game.q1_start:
        return None  # hasn't started
    if game.q1_start <= now < (game.q2_start or game.q1_start):
        return Quarter.Q1
    if game.q2_start and game.q3_start and now < game.q3_start:
        return Quarter.Q2
    if game.q3_start and game.q4_start and now < game.q4_start:
        return Quarter.Q3
    if game.q4_start and now >= game.q4_start:
        return Quarter.Q4
    return None


async def resolve_board(board_id: str, home_score: int, away_score: int):
    """Find winning square, update board, credit winner wallet, record rake."""
    winning_number = determine_winning_number(home_score, away_score)

    async with async_session() as session:
        board_result = await session.execute(
            select(Board).where(Board.id == board_id)
        )
        board = board_result.scalar_one_or_none()
        if not board:
            return

        squares_result = await session.execute(
            select(Square).where(Square.board_id == board_id)
        )
        winner = None
        for sq in squares_result.scalars().all():
            if sq.number == winning_number:
                winner = sq
                break

        board.status = BoardStatus.RESOLVED
        board.winning_square_id = winner.id if winner else None

        price_cents = int(board.price_tier * 100)
        payout_cents = price_cents * 9   # 90% to winner
        rake_cents = price_cents * 1     # 10% to house

        if winner and winner.owner_id:
            # Credit winner wallet
            user_result = await session.execute(
                select(User).where(User.id == winner.owner_id)
            )
            user = user_result.scalar_one_or_none()
            if user:
                user.balance_cents += payout_cents

            payout_tx = Transaction(
                id=str(uuid.uuid4()),
                user_id=winner.owner_id,
                board_id=board_id,
                amount_cents=payout_cents,
                type="payout",
            )
            session.add(payout_tx)

        # Record house rake
        rake_tx = Transaction(
            id=str(uuid.uuid4()),
            user_id=None,
            board_id=board_id,
            amount_cents=rake_cents,
            type="rake",
        )
        session.add(rake_tx)
        await session.commit()


async def poll_active_boards():
    """
    Poll all LOCKED boards and resolve them when their quarter ends.
    """
    # Fetch board IDs only (avoids detached object issues)
    async with async_session() as session:
        result = await session.execute(
            select(Board.id, Board.game_id, Board.quarter).where(
                Board.status == BoardStatus.LOCKED
            )
        )
        board_rows = result.all()

    now = datetime.now(timezone.utc)

    for board_id, game_id, board_quarter in board_rows:
        async with async_session() as session:
            game_result = await session.execute(
                select(Game).where(Game.id == game_id)
            )
            game = game_result.scalar_one_or_none()
            if not game:
                continue

            home_score, away_score, is_final = await fetch_live_scores(game.external_id)
            if home_score is None:
                continue

            game.home_score = home_score
            game.away_score = away_score

            if is_final and game.status != GameStatus.COMPLETED:
                game.status = GameStatus.COMPLETED
            elif game.status == GameStatus.UPCOMING:
                game.status = GameStatus.LIVE

            await session.commit()

            current_quarter = get_quarter_from_time(game, now)
            quarter_match = current_quarter and current_quarter.value == board_quarter.value

            if quarter_match or game.status == GameStatus.COMPLETED:
                await resolve_board(board_id, home_score, away_score)
