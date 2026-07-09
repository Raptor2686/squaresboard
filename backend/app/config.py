import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///squaresboard.db")
    STRIPE_SECRET_KEY: str = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_PUBLISHABLE_KEY: str = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    THESPORTSDB_API_KEY: str = os.getenv("THESPORTSDB_API_KEY", "")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-change-in-production")

settings = Settings()
