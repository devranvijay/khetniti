from datetime import date

import pytest
from sqlalchemy import and_, update

from app.db import engine, mandi_prices
from app.services import prices, risk
from app.services.advisor import advise, compute_net
from app.services.replay import ReplayError, replay


def test_net_revenue_formula():
    r = compute_net(quantity_q=20, price_per_q=1500, transport_cost=600, handling_per_q=10, fee_pct=2)
    assert r["gross"] == 30000
    assert r["market_fee"] == 600
    assert r["handling"] == 200
    assert r["net"] == 30000 - 600 - 200 - 600
    assert r["net_per_q"] == pytest.approx(r["net"] / 20)


def test_net_revenue_with_spoilage_and_storage():
    r = compute_net(10, 2000, 100, 0, 0, saleable_q=9.5, storage_cost=50)
    assert r["gross"] == 19000
    assert r["net"] == 19000 - 100 - 50


def test_advice_options_are_internally_consistent():
    a = advise("tomato", 20, "nashik", cutoff=date(2025, 6, 2))
    assert a["ok"]
    for o in a["options"]:
        assert o["gross"] == pytest.approx(o["quantity_q"] * o["price_per_q"])
        assert o["net"] == pytest.approx(o["gross"] - o["transport"] - o["handling"] - o["market_fee"] - o["storage"])
    assert a["best_now"]["net"] == max(o["net"] for o in a["options"] if not o["stale"])
    assert a["provenance"]["mode"] == "historical"


def test_cutoff_excludes_future_rows():
    df = prices.load_frame("onion", False, cutoff=date(2025, 3, 1))
    assert not df.empty
    assert df["date"].max() <= date(2025, 3, 1)


def test_replay_has_no_lookahead():
    """Changing every price after the replay date must not change the recommendation."""
    as_of = date(2025, 5, 14)
    before = replay("onion", as_of, 50, "niphad")
    with engine.begin() as conn:
        conn.execute(
            update(mandi_prices)
            .where(and_(mandi_prices.c.commodity == "onion", mandi_prices.c.date > as_of))
            .values(modal_price=mandi_prices.c.modal_price * 3)
        )
    try:
        after = replay("onion", as_of, 50, "niphad")
    finally:
        with engine.begin() as conn:
            conn.execute(
                update(mandi_prices)
                .where(and_(mandi_prices.c.commodity == "onion", mandi_prices.c.date > as_of))
                .values(modal_price=mandi_prices.c.modal_price / 3)
            )
    assert before["advice"]["headline"] == after["advice"]["headline"]
    assert before["advice"]["estimated_net"] == after["advice"]["estimated_net"]
    assert before["advice"]["scenarios"] == after["advice"]["scenarios"]
    assert after["leakage_check"]["latest_row_used_for_decision"] <= str(as_of)
    # ...while the scored outcome does see the changed future.
    if before["advice"]["scenarios"]:
        wait_before = [o for o in before["outcomes"] if o["kind"] == "wait"]
        wait_after = [o for o in after["outcomes"] if o["kind"] == "wait"]
        assert wait_after[0]["price"] == pytest.approx(wait_before[0]["price"] * 3)


def test_replay_rejects_dates_without_outcomes():
    with pytest.raises(ReplayError):
        replay("tomato", date(2025, 12, 30), 20, "nashik")


def test_risk_levels():
    base = {"date": "2025-07-01", "tmax": 30, "rain_mm": 0, "rain_prob": 10, "humidity": 50, "wind_kmh": 10}
    assert risk.day_risk(base, "tomato")["level"] == "Low"
    assert risk.day_risk({**base, "rain_mm": 8}, "tomato")["level"] == "Moderate"
    assert risk.day_risk({**base, "rain_mm": 25}, "tomato")["level"] == "High"
    assert risk.day_risk({**base, "tmax": 39}, "onion")["level"] == "Moderate"
    days = [{**base, "date": f"2025-07-0{i}", "rain_mm": 15} for i in range(1, 8)]
    out = risk.assess(days, "onion")
    assert out["level"] == "High"  # 45 mm over 3 days
    assert "maturity" in out["disclaimer"]


def test_wait_blocked_for_perishable_under_high_risk():
    a = advise("tomato", 20, "nashik", cutoff=date(2025, 6, 2), risk_level="High")
    assert a["action"] == "SELL_NOW"
