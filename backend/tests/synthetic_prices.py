"""Synthetic, seeded mandi prices for the test suite only.

Loaded into the tests' throwaway SQLite database (see conftest.py); never into the app's database.
"""

import math
from datetime import date, datetime, timedelta

import numpy as np

from app.reference import MANDIS
from app.services.weather import IST

# (base ₹/q, seasonal amplitude, month of seasonal peak, daily noise)
PROFILES = {
    "tomato": (1500, 0.55, 7, 0.045),
    "onion": (1900, 0.35, 10, 0.025),
    "potato": (1350, 0.25, 11, 0.018),
}
# Typical price level of each mandi relative to the regional average.
MARKET_PREMIUM = {
    "nashik": 0.00, "pimpalgaon": 0.02, "lasalgaon": 0.03, "yeola": -0.01,
    "sinnar": -0.02, "ahmednagar": -0.01, "pune": 0.07, "mumbai": 0.11,
}
MARKET_SIZE = {
    "nashik": 1.0, "pimpalgaon": 0.9, "lasalgaon": 1.6, "yeola": 0.6,
    "sinnar": 0.4, "ahmednagar": 0.7, "pune": 1.2, "mumbai": 1.5,
}
BASE_ARRIVALS_T = {"tomato": 450, "onion": 900, "potato": 350}


def generate(start: date, end: date, seed: int = 2026) -> list[dict]:
    rng = np.random.default_rng(seed)
    fetched_at = datetime.now(IST)
    rows = []
    days = (end - start).days + 1
    for crop, (base, amp, peak, noise) in PROFILES.items():
        # Shared regional shock (AR(1) in log space) plus small mandi-specific noise.
        shock = np.zeros(days)
        for i in range(1, days):
            shock[i] = 0.93 * shock[i - 1] + rng.normal(0, noise)
        for mid, m in MANDIS.items():
            if crop not in m["crops"]:
                continue
            local = np.zeros(days)
            for i in range(1, days):
                local[i] = 0.7 * local[i - 1] + rng.normal(0, noise * 0.35)
            for i in range(days):
                d = start + timedelta(days=i)
                if d.weekday() == 6 and mid not in ("mumbai", "pune"):
                    continue  # most rural APMCs closed on Sunday
                season = amp * math.cos(2 * math.pi * (d.month - peak + d.day / 30.0) / 12.0)
                modal = base * math.exp(season + shock[i] + local[i]) * (1 + MARKET_PREMIUM[mid])
                spread_lo = rng.uniform(0.70, 0.85)
                spread_hi = rng.uniform(1.10, 1.25)
                arrivals = BASE_ARRIVALS_T[crop] * MARKET_SIZE[mid] * math.exp(-season * 0.8 + rng.normal(0, 0.2))
                rows.append(
                    {
                        "date": d,
                        "commodity": crop,
                        "market_id": mid,
                        "market_name": m["name"],
                        "min_price": round(modal * spread_lo / 10) * 10,
                        "max_price": round(modal * spread_hi / 10) * 10,
                        "modal_price": round(modal / 10) * 10,
                        "arrivals_tonnes": round(arrivals, 1),
                        "source": "Synthetic test prices",
                        "is_demo": False,
                        "fetched_at": fetched_at,
                    }
                )
    return rows
