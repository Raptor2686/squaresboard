import uuid
import stripe
from app.config import settings
from sqlalchemy import select
from app.database import async_session
from app.models import Payout

async def send_payout(winner_user_id: str, amount_cents: int, board_id: str, square_id: str):
    """
    Record a Payout audit row for the winner.
    Balance credit and Transaction record are created by resolve_board — not here.
    """
    if not settings.STRIPE_SECRET_KEY:
        return

    stripe.api_key = settings.STRIPE_SECRET_KEY

    async with async_session() as session:
        # Idempotency guard — skip if already recorded
        existing = await session.execute(
            select(Payout).where(Payout.square_id == square_id)
        )
        if existing.scalar_one_or_none():
            return

        payout_record = Payout(
            id=str(uuid.uuid4()),
            square_id=square_id,
            amount_cents=amount_cents,
            status="pending",
        )
        session.add(payout_record)
        await session.commit()
        print(f"[payout] Recorded {amount_cents} cents for square {square_id}")
