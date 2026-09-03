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
# $5, $10, $20, $50, $100, $1000 packages with bonus GC & SC
# ---------------------------------------------------------------------------
GC_BUNDLES = [
    {"id": "gc_5",    "price_cents": 500,    "gold_coins": 500,    "bonus_sc": 50,    "label": "500 GC",    "bonus": ""},
    {"id": "gc_10",   "price_cents": 1000,   "gold_coins": 1100,   "bonus_sc": 120,   "label": "1,100 GC",  "bonus": "+100 Bonus"},
    {"id": "gc_20",   "price_cents": 2000,   "gold_coins": 2300,   "bonus_sc": 260,   "label": "2,300 GC",  "bonus": "+300 Bonus"},
    {"id": "gc_50",   "price_cents": 5000,   "gold_coins": 6000,   "bonus_sc": 700,   "label": "6,000 GC",  "bonus": "+1,000 Bonus"},
    {"id": "gc_100",  "price_cents": 10000,  "gold_coins": 13000,  "bonus_sc": 1500,  "label": "13,000 GC", "bonus": "+3,000 Bonus"},
    {"id": "gc_1000", "price_cents": 100000, "gold_coins": 150000, "bonus_sc": 18000, "label": "150,000 GC","bonus": "+50,000 Bonus"},
]


def calculate_custom_bundle(amount_usd: float) -> dict:
    """Calculate Gold Coins and bonus Sweepstakes Coins for any custom USD amount."""
    if amount_usd < 1:
        raise ValueError("Minimum purchase amount is $1.00")
    if amount_usd > 10000:
        raise ValueError("Maximum purchase amount is $10,000.00")

    price_cents = int(round(amount_usd * 100))
    dollars = price_cents / 100.0
    base_gc = int(round(dollars * 100))

    if dollars >= 1000:
        bonus_gc = int(round(base_gc * 0.50))
        bonus_sc = int(round(dollars * 18))
    elif dollars >= 100:
        bonus_gc = int(round(base_gc * 0.30))
        bonus_sc = int(round(dollars * 15))
    elif dollars >= 50:
        bonus_gc = int(round(base_gc * 0.20))
        bonus_sc = int(round(dollars * 14))
    elif dollars >= 20:
        bonus_gc = int(round(base_gc * 0.15))
        bonus_sc = int(round(dollars * 13))
    elif dollars >= 10:
        bonus_gc = int(round(base_gc * 0.10))
        bonus_sc = int(round(dollars * 12))
    elif dollars >= 5:
        bonus_gc = 0
        bonus_sc = int(round(dollars * 10))
    else:
        bonus_gc = 0
        bonus_sc = int(round(dollars * 5))

    total_gc = base_gc + bonus_gc
    return {
        "id": f"custom_{price_cents}",
        "price_cents": price_cents,
        "gold_coins": total_gc,
        "bonus_sc": bonus_sc,
        "label": f"{total_gc:,} GC",
        "bonus": f"+{bonus_gc:,} Bonus" if bonus_gc > 0 else "",
        "is_custom": True,
    }


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


@router.get("/calculate-bundle")
async def calculate_bundle_quote(amount: float):
    """Calculate GC and SC bonus for a custom USD amount."""
    try:
        return calculate_custom_bundle(amount)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class BuyCoinsRequest(BaseModel):
    bundle_id: str | None = None
    custom_amount: float | None = None


@router.post("/buy-coins")
async def buy_gold_coins(
    req: BuyCoinsRequest | None = None,
    bundle_id: str | None = None,
    custom_amount: float | None = None,
    token: Annotated[str | None, Cookie(alias="session")] = None,
):
    """Create a Stripe PaymentIntent for purchasing a Gold Coin bundle or custom amount."""
    user = await _get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    b_id = (req.bundle_id if req and req.bundle_id else bundle_id)
    c_amt = (req.custom_amount if req and req.custom_amount is not None else custom_amount)

    bundle = None
    if b_id:
        bundle = next((b for b in GC_BUNDLES if b["id"] == b_id), None)
        if not bundle and not c_amt:
            raise HTTPException(status_code=400, detail="Invalid bundle ID")

    if not bundle and c_amt is not None:
        try:
            bundle = calculate_custom_bundle(float(c_amt))
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    if not bundle:
        raise HTTPException(status_code=400, detail="Either bundle_id or custom_amount is required")

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
                "bundle_id": bundle["id"],
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
    Min redemption: 25 SC ($25).
    """
    user = await _get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if amount < 25:
        raise HTTPException(status_code=400, detail="Minimum redemption is 25 SC ($25)")

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
