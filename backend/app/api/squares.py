import uuid
import random
from datetime import datetime
from fastapi import APIRouter, HTTPException, Cookie, Query
from typing import Annotated
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.database import async_session
from app.models import Board, BoardStatus, Square, User
from app.api.auth import _get_user_from_token


router = APIRouter()

PRICE_TIERS = [0.50, 1, 2, 5, 10, 20, 50, 100, 1000, 10000]


async def get_user(token: Annotated[str | None, Cookie()] = None):
    user = await _get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


@router.get("/board/{board_id}")
async def get_board_squares(board_id: str):
    async with async_session() as session:
        result = await session.execute(select(Board).where(Board.id == board_id))
        board = result.scalar_one_or_none()
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")

        squares_result = await session.execute(
            select(Square).where(Square.board_id == board_id).order_by(Square.position).options(joinedload(Square.owner))
        )
        squares = squares_result.scalars().all()
        return {
            "board_id": board.id,
            "board_status": board.status,
            "squares": [
                {
                    "id": s.id,
                    "position": s.position,
                    "number": s.number,
                    "owner_id": s.owner_id,
                    "owner_name": s.owner.display_name if s.owner else None,
                    "checkout_session_id": s.checkout_session_id,
                    "is_owned_by_me": s.owner_id == None,  # available
                }
                for s in squares
            ],
        }


@router.post("/board/{board_id}/checkout")
async def create_checkout(
    board_id: str,
    position: int,
    user: Annotated[User, Depends(get_user)],
):
    """
    Create a Stripe Checkout Session for purchasing a square.
    Returns {checkout_url} so the frontend can redirect the user.
    """
    import stripe
    from app.config import settings

    async with async_session() as session:
        result = await session.execute(
            select(Board).where(Board.id == board_id).options(joinedload(Board.game))
        )
        board = result.scalar_one_or_none()
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        if board.status != BoardStatus.OPEN:
            raise HTTPException(status_code=400, detail="Board is not open for purchases")
        if board.is_private and board.created_by != user.id:
            raise HTTPException(status_code=403, detail="Cannot join private board")

        square_result = await session.execute(
            select(Square).where(Square.board_id == board_id, Square.position == position)
        )
        square = square_result.scalar_one_or_none()
        if not square:
            raise HTTPException(status_code=404, detail="Square not found")
        if square.owner_id is not None:
            raise HTTPException(status_code=400, detail="Square already taken")
        if square.checkout_session_id is not None:
            # Already has a pending checkout — verify if it's still valid
            try:
                sess = stripe.checkout.Session.retrieve(square.checkout_session_id)
                if sess.payment_status == "paid":
                    raise HTTPException(status_code=400, detail="Square already paid for")
                # Session exists but unpaid — return existing URL
                return {"checkout_url": sess.url}
            except Exception:
                # Stale session — clear it and create fresh
                square.checkout_session_id = None

        # Create Stripe Checkout Session
        stripe.api_key = settings.STRIPE_SECRET_KEY
        price_cents = int(board.price_tier * 100)

        session_obj = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": f"SquaresBoard — {board.game.home_team} vs {board.game.away_team} ({board.quarter.value})",
                            "description": f"Square #{position} — ${board.price_tier}",
                        },
                        "unit_amount": price_cents,
                    },
                    "quantity": 1,
                }
            ],
            mode="payment",
            success_url=f"{settings.FRONTEND_URL}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.FRONTEND_URL}/checkout/cancel?session_id={{CHECKOUT_SESSION_ID}}",
            metadata={
                "square_id": square.id,
                "board_id": board_id,
                "position": str(position),
                "user_id": user.id,
            },
            expires_at=int((datetime.utcnow().timestamp()) + 30 * 60),  # 30 min expiry
        )

        square.checkout_session_id = session_obj.id
        await session.commit()

        return {"checkout_url": session_obj.url}


@router.post("/board/{board_id}/verify")
async def verify_and_claim(
    board_id: str,
    session_id: str,
    user: Annotated[User, Depends(get_user)],
):
    """
    Called after Stripe redirects back. Verifies the checkout session with Stripe
    and fulfills the purchase if valid.
    """
    import stripe
    from app.config import settings

    stripe.api_key = settings.STRIPE_SECRET_KEY

    try:
        sess = stripe.checkout.Session.retrieve(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid checkout session")

    if sess.payment_status != "paid":
        raise HTTPException(status_code=400, detail="Payment not completed")

    square_id = sess.metadata.get("square_id")
    if not square_id:
        raise HTTPException(status_code=400, detail="No square linked to this session")

    async with async_session() as session:
        square_result = await session.execute(select(Square).where(Square.id == square_id))
        square = square_result.scalar_one_or_none()
        if not square:
            raise HTTPException(status_code=404, detail="Square not found")
        if square.owner_id is not None:
            return {"status": "already_owned", "board_status": square.board.status}

        # Claim the square
        square.owner_id = user.id
        square.purchased_at = datetime.utcnow()
        square.checkout_session_id = None  # clean up

        # Refresh board to check fill
        board_result = await session.execute(select(Board).where(Board.id == board_id))
        board = board_result.scalar_one_or_none()

        # Count owned squares
        all_squares_result = await session.execute(
            select(Square).where(Square.board_id == board_id)
        )
        all_squares = all_squares_result.scalars().all()
        owned = [s for s in all_squares if s.owner_id is not None]

        if len(owned) == 10:
            # Fill and assign random numbers
            numbers = list(range(10))
            random.shuffle(numbers)
            for i, sq in enumerate(all_squares):
                sq.number = numbers[i]
            board.status = BoardStatus.LOCKED

        await session.commit()
        return {
            "status": "success",
            "board_status": board.status,
            "your_square": square_id,
        }


@router.post("/board/{board_id}/purchase")
async def purchase_square(
    board_id: str,
    position: int,
    user: Annotated[User, Depends(get_user)],
):
    """
    Direct purchase (no Stripe redirect). Used when Stripe is not yet connected
    or for testing. In production this should redirect to checkout instead.
    """
    async with async_session() as session:
        result = await session.execute(select(Board).where(Board.id == board_id))
        board = result.scalar_one_or_none()
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        if board.status != BoardStatus.OPEN:
            raise HTTPException(status_code=400, detail="Board is not open for purchases")

        square_result = await session.execute(
            select(Square).where(Square.board_id == board_id, Square.position == position)
        )
        square = square_result.scalar_one_or_none()
        if not square:
            raise HTTPException(status_code=404, detail="Square not found")
        if square.owner_id is not None:
            raise HTTPException(status_code=400, detail="Square already taken")

        square.owner_id = user.id
        square.purchased_at = datetime.utcnow()
        await session.commit()

        # Check if board is now full
        all_squares_result = await session.execute(
            select(Square).where(Square.board_id == board_id)
        )
        all_squares = all_squares_result.scalars().all()
        if all(s.owner_id is not None for s in all_squares):
            numbers = list(range(10))
            random.shuffle(numbers)
            for i, sq in enumerate(all_squares):
                sq.number = numbers[i]
            board.status = BoardStatus.LOCKED
            await session.commit()

        return {"ok": True, "board_status": board.status}
