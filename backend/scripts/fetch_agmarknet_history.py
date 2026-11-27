"""Backfill real mandi price history from data.gov.in (AGMARKNET variety-wise daily prices).

The app's live refresh only brings in recent prices. Charts, Decision Replay and the Sell Advisor's
wait scenarios need at least 60 days of history, so this fetches it day by day for Maharashtra,
keeps the app's mandis (main yards only), averages varieties per market-day and stores the result
as real data (is_demo = False). Each day is saved as soon as it is fetched, and re-running is safe
because market-days are upserted.

    .venv/Scripts/python -m scripts.fetch_agmarknet_history                  # last 120 days, all crops
    .venv/Scripts/python -m scripts.fetch_agmarknet_history --days 400 --crop onion

Needs DATA_GOV_IN_API_KEY in backend/.env. The key is never printed.
"""

import argparse
import sys
import time
from datetime import datetime, timedelta

import httpx
import pandas as pd

from app.config import settings
from app.db import init_db
from app.reference import CROPS, MANDIS, match_mandi
from app.services.prices import DATA_GOV_HEADERS, LIVE_SOURCE, today_ist, upsert_rows
from app.services.weather import IST

# "Variety-wise Daily Market Prices Data of Commodity". Unlike the current-day resource the app
# refreshes from, this one keeps history and can be filtered by Arrival_Date.
HISTORY_RESOURCE = "35985678-0d79-46b4-9ed6-6f13308a1d24"
API_URL = f"https://api.data.gov.in/resource/{HISTORY_RESOURCE}"
STATE = "Maharashtra"
PAGE_SIZE = 1000
RETRIES = 4
PAUSE_SECONDS = 0.3
DEFAULT_DAYS = 120  # comfortably above the 60 real price days that charts and replay need


def _num(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse(rec: dict) -> dict | None:
    """One API record -> {date, market_id, prices}, or None if it is not usable for the app."""
    low = {k.lower(): v for k, v in rec.items()}
    market_id = match_mandi(str(low.get("market", "")))
    modal = _num(low.get("modal_price"))
    try:
        day = datetime.strptime(str(low.get("arrival_date", "")).strip(), "%d/%m/%Y").date()
    except ValueError:
        return None
    if not market_id or modal is None:
        return None
    return {"date": day, "market_id": market_id, "min_price": _num(low.get("min_price")), "max_price": _num(low.get("max_price")), "modal_price": modal}


def _price(value) -> float | None:
    return None if pd.isna(value) else round(float(value), 2)


def to_rows(records: list[dict], crop: str) -> list[dict]:
    """API records -> one row per (date, app mandi), varieties averaged, ready for upsert_rows."""
    parsed = [p for p in (_parse(r) for r in records) if p]
    if not parsed:
        return []
    df = pd.DataFrame(parsed).groupby(["date", "market_id"], as_index=False).mean(numeric_only=True)
    fetched_at = datetime.now(IST)
    return [
        {
            "date": r["date"],
            "commodity": crop,
            "market_id": r["market_id"],
            "market_name": MANDIS[r["market_id"]]["name"],
            "min_price": _price(r["min_price"]),
            "max_price": _price(r["max_price"]),
            "modal_price": _price(r["modal_price"]),
            "arrivals_tonnes": None,  # not provided by this resource
            "source": LIVE_SOURCE,
            "is_demo": False,
            "fetched_at": fetched_at,
        }
        for r in df.to_dict("records")
    ]


def _get_page(client: httpx.Client, params: dict) -> list[dict]:
    """One API page with retries on rate limits and server errors. Error text never includes the URL (it holds the key)."""
    for attempt in range(RETRIES):
        try:
            r = client.get(API_URL, params=params)
            if r.status_code == 200:
                return r.json().get("records") or []
            if r.status_code in (401, 403):
                sys.exit(f"data.gov.in rejected the API key (HTTP {r.status_code}). Check DATA_GOV_IN_API_KEY in backend/.env.")
            if r.status_code != 429 and r.status_code < 500:
                sys.exit(f"data.gov.in request failed (HTTP {r.status_code}).")
            problem = f"HTTP {r.status_code}"
        except (httpx.HTTPError, ValueError) as exc:
            problem = type(exc).__name__
        wait = 2 ** attempt * 2
        print(f"  {problem}; retrying in {wait}s", file=sys.stderr)
        time.sleep(wait)
    sys.exit("data.gov.in kept failing. Try again later; days fetched so far are already saved.")


def fetch_day(client: httpx.Client, crop: str, day) -> list[dict]:
    params = {
        "api-key": settings.data_gov_in_api_key,
        "format": "json",
        "limit": PAGE_SIZE,
        "filters[State]": STATE,
        "filters[Commodity]": CROPS[crop]["agmarknet_name"],
        "filters[Arrival_Date]": day.strftime("%d/%m/%Y"),
    }
    records, offset = [], 0
    while True:
        page = _get_page(client, {**params, "offset": offset})
        records.extend(page)
        if len(page) < PAGE_SIZE:
            return records
        offset += PAGE_SIZE
        time.sleep(PAUSE_SECONDS)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--days", type=int, default=DEFAULT_DAYS, help=f"how many past days to fetch (default {DEFAULT_DAYS})")
    p.add_argument("--crop", action="append", choices=list(CROPS), help="repeat for several; default: all crops")
    args = p.parse_args()
    if not settings.data_gov_in_api_key:
        sys.exit("Set DATA_GOV_IN_API_KEY in backend/.env first (data.gov.in -> My Account -> API key).")
    crops = args.crop or list(CROPS)

    init_db()
    totals = {c: {"rows": 0, "days": 0} for c in crops}
    today = today_ist()
    with httpx.Client(timeout=60, headers=DATA_GOV_HEADERS) as client:
        for back in range(args.days, -1, -1):
            day = today - timedelta(days=back)
            stored = []
            for crop in crops:
                rows = to_rows(fetch_day(client, crop, day), crop)
                upsert_rows(rows)
                totals[crop]["rows"] += len(rows)
                totals[crop]["days"] += bool(rows)
                stored.append(f"{crop} {len(rows)}")
                time.sleep(PAUSE_SECONDS)
            print(f"{day}: {', '.join(stored)} market-days")

    print()
    for crop, t in totals.items():
        print(f"{crop}: {t['rows']} market-day prices over {t['days']} days")
    short = [c for c, t in totals.items() if t["days"] < 60]
    if short:
        print(f"Fewer than 60 price days for {', '.join(short)}: wait scenarios and replay have little history. Re-run with a larger --days.")


if __name__ == "__main__":
    main()
