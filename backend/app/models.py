import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import String, Text, Float, Boolean, DateTime, ForeignKey, Enum, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Sport(str, PyEnum):
    FOOTBALL = "football"
    BASKETBALL = "basketball"
    BASEBALL = "baseball"


class Quarter(str, PyEnum):
    Q1 = "Q1"
    Q2 = "Q2"
    Q3 = "Q3"
    Q4 = "Q4"


class BoardStatus(str, PyEnum):
    OPEN = "open"
    FILLED = "filled"
    LOCKED = "locked"
    RESOLVED = "resolved"
    CANCELLED = "cancelled"


class GameStatus(str, PyEnum):
    UPCOMING = "upcoming"
    LIVE = "live"
    COMPLETED = "completed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    squares: Mapped[list["Square"]] = relationship(back_populates="owner")
    private_boards: Mapped[list["Board"]] = relationship(back_populates="created_by_user")
    sessions: Mapped[list["Session"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="sessions")


class Game(Base):
    __tablename__ = "games"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    external_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    sport: Mapped[Sport] = mapped_column(Enum(Sport), nullable=False)
    home_team: Mapped[str] = mapped_column(String(100), nullable=False)
    away_team: Mapped[str] = mapped_column(String(100), nullable=False)
    home_team_logo: Mapped[str | None] = mapped_column(String(500), nullable=True)
    away_team_logo: Mapped[str | None] = mapped_column(String(500), nullable=True)
    event_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    q1_start: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    q2_start: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    q3_start: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    q4_start: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    home_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    away_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[GameStatus] = mapped_column(Enum(GameStatus), default=GameStatus.UPCOMING)

    boards: Mapped[list["Board"]] = relationship(back_populates="game")


class Board(Base):
    __tablename__ = "boards"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    game_id: Mapped[str] = mapped_column(String(36), ForeignKey("games.id"), nullable=False)
    quarter: Mapped[Quarter] = mapped_column(Enum(Quarter), nullable=False)
    price_tier: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[BoardStatus] = mapped_column(Enum(BoardStatus), default=BoardStatus.OPEN)
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    share_link: Mapped[str | None] = mapped_column(String(36), unique=True, nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    game: Mapped["Game"] = relationship(back_populates="boards")
    created_by_user: Mapped["User | None"] = relationship(back_populates="private_boards")
    squares: Mapped[list["Square"]] = relationship(back_populates="board", cascade="all, delete-orphan")
    winning_square_id: Mapped[str | None] = mapped_column(String(36), nullable=True)


class Square(Base):
    __tablename__ = "squares"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    board_id: Mapped[str] = mapped_column(String(36), ForeignKey("boards.id"), nullable=False)
    owner_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    purchased_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    stripe_payment_intent: Mapped[str | None] = mapped_column(String(255), nullable=True)

    board: Mapped["Board"] = relationship(back_populates="squares")
    owner: Mapped["User | None"] = relationship(back_populates="squares")
    payout: Mapped["Payout | None"] = relationship(back_populates="square", uselist=False)


class Payout(Base):
    __tablename__ = "payouts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    square_id: Mapped[str] = mapped_column(String(36), ForeignKey("squares.id"), nullable=False)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    stripe_transfer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    square: Mapped["Square"] = relationship(back_populates="payout")
