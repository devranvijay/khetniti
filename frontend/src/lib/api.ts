export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(`Cannot reach the KHETNITI server at ${API_URL}. Is the backend running?`, 0);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {}
    throw new ApiError(detail, res.status);
  }
  return res.json() as Promise<T>;
}

export const post = <T,>(path: string, body: unknown) => api<T>(path, { method: "POST", body: JSON.stringify(body) });

// ---------- types (mirror backend responses)

export type Provenance = {
  mode: "live" | "historical" | "demo";
  label: string;
  source: string;
  notice: string | null;
  latest_price_date: string | null;
  last_updated: string | null;
};

export type Crop = { id: string; name: string; hindi: string; wait_horizons: number[]; spoilage_pct_per_day: number; storage_cost_per_q_day: number; storable: boolean };
export type Location = { id: string; name: string; district: string; state: string; lat: number; lon: number };
export type Mandi = { id: string; name: string; lat: number; lon: number; crops: string[] };
export type Meta = { crops: Crop[]; locations: Location[]; mandis: Mandi[] };

export type DayWeather = { date: string; tmax: number; tmin: number; rain_mm: number; rain_prob: number; humidity: number; wind_kmh: number; weather_code: number };
export type Weather = {
  source: string;
  fetched_at: string;
  model_time: string;
  current: { temp: number; humidity: number; rain_mm: number; wind_kmh: number; weather_code: number };
  daily: DayWeather[];
  stale: boolean;
  error: string | null;
};
export type RiskLevel = "Low" | "Moderate" | "High";
export type Risk = {
  level: RiskLevel;
  reasons: string[];
  per_day: { date: string; level: RiskLevel; reasons: string[] }[];
  window_rain_mm: number;
  suggested_window: { start: string; end: string; days: number } | null;
  actions: string[];
  rules: string[];
  disclaimer: string;
};

export type MarketLatest = {
  market_id: string;
  market_name: string;
  date: string;
  age_days: number;
  stale: boolean;
  min_price: number | null;
  max_price: number | null;
  modal_price: number;
  arrivals_tonnes: number | null;
  change_7d_pct: number | null;
  distance_km: number;
  source: string;
};
export type LatestPrices = { crop: string; unit: string; reference_date: string; markets: MarketLatest[]; provenance: Provenance; local_mandi: string };

export type PricePoint = { date: string; min: number | null; max: number | null; modal: number; arrivals: number | null };
export type History = { crop: string; unit: string; days: number; series: Record<string, PricePoint[]>; markets: Record<string, string>; provenance: Provenance };

export type NetCalc = {
  quantity_q: number;
  saleable_q: number;
  price_per_q: number;
  gross: number;
  transport: number;
  handling: number;
  market_fee: number;
  storage: number;
  net: number;
  net_per_q: number;
};
export type Option = NetCalc & {
  market_id: string;
  market_name: string;
  distance_km: number;
  price_date: string;
  age_days: number;
  stale: boolean;
  transport_basis: string;
  is_local: boolean;
};
export type Scenario = {
  days: number;
  market_id: string;
  market_name: string;
  loss_pct: number;
  price_expected: number;
  price_low: number;
  price_high: number;
  expected: NetCalc;
  net_low: number;
  net_high: number;
};
export type Advice = {
  ok: boolean;
  message?: string;
  crop: string;
  location: string;
  reference_date: string;
  action: "SELL_NOW" | "WAIT";
  headline: string;
  decision_market: string;
  wait_days: number;
  estimated_net: { net: number; low: number; high: number };
  confidence: "Low" | "Medium" | "High";
  reasons: string[];
  options: Option[];
  best_now: Option;
  local: Option | null;
  scenarios: Scenario[];
  trend: { window_days: number; points: number; slope_pct_per_day: number; volatility_pct_per_day: number; from: string; to: string } | null;
  risk_level: RiskLevel | null;
  assumptions: Record<string, string | number>;
  formulas: Record<string, string>;
  caveats: string[];
  data_max_date: string;
  provenance: Provenance;
  weather_error?: string | null;
};

export type Outcome = {
  label: string;
  kind: "now" | "wait";
  market_id: string;
  days: number;
  price: number;
  price_date: string;
  net: number;
  predicted_net?: number;
  predicted_range?: [number, number];
  within_range?: boolean;
};
export type Replay = {
  crop: string;
  as_of: string;
  advice: Advice;
  outcomes: Outcome[];
  recommended_outcome: Outcome;
  best_outcome: Outcome;
  local_now_outcome: Outcome | null;
  regret: number;
  good_call: boolean;
  verdict: string;
  verdict_detail: string;
  path: { date: string; modal: number; phase: "known" | "revealed" }[];
  path_market: string;
  leakage_check: { decision_cutoff: string; latest_row_used_for_decision: string; passed: boolean; note: string };
  provenance: Provenance;
};
export type Backtest = {
  crop: string;
  start: string;
  end: string;
  step_days: number;
  runs: { as_of: string; action: string; headline: string; recommended_net: number; best_net: number; local_now_net: number | null; good_call: boolean; regret: number }[];
  summary: {
    decisions: number;
    good_calls: number;
    good_call_rate: number;
    wait_recommendations: number;
    avg_regret: number;
    recommended_total: number;
    baseline_local_total: number | null;
    uplift_vs_local_pct: number | null;
    baseline_note: string;
  };
  provenance: Provenance;
};

export type Report = {
  id: number;
  created_at: string;
  kind: "advice" | "replay" | "backtest";
  crop: string;
  location: string;
  headline: string;
  data_mode: string;
  payload: Record<string, unknown>;
};
