import stripe
from app.config import settings
from app.database import async_session
from app.models import Payout, Square

stripe.api_key = settings.STRIPE_SECRET_KEY


async def send_payout(user_stripe_customer_id: str | None, amount_cents: int, square_id: str):
    if not user_stripe_customer_id:
        # Queue for manual payout — user needs to connect Stripe
        async with async_session() as session:
            payout = Payout(
                id=square_id + "_payout",
                square_id=square_id,
                amount_cents=amount_cents,
                status="pending_manual",
            )
            session.add(payout)
            await session.commit()
        return

    try:
        transfer = stripe.Transfer.create(
            amount=amount_cents,
            currency="usd",
            destination=user_stripe_customer_id,
        )
        async with async_session() as session:
            payout = Payout(
                id=square_id + "_payout",
                square_id=square_id,
                amount_cents=amount_cents,
                status="sent",
                stripe_transfer_id=transfer.id,
            )
            session.add(payout)
            await session.commit()
    except Exception as e:
        print(f"Payout failed: {e}")
