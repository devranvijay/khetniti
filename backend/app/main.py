import json
from datetime import date, datetime

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import desc, insert, select

from .config import settings
from .db import decisions, engine, init_db
from .reference import CROPS, LOCATIONS, MANDIS, nearest_mandi
from .services import prices, risk, weather
from .services.advisor import advise
from .services.replay import ReplayError, backtest, replay, replay_window

app = FastAPI(title="KHETNITI API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()


def _crop(crop: str) -> str:
    if crop not in CROPS:
        raise HTTPException(400, f"Unsupported crop '{crop}'. Supported: {', '.join(CROPS)}.")
    return crop


def _loc(location: str) -> dict:
    if location not in LOCATIONS:
        raise HTTPException(400, f"Unsupported location '{location}'. Supported: {', '.join(LOCATIONS)}.")
    return LOCATIONS[location]


def _weather(location: str) -> dict:
    loc = _loc(location)
    try:
        return weather.get_forecast(loc["lat"], loc["lon"])
    except weather.WeatherUnavailable as exc:
        raise HTTPException(503, str(exc)) from exc


def _no_data(exc: Exception):
    raise HTTPException(404, str(exc)) from exc


# ---------------------------------------------------------------- meta


@app.get("/api/health")
def health():
    return {"ok": True, "time": datetime.now(weather.IST).isoformat(timespec="seconds")}


@app.get("/api/meta")
def meta():
    return {
        "crops": list(CROPS.values()),
        "locations": list(LOCATIONS.values()),
        "mandis": [{k: v for k, v in m.items() if k != "aliases"} for m in MANDIS.values()],
    }


@app.get("/api/sources")
def sources():
    out = []
    for crop in CROPS:
        real = prices.dataset_stats(crop, False)
        demo = prices.dataset_stats(crop, True)
        out.append(
            {
                "crop": crop,
                "real": {"dates": real["dates"], "first": str(real["first"] or ""), "last": str(real["last"] or ""), "fetched_at": str(real["fetched_at"] or "")},
                "demo": {"dates": demo["dates"], "first": str(demo["first"] or ""), "last": str(demo["last"] or "")},
            }
        )
    return {
        "prices": out,
        "live_api_configured": bool(settings.data_gov_in_api_key),
        "refresh": prices.refresh_status(),
        "catalogue": [
            {"name": "AGMARKNET via data.gov.in", "use": "Daily mandi prices (min, max, modal)", "status": "configured" if settings.data_gov_in_api_key else "needs API key"},
            {"name": "AGMARKNET CSV import", "use": "Historical mandi prices and arrivals", "status": "available via scripts/import_agmarknet_csv.py"},
            {"name": "Open-Meteo Forecast API", "use": "7-day weather forecast", "status": "active (no key needed)"},
            {"name": "IMD", "use": "Official forecasts and warnings", "status": "no open API; not integrated"},
            {"name": "e-NAM", "use": "Additional market data", "status": "no open API; not integrated"},
            {"name": "KHETNITI demo dataset", "use": "Synthetic prices used only when no real data is loaded", "status": "always labelled DEMO"},
        ],
    }


# ---------------------------------------------------------------- weather & harvest


@app.get("/api/harvest")
def harvest(crop: str = "tomato", location: str = "nashik"):
    _crop(crop)
    w = _weather(location)
    return {"location": LOCATIONS[location], "weather": w, "risk": risk.assess(w["daily"], crop)}


# ---------------------------------------------------------------- prices


@app.get("/api/prices/latest")
def prices_latest(crop: str = "tomato", location: str = "nashik"):
    _crop(crop)
    _loc(location)
    if settings.data_gov_in_api_key:
        prices.refresh_live(crop)  # throttled; failures are reported in /api/sources, not raised
    try:
        out = prices.latest_by_market(crop, location)
    except prices.NoPriceData as exc:
        _no_data(exc)
    out["local_mandi"] = nearest_mandi(location, crop)
    return out


@app.get("/api/prices/history")
def prices_history(crop: str = "tomato", markets: str | None = None, days: int = Query(90, ge=7, le=730)):
    _crop(crop)
    ids = [m for m in (markets or "").split(",") if m] or None
    try:
        return prices.history(crop, ids, days)
    except prices.NoPriceData as exc:
        _no_data(exc)


@app.post("/api/prices/refresh")
def prices_refresh(crop: str = "tomato"):
    _crop(crop)
    return prices.refresh_live(crop, force=True)


# ---------------------------------------------------------------- advisor


class AdviceIn(BaseModel):
    crop: str = "tomato"
    location: str = "nashik"
    quantity_q: float = Field(20, gt=0, le=100000)
    local_mandi: str | None = None
    transport_rate_per_q_km: float = Field(1.0, ge=0, le=100)
    transport_overrides: dict[str, float] | None = None
    handling_per_q: float = Field(10, ge=0, le=10000)
    fee_pct: float = Field(0, ge=0, le=50)
    spoilage_pct_per_day: float | None = Field(None, ge=0, le=50)
    storage_cost_per_q_day: float | None = Field(None, ge=0, le=1000)
    include_weather: bool = True


def _advice_kwargs(body: AdviceIn) -> dict:
    return {
        "local_mandi": body.local_mandi,
        "transport_rate_per_q_km": body.transport_rate_per_q_km,
        "transport_overrides": body.transport_overrides,
        "handling_per_q": body.handling_per_q,
        "fee_pct": body.fee_pct,
        "spoilage_pct_per_day": body.spoilage_pct_per_day,
        "storage_cost_per_q_day": body.storage_cost_per_q_day,
    }


@app.post("/api/advisor")
def advisor(body: AdviceIn):
    _crop(body.crop)
    loc = _loc(body.location)
    risk_level, weather_error = None, None
    if body.include_weather:
        try:
            w = weather.get_forecast(loc["lat"], loc["lon"])
            risk_level = risk.assess(w["daily"], body.crop)["level"]
        except weather.WeatherUnavailable as exc:
            weather_error = str(exc)
    try:
        out = advise(body.crop, body.quantity_q, body.location, risk_level=risk_level, **_advice_kwargs(body))
    except prices.NoPriceData as exc:
        _no_data(exc)
    out["weather_error"] = weather_error
    return out


# ---------------------------------------------------------------- replay


class ReplayIn(AdviceIn):
    as_of: date


class BacktestIn(AdviceIn):
    start: date
    end: date
    step_days: int = Field(7, ge=1, le=60)


@app.get("/api/replay/window")
def replay_range(crop: str = "tomato"):
    _crop(crop)
    try:
        return replay_window(crop)
    except (ReplayError, prices.NoPriceData) as exc:
        _no_data(exc)


@app.post("/api/replay")
def replay_one(body: ReplayIn):
    _crop(body.crop)
    _loc(body.location)
    try:
        return replay(body.crop, body.as_of, body.quantity_q, body.location, **_advice_kwargs(body))
    except ReplayError as exc:
        raise HTTPException(422, str(exc)) from exc
    except prices.NoPriceData as exc:
        _no_data(exc)


@app.post("/api/replay/backtest")
def replay_backtest(body: BacktestIn):
    _crop(body.crop)
    _loc(body.location)
    try:
        return backtest(body.crop, body.start, body.end, body.step_days, body.quantity_q, body.location, **_advice_kwargs(body))
    except ReplayError as exc:
        raise HTTPException(422, str(exc)) from exc
    except prices.NoPriceData as exc:
        _no_data(exc)


# ---------------------------------------------------------------- dashboard


@app.get("/api/dashboard")
def dashboard(crop: str = "tomato", location: str = "nashik"):
    _crop(crop)
    loc = _loc(location)
    out: dict = {"crop": CROPS[crop], "location": loc}
    try:
        w = weather.get_forecast(loc["lat"], loc["lon"])
        out["weather"] = w
        out["risk"] = risk.assess(w["daily"], crop)
    except weather.WeatherUnavailable as exc:
        out["weather"], out["risk"], out["weather_error"] = None, None, str(exc)
    try:
        out["prices"] = prices_latest(crop, location)
        hist = prices.history(crop, [out["prices"]["local_mandi"]], 30)
        out["local_history"] = hist
        out["advice"] = advise(crop, 20, location, risk_level=out["risk"]["level"] if out.get("risk") else None)
    except (prices.NoPriceData, HTTPException) as exc:
        out["prices"], out["advice"], out["price_error"] = None, None, str(getattr(exc, "detail", exc))
    return out


# ---------------------------------------------------------------- reports


class ReportIn(BaseModel):
    kind: str = Field(pattern="^(advice|replay|backtest)$")
    crop: str
    location: str
    headline: str = Field(max_length=500)
    data_mode: str = Field(max_length=20)
    payload: dict


@app.post("/api/reports")
def save_report(body: ReportIn):
    _crop(body.crop)
    with engine.begin() as conn:
        res = conn.execute(
            insert(decisions).values(
                created_at=datetime.now(weather.IST),
                kind=body.kind,
                crop=body.crop,
                location=body.location,
                headline=body.headline,
                data_mode=body.data_mode,
                payload=json.dumps(body.payload, default=str),
            )
        )
    return {"id": res.inserted_primary_key[0]}


@app.get("/api/reports")
def list_reports(limit: int = Query(50, ge=1, le=500)):
    with engine.connect() as conn:
        rows = conn.execute(select(decisions).order_by(desc(decisions.c.created_at)).limit(limit)).mappings().all()
    return [
        {**{k: v for k, v in r.items() if k != "payload"}, "created_at": r["created_at"].isoformat(), "payload": json.loads(r["payload"])}
        for r in rows
    ]


@app.delete("/api/reports/{report_id}")
def delete_report(report_id: int):
    with engine.begin() as conn:
        conn.execute(decisions.delete().where(decisions.c.id == report_id))
    return {"ok": True}
