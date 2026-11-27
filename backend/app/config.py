from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Runtime configuration. Secrets come from the environment or backend/.env only."""

    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    # PostgreSQL in production, e.g. postgresql+psycopg://user:pass@host:5432/khetniti
    # Falls back to a local SQLite file so the app runs without a database server.
    database_url: str = f"sqlite:///{BASE_DIR / 'khetniti.db'}"

    # data.gov.in API key for the AGMARKNET daily mandi price resource. Never sent to the browser.
    data_gov_in_api_key: str | None = None
    data_gov_in_resource_id: str = "9ef84268-d588-465a-a308-a864a43d0070"

    cors_origins: str = "http://localhost:3000"

    # Vercel Cron sends this as "Authorization: Bearer <CRON_SECRET>". Unset = the cron endpoint is closed.
    cron_secret: str | None = None

    weather_cache_minutes: int = 30
    price_refresh_minutes: int = 60
    http_timeout_seconds: float = 12.0


settings = Settings()
