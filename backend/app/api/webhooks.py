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
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "payment_intent.succeeded":
        intent = event["data"]["object"]
        if intent.get("metadata", {}).get("type") == "deposit":
            user_id = intent.get("metadata", {}).get("user_id")
            amount_cents = intent["amount"]
            if user_id and amount_cents:
                async with async_session() as session:
                    result = await session.execute(select(User).where(User.id == user_id))
                    db_user = result.scalar_one_or_none()
                    if db_user:
                        db_user.balance_cents += amount_cents
                        tx = Transaction(
                            id=str(uuid.uuid4()),
                            user_id=user_id,
                            amount_cents=amount_cents,
                            type="deposit",
                            reference_id=intent["id"],
                        )
                        session.add(tx)
                        await session.commit()
                print(f"Deposit credited: user={user_id}, amount={amount_cents}")

    return {"received": True}
