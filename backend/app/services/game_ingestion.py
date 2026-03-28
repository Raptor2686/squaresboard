import uuid
import httpx
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from app.database import async_session
from app.models import Game, Board, Square, BoardStatus, Sport, Quarter

THESPORTSDB_BASE = "https://www.thesportsdb.com/api/v1/json/123"

PRICE_TIERS = [0.50, 1, 2, 5, 10, 20, 50, 100, 1000, 10000]

SPORT_LEAGUE_IDS = {
    "football": "4391",
    "basketball": "4387",
    "baseball": "4424",
}

QUARTER_DURATIONS = {
    Quarter.Q1: timedelta(minutes=15),
    Quarter.Q2: timedelta(minutes=15),
    Quarter.Q3: timedelta(minutes=15),
    Quarter.Q4: timedelta(minutes=15),
}


async def fetch_upcoming_games(sport: str, days_ahead: int = 7) -> list[dict]:
    league_id = SPORT_LEAGUE_IDS.get(sport)
    if not league_id:
        return []

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{THESPORTSDB_BASE}/eventsnextleague.php",
                params={"id": league_id},
                timeout=10.0,
            )
            resp.raise_for_status()
            data = resp.json()
            events = data.get("events", []) or []
            return [
                {
                    "external_id": e["idEvent"],
                    "home_team": e["strHomeTeam"],
                    "away_team": e["strAwayTeam"],
                    "event_time": e["dateEvent"] + " " + e["strTime"],
                    "home_team_logo": e.get("strThumb"),
                    "away_team_logo": e.get("strAwayTeamThumb"),
                }
                for e in events
                if e.get("strTime")
            ]
    except Exception as e:
        print(f"[game_ingestion] Failed to fetch {sport} games: {e}")
        return []


async def run():
    for sport in ["football", "basketball", "baseball"]:
        games_data = await fetch_upcoming_games(sport)
        for gdata in games_data:
            async with async_session() as session:
                existing = await session.execute(
                    select(Game).where(Game.external_id == gdata["external_id"])
                )
                if existing.scalar_one_or_none():
                    continue

                try:
                    event_dt = datetime.strptime(gdata["event_time"], "%Y-%m-%d %H:%M:%S")
                    event_dt = event_dt.replace(tzinfo=timezone.utc)
                except ValueError:
                    event_dt = datetime.now(timezone.utc)

                # Quarter start times — rough estimates
                # NFL: Q1=0min, Q2=15min, Q3=30min, Q4=45min (60min game)
                # NBA: Q1=12min, Q2=24min, Q3=36min, Q4=48min
                # MLB: Innings instead of quarters — treat as 9 innings × ~20min
                if sport == "football":
                    q_delta = timedelta(minutes=15)
                elif sport == "basketball":
                    q_delta = timedelta(minutes=12)
                else:
                    q_delta = timedelta(minutes=3)  # innings — shorter blocks for board creation

                game = Game(
                    id=str(uuid.uuid4()),
                    external_id=gdata["external_id"],
                    sport=Sport(sport),
                    home_team=gdata["home_team"],
                    away_team=gdata["away_team"],
                    home_team_logo=gdata.get("home_team_logo"),
                    away_team_logo=gdata.get("away_team_logo"),
                    event_time=event_dt,
                    q1_start=event_dt,
                    q2_start=event_dt + q_delta,
                    q3_start=event_dt + q_delta * 2,
                    q4_start=event_dt + q_delta * 3,
                )
                session.add(game)
                await session.commit()

                # Auto-create one board per quarter per price tier
                for quarter in Quarter:
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

                        # Pre-create all 10 squares (unowned until purchase)
                        for pos in range(10):
                            square = Square(
                                id=str(uuid.uuid4()),
                                board_id=board.id,
                                position=pos,
                            )
                            session.add(square)
                        await session.commit()
