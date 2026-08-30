import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Cookie
from pydantic import BaseModel
from typing import Annotated
from sqlalchemy import select
from app.database import async_session
from app.models import User, Transaction
from app.api.auth import _get_user_from_token

router = APIRouter()

# ---------------------------------------------------------------------------
# Gold Coin bundles: real money → GC (no cash value)
# Designed so $1 ≈ 100 GC. Bonus coins incentivize bigger purchases.
# ---------------------------------------------------------------------------
GC_BUNDLES = [
    {"id": "gc_200",   "price_cents": 199,   "gold_coins": 200,   "bonus_sc": 25,   "label": "200 GC",   "bonus": ""},
    {"id": "gc_600",   "price_cents": 499,   "gold_coins": 650,   "bonus_sc": 75,   "label": "650 GC",   "bonus": "+50 Bonus"},
    {"id": "gc_1200",  "price_cents": 999,   "gold_coins": 1400,  "bonus_sc": 175,  "label": "1,400 GC", "bonus": "+200 Bonus"},
    {"id": "gc_3000",  "price_cents": 1999,  "gold_coins": 3500,  "bonus_sc": 450,  "label": "3,500 GC", "bonus": "+500 Bonus"},
    {"id": "gc_7500",  "price_cents": 4999,  "gold_coins": 10000, "bonus_sc": 1250, "label": "10,000 GC","bonus": "+2,500 Bonus"},
]

FREE_SC_DAILY = 50   # Sweepstakes Coins granted per day — the "no purchase necessary" mechanism


@router.get("/me")
async def get_wallet(token: Annotated[str | None, Cookie(alias="session")] = None):
    user = await _get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with async_session() as db:
        result = await db.execute(select(User).where(User.id == user.id))
        db_user = result.scalar_one_or_none()

        tx_result = await db.execute(
            select(Transaction)
            .where(Transaction.user_id == user.id)
            .order_by(Transaction.created_at.desc())
            .limit(50)
        )
        transactions = tx_result.scalars().all()

    # Determine if daily SC is claimable
    can_claim_free_sc = (
        db_user.last_free_sc_claim is None
        or datetime.utcnow() - db_user.last_free_sc_claim >= timedelta(hours=24)
    )

    return {
        "user_id": db_user.id,
        "display_name": db_user.display_name,
        "gold_coins": db_user.gold_coins,
        "sweep_coins": db_user.sweep_coins,
        "can_claim_free_sc": can_claim_free_sc,
        "free_sc_amount": FREE_SC_DAILY,
        "transactions": [
            {
                "id": t.id,
                "amount": t.amount,
                "type": t.type,
                "currency": t.currency,
                "reference_id": t.reference_id,
                "created_at": t.created_at.isoformat(),
            }
            for t in transactions
        ],
    }


@router.get("/bundles")
async def list_bundles():
    """Return available Gold Coin purchase bundles."""
    return GC_BUNDLES


@router.post("/buy-coins")
async def buy_gold_coins(
    bundle_id: str,
    token: Annotated[str | None, Cookie(alias="session")] = None,
):
    """Create a Stripe PaymentIntent for purchasing a Gold Coin bundle."""
    user = await _get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    bundle = next((b for b in GC_BUNDLES if b["id"] == bundle_id), None)
    if not bundle:
        raise HTTPException(status_code=400, detail="Invalid bundle ID")

    async with async_session() as db:
        result = await db.execute(select(User).where(User.id == user.id))
        db_user = result.scalar_one_or_none()

        import stripe
        from app.config import settings
        stripe.api_key = settings.STRIPE_SECRET_KEY

        if not db_user.stripe_customer_id:
            customer = stripe.Customer.create(
                email=db_user.email,
                metadata={"user_id": db_user.id},
            )
            db_user.stripe_customer_id = customer.id
            await db.commit()

        intent = stripe.PaymentIntent.create(
            amount=bundle["price_cents"],
            currency="usd",
            customer=db_user.stripe_customer_id,
            metadata={
                "user_id": db_user.id,
                "type": "gc_purchase",
                "bundle_id": bundle_id,
                "gold_coins": bundle["gold_coins"],
                "bonus_sc": bundle["bonus_sc"],
            },
            automatic_payment_methods={"enabled": True},
        )

    return {
        "client_secret": intent.client_secret,
        "publishable_key": settings.STRIPE_PUBLISHABLE_KEY,
        "bundle": bundle,
    }


@router.post("/claim-free-sc")
async def claim_free_sweep_coins(
    token: Annotated[str | None, Cookie(alias="session")] = None,
):
    """
    Grant FREE_SC_DAILY Sweepstakes Coins once per 24 hours.
    This is the critical 'no purchase necessary' mechanism for sweepstakes legality.
    """
    user = await _get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with async_session() as db:
        result = await db.execute(select(User).where(User.id == user.id))
        db_user = result.scalar_one_or_none()

        now = datetime.utcnow()
        if db_user.last_free_sc_claim and (now - db_user.last_free_sc_claim) < timedelta(hours=24):
            next_claim = db_user.last_free_sc_claim + timedelta(hours=24)
            raise HTTPException(
                status_code=400,
                detail=f"Already claimed today. Next claim available at {next_claim.isoformat()}Z"
            )

        db_user.sweep_coins += FREE_SC_DAILY
        db_user.last_free_sc_claim = now

        tx = Transaction(
            id=str(uuid.uuid4()),
            user_id=user.id,
            amount=FREE_SC_DAILY,
            type="sc_free_claim",
            currency="SC",
        )
        db.add(tx)
        await db.commit()

    return {
        "ok": True,
        "sweep_coins_granted": FREE_SC_DAILY,
        "new_sweep_coins": db_user.sweep_coins,
    }


@router.post("/redeem-sc")
async def redeem_sweep_coins(
    amount: int,
    token: Annotated[str | None, Cookie(alias="session")] = None,
):
    """
    Request a Sweepstakes Coin redemption for a prize.
    For MVP: records the request and deducts SC. Fulfillment is manual.
    Min redemption: 500 SC.
    """
    user = await _get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if amount < 500:
        raise HTTPException(status_code=400, detail="Minimum redemption is 500 SC")

    async with async_session() as db:
        result = await db.execute(select(User).where(User.id == user.id))
        db_user = result.scalar_one_or_none()

        if db_user.sweep_coins < amount:
            raise HTTPException(status_code=400, detail="Insufficient Sweepstakes Coins")

        db_user.sweep_coins -= amount
        tx = Transaction(
            id=str(uuid.uuid4()),
            user_id=user.id,
            amount=-amount,
            type="sc_redeem",
            currency="SC",
            reference_id=str(uuid.uuid4()),
        )
        db.add(tx)
        await db.commit()

    return {
        "ok": True,
        "sweep_coins_redeemed": amount,
        "message": "Redemption request received. Our team will process your prize within 3-5 business days.",
        "new_sweep_coins": db_user.sweep_coins,
    }
