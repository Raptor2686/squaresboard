"""One-time migration: add entry_currency column to boards table."""
import sqlite3

conn = sqlite3.connect("squaresboard.db")
try:
    conn.execute("ALTER TABLE boards ADD COLUMN entry_currency VARCHAR(5) NOT NULL DEFAULT 'GC'")
    conn.commit()
    print("Migration done: boards.entry_currency added (default='GC')")
except sqlite3.OperationalError as e:
    if "duplicate column" in str(e):
        print("Column already exists, skipping.")
    else:
        raise
finally:
    conn.close()
