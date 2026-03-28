import httpx
from sqlalchemy import select
from app.database import async_session
from app.models import Game, Board, Square, BoardStatus, GameStatus


async def fetch_live_scores(external_id: str, sport: str) -> tuple[int | None, int | None]:
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://www.thesportsdb.com/api/v1/json/1/eventsummary.php",
                params={"id": external_id},
                timeout=10.0,
            )
            data = resp.json()
            if data.get("error"):
                return None, None
            event = data.get("events", [{}])[0]
            home = int(event.get("intHomeScore") or 0)
            away = int(event.get("intAwayScore") or 0)
            return home, away
    except Exception as e:
        print(f"Score fetch failed for {external_id}: {e}")
        return None, None


async def determine_winner(home_score: int, away_score: int) -> int:
    return (home_score + away_score) % 10


async def poll_active_boards():
    async with async_session() as session:
        result = await session.execute(
            select(Board).where(Board.status == BoardStatus.LOCKED)
        )
        boards = result.scalars().all()

        for board in boards:
            game_result = await session.execute(
                select(Game).where(Game.id == board.game_id)
            )
            game = game_result.scalar_one_or_none()
            if not game:
                continue

            if game.status == GameStatus.COMPLETED:
                continue

            home_score, away_score = await fetch_live_scores(game.external_id, game.sport)
            if home_score is None:
                continue

            game.home_score = home_score
            game.away_score = away_score

            if game.status != GameStatus.LIVE:
                game.status = GameStatus.LIVE

            # Determine if quarter is over (simple: check if game status says completed)
            if game.status == GameStatus.COMPLETED:
                winning_number = determine_winner(home_score, away_score)
                squares_result = await session.execute(
                    select(Square).where(Square.board_id == board.id)
                )
                for sq in squares_result.scalars().all():
                    if sq.number == winning_number:
                        board.winning_square_id = sq.id
                        board.status = BoardStatus.RESOLVED
                        # Trigger payout
                        await trigger_payout(sq, board.price_tier)
                        break
                await session.commit()


async def trigger_payout(winning_square, price_tier):
    from app.services.payout import send_payout
    await send_payout(winning_square.owner_id, price_tier * 9 * 100)  # cents
