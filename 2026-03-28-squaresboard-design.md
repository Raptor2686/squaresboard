# SquaresBoard — Design Document

**Date:** 2026-03-28  
**Author:** raptor2686

---

## 1. Overview

**SquaresBoard** is a sports betting marketplace built around the classic office pool "squares" game. Users join open "squares" on game boards and win real money when the final score of a quarter produces a winning number.

### Core Loop
1. User browses open boards for upcoming NFL, NBA, or MLB games
2. Selects an open square on a board (10 squares per board)
3. Pays the square price via Stripe
4. Once all 10 squares are purchased, random numbers 0–9 are assigned (no repeats)
5. When the quarter ends, scores are fetched from a sports API
6. Last digit of (winning team's score + losing team's score) = winning number
7. Owner of that number wins 9× the square price; platform keeps 1× as rake

### Platform Model
- **Public Marketplace (Platform-Hosted):** The platform automatically creates boards for upcoming games. Any logged-in user can join open squares. The platform handles all payments and payouts.
- **Private Boards (User-Hosted):** Any logged-in user can create a private board, set the price tier, and share a unique link. Only people with the link can join. The platform still handles all money — the host is just another player.

---

## 2. Supported Sports & Events

- **Football** (NFL, college)
- **Basketball** (NBA, college)
- **Baseball** (MLB)

Each sport has its own quarter/period structure:
- **Football:** Q1, Q2, Q3, Q4
- **Basketball:** Q1, Q2, Q3, Q4
- **Baseball:** Inning 1–9 (each inning is a separate "board")

A single game can spawn multiple boards — one per quarter/inning — and any number of boards per quarter as long as each fills.

---

## 3. Core Entities

### User
| Field | Description |
|-------|-------------|
| `id` | Primary key |
| `email` | Unique email |
| `password_hash` | Hashed password |
| `display_name` | User-chosen — username or first initial + last name |
| `stripe_customer_id` | Stripe customer for receiving payouts |
| `created_at` | Timestamp |

### Game
| Field | Description |
|-------|-------------|
| `id` | External API ID |
| `sport` | football / basketball / baseball |
| `home_team` | Team name string |
| `away_team` | Team name string |
| `event_time` | UTC timestamp of game start |
| `status` | upcoming / live / completed |
| `sport_api_data` | Raw JSON from sports API |

### Board
| Field | Description |
|-------|-------------|
| `id` | Primary key |
| `game_id` | FK to Game |
| `quarter` | Q1 / Q2 / Q3 / Q4 (or inning for baseball) |
| `price_tier` | $0.50, $1, $2, $5, $10, $20, $50, $100, $1000, $10000 |
| `status` | open / filled / locked / resolved / cancelled |
| `is_private` | Boolean |
| `share_link` | UUID, only if private |
| `created_by` | FK to User, null if public/platform |
| `filled_at` | Timestamp when 10th square purchased |
| `resolved_at` | Timestamp when winner determined |

### Square
| Field | Description |
|-------|-------------|
| `id` | Primary key |
| `board_id` | FK to Board |
| `user_id` | FK to User |
| `number` | 0–9, null until board fills |
| `purchased_at` | Timestamp |

### BoardNumber (after fill)
| Field | Description |
|-------|-------------|
| `board_id` | FK to Board |
| `number` | 0–9 |
| `assigned_to_square_id` | FK to Square |

### Payout
| Field | Description |
|-------|-------------|
| `id` | Primary key |
| `board_id` | FK to Board |
| `winner_square_id` | FK to Square |
| `winner_user_id` | FK to User |
| `amount` | price × 9 |
| `platform_amount` | price × 1 |
| `status` | pending / completed / failed |
| `stripe_transfer_id` | Stripe transfer reference |
| `created_at` | Timestamp |

---

## 4. Board States & Transitions

```
OPEN → (10th square purchased) → FILLED → (numbers assigned) → LOCKED → (quarter ends + scores in) → RESOLVED
  ↑                                   
(cancelled — quarter started before fill)
```

