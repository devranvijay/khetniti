"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DayWeather, PricePoint } from "@/lib/api";
import { inr, shortDate, weekday } from "@/lib/format";

export const SERIES = ["var(--tint)", "var(--gold)", "var(--blue)", "var(--indigo)", "var(--pink)", "var(--teal)", "var(--orange)", "var(--brown)"];

const axisProps = { tickLine: false, axisLine: false } as const;

export function WeatherChart({ days, height = 240 }: { days: DayWeather[]; height?: number }) {
  const data = days.map((d) => ({ ...d, label: `${weekday(d.date)} ${shortDate(d.date).split(" ")[0]}` }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis yAxisId="t" {...axisProps} unit="°" domain={["dataMin - 3", "dataMax + 2"]} tickFormatter={(v) => String(Math.round(Number(v)))} allowDecimals={false} />
        <YAxis yAxisId="r" orientation="right" {...axisProps} unit=" mm" width={52} />
        <Tooltip
          formatter={(v, name) => {
            const n = Number(v);
            if (name === "Rain") return [`${n.toFixed(1)} mm`, name];
            return [`${n.toFixed(1)} °C`, name];
          }}
        />
        <Legend iconType="circle" iconSize={8} />
        <Bar isAnimationActive={false} yAxisId="r" dataKey="rain_mm" name="Rain" fill="var(--blue)" fillOpacity={0.7} radius={[6, 6, 0, 0]} maxBarSize={28} />
        <Line isAnimationActive={false} yAxisId="t" type="monotone" dataKey="tmax" name="Max temp" stroke="var(--orange)" strokeWidth={2.5} dot={{ r: 3 }} />
        <Line isAnimationActive={false} yAxisId="t" type="monotone" dataKey="tmin" name="Min temp" stroke="var(--teal)" strokeWidth={2.5} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Modal price of several mandis on one chart. */
export function PriceLines({
  series,
  names,
  height = 300,
  colorOf,
}: {
  series: Record<string, PricePoint[]>;
  names: Record<string, string>;
  height?: number;
  colorOf: (id: string) => string;
}) {
  const byDate = new Map<string, Record<string, number | string>>();
  for (const [mid, pts] of Object.entries(series)) {
    for (const p of pts) {
      const row = byDate.get(p.date) ?? { date: p.date };
      row[mid] = p.modal;
      byDate.set(p.date, row);
    }
  }
  const data = [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" {...axisProps} tickFormatter={shortDate} minTickGap={32} />
        <YAxis {...axisProps} tickFormatter={(v) => `₹${v}`} width={58} domain={["auto", "auto"]} />
        <Tooltip labelFormatter={(l) => shortDate(String(l))} formatter={(v, name) => [`${inr(Number(v))}/q`, names[String(name)] ?? name]} />
        {Object.keys(series).map((mid) => (
          <Line isAnimationActive={false} key={mid} type="monotone" dataKey={mid} name={mid} stroke={colorOf(mid)} strokeWidth={2.2} dot={false} connectNulls />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Min–max band with modal line, plus arrivals bars, for one mandi. */
export function PriceBand({ points, height = 260 }: { points: PricePoint[]; height?: number }) {
  const data = points.map((p) => ({ ...p, band: p.min != null && p.max != null ? [p.min, p.max] : null }));
  const hasArrivals = points.some((p) => p.arrivals != null);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" {...axisProps} tickFormatter={shortDate} minTickGap={32} />
        <YAxis yAxisId="p" {...axisProps} tickFormatter={(v) => `₹${v}`} width={58} domain={["auto", "auto"]} />
        {hasArrivals && <YAxis yAxisId="a" orientation="right" {...axisProps} unit=" t" width={48} />}
        <Tooltip
          labelFormatter={(l) => shortDate(String(l))}
          formatter={(v, name) => {
            if (Array.isArray(v)) return [`${inr(Number(v[0]))} – ${inr(Number(v[1]))}`, "Min – Max"];
            if (name === "Arrivals") return [`${Number(v).toFixed(0)} t`, name];
            return [`${inr(Number(v))}/q`, name];
          }}
        />
        <Legend iconType="circle" iconSize={8} />
        {hasArrivals && <Bar isAnimationActive={false} yAxisId="a" dataKey="arrivals" name="Arrivals" fill="var(--label-3)" fillOpacity={0.35} radius={[3, 3, 0, 0]} />}
        <Area isAnimationActive={false} yAxisId="p" dataKey="band" name="Min – Max" fill="var(--gold)" fillOpacity={0.22} stroke="none" />
        <Line isAnimationActive={false} yAxisId="p" type="monotone" dataKey="modal" name="Modal" stroke="var(--tint)" strokeWidth={2.4} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Replay price path: known before the decision, revealed after. */
export function ReplayPath({ path, asOf, height = 280 }: { path: { date: string; modal: number; phase: string }[]; asOf: string; height?: number }) {
  const data = path.map((p) => ({ date: p.date, known: p.phase === "known" ? p.modal : null, revealed: p.phase === "revealed" || p.date === asOf ? p.modal : null }));
  // connect the two segments at the decision date
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" {...axisProps} tickFormatter={shortDate} minTickGap={28} />
        <YAxis {...axisProps} tickFormatter={(v) => `₹${v}`} width={58} domain={["auto", "auto"]} />
        <Tooltip labelFormatter={(l) => shortDate(String(l))} formatter={(v, name) => [`${inr(Number(v))}/q`, name]} />
        <Legend iconType="circle" iconSize={8} />
        <ReferenceLine x={asOf} stroke="var(--label)" strokeDasharray="4 4" label={{ value: "Decision", position: "top", fill: "var(--label-2)", fontSize: 11 }} />
        <Line isAnimationActive={false} type="monotone" dataKey="known" name="Known at decision" stroke="var(--tint)" strokeWidth={2.5} dot={false} connectNulls />
        <Line isAnimationActive={false} type="monotone" dataKey="revealed" name="Revealed afterwards" stroke="var(--gold)" strokeWidth={2.5} strokeDasharray="5 4" dot={{ r: 2.5 }} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function BacktestBars({ runs, height = 260 }: { runs: { as_of: string; recommended_net: number; local_now_net: number | null; best_net: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={runs} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="as_of" {...axisProps} tickFormatter={shortDate} minTickGap={28} />
        <YAxis {...axisProps} tickFormatter={(v) => `₹${Math.round(Number(v) / 1000)}k`} width={52} domain={["auto", "auto"]} />
        <Tooltip labelFormatter={(l) => shortDate(String(l))} formatter={(v, name) => [inr(Number(v)), name]} />
        <Legend iconType="circle" iconSize={8} />
        <Line isAnimationActive={false} type="monotone" dataKey="best_net" name="Best in hindsight" stroke="var(--label-3)" strokeWidth={1.5} dot={false} />
        <Line isAnimationActive={false} type="monotone" dataKey="local_now_net" name="Always sell locally" stroke="var(--orange)" strokeWidth={2} dot={false} />
        <Line isAnimationActive={false} type="monotone" dataKey="recommended_net" name="KHETNITI recommendation" stroke="var(--tint)" strokeWidth={2.5} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
