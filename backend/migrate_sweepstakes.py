"""
migrate_sweepstakes.py
One-time migration: USD wallet → dual-currency sweepstakes model (GC + SC).

Run against the live Render DB:
    python migrate_sweepstakes.py /var/data/squaresboard.db

Or against the local DB (from backend/):
    python migrate_sweepstakes.py squaresboard.db

What this does:
  users       — add gold_coins, sweep_coins, last_free_sc_claim; drop balance_cents
  boards      — add entry_currency (default 'GC'); cast price_tier float -> int
  squares     — drop stripe_payment_intent column
  transactions— add currency col; rename amount_cents -> amount; update type labels
  sweep_rewards (NEW table, was 'payouts')
  payouts     — drop old table (after migrating data to sweep_rewards)
  games       — add home_team_logo, away_team_logo if missing
"""

import sqlite3
import sys
import uuid
from datetime import datetime

DB_PATH = sys.argv[1] if len(sys.argv) > 1 else "squaresboard.db"
print(f"Migrating: {DB_PATH}")

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

def col_exists(table, col):
    cur.execute(f"PRAGMA table_info({table})")
    return any(row["name"] == col for row in cur.fetchall())

def table_exists(table):
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
    return cur.fetchone() is not None

changes = []

# ─── users ────────────────────────────────────────────────────────────────────
print("\n[users]")

if not col_exists("users", "gold_coins"):
    cur.execute("ALTER TABLE users ADD COLUMN gold_coins INTEGER NOT NULL DEFAULT 0")
    # Carry over old balance_cents as GC (1 cent = 1 GC for simplicity, or zero out — using 0)
    print("  + gold_coins column added (defaulting existing users to 0)")
    changes.append("users.gold_coins added")
else:
    print("  - gold_coins already exists, skipping")

if not col_exists("users", "sweep_coins"):
    cur.execute("ALTER TABLE users ADD COLUMN sweep_coins INTEGER NOT NULL DEFAULT 0")
    print("  + sweep_coins column added")
    changes.append("users.sweep_coins added")
else:
    print("  - sweep_coins already exists, skipping")

if not col_exists("users", "last_free_sc_claim"):
    cur.execute("ALTER TABLE users ADD COLUMN last_free_sc_claim DATETIME NULL")
    print("  + last_free_sc_claim column added")
    changes.append("users.last_free_sc_claim added")
else:
    print("  - last_free_sc_claim already exists, skipping")

# Note: SQLite can't DROP columns in older versions; balance_cents is left in place
# (it's ignored by the app). If SQLite >= 3.35 is available you could drop it.
if col_exists("users", "balance_cents"):
    print("  ~ balance_cents left in place (SQLite can't drop; ignored by app)")

# ─── boards ───────────────────────────────────────────────────────────────────
print("\n[boards]")

if not col_exists("boards", "entry_currency"):
    cur.execute("ALTER TABLE boards ADD COLUMN entry_currency VARCHAR(5) NOT NULL DEFAULT 'GC'")
    print("  + entry_currency added (all existing boards default to GC)")
    changes.append("boards.entry_currency added")
else:
    print("  - entry_currency already exists, skipping")

# Cast price_tier from float to nearest valid GC tier
# Old float tiers: 0.50, 1, 2, 5, 10, 20, 50, 100, 1000, 10000
# New int GC tiers: 50, 100, 250, 500, 1000, 2500
FLOAT_TO_GC = {
    0.5:   50,
    1.0:   50,
    2.0:   100,
    5.0:   100,
    10.0:  100,
    20.0:  250,
    50.0:  500,
    100.0: 1000,
    1000.0:2500,
    10000.0:2500,
}
cur.execute("SELECT id, price_tier FROM boards")
boards = cur.fetchall()
updated_boards = 0
for b in boards:
    old = b["price_tier"]
    if isinstance(old, float) or (isinstance(old, (int, float)) and old < 50):
        new_tier = FLOAT_TO_GC.get(float(old), 100)  # fallback to 100 GC
        cur.execute("UPDATE boards SET price_tier = ? WHERE id = ?", (new_tier, b["id"]))
        updated_boards += 1
if updated_boards:
    print(f"  ~ Converted {updated_boards} board price_tiers from float dollars to int GC")
    changes.append(f"boards.price_tier converted ({updated_boards} rows)")
else:
    print("  - price_tier values already look like integers, skipping conversion")

