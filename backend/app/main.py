import os
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.database import init_db
from app.config import settings
from app.api import (
    auth,
    games,
    boards,
    squares,
    users,
    webhooks,
    wallet,
)
from app.services import (
    game_ingestion,
    score_polling,
)


scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    scheduler.add_job(game_ingestion.run, "interval", hours=6, id="game_ingestion")
    scheduler.add_job(score_polling.poll_active_boards, "interval", minutes=5, id="score_polling")
    scheduler.start()
    yield
    # Shutdown
    scheduler.shutdown()


app = FastAPI(
    title="SquaresBoard API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth")
app.include_router(users.router, prefix="/api/users")
app.include_router(games.router, prefix="/api/games")
app.include_router(boards.router, prefix="/api/boards")
app.include_router(squares.router, prefix="/api/squares")
app.include_router(webhooks.router, prefix="/api/webhooks")
app.include_router(wallet.router, prefix="/api/wallet")
