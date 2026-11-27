"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronRight, Droplets, Store, Thermometer, Wind } from "lucide-react";
import { useApi, useApp } from "@/components/AppContext";
import { PriceLines, WeatherChart } from "@/components/charts";
import {
  Badge,
  Card,
  CardTitle,
  ErrorBox,
  HeroCard,
  LargeTitle,
  List,
  Loading,
  ProvenanceBadge,
  RISK_COLOR,
  RiskBadge,
  Row,
  SourceFootnote,
  Stat,
  WeatherFootnote,
} from "@/components/ui";
import type { Advice, Crop, History, LatestPrices, Location, Risk, Weather } from "@/lib/api";
import { inr, pct, shortDate, weekday } from "@/lib/format";
import { wxIcon, wxLabel } from "@/lib/weather";

type Dashboard = {
  crop: Crop;
  location: Location;
  weather: Weather | null;
  risk: Risk | null;
  weather_error?: string;
  prices: LatestPrices | null;
  local_history?: History;
  advice: Advice | null;
  price_error?: string;
};

export default function DashboardPage() {
  const { crop, location } = useApp();
  const { data, error, loading, reload } = useApi<Dashboard>(`/api/dashboard?crop=${crop}&location=${location}`);

  return (
    <>
      <LargeTitle
        title="Dashboard"
        subtitle={data ? `${data.crop.name} near ${data.location.name}, Nashik district — weather, mandi prices and today's selling outlook.` : "Weather, mandi prices and today's selling outlook."}
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <Loading />
            </Card>
          ))}
        </div>
      )}
      {data && <DashboardBody d={data} onRetry={reload} />}
    </>
  );
}

