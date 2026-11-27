# KHETNITI · खेतनीति

**Smart Decisions. Better Harvests.** An agricultural decision-support system for Indian farmers that connects weather, mandi prices and selling costs. Built for TECH HEIST 2026.

Launch scope: Nashik district (5 talukas, 8 mandis); crops: tomato, onion and potato.

## Pages

| Page | What it does |
|---|---|
| Dashboard | Today's selling outlook, current weather, 3-day harvest risk, local and best mandi, 7-day forecast, 30-day price trend |
| Harvest Intelligence | 7-day forecast, Low / Moderate / High risk per day with the rule that fired, suggested actions per crop, longest low-risk window |
| Mandi Intelligence | Min / modal / max price, arrivals, 7-day change, distance and price date for every mandi; history charts (1M–1Y); min–max band with arrivals |
| Smart Sell Advisor | Net revenue at every mandi after transport, handling and fees; wait scenarios with an 80% range; recommendation with reasons, confidence and a line-by-line calculation |
| Decision Replay | Re-run the advisor on any past date using only data available that day, then score it against actual prices. Backtest a whole period against "always sell locally". Includes a look-ahead check |
| Reports & Insights | Saved decisions, replay hit rate, data-source status, print / save as PDF |

## Run it

```bash
# Backend (Python 3.11+)
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env                          # optional: add DATA_GOV_IN_API_KEY
.venv/bin/python -m scripts.generate_demo_data   # seeds the DEMO price dataset
.venv/bin/uvicorn app.main:app --port 8000

# Frontend (Node 20+)
cd frontend
npm install
npm run dev                                   # http://localhost:3000
```

The frontend calls `http://localhost:8000` by default. To change that, set `NEXT_PUBLIC_API_URL`.

Tests: `cd backend && .venv/bin/python -m pytest`. They cover the revenue formulas, risk rules, and a look-ahead test: it triples every price after the replay date and asserts the recommendation does not change.

## Data and honesty rules

| Source | Used for | Status |
|---|---|---|
| AGMARKNET via data.gov.in API | Daily min/max/modal mandi prices | Live when `DATA_GOV_IN_API_KEY` is set (refreshed at most hourly) |
| AGMARKNET CSV export | Real price history and arrivals | `python -m scripts.import_agmarknet_csv file.csv --crop onion` |
| Open-Meteo Forecast API | 7-day weather | Live, no key needed |
| IMD, e-NAM | Official forecasts, extra market data | No open API, so not integrated |
| KHETNITI demo dataset | Synthetic prices so the app works offline | Only when no real data is loaded |

- **Demo data is never shown as live.** Every price view shows a `LIVE`, `REAL · HISTORICAL` or `DEMO DATA` badge with the source name and timestamps. Real and demo rows are stored separately and never mixed in one response. Real data replaces the demo set automatically: as soon as one real price is loaded for live views, and from 60 days of real history for charts and replay.
- **No look-ahead.** Every price query accepts a cutoff date, and the advisor used by Replay reads only rows dated on or before the replay date. Later prices are loaded separately and only to score the decision.
- **Transparent maths.** Gross = saleable quantity × modal price. Net = Gross − transport − handling − market fee − storage. Wait scenarios carry forward half of the recent 21-day trend, with a band based on recent volatility. All assumptions are editable in the UI.
- **No guarantees.** Results are framed as estimates, and the app never claims weather can show crop maturity.
- **Failures are handled.** If the weather service is down, the last forecast is served marked `STALE`. Prices older than 7 days are flagged and excluded from recommendations. API keys stay on the server.

## Stack

Next.js 16 · TypeScript · Tailwind CSS 4 · Recharts. Python · FastAPI · Pandas · NumPy · SQLAlchemy, with PostgreSQL via `DATABASE_URL` and SQLite as the local default.

The UI follows Apple's Human Interface Guidelines: system font, grouped backgrounds, translucent sidebar, toolbar and tab bar, segmented controls, inset grouped lists, and system colours for status. It is tinted with the KHETNITI brand palette.

- **Appearance:** System (default), Light or Dark. Switch it in the sidebar or the phone toolbar. The choice is saved in the browser and applied before first paint, so the page never flashes the wrong theme. Brand artwork switches between its light and dark versions automatically.
- **Responsive:** phone (tab bar, card lists instead of tables, horizontally scrolling strips), tablet (two-column forms), and desktop (sidebar). Checked for horizontal overflow at 360, 390, 820 and 1440 px.
- **Splash:** the brand intro video plays once per browser session. Desktop and landscape screens play `splash-desktop.mp4` once. Phones and portrait screens loop `splash-mobile.mp4` until the page has loaded. Tap or press any key to skip. With reduced motion, a static logo is shown instead.

## Assets

```
frontend/
  assets/brand/        Brand-identity boards (design originals, not served)
  public/brand/        Web-ready logos generated from the boards: lockup, horizontal, vertical,
                       mark and Hindi wordmark, each in -light / -dark versions, plus app icons
  public/splash/       splash-desktop.mp4 (1920×1080, 2.2 s), splash-mobile.mp4 (1080×1920, 1 s loop)
  src/app/icon.png, apple-icon.png, manifest.ts   Favicon, iOS icon, installable-app manifest
  scripts/process_brand_assets.py                  Regenerates public/brand and the icons from the boards
```

After changing a board, regenerate the logos and icons:
`python3 -m venv /tmp/imgtools && /tmp/imgtools/bin/pip install pillow numpy && /tmp/imgtools/bin/python frontend/scripts/process_brand_assets.py`

## Demo flow (from the PRD)

1. Pick **Tomato** and **Nashik** in the toolbar. The Dashboard shows the farmer's day at a glance.
2. **Harvest Intelligence**: risk level, the rules behind it, and what to do.
3. **Mandi Intelligence**: compare mandis and price history.
4. **Smart Sell Advisor**: enter quantity and transport cost, then tap *Get recommendation*.
5. **Decision Replay**: pick a past date and replay it. Point out the look-ahead check. Then switch to *Backtest a period*.
6. **Reports & Insights**: saved decisions and the data-sources panel.
