"""Decision Replay: re-run the advisor as of a past date and score it against what happened next.

The recommendation is produced by advisor.advise(cutoff=as_of), which can only read rows dated on or
before as_of. Outcome prices are loaded afterwards in a separate query that starts the day after as_of.
"""

from datetime import date, timedelta

from ..reference import CROPS
from . import prices
from .advisor import advise, compute_net

OUTCOME_TOLERANCE_DAYS = 3
GOOD_CALL_TOLERANCE = 0.02
MIN_HISTORY_DAYS = 30


class ReplayError(Exception):
    pass


def replay_window(crop: str) -> dict:
    rng = prices.available_range(crop)
    if not rng["first"]:
        raise ReplayError("No price history available.")
    first = date.fromisoformat(rng["first"]) + timedelta(days=MIN_HISTORY_DAYS)
    last = date.fromisoformat(rng["last"]) - timedelta(days=max(CROPS[crop]["wait_horizons"]) + OUTCOME_TOLERANCE_DAYS)
    return {"earliest": str(first), "latest": str(last)}


def _actual_price(frame, market_id: str, target: date) -> tuple[float, str] | None:
    g = frame[(frame["market_id"] == market_id) & (frame["date"] >= target) & (frame["date"] <= target + timedelta(days=OUTCOME_TOLERANCE_DAYS))]
    if g.empty:
        return None
    row = g.sort_values("date").iloc[0]
    return float(row["modal_price"]), str(row["date"])


def replay(crop: str, as_of: date, quantity_q: float, location: str, **advise_kwargs) -> dict:
    win = replay_window(crop)
    if not (date.fromisoformat(win["earliest"]) <= as_of <= date.fromisoformat(win["latest"])):
        raise ReplayError(f"Choose a date between {win['earliest']} and {win['latest']} so there is history before and outcomes after it.")

    advice = advise(crop, quantity_q, location, cutoff=as_of, **advise_kwargs)
    if not advice.get("ok"):
        raise ReplayError(advice.get("message", "No recommendation could be made for that date."))
    # Look-ahead guard: the advice must not have touched any row after as_of.
    if date.fromisoformat(advice["data_max_date"]) > as_of or date.fromisoformat(advice["best_now"]["price_date"]) > as_of:
        raise ReplayError("Look-ahead check failed: decision used data after the replay date.")

    is_demo = False
    horizon_max = max(CROPS[crop]["wait_horizons"])
    future = prices.load_frame(crop, is_demo, start=as_of + timedelta(days=1), cutoff=as_of + timedelta(days=horizon_max + OUTCOME_TOLERANCE_DAYS))

    cfg = CROPS[crop]
    a = advice["assumptions"]
    best_now = advice["best_now"]
    outcomes = [
        {
            "label": f"Sell now at {o['market_name']}",
            "kind": "now",
            "market_id": o["market_id"],
            "days": 0,
            "price": o["price_per_q"],
            "price_date": o["price_date"],
            "net": o["net"],
        }
        for o in advice["options"]
        if not o["stale"]
    ]
    for s in advice["scenarios"]:
        actual = _actual_price(future, s["market_id"], as_of + timedelta(days=s["days"]))
        if not actual:
            continue
        loss = min(a["spoilage_pct_per_day"] * s["days"] / 100.0, 0.9)
        calc = compute_net(
            quantity_q,
            actual[0],
            best_now["transport"],
            a["handling_per_q"],
            a["market_fee_pct"],
            quantity_q * (1 - loss),
            a["storage_cost_per_q_day"] * quantity_q * s["days"],
        )
        outcomes.append(
            {
                "label": f"Wait {s['days']} days, sell at {s['market_name']}",
                "kind": "wait",
                "market_id": s["market_id"],
                "days": s["days"],
                "price": actual[0],
                "price_date": actual[1],
                "net": calc["net"],
                "predicted_net": s["expected"]["net"],
                "predicted_range": [s["net_low"], s["net_high"]],
                "within_range": bool(s["net_low"] <= calc["net"] <= s["net_high"]),
            }
        )

    if advice["action"] == "SELL_NOW":
        rec = next(o for o in outcomes if o["kind"] == "now" and o["market_id"] == advice["decision_market"])
    else:
        rec = next((o for o in outcomes if o["kind"] == "wait" and o["days"] == advice["wait_days"]), None)
        if rec is None:
            raise ReplayError("No actual price was recorded for the recommended selling date.")
    best = max(outcomes, key=lambda o: o["net"])
    local_now = next((o for o in outcomes if o["kind"] == "now" and advice["local"] and o["market_id"] == advice["local"]["market_id"]), None)
    regret = best["net"] - rec["net"]
    good = bool(rec["net"] >= best["net"] * (1 - GOOD_CALL_TOLERANCE))

    # Price path for the chart, marking which points were visible at decision time.
    chart_market = advice["decision_market"]
    before = prices.load_frame(crop, is_demo, cutoff=as_of, start=as_of - timedelta(days=30), market_ids=[chart_market])
    after = future[future["market_id"] == chart_market]
    path = [{"date": str(r.date), "modal": float(r.modal_price), "phase": "known"} for r in before.itertuples()]
    path += [{"date": str(r.date), "modal": float(r.modal_price), "phase": "revealed"} for r in after.itertuples()]

    return {
        "crop": crop,
        "as_of": str(as_of),
        "advice": advice,
        "outcomes": sorted(outcomes, key=lambda o: o["net"], reverse=True),
        "recommended_outcome": rec,
        "best_outcome": best,
        "local_now_outcome": local_now,
        "regret": round(regret, 2),
        "good_call": good,
        "verdict": "Good call" if good else "Better option existed",
        "verdict_detail": (
            f"The recommendation earned ₹{rec['net']:,.0f}; the best option in hindsight earned ₹{best['net']:,.0f}."
            + ("" if good else f" Difference: ₹{regret:,.0f}.")
        ),
        "path": path,
        "path_market": chart_market,
        "leakage_check": {
            "decision_cutoff": str(as_of),
            "latest_row_used_for_decision": advice["data_max_date"],
            "passed": True,
            "note": "The recommendation was computed with a query limited to rows dated on or before the replay date. Later prices were loaded only to score it.",
        },
        "provenance": advice["provenance"],
    }


