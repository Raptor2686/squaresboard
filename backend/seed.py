"""
Seed script — populates the DB with sample games and boards for testing.
Run with: python -m app.seed
"""
import uuid
from datetime import datetime, timedelta
from app.database import async_session, engine
from app.models import Base, Game, Board, Square, Sport, Quarter, BoardStatus, GameStatus


MOCK_GAMES = [
    # Football
    {
        "sport": Sport.FOOTBALL,
        "external_id": "nfl_001",
        "home_team": "Kansas City Chiefs",
        "away_team": "Philadelphia Eagles",
        "home_team_logo": "https://www.thesportsdb.com/images/kits/kansas_city_chiefs.png",
        "event_time": datetime.utcnow() + timedelta(hours=2),
    },
    {
        "sport": Sport.FOOTBALL,
        "external_id": "nfl_002",
        "home_team": "San Francisco 49ers",
        "away_team": "Dallas Cowboys",
        "home_team_logo": "https://www.thesportsdb.com/images/kits/san_francisco_49ers.png",
        "event_time": datetime.utcnow() + timedelta(days=1),
    },
    # Basketball
    {
        "sport": Sport.BASKETBALL,
        "external_id": "nba_001",
        "home_team": "Los Angeles Lakers",
        "away_team": "Boston Celtics",
        "home_team_logo": "https://www.thesportsdb.com/images/kits/los_angeles_lakers.png",
        "event_time": datetime.utcnow() + timedelta(hours=5),
    },
    {
        "sport": Sport.BASKETBALL,
        "external_id": "nba_002",
        "home_team": "Miami Heat",
        "away_team": "Denver Nuggets",
        "home_team_logo": "https://www.thesportsdb.com/images/kits/miami_heat.png",
        "event_time": datetime.utcnow() + timedelta(days=2),
    },
    # Baseball
    {
        "sport": Sport.BASEBALL,
        "external_id": "mlb_001",
        "home_team": "New York Yankees",
        "away_team": "Los Angeles Dodgers",
        "home_team_logo": "https://www.thesportsdb.com/images/kits/new_york_yankees.png",
        "event_time": datetime.utcnow() + timedelta(hours=8),
    },
]

PRICE_TIERS = [1, 5, 10, 20, 100]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    for gdata in MOCK_GAMES:
        async with async_session() as session:
            sport = gdata["sport"]
            event_time = gdata["event_time"]

            # Quarter start times
            if sport == Sport.FOOTBALL:
                q_deltas = [0, 15, 30, 45]  # minutes
            elif sport == Sport.BASKETBALL:
                q_deltas = [0, 12, 24, 36]
            else:  # baseball — 9 innings, use quarters as innings
                q_deltas = [0, 20, 40, 60]

            game = Game(
                id=str(uuid.uuid4()),
                external_id=gdata["external_id"],
                sport=sport,
                home_team=gdata["home_team"],
                away_team=gdata["away_team"],
                home_team_logo=gdata.get("home_team_logo"),
                event_time=event_time,
                q1_start=event_time + timedelta(minutes=q_deltas[0]),
                q2_start=event_time + timedelta(minutes=q_deltas[1]),
                q3_start=event_time + timedelta(minutes=q_deltas[2]),
                q4_start=event_time + timedelta(minutes=q_deltas[3]),
                status=GameStatus.UPCOMING,
            )
            session.add(game)
            await session.commit()

            # Create boards for each quarter × price tier
            for quarter in [Quarter.Q1, Quarter.Q2, Quarter.Q3, Quarter.Q4]:
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
                    await session.commit()

                    # Pre-create 10 empty squares
                    for pos in range(10):
                        square = Square(
                            id=str(uuid.uuid4()),
                            board_id=board.id,
                            position=pos,
                        )
                        session.add(square)
                    await session.commit()

            print(f"Seeded: {gdata['away_team']} @ {gdata['home_team']} ({sport.value})")

    print(f"\nDone! Seeded {len(MOCK_GAMES)} games.")


if __name__ == "__main__":
    import asyncio
    asyncio.run(seed())
