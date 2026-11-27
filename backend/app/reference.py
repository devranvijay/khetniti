"""Static reference data: crops, farm locations and mandis around Nashik.

Crop handling parameters are stated assumptions, shown to the user and overridable per request.
"""

import math

CROPS: dict[str, dict] = {
    "tomato": {
        "id": "tomato",
        "name": "Tomato",
        "hindi": "टमाटर",
        "agmarknet_name": "Tomato",
        # Share of saleable quantity lost per day of waiting without cold storage.
        "spoilage_pct_per_day": 3.0,
        "storage_cost_per_q_day": 0.0,
        "wait_horizons": [2, 3],
        "storable": False,
    },
    "onion": {
        "id": "onion",
        "name": "Onion",
        "hindi": "प्याज",
        "agmarknet_name": "Onion",
        "spoilage_pct_per_day": 0.3,
        "storage_cost_per_q_day": 2.0,
        "wait_horizons": [7, 14],
        "storable": True,
    },
    "potato": {
        "id": "potato",
        "name": "Potato",
        "hindi": "आलू",
        "agmarknet_name": "Potato",
        "spoilage_pct_per_day": 0.5,
        "storage_cost_per_q_day": 3.0,
        "wait_horizons": [7, 14],
        "storable": True,
    },
}

HARVEST_ACTIONS: dict[str, dict[str, list[str]]] = {
    "tomato": {
        "Low": [
            "Good window for picking. Harvest in the cool early morning.",
            "Grade by colour stage so ripe and breaker fruit travel separately.",
        ],
        "Moderate": [
            "Arrange crates and shade before picking; avoid leaving fruit in the field.",
            "Prioritise ripe fruit that will crack or rot if rain arrives.",
        ],
        "High": [
            "Avoid picking wet fruit; it cracks and rots in transit.",
            "Pick ripe fruit ahead of the rain if the field is accessible, and keep it covered.",
            "Check drainage channels so water does not stand in the beds.",
        ],
    },
    "onion": {
        "Low": [
            "Dry conditions suit curing. Leave bulbs to field-cure for 3–5 days.",
            "Cut tops leaving 2–3 cm of neck once curing is complete.",
        ],
        "Moderate": [
            "Keep tarpaulins ready to cover windrows.",
            "Move cured bulbs to a ventilated shed (chawl) rather than leaving them in heaps.",
        ],
        "High": [
            "Postpone lifting if bulbs are still in the ground; wet bulbs store poorly.",
            "Cover harvested windrows and move them under a roof.",
            "Do not store bulbs that were rained on before they dry fully.",
        ],
    },
    "potato": {
        "Low": [
            "Good window to dig. Let skins set for 10–14 days after haulm cutting.",
            "Keep harvested tubers out of direct sun to prevent greening.",
        ],
        "Moderate": [
            "Dig only what can be shaded and moved the same day.",
            "Keep the field drained so tubers are not lifted from wet soil.",
        ],
        "High": [
            "Postpone digging; tubers lifted from wet soil bruise and rot.",
            "Cover any heaps already in the field.",
        ],
    },
}

# Talukas in Nashik district. Coordinates are approximate town centres.
LOCATIONS: dict[str, dict] = {
    "nashik": {"id": "nashik", "name": "Nashik", "district": "Nashik", "state": "Maharashtra", "lat": 19.9975, "lon": 73.7898},
    "niphad": {"id": "niphad", "name": "Niphad", "district": "Nashik", "state": "Maharashtra", "lat": 20.0800, "lon": 74.1100},
    "dindori": {"id": "dindori", "name": "Dindori", "district": "Nashik", "state": "Maharashtra", "lat": 20.2050, "lon": 73.8330},
    "sinnar": {"id": "sinnar", "name": "Sinnar", "district": "Nashik", "state": "Maharashtra", "lat": 19.8450, "lon": 73.9980},
    "chandwad": {"id": "chandwad", "name": "Chandwad", "district": "Nashik", "state": "Maharashtra", "lat": 20.3300, "lon": 74.2500},
}

# Mandis (APMCs). `aliases` match AGMARKNET market names (case-insensitive substring).
MANDIS: dict[str, dict] = {
    "nashik": {"id": "nashik", "name": "Nashik APMC", "lat": 19.9975, "lon": 73.7898, "aliases": ["nashik"], "crops": ["tomato", "onion", "potato"]},
    "pimpalgaon": {"id": "pimpalgaon", "name": "Pimpalgaon Baswant APMC", "lat": 20.1667, "lon": 73.9833, "aliases": ["pimpalgaon"], "crops": ["tomato", "onion"]},
    "lasalgaon": {"id": "lasalgaon", "name": "Lasalgaon APMC", "lat": 20.1490, "lon": 74.2318, "aliases": ["lasalgaon"], "crops": ["onion"]},
    "yeola": {"id": "yeola", "name": "Yeola APMC", "lat": 20.0420, "lon": 74.4890, "aliases": ["yeola"], "crops": ["onion"]},
    "sinnar": {"id": "sinnar", "name": "Sinnar APMC", "lat": 19.8450, "lon": 73.9980, "aliases": ["sinnar"], "crops": ["tomato", "onion"]},
    "ahmednagar": {"id": "ahmednagar", "name": "Ahmednagar APMC", "lat": 19.0948, "lon": 74.7480, "aliases": ["ahmednagar", "ahilyanagar"], "crops": ["tomato", "onion", "potato"]},
    "pune": {"id": "pune", "name": "Pune (Gultekdi) APMC", "lat": 18.4900, "lon": 73.8650, "aliases": ["pune"], "crops": ["tomato", "onion", "potato"]},
    "mumbai": {"id": "mumbai", "name": "Mumbai (Vashi) APMC", "lat": 19.0771, "lon": 72.9986, "aliases": ["mumbai", "vashi"], "crops": ["tomato", "onion", "potato"]},
}

# Straight-line distance is multiplied by this to approximate road distance.
ROAD_FACTOR = 1.3


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def road_distance_km(location_id: str, mandi_id: str) -> float:
    loc, m = LOCATIONS[location_id], MANDIS[mandi_id]
    return round(haversine_km(loc["lat"], loc["lon"], m["lat"], m["lon"]) * ROAD_FACTOR, 1)


def match_mandi(market_name: str) -> str | None:
    name = market_name.lower()
    for mid, m in MANDIS.items():
        if any(alias in name for alias in m["aliases"]):
            return mid
    return None


def nearest_mandi(location_id: str, crop_id: str) -> str:
    options = [mid for mid, m in MANDIS.items() if crop_id in m["crops"]]
    return min(options, key=lambda mid: road_distance_km(location_id, mid))
