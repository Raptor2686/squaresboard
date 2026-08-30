from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings


def _make_async_url(url: str) -> str:
    """
    Convert a sync database URL to its async equivalent.
    Render provides  postgresql://...  but asyncpg needs  postgresql+asyncpg://...
    SQLite local dev stays as    sqlite+aiosqlite://...
    """
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):
        # Render sometimes emits 'postgres://' (older format)
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url  # already correct (e.g. sqlite+aiosqlite://...)


_db_url = _make_async_url(settings.DATABASE_URL)

engine = create_async_engine(_db_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
