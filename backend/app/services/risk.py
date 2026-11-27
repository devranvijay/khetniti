"""Rule-based harvest weather risk. Every rule that fires is returned as a readable reason.

Weather risk says nothing about crop maturity; maturity must be checked in the field.
"""

from ..reference import CROPS, HARVEST_ACTIONS

LEVELS = ["Low", "Moderate", "High"]
HARVEST_WINDOW_DAYS = 3

RULES_TEXT = [
    "High: ≥ 20 mm rain in a day, or ≥ 40 mm over the next 3 days, or temperature ≥ 42 °C.",
    "Moderate: ≥ 5 mm rain or ≥ 60% rain chance in a day, temperature ≥ 38 °C, mean humidity ≥ 85%, or wind ≥ 40 km/h.",
    "Low: none of the above.",
    "The overall level is the worst day in the next 3 days (the harvest window).",
]

MATURITY_DISCLAIMER = (
    "Weather risk does not tell you whether the crop is mature. Check maturity in the field before deciding to harvest."
)


def _bump(current: str, new: str) -> str:
    return new if LEVELS.index(new) > LEVELS.index(current) else current


def day_risk(day: dict, crop_id: str) -> dict:
    level, reasons = "Low", []
    rain = day.get("rain_mm") or 0.0
    prob = day.get("rain_prob") or 0
    tmax = day.get("tmax")
    hum = day.get("humidity")
    wind = day.get("wind_kmh")

    if rain >= 20:
        level = _bump(level, "High")
        reasons.append(f"Heavy rain forecast ({rain:.1f} mm)")
    elif rain >= 5:
        level = _bump(level, "Moderate")
        reasons.append(f"Rain forecast ({rain:.1f} mm)")
    if prob >= 60 and rain < 20:
        level = _bump(level, "Moderate")
        reasons.append(f"{prob}% chance of rain")
    if tmax is not None and tmax >= 42:
        level = _bump(level, "High")
        reasons.append(f"Extreme heat ({tmax:.0f} °C)")
    elif tmax is not None and tmax >= 38:
        level = _bump(level, "Moderate")
        reasons.append(f"Heat stress ({tmax:.0f} °C)" + (" — tomatoes soften faster" if crop_id == "tomato" else ""))
    if hum is not None and hum >= 85:
        level = _bump(level, "Moderate")
        reasons.append(f"High humidity ({hum:.0f}%) — rot and fungal risk")
    if wind is not None and wind >= 40:
        level = _bump(level, "Moderate")
        reasons.append(f"Strong wind ({wind:.0f} km/h)")
    return {"date": day["date"], "level": level, "reasons": reasons}


def assess(daily: list[dict], crop_id: str) -> dict:
    per_day = [day_risk(d, crop_id) for d in daily]
    window = per_day[:HARVEST_WINDOW_DAYS]
    overall = "Low"
    reasons: list[str] = []
    for d in window:
        overall = _bump(overall, d["level"])
        reasons.extend(f"{d['date']}: {r}" for r in d["reasons"])
    window_rain = sum((d.get("rain_mm") or 0.0) for d in daily[:HARVEST_WINDOW_DAYS])
    if window_rain >= 40:
        overall = _bump(overall, "High")
        reasons.append(f"{window_rain:.0f} mm total rain over the next {HARVEST_WINDOW_DAYS} days")

    # Longest run of Low-risk days in the 7-day forecast, as a suggested window.
    best, run = None, []
    for d in per_day:
        if d["level"] == "Low":
            run.append(d["date"])
            if best is None or len(run) > len(best):
                best = list(run)
        else:
            run = []

    return {
        "crop": crop_id,
        "crop_name": CROPS[crop_id]["name"],
        "level": overall,
        "reasons": reasons or ["No weather rule triggered in the next 3 days."],
        "per_day": per_day,
        "window_rain_mm": round(window_rain, 1),
        "suggested_window": {"start": best[0], "end": best[-1], "days": len(best)} if best else None,
        "actions": HARVEST_ACTIONS[crop_id][overall],
        "rules": RULES_TEXT,
        "disclaimer": MATURITY_DISCLAIMER,
    }
