"""Mandi price storage, live ingestion from data.gov.in (AGMARKNET), and provenance.

Only real AGMARKNET prices are served: from the data.gov.in API or an AGMARKNET CSV import. There is
no demo or synthetic fallback; a crop with no real prices returns a clear "no price data" error.

Every read accepts `cutoff`; rows dated after it are excluded in SQL. Decision Replay relies on this.
"""

import threading
import time
from datetime import date, datetime, timedelta

import httpx
import pandas as pd
from sqlalchemy import and_, delete, func, insert, select

from ..config import settings
from ..db import engine, mandi_prices
from ..reference import CROPS, MANDIS, match_mandi, road_distance_km
from .weather import IST

LIVE_SOURCE = "AGMARKNET via data.gov.in API"
LIVE_MAX_LAG_DAYS = 3
# data.gov.in stalls requests that carry the default python-httpx User-Agent until they time out,
# so every call to it identifies the app instead.
DATA_GOV_HEADERS = {"User-Agent": "KHETNITI/1.0 (mandi price decision support)", "Accept": "application/json"}
STALE_PRICE_DAYS = 7

_refresh_state: dict[str, dict] = {}
_refresh_lock = threading.Lock()


class NoPriceData(Exception):
    pass


def today_ist() -> date:
    return datetime.now(IST).date()


# ---------------------------------------------------------------- storage


def upsert_rows(rows: list[dict]) -> int:
    """Insert rows, replacing any existing row with the same (date, commodity, market, is_demo)."""
    if not rows:
        return 0
    t = mandi_prices
    with engine.begin() as conn:
        for chunk_start in range(0, len(rows), 500):
            chunk = rows[chunk_start : chunk_start + 500]
            for r in chunk:
                conn.execute(
                    delete(t).where(
                        and_(
                            t.c.date == r["date"],
                            t.c.commodity == r["commodity"],
                            t.c.market_id == r["market_id"],
                            t.c.is_demo == r["is_demo"],
                        )
                    )
                )
            conn.execute(insert(t), chunk)
    return len(rows)


def dataset_stats(commodity: str, is_demo: bool) -> dict:
    t = mandi_prices
    with engine.connect() as conn:
        row = conn.execute(
            select(
                func.count(func.distinct(t.c.date)),
                func.min(t.c.date),
                func.max(t.c.date),
                func.max(t.c.fetched_at),
            ).where(and_(t.c.commodity == commodity, t.c.is_demo == is_demo))
        ).one()
    return {"dates": row[0] or 0, "first": row[1], "last": row[2], "fetched_at": row[3]}


def choose_dataset(commodity: str, purpose: str) -> bool:
    """Return is_demo for the dataset to use: always the real one. Raises when a crop has no real prices."""
    if dataset_stats(commodity, False)["dates"] > 0:
        return False
    raise NoPriceData(
        f"No real price data for {commodity} yet. Import an AGMARKNET CSV (scripts/import_agmarknet_csv.py) "
        "or set DATA_GOV_IN_API_KEY and run scripts/fetch_agmarknet_history.py."
    )


def load_frame(
    commodity: str,
    is_demo: bool,
    cutoff: date | None = None,
    start: date | None = None,
    market_ids: list[str] | None = None,
) -> pd.DataFrame:
    t = mandi_prices
    # A zero or negative modal price is a bad feed row; it would break the log-price trend and every net figure.
    conds = [t.c.commodity == commodity, t.c.is_demo == is_demo, t.c.modal_price > 0]
    if cutoff is not None:
        conds.append(t.c.date <= cutoff)
    if start is not None:
        conds.append(t.c.date >= start)
    if market_ids:
        conds.append(t.c.market_id.in_(market_ids))
    q = select(
        t.c.date, t.c.market_id, t.c.market_name, t.c.min_price, t.c.max_price,
        t.c.modal_price, t.c.arrivals_tonnes, t.c.source, t.c.fetched_at,
    ).where(and_(*conds)).order_by(t.c.date)
    with engine.connect() as conn:
        df = pd.read_sql(q, conn)
    if not df.empty:
        df["date"] = pd.to_datetime(df["date"]).dt.date
    # Defence in depth: never return a row after the cutoff even if the query layer changes.
    if cutoff is not None and not df.empty:
        df = df[df["date"] <= cutoff]
    return df


