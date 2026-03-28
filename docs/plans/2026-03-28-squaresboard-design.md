# SquaresBoard — Design Document

**Date:** 2026-03-28  
**Author:** raptor2686

---

## 1. Overview

**SquaresBoard** is a sports betting marketplace built around the classic office pool "squares" game. The platform operates in two modes:

**Public boards** — the platform creates and manages boards for upcoming games, visible in a marketplace. Anyone can join.

**Private boards** — any registered user can create a board, set parameters, and share a private link. The creator has no special role beyond being a participant.

### Supported Sports
- Football (NFL/college)
- Basketball (NBA)
- Baseball (MLB)

### Core Rules
- Each board has exactly 10 squares, priced at one of: $0.50, $1, $2, $5, $10, $20, $50, $100, $1,000, $10,000
- Numbers (0–9, no repeats) are assigned randomly when the board fills and locks
- One payout per board: last digit of (home team score + away team score) determines the winning number
- Winner receives 90% of the pot (9 squares × price); platform keeps 10%
- If a board doesn't fill, no numbers assign and no game occurs
- If a game is postponed, boards stay locked and wait for rescheduled scores
- If a game is cancelled, all players are refunded
- Board is tied to a specific quarter (Q1, Q2, Q3, Q4) — one board per quarter
- Unlimited boards per game/quarter as long as each fills
- Users can purchase any number of squares on a board

---

## 2. User Account Model

Users must register (email + password). Display name is chosen at signup (username or first initial + last name).

**Wallet system** — users deposit funds into their account and use that balance to purchase squares. This avoids per-purchase Stripe fees and creates a smoother experience for frequent players.

**Balance** — tracked in cents (integer) to avoid floating-point issues. Users can withdraw their full balance at any time.

---

## 3. Data Model

### User
- `id` (UUID, PK)
- `email` (unique)
- `password_hash`
- `display_name`
- `stripe_customer_id` (for deposits and withdrawals)
- `balance_cents` (integer, default 0)
- `created_at`

### Session
- `id` (UUID, PK)
- `token` (unique string)
- `user_id` (FK → User)
- `expires_at`

### Game
- `id` (UUID, PK)
- `external_id` (string, unique — from sports API)
- `sport` (football | basketball | baseball)
- `home_team`, `away_team`
- `home_team_logo`, `away_team_logo`
- `event_time`
- `q1_start`, `q2_start`, `q3_start`, `q4_start` (quarter start times, if available)
- `home_score`, `away_score` (nullable — filled when available)
- `status` (upcoming | live | completed | cancelled)

### Board
- `id` (UUID, PK)
- `game_id` (FK → Game)
- `quarter` (Q1 | Q2 | Q3 | Q4)
- `price_tier` (float)
- `status` (open | filled | locked | resolved | cancelled)
- `is_private` (bool)
- `share_link` (nullable UUID string, only for private boards)
- `created_by` (FK → User, nullable)
- `created_at`
- `winning_square_id` (nullable FK → Square)

### Square
- `id` (UUID, PK)
- `board_id` (FK → Board)
- `owner_id` (FK → User, nullable)
- `position` (0–9)
- `number` (0–9, nullable — assigned when board fills)
- `purchased_at` (nullable)
- `stripe_payment_intent` (nullable — for deposits)

### Transaction
Records every money movement in the platform.
- `id` (UUID, PK)
- `user_id` (FK → User)
- `amount_cents` (integer — positive for credits, negative for debits)
- `type` (deposit | purchase | payout | rake | withdrawal | refund)
- `reference_id` (optional — board_id, payout_id, etc.)
- `created_at`

### Payout
- `id` (UUID, PK)
- `square_id` (FK → Square)
- `amount_cents`
- `status` (pending | sent | failed)
- `stripe_transfer_id` (nullable)
- `created_at`

---

## 4. Board States

```
OPEN → FILLED → LOCKED → RESOLVED
  ↓        ↓
CANCELLED CANCELLED
```

- **OPEN** — squares available for purchase. Board visible in marketplace.
- **FILLED** — 10th square just purchased. Numbers 0–9 shuffled and assigned to each square. Status immediately transitions to LOCKED.
- **LOCKED** — board is full and waiting for the quarter to start / game to end. No more purchases accepted. Numbers are fixed.
- **RESOLVED** — quarter/game has ended and scores have been fetched. Winning number calculated. Winner paid 90% of pot. Platform collected 10% rake.
- **CANCELLED** — game was cancelled before resolution. All players refunded their square cost.

