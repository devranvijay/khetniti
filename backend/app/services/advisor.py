"""Smart Sell Advisor: transparent net-revenue maths and a sell-now / wait recommendation.

All price inputs come through prices.load_frame / latest_by_market with an explicit `cutoff`, so the same
function is used for live advice and for Decision Replay without any access to later data.
"""

from datetime import date, timedelta

import numpy as np
import pandas as pd

from ..reference import CROPS, MANDIS, nearest_mandi
from . import prices

TREND_WINDOW_DAYS = 21
TREND_DAMPING = 0.5  # half of the recent trend is carried forward; prices tend to mean-revert
MAX_DRIFT_PER_DAY = 0.015
BAND_Z = 1.28  # 80% band
WAIT_GAIN_REQUIRED = 0.05  # waiting must beat selling now by 5% on expected net...
WAIT_DOWNSIDE_LIMIT = 0.08  # ...and the low end may not fall more than 8% below selling now


def compute_net(
    quantity_q: float,
    price_per_q: float,
    transport_cost: float,
    handling_per_q: float,
    fee_pct: float,
    saleable_q: float | None = None,
    storage_cost: float = 0.0,
) -> dict:
    """Gross = saleable quantity × price; Net = Gross − transport − handling − market fee − storage."""
    sale_q = quantity_q if saleable_q is None else saleable_q
    gross = sale_q * price_per_q
    fee = gross * fee_pct / 100.0
    handling = quantity_q * handling_per_q
    net = gross - transport_cost - handling - fee - storage_cost
    return {
        "quantity_q": round(quantity_q, 2),
        "saleable_q": round(sale_q, 2),
        "price_per_q": round(price_per_q, 2),
        "gross": round(gross, 2),
        "transport": round(transport_cost, 2),
        "handling": round(handling, 2),
        "market_fee": round(fee, 2),
        "storage": round(storage_cost, 2),
        "net": round(net, 2),
        "net_per_q": round(net / quantity_q, 2) if quantity_q else 0.0,
    }


def trend_stats(df: pd.DataFrame) -> dict | None:
    """Log-linear trend and daily volatility of modal price over the last TREND_WINDOW_DAYS."""
    if df.empty:
        return None
    df = df.sort_values("date")
    last = df["date"].max()
    w = df[df["date"] >= last - timedelta(days=TREND_WINDOW_DAYS)]
    if len(w) < 5:
        return None
    x = np.array([(d - w["date"].iloc[0]).days for d in w["date"]], dtype=float)
    y = np.log(w["modal_price"].to_numpy(dtype=float))
    slope = float(np.polyfit(x, y, 1)[0])
    dx = np.diff(x)
    dy = np.diff(y)
    mask = dx > 0
    vol = float(np.std(dy[mask] / np.sqrt(dx[mask]), ddof=1)) if mask.sum() >= 3 else 0.0
    return {
        "window_days": TREND_WINDOW_DAYS,
        "points": int(len(w)),
        "slope_pct_per_day": round(slope * 100, 3),
        "volatility_pct_per_day": round(vol * 100, 3),
        "from": str(w["date"].iloc[0]),
        "to": str(last),
    }


def _transport(mandi_id: str, distance_km: float, qty: float, rate: float, overrides: dict[str, float] | None) -> tuple[float, str]:
    if overrides and mandi_id in overrides and overrides[mandi_id] is not None:
        return float(overrides[mandi_id]), "entered by you"
    return distance_km * rate * qty, f"{distance_km:.0f} km × ₹{rate:g}/q/km × {qty:g} q"