function DashboardBody({ d, onRetry }: { d: Dashboard; onRetry: () => void }) {
  const local = d.prices?.markets.find((m) => m.market_id === d.prices?.local_mandi);
  const best = d.advice?.ok ? d.advice.best_now : null;
  const topMarkets = d.prices ? [...d.prices.markets].filter((m) => !m.stale).sort((a, b) => b.modal_price - a.modal_price).slice(0, 5) : [];

  return (
    <div className="space-y-5">
      {/* Decision hero */}
      {d.advice?.ok ? (
        <HeroCard>
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-[13px] font-medium text-white/70">
                Today&apos;s outlook · example for 20 quintals
                {d.advice.provenance.mode === "demo" && <span className="rounded-full bg-[#FF9500] px-2 py-0.5 text-[11px] font-semibold text-white">DEMO DATA</span>}
              </div>
              <h2 className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.02em]">{d.advice.headline}</h2>
              <p className="mt-2 text-[15px] text-white/75">{d.advice.reasons[0]}</p>
              <Link href="/advisor" className="mt-4 inline-flex items-center gap-1 rounded-full bg-white/15 px-4 py-2 text-[14px] font-semibold backdrop-blur transition hover:bg-white/25">
                Use my quantity and costs <ChevronRight className="size-4" />
              </Link>
            </div>
            <div className="sm:text-right">
              <div className="text-[13px] text-white/70">Estimated net revenue</div>
              <div className="text-[40px] font-bold tracking-[-0.03em] text-[#F2BB3C]">{inr(d.advice.estimated_net.net)}</div>
              <div className="text-[13px] text-white/70">Confidence: {d.advice.confidence}</div>
            </div>
          </div>
        </HeroCard>
      ) : (
        d.price_error && <ErrorBox message={d.price_error} onRetry={onRetry} />
      )}

      {/* Widgets */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          {d.weather ? (
            <>
              <div className="text-[13px] font-medium text-label-2">Now in {d.location.name}</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[34px]">{wxIcon(d.weather.current.weather_code)}</span>
                <span className="text-[34px] font-semibold tracking-[-0.03em]">{Math.round(d.weather.current.temp)}°</span>
              </div>
              <div className="text-[13px] text-label-2">
                {wxLabel(d.weather.current.weather_code)} · Humidity {d.weather.current.humidity}%
              </div>
            </>
          ) : (
            <ErrorBox message={d.weather_error ?? "Weather unavailable"} onRetry={onRetry} />
          )}
        </Card>
        <Card>
          <div className="text-[13px] font-medium text-label-2">Harvest risk · next 3 days</div>
          {d.risk ? (
            <>
              <div className="mt-2">
                <RiskBadge level={d.risk.level} large />
              </div>
              <div className="mt-2 line-clamp-2 text-[13px] text-label-2">{d.risk.reasons[0]}</div>
            </>
          ) : (
            <div className="mt-2 text-[13px] text-label-2">Unavailable</div>
          )}
        </Card>
        <Card>
          {local ? (
            <Stat
              label={`${local.market_name.replace(" APMC", "")} · local modal`}
              value={inr(local.modal_price)}
              sub={
                <>
                  per quintal · <span style={{ color: (local.change_7d_pct ?? 0) >= 0 ? "var(--green)" : "var(--red)" }}>{pct(local.change_7d_pct)} vs last week</span>
                </>
              }
            />
          ) : (
            <Loading rows={2} />
          )}
        </Card>
        <Card>
          {best ? <Stat label="Best net after transport" value={best.market_name.replace(" APMC", "")} sub={`${inr(best.net_per_q)}/q net · ${best.distance_km} km`} tone="tint" compact /> : <Loading rows={2} />}
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        {/* Weather */}
        <Card className="xl:col-span-3">
          <CardTitle title="7-day forecast" subtitle="Rain and temperature drive harvest timing">
            <Link href="/harvest" className="inline-flex items-center gap-0.5 text-[14px] font-medium text-tint">
              Details <ArrowUpRight className="size-4" />
            </Link>
          </CardTitle>
          {d.weather && d.risk ? (
            <>
              <div className="-mx-1 mb-3 overflow-x-auto px-1">
              <div className="grid min-w-[460px] grid-cols-7 gap-1.5">
                {d.weather.daily.map((day, i) => (
                  <div key={day.date} className="rounded-[12px] bg-surface-2 px-1 py-2 text-center">
                    <div className="text-[11px] font-medium text-label-2">{i === 0 ? "Today" : weekday(day.date)}</div>
                    <div className="my-1 text-[20px]">{wxIcon(day.weather_code)}</div>
                    <div className="text-[12px] font-semibold tabular-nums">{Math.round(day.tmax)}°</div>
                    <div className="mx-auto mt-1 h-1 w-6 rounded-full" style={{ background: RISK_COLOR[d.risk!.per_day[i].level] }} title={`${d.risk!.per_day[i].level} risk`} />
                  </div>
                ))}
              </div>
              </div>
              <WeatherChart days={d.weather.daily} height={200} />
              <WeatherFootnote source={d.weather.source} fetchedAt={d.weather.fetched_at} stale={d.weather.stale} error={d.weather.error} />
            </>
          ) : (
            <ErrorBox message={d.weather_error ?? "Weather unavailable"} onRetry={onRetry} />
          )}
        </Card>

        {/* Mandi snapshot */}
        <div className="space-y-2 xl:col-span-2">
          <div className="flex items-end justify-between px-1">
            <h3 className="text-[17px] font-semibold">Highest modal prices</h3>
            {d.prices && <ProvenanceBadge p={d.prices.provenance} />}
          </div>
          <List>
            {topMarkets.map((m) => (
              <Row
                key={m.market_id}
                icon={
                  <span className="grid size-7 place-items-center rounded-[7px] text-white" style={{ background: m.market_id === d.prices?.local_mandi ? "var(--tint)" : "var(--label-3)" }}>
                    <Store className="size-4" />
                  </span>
                }
                label={m.market_name.replace(" APMC", "")}
                sub={`${m.distance_km} km · ${shortDate(m.date)}`}
                value={
                  <div>
                    <div className="font-semibold text-label">{inr(m.modal_price)}</div>
                    <div className="text-[12px]" style={{ color: (m.change_7d_pct ?? 0) >= 0 ? "var(--green)" : "var(--red)" }}>
                      {pct(m.change_7d_pct)}
                    </div>
                  </div>
                }
              />
            ))}
            <Link href="/mandi" className="flex items-center justify-between px-4 py-3 text-[15px] text-tint hover:bg-fill">
              Compare all mandis <ChevronRight className="size-4 text-label-3" />
            </Link>
          </List>
          {d.prices && <SourceFootnote p={d.prices.provenance} extra="₹ per quintal" />}
        </div>
      </div>

      {d.local_history && local && (
        <Card>
          <CardTitle title={`${local.market_name} · last 30 days`} subtitle="Modal price, ₹ per quintal" />
          <PriceLines series={d.local_history.series} names={d.local_history.markets} colorOf={() => "var(--tint)"} height={220} />
          <SourceFootnote p={d.local_history.provenance} />
        </Card>
      )}

      {d.risk && (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: <Thermometer className="size-4" />, color: "var(--orange)", label: "Peak temperature", value: `${Math.max(...(d.weather?.daily.map((x) => x.tmax) ?? [0])).toFixed(0)} °C` },
            { icon: <Droplets className="size-4" />, color: "var(--blue)", label: "Rain in next 3 days", value: `${d.risk.window_rain_mm} mm` },
            { icon: <Wind className="size-4" />, color: "var(--teal)", label: "Max wind", value: `${Math.max(...(d.weather?.daily.map((x) => x.wind_kmh) ?? [0])).toFixed(0)} km/h` },
          ].map((s) => (
            <Card key={s.label} className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full text-white" style={{ background: s.color }}>
                {s.icon}
              </span>
              <div>
                <div className="text-[13px] text-label-2">{s.label}</div>
                <div className="text-[20px] font-semibold tabular-nums">{s.value}</div>
              </div>
              <Badge color={s.color}>7-day</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