---

## 5. Winning Number Logic

For each quarter, the winning number is:

```
(home_score + away_score) % 10
```

The square whose `number` field matches this digit wins. Since all 10 numbers 0–9 are always assigned, there is always exactly one winner.

Score fetching is done by polling TheSportsDB every 5 minutes for live games.

---

## 6. User Flows

### Deposit Funds
1. User clicks "Add Funds" → enters amount
2. Backend creates Stripe PaymentIntent
3. User redirected to Stripe payment page
4. On success → webhook fires → `stripe_payment_intent.succeeded` → user's balance credited
5. Transaction record created: `type=deposit`, `amount_cents=+N`

### Browse & Join (Public Board)
1. User lands on marketplace — sees all open public boards grouped by sport
2. Filters: sport, quarter, price tier
3. Clicks a board → board detail shows: teams, quarter, price, 10 squares (available/taken with owner names)
4. User clicks an available square → redirected to Stripe deposit flow if balance is insufficient, or purchase immediately if sufficient
5. On purchase: balance deducted, square assigned, Transaction record created

### Create Private Board
1. User selects game (search or browse), quarter, price tier, marks as private
2. Board created with a unique `share_link`
3. User shares the link
4. Others visit the link, sign up/login, purchase squares
5. Board fills, locks, resolves — same as public

### Winner Experience
1. Board resolves → scores fetched → winner determined
2. Winner's balance credited: `price_tier * 9 * 100` cents
3. Transaction record: `type=payout`, `amount_cents=+N`
4. Platform balance credited with rake: `price_tier * 1 * 100` cents
5. Transaction record: `type=rake`, `amount_cents=-N` (platform side)

### After Winning
1. User sees "You won!" on board detail page
2. Balance updated
3. Prompt to join other open boards for the same game

### Withdraw
1. User clicks "Withdraw"
2. Backend initiates Stripe payout to their bank
3. Transaction record: `type=withdrawal`, `amount_cents=-N`

---

## 7. Platform / Admin

The platform itself is represented as a special system account. The platform:
- Creates public boards automatically (via scheduled job)
- Collects the 10% rake on every resolved board
- Pays out winners automatically

---

## 8. Game Ingestion

A daily cron job (6 AM UTC) fetches upcoming games from TheSportsDB for all three sports for the next 7 days. Games are stored in the DB with status `upcoming`. Public boards are auto-created for each game/quarter once the game is ingested.

---

## 9. Score Polling

A cron job runs every 5 minutes and checks all games with status `upcoming` or `live`. When a game quarter ends (or quarter start time has passed), the board for that quarter can be resolved. Score data is fetched from TheSportsDB.

For Q1–Q4 boards: resolved once quarter end time is detected.

---

## 10. Technology

### Backend: FastAPI (Python)
- Async SQLAlchemy + aiosqlite for the database
- APScheduler for cron jobs (game ingestion + score polling)
- Stripe for deposits and withdrawals (no per-purchase checkout)
- Session-based auth with httpOnly cookies
- TheSportsDB free tier for game data and scores

### Frontend: React + Vite (hosted on Zo Sites)
- Marketplace browser
- Board detail with interactive square grid
- Auth (signup/login)
- Wallet: deposit, withdraw, balance, transaction history

### Payment Flow (Wallet Model)
- User deposits via Stripe PaymentIntent
- Balance stored in DB, updated on purchase/payout/withdrawal
- No per-square Stripe charges (avoids per-transaction fees)
- Platform uses Stripe payouts to return funds

---

## 11. TODO

- [ ] Session auth (real session tokens stored in DB)
- [ ] Stripe deposit + withdrawal flow
- [ ] TheSportsDB integration for game ingestion
- [ ] Score polling service
- [ ] Public board auto-creation
- [ ] Private board creation + link sharing
- [ ] Winner resolution + automatic payout
- [ ] Frontend marketplace UI
- [ ] Frontend board detail with square grid
- [ ] User wallet (deposit/withdraw/history)
- [ ] Winner celebration + "join other open boards" prompt