def provenance(commodity: str, is_demo: bool, df: pd.DataFrame, reference_date: date | None = None) -> dict:
    latest = df["date"].max() if not df.empty else None
    ref = reference_date or today_ist()
    lag = (ref - latest).days if latest else None
    sources = sorted(set(df["source"])) if not df.empty else [LIVE_SOURCE]
    fetched = df["fetched_at"].max() if not df.empty else None
    is_live = reference_date is None and lag is not None and lag <= LIVE_MAX_LAG_DAYS
    return {
        "mode": "live" if is_live else "historical",
        "label": "LIVE" if is_live else "REAL · HISTORICAL",
        "source": ", ".join(sources),
        "notice": None if is_live else (f"Latest available price is from {latest} ({lag} days old)." if latest else "No recent prices."),
        "latest_price_date": str(latest) if latest else None,
        "last_updated": pd.Timestamp(fetched).isoformat() if fetched is not None else None,
    }


# ---------------------------------------------------------------- queries


def latest_by_market(commodity: str, location_id: str, cutoff: date | None = None) -> dict:
    is_demo = choose_dataset(commodity, "latest" if cutoff is None else "history")
    ref = cutoff or today_ist()
    df = load_frame(commodity, is_demo, cutoff=ref, start=ref - timedelta(days=45))
    markets = []
    for mid, g in df.groupby("market_id"):
        if mid not in MANDIS or commodity not in MANDIS[mid]["crops"]:
            continue
        g = g.sort_values("date")
        last = g.iloc[-1]
        week_ago = g[g["date"] <= last["date"] - timedelta(days=7)]
        prev = float(week_ago.iloc[-1]["modal_price"]) if not week_ago.empty else None
        age = (ref - last["date"]).days
        markets.append(
            {
                "market_id": mid,
                "market_name": MANDIS[mid]["name"],
                "date": str(last["date"]),
                "age_days": age,
                "stale": age > STALE_PRICE_DAYS,
                "min_price": _f(last["min_price"]),
                "max_price": _f(last["max_price"]),
                "modal_price": float(last["modal_price"]),
                "arrivals_tonnes": _f(last["arrivals_tonnes"]),
                "change_7d_pct": round((float(last["modal_price"]) / prev - 1) * 100, 1) if prev else None,
                "distance_km": road_distance_km(location_id, mid),
                "source": last["source"],
            }
        )
    markets.sort(key=lambda m: m["distance_km"])
    return {
        "crop": commodity,
        "unit": "₹ per quintal",
        "reference_date": str(ref),
        "markets": markets,
        "provenance": provenance(commodity, is_demo, df, reference_date=cutoff),
    }


def history(commodity: str, market_ids: list[str] | None, days: int, cutoff: date | None = None) -> dict:
    is_demo = choose_dataset(commodity, "history")
    df_all = load_frame(commodity, is_demo, cutoff=cutoff)
    if df_all.empty:
        raise NoPriceData(f"No price history for {commodity}.")
    end = cutoff or df_all["date"].max()
    df = df_all[df_all["date"] >= end - timedelta(days=days)]
    if market_ids:
        df = df[df["market_id"].isin(market_ids)]
    series = {}
    for mid, g in df.groupby("market_id"):
        series[mid] = [
            {
                "date": str(r.date),
                "min": _f(r.min_price),
                "max": _f(r.max_price),
                "modal": float(r.modal_price),
                "arrivals": _f(r.arrivals_tonnes),
            }
            for r in g.sort_values("date").itertuples()
        ]
    return {
        "crop": commodity,
        "unit": "₹ per quintal",
        "days": days,
        "series": series,
        "markets": {mid: MANDIS[mid]["name"] for mid in series if mid in MANDIS},
        "provenance": provenance(commodity, is_demo, df_all, reference_date=cutoff),
    }