def backtest(crop: str, start: date, end: date, step_days: int, quantity_q: float, location: str, **advise_kwargs) -> dict:
    win = replay_window(crop)
    start = max(start, date.fromisoformat(win["earliest"]))
    end = min(end, date.fromisoformat(win["latest"]))
    if start > end:
        raise ReplayError(f"No valid dates in range. Valid range: {win['earliest']} to {win['latest']}.")
    step_days = max(step_days, 1)
    runs, d = [], start
    while d <= end and len(runs) < 80:
        try:
            r = replay(crop, d, quantity_q, location, **advise_kwargs)
            runs.append(
                {
                    "as_of": r["as_of"],
                    "action": r["advice"]["action"],
                    "headline": r["advice"]["headline"],
                    "recommended_net": r["recommended_outcome"]["net"],
                    "best_net": r["best_outcome"]["net"],
                    "local_now_net": r["local_now_outcome"]["net"] if r["local_now_outcome"] else None,
                    "good_call": r["good_call"],
                    "regret": r["regret"],
                }
            )
        except ReplayError:
            pass
        d += timedelta(days=step_days)
    if not runs:
        raise ReplayError("No replay dates produced a result.")
    n = len(runs)
    rec_total = sum(r["recommended_net"] for r in runs)
    local_runs = [r for r in runs if r["local_now_net"] is not None]
    return {
        "crop": crop,
        "start": str(start),
        "end": str(end),
        "step_days": step_days,
        "runs": runs,
        "summary": {
            "decisions": n,
            "good_calls": sum(r["good_call"] for r in runs),
            "good_call_rate": round(sum(r["good_call"] for r in runs) / n * 100, 1),
            "wait_recommendations": sum(r["action"] == "WAIT" for r in runs),
            "avg_regret": round(sum(r["regret"] for r in runs) / n, 2),
            "recommended_total": round(rec_total, 2),
            "baseline_local_total": round(sum(r["local_now_net"] for r in local_runs), 2) if local_runs else None,
            "uplift_vs_local_pct": (
                round((sum(r["recommended_net"] for r in local_runs) / sum(r["local_now_net"] for r in local_runs) - 1) * 100, 2)
                if local_runs and sum(r["local_now_net"] for r in local_runs) > 0
                else None
            ),
            "baseline_note": "Baseline = always selling immediately at your local (nearest) mandi.",
        },
        "provenance": prices.provenance(crop, False, prices.load_frame(crop, False, cutoff=end, start=end), reference_date=end),
    }
