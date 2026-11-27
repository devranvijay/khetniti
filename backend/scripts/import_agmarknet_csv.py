"""Import real historical prices from an AGMARKNET CSV export.

Download a price report from agmarknet.gov.in (or data.gov.in) as CSV and run:
    .venv/Scripts/python -m scripts.import_agmarknet_csv path/to/file.csv --crop onion

Works with agmarknet.gov.in's "All Type of Report": title rows above the header, a notes footer,
column names carrying the date range ("Modal Price 01-01-2026 to 25-11-2026") and several
commodities in one file are all handled. Prices must be ₹ per quintal and arrivals metric tonnes.
Only rows for --crop and for the app's mandis (main yards, see app/reference.py) are imported.
Imported rows are real data (is_demo = False); re-importing a market-day replaces it.
"""

import argparse
from datetime import datetime

import pandas as pd

from app.db import init_db
from app.reference import CROPS, MANDIS, match_mandi
from app.services.prices import upsert_rows
from app.services.weather import IST

COLUMN_ALIASES = {
    "market": ["market", "market name", "market_name", "apmc"],
    "date": ["arrival_date", "price date", "reported date", "date", "arrival date"],
    "commodity": ["commodity"],
    "min_price": ["min_price", "min price", "min price (rs./quintal)", "min_x0020_price"],
    "max_price": ["max_price", "max price", "max price (rs./quintal)", "max_x0020_price"],
    "modal_price": ["modal_price", "modal price", "modal price (rs./quintal)", "modal_x0020_price"],
    "arrivals": ["arrivals", "arrivals (tonnes)", "arrival (tonnes)", "arrivals_tonnes", "arrival quantity"],
}
HEADER_SEARCH_ROWS = 10


def _match(column: str, key: str, prefix: bool) -> bool:
    c = str(column).strip().lower()
    return any(c == a or (prefix and c.startswith(a + " ")) for a in COLUMN_ALIASES[key])


def _find(columns: list, key: str) -> str | None:
    """Exact alias first; then an alias followed by more words (e.g. a date range)."""
    for prefix in (False, True):
        for c in columns:
            if _match(c, key, prefix):
                return c
    return None


def _read(path: str) -> pd.DataFrame:
    """Read the CSV, using the first row that names both a market and a date column as the header."""
    raw = pd.read_csv(path, header=None, dtype=str, skip_blank_lines=False)
    for i in range(min(HEADER_SEARCH_ROWS, len(raw))):
        row = [c for c in raw.iloc[i].tolist() if isinstance(c, str)]
        if _find(row, "market") and _find(row, "date"):
            df = raw.iloc[i + 1 :].copy()
            df.columns = [c if isinstance(c, str) else f"_{n}" for n, c in enumerate(raw.iloc[i].tolist())]
            return df
    raise SystemExit(f"Could not find a header row with market and date columns in the first {HEADER_SEARCH_ROWS} rows.")


def _number(df: pd.DataFrame, column: str | None):
    return pd.to_numeric(df[column], errors="coerce") if column else None


def load_csv(path: str, crop: str) -> pd.DataFrame:
    """One averaged row per (date, app mandi) for `crop`: date, market_id, prices, arrivals_tonnes."""
    df = _read(path)
    cols = {k: _find(list(df.columns), k) for k in COLUMN_ALIASES}
    missing = [k for k in ("market", "date", "modal_price") if not cols[k]]
    if missing:
        raise SystemExit(f"Could not find columns for: {missing}. Columns present: {list(df.columns)}")

    if cols["commodity"]:
        name = CROPS[crop]["agmarknet_name"]
        present = df[cols["commodity"]].dropna().str.strip()
        df = df[df[cols["commodity"]].str.strip().str.lower() == name.lower()]
        if df.empty:
            raise SystemExit(f"No {name} rows in this file. Commodities present: {sorted(present.unique())}")

    out = pd.DataFrame(
        {
            "market_id": df[cols["market"]].astype(str).map(match_mandi),
            "date": pd.to_datetime(df[cols["date"]], dayfirst=True, errors="coerce").dt.date,
            "min_price": _number(df, cols["min_price"]),
            "max_price": _number(df, cols["max_price"]),
            "modal_price": _number(df, cols["modal_price"]),
            "arrivals_tonnes": _number(df, cols["arrivals"]),
        }
    ).dropna(subset=["market_id", "date", "modal_price"])
    return out.groupby(["date", "market_id"], as_index=False).mean(numeric_only=True)


def _value(r: dict, key: str) -> float | None:
    v = r.get(key)
    return None if v is None or pd.isna(v) else float(v)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("csv")
    p.add_argument("--crop", required=True, choices=list(CROPS))
    p.add_argument("--source", default="AGMARKNET (CSV import)")
    args = p.parse_args()

    out = load_csv(args.csv, args.crop)
    init_db()
    fetched_at = datetime.now(IST)
    rows = [
        {
            "date": r["date"],
            "commodity": args.crop,
            "market_id": r["market_id"],
            "market_name": MANDIS[r["market_id"]]["name"],
            "min_price": _value(r, "min_price"),
            "max_price": _value(r, "max_price"),
            "modal_price": float(r["modal_price"]),
            "arrivals_tonnes": _value(r, "arrivals_tonnes"),
            "source": args.source,
            "is_demo": False,
            "fetched_at": fetched_at,
        }
        for r in out.to_dict("records")
    ]
    n = upsert_rows(rows)
    print(f"Imported {n} market-day rows for {args.crop}.")
    for market_id, days in out.groupby("market_id")["date"].nunique().items():
        print(f"  {MANDIS[market_id]['name']}: {days} days")


if __name__ == "__main__":
    main()
