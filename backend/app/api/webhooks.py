import stripe
import uuid
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

            if user_id and gold_coins > 0:
                async with async_session() as session:
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
                            reference_id=intent["id"],
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
                                reference_id=intent["id"],
                            )
                            session.add(sc_tx)

                        await session.commit()
                print(f"[webhook] GC credited: user={user_id}, gc={gold_coins}, sc_bonus={bonus_sc}, bundle={bundle_id}")

    return {"received": True}
