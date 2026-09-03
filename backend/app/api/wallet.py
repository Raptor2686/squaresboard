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
# ---------------------------------------------------------------------------
# Gold Coin bundles: real money → GC (no cash value) + FREE bonus SC
# Matched pricing:
#   $4.99   →   500 GC  +   5 FREE SC
#   $9.99   → 1,000 GC  +  10 FREE SC
#  $19.99   → 2,000 GC  +  20 FREE SC
#  $49.99   → 5,000 GC  +  50 FREE SC
#  $99.99   → 10,000 GC + 100 FREE SC
# $499.99   → 50,000 GC + 500 FREE SC
# $999.99   → 100,000 GC+ 1,000 FREE SC
# ---------------------------------------------------------------------------
GC_BUNDLES = [
    {"id": "gc_5",    "price_cents": 499,    "gold_coins": 500,    "bonus_sc": 5.0,    "label": "500 GC",    "bonus": "FREE 5 SC"},
    {"id": "gc_10",   "price_cents": 999,    "gold_coins": 1000,   "bonus_sc": 10.0,   "label": "1,000 GC",  "bonus": "FREE 10 SC"},
    {"id": "gc_20",   "price_cents": 1999,   "gold_coins": 2000,   "bonus_sc": 20.0,   "label": "2,000 GC",  "bonus": "FREE 20 SC"},
    {"id": "gc_50",   "price_cents": 4999,   "gold_coins": 5000,   "bonus_sc": 50.0,   "label": "5,000 GC",  "bonus": "FREE 50 SC"},
    {"id": "gc_100",  "price_cents": 9999,   "gold_coins": 10000,  "bonus_sc": 100.0,  "label": "10,000 GC", "bonus": "FREE 100 SC"},
    {"id": "gc_500",  "price_cents": 49999,  "gold_coins": 50000,  "bonus_sc": 500.0,  "label": "50,000 GC", "bonus": "FREE 500 SC"},
    {"id": "gc_1000", "price_cents": 99999,  "gold_coins": 100000, "bonus_sc": 1000.0, "label": "100,000 GC","bonus": "FREE 1,000 SC"},
]


def calculate_custom_bundle(amount_usd: float) -> dict:
    """Calculate Gold Coins and bonus Sweepstakes Coins for any custom USD amount.
    Every $1.00 USD gives 100 Gold Coins + 1 Free Sweepstakes Coin bonus.
    """
    if amount_usd < 1:
        raise ValueError("Minimum purchase amount is $1.00")
    if amount_usd > 10000:
        raise ValueError("Maximum purchase amount is $10,000.00")

    price_cents = int(round(amount_usd * 100))
    dollars = price_cents / 100.0
    total_gc = int(round(dollars * 100))
    bonus_sc = round(dollars, 2)

    return {
        "id": f"custom_{price_cents}",
        "price_cents": price_cents,
        "gold_coins": total_gc,
        "bonus_sc": bonus_sc,
        "label": f"{total_gc:,} GC",
        "bonus": f"FREE {bonus_sc:,.2f} SC",
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
