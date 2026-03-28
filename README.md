# SquaresBoard

A marketplace for sports squares boards — buy squares, win payouts when your number hits.

## Tech Stack

- **Backend:** Python FastAPI + SQLAlchemy (async) + SQLite
- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Payments:** Stripe (wallet model)
- **Sports Data:** TheSportsDB API (free)

## Setup

### 1. Clone & install backend deps

```bash
cd backend
cp .env.example .env
# Fill in .env with your API keys (see .env.example)
pip install -r requirements.txt
```

### 2. Get API keys

| Service | Where to get it |
|---------|---------------|
| **TheSportsDB** | https://www.thesportsdb.com — free sign-up, key on profile page |
| **Stripe** | https://dashboard.stripe.com/apikeys — test keys work fine |

### 3. Run the backend

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

The API will be at `http://localhost:8000`. Auto-docs at `http://localhost:8000/docs`.

### 4. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend at `http://localhost:5173`.

### 5. Seed sports data

```bash
cd backend
python -c "import asyncio; from app.services.game_ingestion import run; asyncio.run(run())"
```

This fetches upcoming NFL, NBA, and MLB games and auto-creates boards for each quarter and price tier. The scheduler runs every 6 hours automatically after that.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key (`sk_test_...` for dev) |
| `STRIPE_WEBHOOK_SECRET` | Yes (for webhooks) | From `stripe listen` or dashboard |
| `THESPORTSDB_API_KEY` | Yes | From thesportsdb.com |
| `DATABASE_URL` | No | Defaults to local SQLite |
| `FRONTEND_URL` | No | Defaults to `http://localhost:5173` |
| `SECRET_KEY` | No | Dev default fine; change for prod |

## Stripe Webhook (for local dev)

```bash
stripe listen --forward-to localhost:8000/api/webhooks/stripe
```

Copy the `whsec_...` secret into your `.env` as `STRIPE_WEBHOOK_SECRET`.

## Project Structure

```
squaresboard/
├── backend/
│   ├── app/
│   │   ├── api/          # Route handlers (auth, boards, squares, wallet, games, webhooks)
│   │   ├── models.py     # SQLAlchemy models
│   │   ├── database.py  # DB connection
│   │   ├── config.py    # Settings from env
│   │   └── services/     # Business logic (game_ingestion, score_polling, payout)
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/        # Marketplace, BoardDetail, Auth, MySquares
│       └── context/      # AuthContext
└── docs/plans/           # Design documents
```
