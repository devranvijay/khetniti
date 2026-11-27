from urllib.parse import quote, unquote

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

from .config import settings


def normalize_database_url(url: str) -> str:
    """Make a PostgreSQL URL usable exactly as copied from Supabase.

    - `postgresql://` maps to psycopg2 in SQLAlchemy; this app installs psycopg 3.
    - A password pasted with a raw `@`, `#`, `/` ... would be split into the host name, so the
      password (everything before the last `@`) is percent-encoded. Already-encoded ones stay as is.
    """
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            url = "postgresql+psycopg://" + url[len(prefix) :]
    if not url.startswith("postgresql+psycopg://") or "@" not in url:
        return url
    scheme, rest = url.split("://", 1)
    credentials, host = rest.rsplit("@", 1)
    if ":" not in credentials:
        return url
    user, password = credentials.split(":", 1)
    return f"{scheme}://{user}:{quote(unquote(password), safe='')}@{host}"


DATABASE_URL = normalize_database_url(settings.database_url)
POOL_SIZE = 2
POOL_OVERFLOW = 3
POOL_RECYCLE_SECONDS = 300
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, future=True, pool_pre_ping=True, connect_args={"check_same_thread": False})
else:
    # Opening a connection to Supabase costs a TLS handshake and login (seconds over a long route), far
    # more than a query, so a small pool is kept and reused: Vercel's Fluid compute serves many requests
    # from one instance. Small sizes stay inside Supabase's pooler limits; recycling drops idle
    # connections before the pooler does. Prepared statements are off for the pooler's transaction mode.
    engine = create_engine(
        DATABASE_URL,
        future=True,
        pool_size=POOL_SIZE,
        max_overflow=POOL_OVERFLOW,
        pool_pre_ping=True,
        pool_recycle=POOL_RECYCLE_SECONDS,
        connect_args={"prepare_threshold": None},
    )
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
    if engine.dialect.name == "postgresql":
        _close_supabase_data_api()


def _close_supabase_data_api() -> None:
    """Only this backend reads and writes these tables. On Supabase, the public Data API roles (anon,
    authenticated) get table grants by default, and RLS does not stop TRUNCATE, so RLS is enabled and
    the grants are revoked. The backend's own role owns the tables and is unaffected."""
    with engine.begin() as conn:
        api_roles = [r for (r,) in conn.exec_driver_sql("select rolname from pg_roles where rolname in ('anon', 'authenticated')")]
        for table in metadata.sorted_tables:
            conn.exec_driver_sql(f'alter table "{table.name}" enable row level security')
            if api_roles:
                conn.exec_driver_sql(f'revoke all on table "{table.name}" from {", ".join(api_roles)}')
