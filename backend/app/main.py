import os
import sqlite3
import asyncio
import uuid
from contextlib import asynccontextmanager
from datetime import datetime

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
    simulator,
)
from app.services import (
    game_ingestion,
    score_polling,
)


scheduler = AsyncIOScheduler()


def _run_migrations():
    """
    Idempotent SQLite schema migration for the sweepstakes dual-currency model.
    Runs on every startup — skips steps that are already applied.
    """
    db_url = settings.DATABASE_URL or ""
    # Extract the file path from sqlite+aiosqlite:///./path or ////abs/path
    if "sqlite" not in db_url:
        print("[migrate] Non-SQLite DB detected, skipping SQLite migration.")
        return

    db_path = db_url.split("///")[-1].lstrip("/")
    # Handle absolute paths (////var/data/...) vs relative (./squaresboard.db)
    if db_url.count("///") >= 2 and not db_path.startswith("."):
        db_path = "/" + db_path

    if not os.path.exists(db_path):
        print(f"[migrate] DB not found at {db_path} — will be created by init_db(). Skipping migration.")
        return

    print(f"[migrate] Running schema migrations on {db_path} ...")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    def col_exists(table, col):
        cur.execute(f"PRAGMA table_info({table})")
        return any(row["name"] == col for row in cur.fetchall())

    def table_exists(tbl):
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (tbl,))
        return cur.fetchone() is not None

    applied = []

    # ── users: dual-currency wallet columns ──────────────────────────────────
    for col, ddl in [
        ("gold_coins",         "ALTER TABLE users ADD COLUMN gold_coins INTEGER NOT NULL DEFAULT 0"),
        ("sweep_coins",        "ALTER TABLE users ADD COLUMN sweep_coins INTEGER NOT NULL DEFAULT 0"),
        ("last_free_sc_claim", "ALTER TABLE users ADD COLUMN last_free_sc_claim DATETIME NULL"),
    ]:
        if not col_exists("users", col):
            cur.execute(ddl)
            applied.append(f"users.{col}")

    # ── boards: entry_currency + int price_tier ───────────────────────────────
    if not col_exists("boards", "entry_currency"):
        cur.execute("ALTER TABLE boards ADD COLUMN entry_currency VARCHAR(5) NOT NULL DEFAULT 'GC'")
        applied.append("boards.entry_currency")

    # Convert old float dollar price_tiers to int GC amounts
    float_to_gc = {0.5: 50, 1.0: 50, 2.0: 100, 5.0: 100, 10.0: 100,
                   20.0: 250, 50.0: 500, 100.0: 1000, 1000.0: 2500, 10000.0: 2500}
    cur.execute("SELECT id, price_tier FROM boards")
    for b in cur.fetchall():
        old = b["price_tier"]
        if isinstance(old, float) or (old is not None and float(old) < 50):
            new_tier = float_to_gc.get(float(old), 100)
            cur.execute("UPDATE boards SET price_tier = ? WHERE id = ?", (new_tier, b["id"]))
            applied.append(f"boards.price_tier converted ({old}->{new_tier})")

    # ── games: team logos ─────────────────────────────────────────────────────
    for col, ddl in [
        ("home_team_logo", "ALTER TABLE games ADD COLUMN home_team_logo VARCHAR(500) NULL"),
        ("away_team_logo", "ALTER TABLE games ADD COLUMN away_team_logo VARCHAR(500) NULL"),
    ]:
        if not col_exists("games", col):
            cur.execute(ddl)
            applied.append(f"games.{col}")

    # ── transactions: currency + amount columns + type renames ────────────────
    if not col_exists("transactions", "currency"):
        cur.execute("ALTER TABLE transactions ADD COLUMN currency VARCHAR(10) NOT NULL DEFAULT 'GC'")
        applied.append("transactions.currency")

    if not col_exists("transactions", "amount"):
        cur.execute("ALTER TABLE transactions ADD COLUMN amount INTEGER NOT NULL DEFAULT 0")
        cur.execute("UPDATE transactions SET amount = amount_cents WHERE amount_cents IS NOT NULL")
        applied.append("transactions.amount")

    for old_type, new_type in [("deposit", "gc_purchase"), ("withdrawal", "sc_redeem"),
                                ("purchase", "gc_spend"), ("payout", "sc_earn")]:
        cur.execute("UPDATE transactions SET type = ? WHERE type = ?", (new_type, old_type))
        if cur.rowcount:
            applied.append(f"transactions type {old_type}->{new_type}")

    cur.execute("UPDATE transactions SET currency = 'SC' WHERE type = 'sc_earn' AND currency = 'GC'")

    # ── sweep_rewards: new table (replaces payouts) ───────────────────────────
    if not table_exists("sweep_rewards"):
        cur.execute("""
            CREATE TABLE sweep_rewards (
                id VARCHAR(36) PRIMARY KEY,
                square_id VARCHAR(36) NOT NULL REFERENCES squares(id),
                sweep_coins_awarded INTEGER NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'credited',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        applied.append("sweep_rewards table created")

        if table_exists("payouts"):
            cur.execute("SELECT * FROM payouts")
            for p in cur.fetchall():
                cents = p["amount_cents"] if "amount_cents" in p.keys() else 0
                sc = max(50, round(cents / 100 / 50) * 50) if cents else 50
                cur.execute(
                    "INSERT OR IGNORE INTO sweep_rewards (id, square_id, sweep_coins_awarded, status, created_at) VALUES (?,?,?,?,?)",
                    (str(uuid.uuid4()), p["square_id"], sc, "credited", datetime.utcnow().isoformat()),
                )
            applied.append("payouts migrated -> sweep_rewards")

    conn.commit()
    conn.close()

    if applied:
        print(f"[migrate] Applied {len(applied)} migration(s):")
        for a in applied:
            print(f"  ✓ {a}")
    else:
        print("[migrate] Schema already up to date.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    _run_migrations()        # idempotent — safe on every boot
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

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "https://localhost:5173",
    "http://localhost",
    "capacitor://localhost",
    settings.FRONTEND_URL,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in ALLOWED_ORIGINS if o],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"msg": "SquaresBoard API", "version": "1.0.0", "docs": "/docs"}

app.include_router(auth.router, prefix="/api/auth")
app.include_router(users.router, prefix="/api/users")
app.include_router(games.router, prefix="/api/games")
app.include_router(boards.router, prefix="/api/boards")
app.include_router(squares.router, prefix="/api/squares")
app.include_router(webhooks.router, prefix="/api/webhooks")
app.include_router(wallet.router, prefix="/api/wallet")
app.include_router(simulator.router, prefix="/api/simulator")
