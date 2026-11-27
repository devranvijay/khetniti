"use client";

import { CalendarCheck, CircleCheck, Info } from "lucide-react";
import { useApi, useApp } from "@/components/AppContext";
import { WeatherChart } from "@/components/charts";
import { Card, CardTitle, ErrorBox, LargeTitle, List, Loading, Note, RISK_COLOR, RiskBadge, Row, SectionHeader, WeatherFootnote } from "@/components/ui";
import type { Location, Risk, Weather } from "@/lib/api";
import { longDate, shortDate, weekday } from "@/lib/format";
import { wxIcon, wxLabel } from "@/lib/weather";

type Harvest = { location: Location; weather: Weather; risk: Risk };

export default function HarvestPage() {
  const { crop, location, meta } = useApp();
  const { data, error, loading, reload } = useApi<Harvest>(`/api/harvest?crop=${crop}&location=${location}`);
  const cropInfo = meta?.crops.find((c) => c.id === crop);

  return (
    <>
      <LargeTitle title="Harvest Intelligence" hindi="कटाई" subtitle={`Weather risk for harvesting ${cropInfo?.name.toLowerCase() ?? "your crop"} over the next 7 days.`} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && (
        <Card>
          <Loading rows={4} />
        </Card>
      )}
      {data && (
        <div className="space-y-6">
          <div className="grid gap-5 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-13 font-medium text-label-2">Next 3 days · {data.location.name}</div>
                  <div className="mt-2">
                    <RiskBadge level={data.risk.level} large />
                  </div>
                </div>
                {data.risk.suggested_window && (
                  <div className="flex items-center gap-2.5 rounded-[14px] bg-surface-2 px-3.5 py-2.5">
                    <CalendarCheck className="size-5 text-green" />
                    <div>
                      <div className="text-12 text-label-2">Longest low-risk stretch</div>
                      <div className="text-15 font-semibold">
                        {shortDate(data.risk.suggested_window.start)} – {shortDate(data.risk.suggested_window.end)} · {data.risk.suggested_window.days} days
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <ul className="mt-4 space-y-1.5 text-15">
                {data.risk.reasons.map((r) => (
                  <li key={r} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full" style={{ background: RISK_COLOR[data.risk.level] }} />
                    {r}
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <Note tone="warn">{data.risk.disclaimer}</Note>
              </div>
            </Card>

            <div className="lg:col-span-2">
              <SectionHeader title="Suggested actions" />
              <List>
                {data.risk.actions.map((a) => (
                  <Row key={a} icon={<CircleCheck className="size-5 shrink-0 text-tint" />} label={<span className="text-14">{a}</span>} />
                ))}
              </List>
            </div>
          </div>

          <div>
            <SectionHeader title="Day by day" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
              {data.weather.daily.map((d, i) => {
                const r = data.risk.per_day[i];
                return (
                  <Card key={d.date} className="!p-4" pad>
                    <div className="flex items-center justify-between">
                      <span className="text-13 font-semibold">{i === 0 ? "Today" : weekday(d.date)}</span>
                      <span className="size-2 rounded-full" style={{ background: RISK_COLOR[r.level] }} title={`${r.level} risk`} />
                    </div>
                    <div className="text-12 text-label-2">{shortDate(d.date)}</div>
                    <div className="my-2 text-30 leading-none">{wxIcon(d.weather_code)}</div>
                    <div className="text-12 text-label-2">{wxLabel(d.weather_code)}</div>
                    <div className="mt-1 text-17 font-semibold tabular-nums">
                      {Math.round(d.tmax)}° <span className="font-normal text-label-2">{Math.round(d.tmin)}°</span>
                    </div>
                    <dl className="mt-2 space-y-0.5 text-12 text-label-2">
                      <div className="flex justify-between">
                        <dt>Rain</dt>
                        <dd className="tabular-nums text-label">{d.rain_mm.toFixed(1)} mm</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Chance</dt>
                        <dd className="tabular-nums text-label">{d.rain_prob ?? "—"}%</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Humidity</dt>
                        <dd className="tabular-nums text-label">{d.humidity ?? "—"}%</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Wind</dt>
                        <dd className="tabular-nums text-label">{Math.round(d.wind_kmh)} km/h</dd>
                      </div>
                    </dl>
                    {r.reasons.length > 0 && <div className="mt-2 text-11 leading-snug" style={{ color: RISK_COLOR[r.level] }}>{r.reasons.join("; ")}</div>}
                  </Card>
                );
              })}
            </div>
          </div>

          <Card>
            <CardTitle title="Temperature and rainfall" subtitle={`${longDate(data.weather.daily[0].date)} – ${longDate(data.weather.daily.at(-1)!.date)}`} />
            <WeatherChart days={data.weather.daily} />
            <WeatherFootnote source={data.weather.source} fetchedAt={data.weather.fetched_at} stale={data.weather.stale} error={data.weather.error} />
          </Card>

          <div>
            <SectionHeader title="How risk is calculated" />
            <List>
              {data.risk.rules.map((r) => (
                <Row key={r} icon={<Info className="size-4 shrink-0 text-blue" />} label={<span className="text-14">{r}</span>} />
              ))}
            </List>
          </div>
        </div>
      )}
    </>
  );
}