| State | Description |
|-------|-------------|
| `OPEN` | Squares purchasable. If quarter starts before filling → `CANCELLED`. |
| `FILLED` | 10th square purchased. Platform assigns 0–9 to each square (no repeats). Transitions to `LOCKED`. |
| `LOCKED` | Numbers assigned. Board frozen. Waiting for quarter to end and scores from API. |
| `RESOLVED` | Scores fetched. Winning number determined. Winner paid 9× price. Platform keeps 1×. Winner prompted to join other open quarters. |
| `CANCELLED` | Quarter started before board filled. All payments refunded via Stripe. |

---

## 5. Winning Number Logic

After a quarter ends, the platform fetches the final scores for both teams from the sports API:

```
winning_number = (home_team_score + away_team_score) % 10
```

The square whose assigned `number` matches `winning_number` wins. Since all 10 numbers 0–9 are always assigned, there is always exactly one winner.

**Example:** Chiefs 27, Eagles 14 → sum = 41 → 41 % 10 = **1** → owner of square #1 wins.

---

## 6. User Flows

### Authentication
- Email/password signup and login required. No guest checkout.

### Browse & Join (Public Board)
1. User lands on marketplace — all open public boards shown grouped by sport
2. Filters: sport, price tier, quarter
3. Clicks a board → detail page shows: teams, quarter, price, square grid (10 squares)
4. Open squares are clickable. Taken squares show the owner's display name.
5. User clicks open square → Stripe Checkout for that square's price
6. Payment succeeds → Square assigned to user, board updated
7. If 10th square purchased → board transitions to `FILLED`, numbers assigned, board `LOCKED`
8. In-app notification sent to all participants

### Create Private Board
1. Logged-in user clicks "Create Private Board"
2. Selects sport → searches/selects game (API list or manual entry)
3. Picks quarter, price tier
4. Board created as `OPEN`, shareable UUID link generated
5. User shares link. Visitors with the link see the board and can join squares.
6. Flow from step 6 above is identical to public boards

### Winner Experience
1. Board resolves → winner notified in-app and optionally via email/SMS
2. Winner sees their payout of `price × 9` in their account
3. Prompt shown: "Q2 boards are open for this game — play again?"
4. Winner can join other open boards for the same game

---

## 7. Sports Data Integration

**API: TheSportsDB** (free tier, primary)
- Fetches upcoming games for NFL, NBA, MLB
- Daily cron job ingests games for the next 7 days
- After ingestion, system auto-creates `OPEN` boards for each price tier at each quarter

**Score Fetching**
- Background job polls TheSportsDB every 5 minutes for `LOCKED` boards
- When a quarter's end is confirmed (score available), board transitions to `RESOLVED`
- Winning number calculated, winner identified, payout triggered

**Game Selection**
- Hybrid approach: API-driven game list as default, with manual entry fallback
- Hosts can search/select from the API list or enter a custom game (e.g., "Chiefs vs Eagles, Week 5")

---

## 8. Payments (Stripe)

**All money flows through the platform's Stripe account.**

### Square Purchase
- User pays via Stripe Checkout → payment captured to platform's Stripe
- Square marked as owned

### Board Cancellation
- Full refund issued to all buyers via Stripe refund API

### Winner Payout
- Winner receives `price × 9` via Stripe transfer to their connected Stripe account
- Platform keeps `price × 1`

### User Payout Account
- Users must connect a Stripe account (Stripe Connect onboarding) to receive winnings
- If no Stripe account connected at payout time, winnings held in platform balance
- User prompted to connect Stripe to withdraw

---

## 9. Price Tiers

Platform-defined fixed price options per square:
$0.50 | $1 | $2 | $5 | $10 | $20 | $50 | $100 | $1000 | $10000

Each board uses exactly one price tier for all 10 squares. Host selects when creating.

---

## 10. Out of Scope (V1)

- Real-time score updates on the board page (polling every 5 min is sufficient)
- Live chat or social features on boards
- Leaderboards or player rankings
- Multi-game parlays or bundles
- Dark/sports-book UI themes (start with clean, simple interface)
- Push notifications (email/in-app only for now)
- Mobile app (web-only for V1)

---

## 11. Open Questions

- Should a user be able to buy multiple squares on the same board? (Yes allowed — mathematically they just lose more to the rake.)
- Does the platform generate boards automatically for all games, or only for games with sufficient marketplace demand?
- What is the minimum number of boards needed per quarter before auto-generation kicks in?
- How does the platform handle API failures for score fetching — manual override?
