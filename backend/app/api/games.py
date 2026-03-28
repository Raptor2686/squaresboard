from fastapi import APIRouter, Query
from sqlalchemy import select
from app.database import async_session
from app.models import Game

router = APIRouter()


@router.get("/")
async def list_games(
    sport: str | None = None,
    status: str | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
):
    async with async_session() as session:
        query = select(Game)
        if sport:
            query = query.where(Game.sport == sport)
        if status:
            query = query.where(Game.status == status)
        query = query.order_by(Game.event_time).limit(limit).offset(offset)
        result = await session.execute(query)
        games = result.scalars().all()
        return [
            {
                "id": g.id,
                "external_id": g.external_id,
                "sport": g.sport,
                "home_team": g.home_team,
                "away_team": g.away_team,
                "home_team_logo": g.home_team_logo,
                "away_team_logo": g.away_team_logo,
                "event_time": g.event_time.isoformat(),
                "q1_start": g.q1_start.isoformat() if g.q1_start else None,
                "q2_start": g.q2_start.isoformat() if g.q2_start else None,
                "q3_start": g.q3_start.isoformat() if g.q3_start else None,
                "q4_start": g.q4_start.isoformat() if g.q4_start else None,
                "home_score": g.home_score,
                "away_score": g.away_score,
                "status": g.status,
            }
            for g in games
        ]


@router.get("/{game_id}")
async def get_game(game_id: str):
    async with async_session() as session:
        result = await session.execute(select(Game).where(Game.id == game_id))
        game = result.scalar_one_or_none()
        if not game:
            return {"error": "Game not found"}
        return {
            "id": game.id,
            "sport": game.sport,
            "home_team": game.home_team,
            "away_team": game.away_team,
            "event_time": game.event_time.isoformat(),
            "home_score": game.home_score,
            "away_score": game.away_score,
            "status": game.status,
        }