def advise(
    crop: str,
    quantity_q: float,
    location: str,
    local_mandi: str | None = None,
    transport_rate_per_q_km: float = 1.0,
    transport_overrides: dict[str, float] | None = None,
    handling_per_q: float = 10.0,
    fee_pct: float = 0.0,
    spoilage_pct_per_day: float | None = None,
    storage_cost_per_q_day: float | None = None,
    risk_level: str | None = None,
    cutoff: date | None = None,
) -> dict:
    cfg = CROPS[crop]
    spoil = cfg["spoilage_pct_per_day"] if spoilage_pct_per_day is None else spoilage_pct_per_day
    storage_rate = cfg["storage_cost_per_q_day"] if storage_cost_per_q_day is None else storage_cost_per_q_day
    local_mandi = local_mandi if local_mandi in MANDIS and crop in MANDIS[local_mandi]["crops"] else nearest_mandi(location, crop)

    latest = prices.latest_by_market(crop, location, cutoff=cutoff)
    ref_date = date.fromisoformat(latest["reference_date"])

    # Sell-now options at every mandi with a price.
    options = []
    for m in latest["markets"]:
        cost, basis = _transport(m["market_id"], m["distance_km"], quantity_q, transport_rate_per_q_km, transport_overrides)
        calc = compute_net(quantity_q, m["modal_price"], cost, handling_per_q, fee_pct)
        options.append(
            {
                **calc,
                "market_id": m["market_id"],
                "market_name": m["market_name"],
                "distance_km": m["distance_km"],
                "price_date": m["date"],
                "age_days": m["age_days"],
                "stale": m["stale"],
                "transport_basis": basis,
                "is_local": m["market_id"] == local_mandi,
            }
        )
    options.sort(key=lambda o: o["net"], reverse=True)
    fresh = [o for o in options if not o["stale"]]
    if not fresh:
        return {
            "ok": False,
            "message": "No mandi has a price from the last 7 days, so no recommendation can be made safely.",
            "options": options,
            "provenance": latest["provenance"],
        }
    best_now = fresh[0]
    local = next((o for o in options if o["market_id"] == local_mandi), None)

    # Wait scenarios at the best-now mandi, using only data up to the reference date.
    is_demo = latest["provenance"]["mode"] == "demo"
    hist = prices.load_frame(crop, is_demo, cutoff=ref_date, start=ref_date - timedelta(days=60), market_ids=[best_now["market_id"]])
    data_max_date = str(hist["date"].max()) if not hist.empty else best_now["price_date"]
    trend = trend_stats(hist)
    scenarios = []
    wait_note = None
    if trend is None:
        wait_note = "Not enough recent price history at this mandi to model waiting."
    else:
        drift = float(np.clip(trend["slope_pct_per_day"] / 100 * TREND_DAMPING, -MAX_DRIFT_PER_DAY, MAX_DRIFT_PER_DAY))
        vol = trend["volatility_pct_per_day"] / 100
        p0 = best_now["price_per_q"]
        for h in cfg["wait_horizons"]:
            loss = min(spoil * h / 100.0, 0.9)
            saleable = quantity_q * (1 - loss)
            storage = storage_rate * quantity_q * h
            band = BAND_Z * vol * np.sqrt(h)
            p_exp = p0 * np.exp(drift * h)
            p_low = p0 * np.exp(drift * h - band)
            p_high = p0 * np.exp(drift * h + band)
            exp_calc = compute_net(quantity_q, p_exp, best_now["transport"], handling_per_q, fee_pct, saleable, storage)
            low_calc = compute_net(quantity_q, p_low, best_now["transport"], handling_per_q, fee_pct, saleable, storage)
            high_calc = compute_net(quantity_q, p_high, best_now["transport"], handling_per_q, fee_pct, saleable, storage)
            scenarios.append(
                {
                    "days": h,
                    "market_id": best_now["market_id"],
                    "market_name": best_now["market_name"],
                    "loss_pct": round(loss * 100, 2),
                    "price_expected": round(p_exp, 2),
                    "price_low": round(p_low, 2),
                    "price_high": round(p_high, 2),
                    "expected": exp_calc,
                    "net_low": low_calc["net"],
                    "net_high": high_calc["net"],
                }
            )

    # Decision.
    reasons: list[str] = []
    action, chosen = "SELL_NOW", None
    best_wait = max(scenarios, key=lambda s: s["expected"]["net"]) if scenarios else None
    perishable_block = risk_level == "High" and not cfg["storable"]
    if best_wait:
        gain = best_wait["expected"]["net"] / best_now["net"] - 1 if best_now["net"] > 0 else 0
        downside = 1 - best_wait["net_low"] / best_now["net"] if best_now["net"] > 0 else 1
        if gain >= WAIT_GAIN_REQUIRED and downside <= WAIT_DOWNSIDE_LIMIT and not perishable_block:
            action, chosen = "WAIT", best_wait
            reasons.append(
                f"Waiting {best_wait['days']} days is estimated to add {gain * 100:.1f}% (₹{best_wait['expected']['net'] - best_now['net']:,.0f}) "
                f"after {best_wait['loss_pct']}% weight loss and ₹{best_wait['expected']['storage']:,.0f} storage."
            )
            reasons.append(
                f"In a poor case (low end of the 80% range) waiting yields ₹{best_wait['net_low']:,.0f}, {downside * 100:.1f}% below selling now."
            )
        else:
            why = []
            if gain < WAIT_GAIN_REQUIRED:
                why.append(f"the expected gain from waiting is only {gain * 100:+.1f}% (needs ≥ {WAIT_GAIN_REQUIRED * 100:.0f}%)")
            if downside > WAIT_DOWNSIDE_LIMIT:
                why.append(f"the downside is up to {downside * 100:.1f}% below selling now (limit {WAIT_DOWNSIDE_LIMIT * 100:.0f}%)")
            if perishable_block:
                why.append("weather risk is High and the crop cannot be stored")
            reasons.append("Selling now is preferred because " + " and ".join(why) + ".")
    elif wait_note:
        reasons.append(wait_note + " Selling now is the default.")

    if local and best_now["market_id"] != local["market_id"]:
        diff = best_now["net"] - local["net"]
        reasons.append(
            f"{best_now['market_name']} pays ₹{best_now['price_per_q'] - local['price_per_q']:,.0f}/q more than {local['market_name']}; "
            f"after the extra transport you keep ₹{diff:,.0f} more."
        )
    elif local:
        reasons.append(f"Your local mandi, {local['market_name']}, gives the highest net after transport.")
    if trend:
        reasons.append(
            f"Modal price at {best_now['market_name']} moved {trend['slope_pct_per_day']:+.2f}%/day over the last {trend['window_days']} days "
            f"(day-to-day volatility {trend['volatility_pct_per_day']:.2f}%)."
        )
    if risk_level:
        reasons.append(f"Harvest weather risk for the next 3 days is {risk_level}.")

    # Confidence: data freshness, depth and volatility, plus how clear the margin is.
    margin = 0.0
    if action == "SELL_NOW":
        alts = [o["net"] for o in fresh[1:]] + ([best_wait["expected"]["net"]] if best_wait else [])
        if alts and best_now["net"] > 0:
            margin = 1 - max(alts) / best_now["net"]
    else:
        margin = chosen["expected"]["net"] / best_now["net"] - 1
    vol = trend["volatility_pct_per_day"] if trend else 99
    pts = trend["points"] if trend else 0
    if best_now["age_days"] > 3 or pts < 8 or vol > 6:
        confidence = "Low"
    elif best_now["age_days"] <= 2 and pts >= 10 and vol < 3 and margin > 0.08:
        confidence = "High"
    else:
        confidence = "Medium"

    if action == "SELL_NOW":
        headline = f"Sell now at {best_now['market_name']}"
        est = {"net": best_now["net"], "low": best_now["net"], "high": best_now["net"]}
        decision_market = best_now["market_id"]
    else:
        headline = f"Consider waiting about {chosen['days']} days, then sell at {chosen['market_name']}"
        est = {"net": chosen["expected"]["net"], "low": chosen["net_low"], "high": chosen["net_high"]}
        decision_market = chosen["market_id"]

    return {
        "ok": True,
        "crop": crop,
        "location": location,
        "reference_date": str(ref_date),
        "action": action,
        "headline": headline,
        "decision_market": decision_market,
        "wait_days": chosen["days"] if chosen else 0,
        "estimated_net": est,
        "confidence": confidence,
        "reasons": reasons,
        "options": options,
        "best_now": best_now,
        "local": local,
        "scenarios": scenarios,
        "trend": trend,
        "risk_level": risk_level,
        "assumptions": {
            "transport_rate_per_q_km": transport_rate_per_q_km,
            "handling_per_q": handling_per_q,
            "market_fee_pct": fee_pct,
            "spoilage_pct_per_day": spoil,
            "storage_cost_per_q_day": storage_rate,
            "trend_damping": TREND_DAMPING,
            "range": "80% range from recent day-to-day volatility",
            "distance": "Straight-line distance × 1.3 as an estimate of road distance",
        },
        "formulas": {
            "gross": "Gross revenue = Saleable quantity (q) × Modal price (₹/q)",
            "net": "Net revenue = Gross − Transport − Handling − Market fee − Storage",
            "wait_price": "Expected price after d days = Today's price × e^(damped trend × d)",
        },
        "caveats": [
            "This is an estimate from past prices. Future prices and profits are not guaranteed.",
            "Confirm the day's rate with the mandi or your commission agent before transporting.",
        ],
        "data_max_date": data_max_date,
        "provenance": latest["provenance"],
    }
