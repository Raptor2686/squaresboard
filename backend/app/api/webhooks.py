import stripe
import uuid
from datetime import datetime
from fastapi import APIRouter, Request, HTTPException
from sqlalchemy import select
from app.config import settings
from app.database import async_session
from app.models import User, Transaction

router = APIRouter()


@router.post("/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.STRIPE_WEBHOOK_SECRET)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "payment_intent.succeeded":
        intent = event["data"]["object"]
        meta = intent.get("metadata", {})

        if meta.get("type") == "gc_purchase":
            user_id = meta.get("user_id")
            gold_coins = float(meta.get("gold_coins", 0))
            bonus_sc = float(meta.get("bonus_sc", 0))
            bundle_id = meta.get("bundle_id", "unknown")
            payment_intent_id = intent["id"]

            if user_id and gold_coins > 0:
                async with async_session() as session:
                    # ── Idempotency check ──
                    # Stripe may retry webhooks — prevent double-crediting
                    existing_tx = await session.execute(
                        select(Transaction).where(
                            Transaction.reference_id == payment_intent_id,
                            Transaction.type == "gc_purchase",
                        )
                    )
                    if existing_tx.scalar_one_or_none():
                        print(f"[webhook] SKIP duplicate: pi={payment_intent_id}, user={user_id}")
                        return {"received": True, "status": "duplicate"}

                    result = await session.execute(select(User).where(User.id == user_id))
                    db_user = result.scalar_one_or_none()
                    if db_user:
                        db_user.gold_coins += gold_coins
                        tx = Transaction(
                            id=str(uuid.uuid4()),
                            user_id=user_id,
                            amount=gold_coins,
                            type="gc_purchase",
                            currency="GC",
                            reference_id=payment_intent_id,
                        )
                        session.add(tx)

                        # Bonus SC credited alongside every GC purchase
                        if bonus_sc > 0:
                            db_user.sweep_coins += bonus_sc
                            sc_tx = Transaction(
                                id=str(uuid.uuid4()),
                                user_id=user_id,
                                amount=bonus_sc,
                                type="sc_earn",
                                currency="SC",
                                reference_id=payment_intent_id,
                            )
                            session.add(sc_tx)

                        await session.commit()
                print(f"[webhook] GC credited: user={user_id}, gc={gold_coins}, sc_bonus={bonus_sc}, bundle={bundle_id}, pi={payment_intent_id}")

    return {"received": True}