# ─── games ────────────────────────────────────────────────────────────────────
print("\n[games]")

if not col_exists("games", "home_team_logo"):
    cur.execute("ALTER TABLE games ADD COLUMN home_team_logo VARCHAR(500) NULL")
    print("  + home_team_logo added")
    changes.append("games.home_team_logo added")
else:
    print("  - home_team_logo already exists")

if not col_exists("games", "away_team_logo"):
    cur.execute("ALTER TABLE games ADD COLUMN away_team_logo VARCHAR(500) NULL")
    print("  + away_team_logo added")
    changes.append("games.away_team_logo added")
else:
    print("  - away_team_logo already exists")

# ─── transactions ─────────────────────────────────────────────────────────────
print("\n[transactions]")

if not col_exists("transactions", "currency"):
    cur.execute("ALTER TABLE transactions ADD COLUMN currency VARCHAR(10) NOT NULL DEFAULT 'GC'")
    print("  + currency column added (existing rows default to GC)")
    changes.append("transactions.currency added")
else:
    print("  - currency already exists, skipping")

if not col_exists("transactions", "amount"):
    # SQLite doesn't allow renaming columns in older versions.
    # We add a new 'amount' column and copy from amount_cents.
    cur.execute("ALTER TABLE transactions ADD COLUMN amount INTEGER NOT NULL DEFAULT 0")
    cur.execute("UPDATE transactions SET amount = amount_cents WHERE amount_cents IS NOT NULL")
    print("  + amount column added and populated from amount_cents")
    changes.append("transactions.amount added (copied from amount_cents)")
else:
    print("  - amount already exists, skipping")

# Reclassify old transaction types to new naming scheme
type_map = {
    "deposit":    "gc_purchase",
    "withdrawal": "sc_redeem",
    "purchase":   "gc_spend",
    "payout":     "sc_earn",
}
for old_type, new_type in type_map.items():
    cur.execute(
        "UPDATE transactions SET type = ? WHERE type = ?",
        (new_type, old_type)
    )
    rows = cur.rowcount
    if rows:
        print(f"  ~ Renamed transaction type '{old_type}' -> '{new_type}' ({rows} rows)")
        changes.append(f"transactions type {old_type}->{new_type}")

# Mark payout (sc_earn) transactions as SC currency
cur.execute("UPDATE transactions SET currency = 'SC' WHERE type = 'sc_earn'")
if cur.rowcount:
    print(f"  ~ Set currency='SC' on {cur.rowcount} sc_earn transactions")

# ─── sweep_rewards (new table) ────────────────────────────────────────────────
print("\n[sweep_rewards]")

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
    print("  + sweep_rewards table created")
    changes.append("sweep_rewards table created")

    # Migrate existing payouts to sweep_rewards (convert cents -> SC at 1:1)
    if table_exists("payouts"):
        cur.execute("SELECT * FROM payouts")
        old_payouts = cur.fetchall()
        migrated = 0
        for p in old_payouts:
            # Convert amount_cents to SC (divide by 100, round to nearest 50)
            amount_cents = p["amount_cents"] if "amount_cents" in p.keys() else 0
            sc_amount = max(50, round(amount_cents / 100 / 50) * 50) if amount_cents else 50
            cur.execute(
                "INSERT OR IGNORE INTO sweep_rewards (id, square_id, sweep_coins_awarded, status, created_at) VALUES (?,?,?,?,?)",
                (str(uuid.uuid4()), p["square_id"], sc_amount, "credited", datetime.utcnow().isoformat())
            )
            migrated += 1
        print(f"  ~ Migrated {migrated} old payout records -> sweep_rewards")
        changes.append(f"Migrated {migrated} payouts -> sweep_rewards")
else:
    print("  - sweep_rewards already exists, skipping")

# ─── squares ──────────────────────────────────────────────────────────────────
# stripe_payment_intent column can stay (SQLite can't easily drop it, app ignores it)
print("\n[squares]")
if col_exists("squares", "stripe_payment_intent"):
    print("  ~ stripe_payment_intent left in place (ignored by app, can't drop in SQLite)")

# ─── commit ───────────────────────────────────────────────────────────────────
conn.commit()
conn.close()

print("\n" + "="*60)
if changes:
    print(f"Migration complete. {len(changes)} change(s) applied:")
    for c in changes:
        print(f"  ✓ {c}")
else:
    print("Nothing to migrate — schema already up to date.")
print("="*60)
