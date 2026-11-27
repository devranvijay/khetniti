"""Import real historical prices from an AGMARKNET CSV export.

Download a "Price & Arrival" report from agmarknet.gov.in (or data.gov.in) as CSV and run:
    .venv/bin/python -m scripts.import_agmarknet_csv path/to/file.csv --crop onion

Column names vary between exports, so common spellings are accepted. Prices must be ₹ per quintal.
Rows from markets not in app/reference.py MANDIS are skipped. Imported rows are real data (is_demo = False).
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
    "min_price": ["min_price", "min price", "min price (rs./quintal)", "min_x0020_price"],
    "max_price": ["max_price", "max price", "max price (rs./quintal)", "max_x0020_price"],
    "modal_price": ["modal_price", "modal price", "modal price (rs./quintal)", "modal_x0020_price"],
    "arrivals": ["arrivals", "arrivals (tonnes)", "arrival (tonnes)", "arrivals_tonnes"],
}


def _find(df: pd.DataFrame, key: str) -> str | None:
    cols = {c.strip().lower(): c for c in df.columns}
    for alias in COLUMN_ALIASES[key]:
        if alias in cols:
            return cols[alias]
    return None


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("csv")
    p.add_argument("--crop", required=True, choices=list(CROPS))
    p.add_argument("--source", default="AGMARKNET (CSV import)")
    args = p.parse_args()

    df = pd.read_csv(args.csv)
    cols = {k: _find(df, k) for k in COLUMN_ALIASES}
    missing = [k for k in ("market", "date", "modal_price") if not cols[k]]
    if missing:
        raise SystemExit(f"Could not find columns for: {missing}. Columns present: {list(df.columns)}")

    out = pd.DataFrame(
        {
            "market_id": df[cols["market"]].astype(str).map(match_mandi),
            "date": pd.to_datetime(df[cols["date"]], dayfirst=True, errors="coerce").dt.date,
            "min_price": pd.to_numeric(df[cols["min_price"]], errors="coerce") if cols["min_price"] else None,
            "max_price": pd.to_numeric(df[cols["max_price"]], errors="coerce") if cols["max_price"] else None,
            "modal_price": pd.to_numeric(df[cols["modal_price"]], errors="coerce"),
            "arrivals_tonnes": pd.to_numeric(df[cols["arrivals"]], errors="coerce") if cols["arrivals"] else None,
        }
    ).dropna(subset=["market_id", "date", "modal_price"])
    out = out.groupby(["date", "market_id"], as_index=False).mean(numeric_only=True)

    init_db()
    fetched_at = datetime.now(IST)
    rows = [
        {
            "date": r["date"],
            "commodity": args.crop,
            "market_id": r["market_id"],
            "market_name": MANDIS[r["market_id"]]["name"],
            "min_price": None if pd.isna(r.get("min_price")) else float(r["min_price"]),
            "max_price": None if pd.isna(r.get("max_price")) else float(r["max_price"]),
            "modal_price": float(r["modal_price"]),
            "arrivals_tonnes": None if pd.isna(r.get("arrivals_tonnes")) else float(r["arrivals_tonnes"]),
            "source": args.source,
            "is_demo": False,
            "fetched_at": fetched_at,
        }
        for r in out.to_dict("records")
    ]
    n = upsert_rows(rows)
    print(f"Imported {n} market-day rows for {args.crop}.")


if __name__ == "__main__":
    main()