def available_range(commodity: str) -> dict:
    is_demo = choose_dataset(commodity, "history")
    s = dataset_stats(commodity, is_demo)
    return {"is_demo": is_demo, "first": str(s["first"]) if s["first"] else None, "last": str(s["last"]) if s["last"] else None}


def _f(v):
    return None if v is None or pd.isna(v) else float(v)


# ---------------------------------------------------------------- live ingestion


def refresh_live(commodity: str, force: bool = False) -> dict:
    """Pull today's AGMARKNET prices for Maharashtra from data.gov.in into the database."""
    now = time.time()
    with _refresh_lock:
        state = _refresh_state.get(commodity)
    if not settings.data_gov_in_api_key:
        return {"ok": False, "status": "not_configured", "message": "DATA_GOV_IN_API_KEY is not set on the server."}
    if state and not force and now - state["ts"] < settings.price_refresh_minutes * 60:
        return {**state["result"], "cached": True}

    url = f"https://api.data.gov.in/resource/{settings.data_gov_in_resource_id}"
    params = {
        "api-key": settings.data_gov_in_api_key,
        "format": "json",
        "limit": 1000,
        "filters[state.keyword]": "Maharashtra",
        "filters[commodity]": CROPS[commodity]["agmarknet_name"],
    }
    try:
        r = httpx.get(url, params=params, headers=DATA_GOV_HEADERS, timeout=settings.http_timeout_seconds)
        r.raise_for_status()
        records = r.json().get("records", [])
    except (httpx.HTTPError, ValueError) as exc:
        result = {"ok": False, "status": "error", "message": f"data.gov.in request failed ({type(exc).__name__})."}
        with _refresh_lock:
            _refresh_state[commodity] = {"ts": now, "result": result}
        return result

    fetched_at = datetime.now(IST)
    parsed = []
    for rec in records:
        mid = match_mandi(rec.get("market", ""))
        if not mid:
            continue
        try:
            d = datetime.strptime(rec["arrival_date"], "%d/%m/%Y").date()
            parsed.append(
                {
                    "date": d,
                    "market_id": mid,
                    "min_price": float(rec["min_price"]),
                    "max_price": float(rec["max_price"]),
                    "modal_price": float(rec["modal_price"]),
                }
            )
        except (KeyError, ValueError, TypeError):
            continue
    rows = []
    if parsed:
        df = pd.DataFrame(parsed).groupby(["date", "market_id"], as_index=False).mean(numeric_only=True)
        for r in df.itertuples():
            rows.append(
                {
                    "date": r.date,
                    "commodity": commodity,
                    "market_id": r.market_id,
                    "market_name": MANDIS[r.market_id]["name"],
                    "min_price": round(r.min_price, 2),
                    "max_price": round(r.max_price, 2),
                    "modal_price": round(r.modal_price, 2),
                    "arrivals_tonnes": None,  # not provided by this resource
                    "source": LIVE_SOURCE,
                    "is_demo": False,
                    "fetched_at": fetched_at,
                }
            )
    upsert_rows(rows)
    result = {
        "ok": True,
        "status": "updated" if rows else "no_matching_markets",
        "message": f"Stored {len(rows)} market-day prices from {len(records)} records.",
        "fetched_at": fetched_at.isoformat(timespec="seconds"),
    }
    with _refresh_lock:
        _refresh_state[commodity] = {"ts": now, "result": result}
    return result


def refresh_status() -> dict:
    with _refresh_lock:
        return {k: v["result"] for k, v in _refresh_state.items()}
