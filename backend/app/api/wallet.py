import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, Cookie
from typing import Annotated
from sqlalchemy import select
from app.database import async_session
from app.models import User, Transaction
from app.api.auth import _get_user_from_token

router = APIRouter()


@router.get("/me")
async def get_wallet(session: Annotated[str, Cookie()] = None):
    user = await _get_user_from_token(session)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with async_session() as session:
        result = await session.execute(select(User).where(User.id == user.id))
        db_user = result.scalar_one_or_none()

        tx_result = await session.execute(
            select(Transaction)
            .where(Transaction.user_id == user.id)
            .order_by(Transaction.created_at.desc())
            .limit(50)
        )
        transactions = tx_result.scalars().all()

    return {
        "user_id": db_user.id,
        "display_name": db_user.display_name,
        "balance_cents": db_user.balance_cents,
        "transactions": [
            {
                "id": t.id,
                "amount_cents": t.amount_cents,
                "type": t.type,
                "reference_id": t.reference_id,
                "created_at": t.created_at.isoformat(),
            }
            for t in transactions
        ],
    }


@router.post("/deposit")
async def create_deposit(
    amount_cents: int,
    session: Annotated[str, Cookie()] = None,
):
    """Create a Stripe PaymentIntent for depositing funds."""
    user = await _get_user_from_token(session)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if amount_cents < 100:  # min $1
        raise HTTPException(status_code=400, detail="Minimum deposit is $1.00")

    async with async_session() as session:
        result = await session.execute(select(User).where(User.id == user.id))
        db_user = result.scalar_one_or_none()

        # Ensure Stripe customer exists
        if not db_user.stripe_customer_id:
            import stripe
            customer = stripe.Customer.create(
                email=db_user.email,
                metadata={"user_id": db_user.id},
            )
            db_user.stripe_customer_id = customer.id
            await session.commit()

        # Create PaymentIntent for the deposit
        import stripe
        from app.config import settings
        stripe.api_key = settings.STRIPE_SECRET_KEY

        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency="usd",
            customer=db_user.stripe_customer_id,
            metadata={
                "user_id": db_user.id,
                "type": "deposit",
            },
            automatic_payment_methods={"enabled": True},
        )

    return {
        "client_secret": intent.client_secret,
        "amount_cents": amount_cents,
    }


@router.post("/withdraw")
async def request_withdrawal(
    amount_cents: int,
    session: Annotated[str, Cookie()] = None,
):
    """Request a withdrawal. For MVP, we just record it and return instructions."""
    user = await _get_user_from_token(session)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if amount_cents < 100:
        raise HTTPException(status_code=400, detail="Minimum withdrawal is $1.00")

    async with async_session() as session:
        result = await session.execute(select(User).where(User.id == user.id))
        db_user = result.scalar_one_or_none()

        if db_user.balance_cents < amount_cents:
            raise HTTPException(status_code=400, detail="Insufficient balance")

        if not db_user.stripe_customer_id:
            raise HTTPException(status_code=400, detail="No payment method on file")

        # For MVP: deduct balance immediately, record transaction.
        # Full implementation: initiate Stripe payout to customer's bank.
        db_user.balance_cents -= amount_cents
        tx = Transaction(
            id=str(uuid.uuid4()),
            user_id=user.id,
            amount_cents=-amount_cents,
            type="withdrawal",
            reference_id=str(uuid.uuid4()),
        )
        session.add(tx)
        await session.commit()

    return {
        "ok": True,
        "amount_cents": amount_cents,
        "message": "Withdrawal requested. Payouts to bank accounts coming soon.",
    }
