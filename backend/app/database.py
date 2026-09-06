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

_is_sqlite = "sqlite" in _db_url

# Production PostgreSQL needs connection pool tuning;
# SQLite doesn't support pool_size / max_overflow.
_engine_kwargs: dict = {"echo": False}
if not _is_sqlite:
    _engine_kwargs.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_recycle": 1800,   # recycle connections every 30 min
        "pool_pre_ping": True,  # verify connection health before use
    })

engine = create_async_engine(_db_url, **_engine_kwargs)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
