import uuid
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select
from app.database import async_session
from app.models import Board, BoardStatus, Quarter

router = APIRouter()


@router.get("/")
async def list_boards(
    sport: str | None = None,
    quarter: str | None = None,
    price_tier: float | None = None,
    status: str | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
):
    async with async_session() as session:
        query = select(Board).where(Board.is_private == False)
        if sport:
            query = query.where(Board.quarter == quarter)
        if quarter:
            query = query.where(Board.quarter == quarter)
        if price_tier:
            query = query.where(Board.price_tier == price_tier)
        if status:
            query = query.where(Board.status == status)
        query = query.limit(limit).offset(offset)
        result = await session.execute(query)
        boards = result.scalars().all()
        return [
            {
                "id": b.id,
                "game_id": b.game_id,
                "quarter": b.quarter,
                "price_tier": b.price_tier,
                "status": b.status,
                "is_private": b.is_private,
                "created_at": b.created_at.isoformat(),
            }
            for b in boards
        ]


@router.get("/{board_id}")
async def get_board(board_id: str):
    async with async_session() as session:
        result = await session.execute(select(Board).where(Board.id == board_id))
        board = result.scalar_one_or_none()
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        return {
            "id": board.id,
            "game_id": board.game_id,
            "quarter": board.quarter,
            "price_tier": board.price_tier,
            "status": board.status,
            "is_private": board.is_private,
            "share_link": board.share_link,
            "created_at": board.created_at.isoformat(),
        }


@router.post("/")
async def create_board(
    game_id: str,
    quarter: str,
    price_tier: float,
    is_private: bool = False,
    created_by: str | None = None,
):
    if quarter not in [q.value for q in Quarter]:
        raise HTTPException(status_code=400, detail="Invalid quarter")
    if price_tier not in [0.50, 1, 2, 5, 10, 20, 50, 100, 1000, 10000]:
        raise HTTPException(status_code=400, detail="Invalid price tier")

    share_link = str(uuid.uuid4()) if is_private else None

    async with async_session() as session:
        board = Board(
            id=str(uuid.uuid4()),
            game_id=game_id,
            quarter=Quarter(quarter),
            price_tier=price_tier,
            status=BoardStatus.OPEN,
            is_private=is_private,
            share_link=share_link,
            created_by=created_by,
        )
        session.add(board)
        await session.commit()
        return {"id": board.id, "share_link": board.share_link}
