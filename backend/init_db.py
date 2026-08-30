import asyncio
import app.models  # ensure all models are registered
from app.database import engine, Base

async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("SUCCESS: New sweepstakes schema created.")

asyncio.run(main())
