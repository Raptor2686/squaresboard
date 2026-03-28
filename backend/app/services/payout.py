import uuid
import stripe
from app.config import settings
from sqlalchemy import select
from app.database import async_session
from app.models import User, Transaction, Payout, Board, BoardStatus

stripe.api_key = settings.STRIPE_SECRET_KEY


async def send_payout(winner_user_id: str, amount_cents: int, board_id: str):
    """
    Credit the winner's wallet balance.
    No Stripe transfer happens here — that's a withdrawal operation.
    """
    async with async_session() as session:
        # Credit winner's wallet
        user_result = await session.execute(select(User).where(User.id == winner_user_id))
        user = user_result.scalar_one_or_none()
        if not user:
            print(f"[payout] Winner user {winner_user_id} not found — manual payout needed")
            return

        user.balance_cents += amount_cents

        # Record payout transaction
        payout_tx = Transaction(
            id=str(uuid.uuid4()),
            user_id=winner_user_id,
            board_id=board_id,
            amount_cents=amount_cents,
            type="payout",
        )
        session.add(payout_tx)

        # Record Payout audit row
        payout_record = Payout(
            id=str(uuid.uuid4()),
            square_id=board_id,  # reuse board_id as reference
            amount_cents=amount_cents,
            status="credited",
        )
        session.add(payout_record)
        await session.commit()

        print(f"[payout] Credited {amount_cents} cents to user {winner_user_id} for board {board_id}")
