import uuid
from sqlalchemy import select
from app.database import async_session
from app.models import SweepReward, User, Transaction


async def award_sweep_coins(winner_user_id: str, sweep_coins: int, board_id: str, square_id: str, db_session=None):
    """
    Credit Sweepstakes Coins to a winning square's owner.
    Called by score_polling when a board is resolved.
    """

    async def _run(session):
        # Idempotency guard
        existing = await session.execute(
            select(SweepReward).where(SweepReward.square_id == square_id)
        )
        if existing.scalar_one_or_none():
            return

        # Create reward record
        reward = SweepReward(
            id=str(uuid.uuid4()),
            square_id=square_id,
            sweep_coins_awarded=sweep_coins,
            status="credited",
        )
        session.add(reward)

        # Credit user's SC balance
        user_result = await session.execute(select(User).where(User.id == winner_user_id))
        db_user = user_result.scalar_one_or_none()
        if db_user:
            db_user.sweep_coins += sweep_coins

        # Ledger entry
        tx = Transaction(
            id=str(uuid.uuid4()),
            user_id=winner_user_id,
            board_id=board_id,
            amount=sweep_coins,
            type="sc_earn",
            currency="SC",
            reference_id=square_id,
        )
        session.add(tx)

        print(f"[payout] Awarded {sweep_coins} SC to user={winner_user_id} for square={square_id}")

    if db_session:
        await _run(db_session)
    else:
        async with async_session() as session:
            await _run(session)
            await session.commit()
