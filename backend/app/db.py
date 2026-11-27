from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.pool import NullPool

from .config import settings



def normalize_database_url(url: str) -> str:
    """Supabase shows `postgresql://...`, which SQLAlchemy maps to psycopg2; this app installs psycopg 3."""
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix) :]
    return url


DATABASE_URL = normalize_database_url(settings.database_url)
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, future=True, pool_pre_ping=True, connect_args={"check_same_thread": False})
else:
    # Serverless (Vercel): hold no pool inside the function; Supabase's pooler does the pooling. Its
    # transaction mode cannot keep prepared statements, so psycopg's automatic preparing is off.
    engine = create_engine(DATABASE_URL, future=True, poolclass=NullPool, connect_args={"prepare_threshold": None})
metadata = MetaData()

# One row per (date, commodity, market). Varieties are averaged at ingest.
# is_demo is kept for schema compatibility. The app stores and serves real AGMARKNET data only (is_demo = False).
mandi_prices = Table(
    "mandi_prices",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("date", Date, nullable=False),
    Column("commodity", String(40), nullable=False),
    Column("market_id", String(40), nullable=False),
    Column("market_name", String(120)),
    Column("min_price", Float),
    Column("max_price", Float),
    Column("modal_price", Float, nullable=False),
    Column("arrivals_tonnes", Float, nullable=True),
    Column("source", String(160), nullable=False),
    Column("is_demo", Boolean, nullable=False, default=False),
    Column("fetched_at", DateTime(timezone=True), nullable=False),
    UniqueConstraint("date", "commodity", "market_id", "is_demo", name="uq_mandi_price"),
)
Index("ix_mandi_lookup", mandi_prices.c.commodity, mandi_prices.c.is_demo, mandi_prices.c.market_id, mandi_prices.c.date)

decisions = Table(
    "decisions",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("kind", String(20), nullable=False),  # "advice" | "replay" | "backtest"
    Column("crop", String(40), nullable=False),
    Column("location", String(40), nullable=False),
    Column("headline", Text, nullable=False),
    Column("data_mode", String(20), nullable=False),
    Column("payload", Text, nullable=False),  # JSON
)


def init_db() -> None:
    metadata.create_all(engine)
