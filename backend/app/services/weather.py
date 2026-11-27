"""Weather forecast from Open-Meteo (no API key required).

IMD does not offer an open forecast API, so Open-Meteo is the forecast source. Responses are cached;
on an upstream failure the last good response is served and flagged as stale, never relabelled as fresh.
"""

import threading
import time
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx

from ..config import settings

IST = ZoneInfo("Asia/Kolkata")
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
SOURCE_NAME = "Open-Meteo Forecast API"

_cache: dict[tuple[float, float], tuple[float, dict]] = {}
_lock = threading.Lock()


class WeatherUnavailable(Exception):
    pass


def _fetch(lat: float, lon: float) -> dict:
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": ",".join(
            [
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_sum",
                "precipitation_probability_max",
                "relative_humidity_2m_mean",
                "wind_speed_10m_max",
                "weather_code",
            ]
        ),
        "current": "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
        "timezone": "Asia/Kolkata",
        "forecast_days": 7,
    }
    r = httpx.get(FORECAST_URL, params=params, timeout=settings.http_timeout_seconds)
    r.raise_for_status()
    raw = r.json()
    d = raw["daily"]
    days = []
    for i, date in enumerate(d["time"]):
        days.append(
            {
                "date": date,
                "tmax": d["temperature_2m_max"][i],
                "tmin": d["temperature_2m_min"][i],
                "rain_mm": d["precipitation_sum"][i] or 0.0,
                "rain_prob": d["precipitation_probability_max"][i],
                "humidity": d["relative_humidity_2m_mean"][i],
                "wind_kmh": d["wind_speed_10m_max"][i],
                "weather_code": d["weather_code"][i],
            }
        )
    c = raw.get("current", {})
    return {
        "source": SOURCE_NAME,
        "fetched_at": datetime.now(IST).isoformat(timespec="seconds"),
        "model_time": c.get("time"),
        "current": {
            "temp": c.get("temperature_2m"),
            "humidity": c.get("relative_humidity_2m"),
            "rain_mm": c.get("precipitation"),
            "wind_kmh": c.get("wind_speed_10m"),
            "weather_code": c.get("weather_code"),
        },
        "daily": days,
    }


def get_forecast(lat: float, lon: float) -> dict:
    key = (round(lat, 3), round(lon, 3))
    now = time.time()
    with _lock:
        cached = _cache.get(key)
    if cached and now - cached[0] < settings.weather_cache_minutes * 60:
        return {**cached[1], "stale": False, "error": None}
    try:
        data = _fetch(lat, lon)
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        if cached:
            return {**cached[1], "stale": True, "error": f"Weather service unreachable; showing forecast fetched at {cached[1]['fetched_at']}."}
        raise WeatherUnavailable(f"Weather service unreachable: {type(exc).__name__}") from exc
    with _lock:
        _cache[key] = (now, data)
    return {**data, "stale": False, "error": None}


WMO_LABELS = {
    0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
    71: "Snow", 73: "Snow", 75: "Snow", 80: "Rain showers", 81: "Rain showers", 82: "Violent showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail",
}


def weather_label(code: int | None) -> str:
    return WMO_LABELS.get(code, "—") if code is not None else "—"
