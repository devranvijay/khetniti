"use client";

import { ChevronDown, Info, RefreshCw, TriangleAlert } from "lucide-react";
import type { Provenance, RiskLevel } from "@/lib/api";
import { dateTime, longDate } from "@/lib/format";
import { useTrackSelect } from "./useTrackSelect";

/* ---------------------------------------------------------------- layout */

export function Card({ children, className = "", pad = true }: { children: React.ReactNode; className?: string; pad?: boolean }) {
  return <section className={`rounded-[20px] bg-surface shadow-card ${pad ? "p-5" : ""} ${className}`}>{children}</section>;
}

/** Prominent tinted card for the key decision (like an iOS widget). */
export function HeroCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`relative overflow-hidden rounded-[22px] p-5 text-white shadow-card sm:p-6 ${className}`}
      style={{ background: "linear-gradient(145deg, #1E6B4B 0%, #0D3B2B 70%)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14), var(--shadow)" }}
    >
      {children}
    </section>
  );
}

export function LargeTitle({ title, hindi, subtitle, children }: { title: string; hindi?: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-4 md:mb-6">
      <div className="min-w-0">
        <h1 className="text-28 font-bold leading-[34px] text-label md:text-34 md:leading-[41px]">
          {title}
          {hindi && <span className="ml-2 inline-block font-hindi text-18 font-medium tracking-normal text-label-2 md:ml-2.5 md:text-22">{hindi}</span>}
        </h1>
        {subtitle && <p className="mt-1 max-w-2xl text-14 text-label-2 md:text-15">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}

/** Section header above a card, like an inset grouped list header. */
export function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-2 mt-1 flex items-end justify-between gap-3 px-1">
      <h2 className="text-20 font-semibold text-label">{title}</h2>
      {children}
    </div>
  );
}

export function CardTitle({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-17 font-semibold text-label">{title}</h3>
        {subtitle && <p className="mt-0.5 text-13 text-label-2">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- grouped list */

export function List({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`overflow-hidden rounded-[14px] bg-surface shadow-card ${className}`}>{children}</div>;
}

export function Row({ label, value, sub, icon, strong = false }: { label: React.ReactNode; value?: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode; strong?: boolean }) {
  return (
    <div className="group flex items-center gap-3 pl-4">
      {icon}
      <div className="flex min-h-11 flex-1 items-center justify-between gap-3 border-b border-separator py-2.5 pr-4 group-last:border-b-0">
        <div className="min-w-0">
          <div className={`text-15 ${strong ? "font-semibold" : ""} text-label`}>{label}</div>
          {sub && <div className="text-12 text-label-2">{sub}</div>}
        </div>
        {value != null && <div className={`max-w-[60%] text-right text-15 tabular-nums [overflow-wrap:anywhere] ${strong ? "font-semibold text-label" : "text-label-2"}`}>{value}</div>}
      </div>
    </div>
  );
}

export function IconTile({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-[7px] text-white" style={{ background: color }}>
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- data display */

export function Stat({ label, value, sub, tone, compact = false }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "tint" | "gold"; compact?: boolean }) {
  const color = tone === "tint" ? "text-tint" : tone === "gold" ? "text-gold-text" : "text-label";
  return (
    <div>
      <div className="text-13 font-medium text-label-2">{label}</div>
      <div className={`mt-0.5 font-semibold leading-tight tabular-nums ${compact ? "text-20" : "text-28"} ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-13 text-label-2">{sub}</div>}
    </div>
  );
}

export function Badge({ children, color = "var(--tint)", solid = false }: { children: React.ReactNode; color?: string; solid?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-12 font-semibold"
      style={solid ? { background: color, color: "#fff" } : { background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
    >
      {children}
    </span>
  );
}

export function ProvenanceBadge({ p }: { p: Provenance }) {
  if (p.mode === "live")
    return (
      <Badge color="var(--green)">
        <span className="size-1.5 animate-pulse rounded-full bg-current" /> LIVE
      </Badge>
    );
  return <Badge color="var(--blue)">REAL · HISTORICAL</Badge>;
}

export function SourceFootnote({ p, extra }: { p: Provenance; extra?: string }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-12 text-label-2">
      <ProvenanceBadge p={p} />
      <span>Source: {p.source}</span>
      {p.latest_price_date && <span>· Price date {longDate(p.latest_price_date)}</span>}
      {p.last_updated && <span>· Updated {dateTime(p.last_updated)}</span>}
      {extra && <span>· {extra}</span>}
      {p.notice && <span className="w-full">{p.notice}</span>}
    </div>
  );
}

export function WeatherFootnote({ source, fetchedAt, stale, error }: { source: string; fetchedAt: string; stale: boolean; error: string | null }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-12 text-label-2">
      {stale ? <Badge color="var(--red)">STALE FORECAST</Badge> : <Badge color="var(--green)">LIVE FORECAST</Badge>}
      <span>Source: {source}</span>
      <span>· Fetched {dateTime(fetchedAt)}</span>
      {error && <span className="w-full text-red">{error}</span>}
    </div>
  );
}

export const RISK_COLOR: Record<RiskLevel, string> = { Low: "var(--green)", Moderate: "var(--orange)", High: "var(--red)" };

export function RiskBadge({ level, large = false }: { level: RiskLevel; large?: boolean }) {
  if (large)
    return (
      <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-15 font-semibold text-white" style={{ background: RISK_COLOR[level] }}>
        {level} risk
      </span>
    );
  return <Badge color={RISK_COLOR[level]}>{level}</Badge>;
}

/* ---------------------------------------------------------------- states */

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 rounded-full bg-fill" style={{ width: `${88 - i * 14}%` }} />
      ))}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-[14px] p-4 text-14" style={{ background: "color-mix(in srgb, var(--red) 10%, transparent)" }}>
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-red" />
      <div className="flex-1 text-label">{message}</div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="pressable inline-flex items-center gap-1 font-semibold text-tint">
          <RefreshCw className="size-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

export function Note({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" }) {
  const color = tone === "warn" ? "var(--orange)" : "var(--blue)";
  return (
    <div className="flex items-start gap-2.5 rounded-[12px] p-3 text-13 text-label" style={{ background: `color-mix(in srgb, ${color} 10%, transparent)` }}>
      <Info className="mt-0.5 size-4 shrink-0" style={{ color }} />
      <div>{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- controls */

/**
 * iOS segmented control: equal-width segments with a thumb that slides on a spring.
 * Press anywhere to preview, drag across segments, release to commit; arrow keys move it too.
 */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  size = "md",
  full = false,
}: {
  options: { value: T; label: React.ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
  /** stretch to the container width (phones) */
  full?: boolean;
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const commit = (i: number) => onChange(options[i].value);
  const { shown, pressed, track, onClickCapture, onKeyDown } = useTrackSelect(options.length, index, commit);
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      {...track}
      className={`${full ? "grid w-full" : "inline-grid"} relative touch-pan-y select-none auto-cols-fr grid-flow-col rounded-[9px] bg-fill p-0.5`}
    >
      <span
        aria-hidden
        className="slide absolute inset-y-0.5 left-0.5 rounded-[7px] bg-seg-thumb shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04),0_0_0_0.5px_rgba(0,0,0,0.04)]"
        style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${shown * 100}%) scale(${pressed ? 0.95 : 1})` }}
      />
      {options.map((o, i) => {
        const active = i === index;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            data-slot
            aria-checked={active}
            aria-label={o.title}
            title={o.title}
            tabIndex={active ? 0 : -1}
            onClickCapture={onClickCapture}
            onClick={() => commit(i)}
            className={`relative inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-[7px] text-label transition-[font-weight,opacity] duration-200 ${size === "sm" ? "px-2.5 py-1 text-12" : "px-3 py-1.5 text-13"} ${
              i === shown ? "font-semibold" : "font-medium"
            } ${pressed && i !== shown ? "opacity-60" : ""}`}
          >
            {/* An invisible semibold copy reserves the selected width, so nothing shifts on selection. */}
            <span className="grid place-items-center">
              <span aria-hidden className="invisible col-start-1 row-start-1 inline-flex items-center gap-1 font-semibold">
                {o.label}
              </span>
              <span className="col-start-1 row-start-1 inline-flex items-center gap-1">{o.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-13 font-medium text-label-2">{label}</span>
      <div className="mt-1">{children}</div>
      {error ? (
        <span className="mt-1 block text-12 font-medium text-red" role="alert">
          {error}
        </span>
      ) : (
        hint && <span className="mt-1 block text-12 text-label-3">{hint}</span>
      )}
    </label>
  );
}

export const inputCls =
  "w-full rounded-[10px] bg-fill px-3 py-2 text-15 text-label outline-none transition placeholder:text-label-3 focus:bg-surface focus:ring-2 focus:ring-tint/40";

export function Select({ value, onChange, children, className = "" }: { value: string; onChange: (v: string) => void; children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} pr-8`}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-label-2" />
    </div>
  );
}

export const btnPrimary =
  "pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-tint px-5 py-2.5 text-17 font-semibold text-on-tint hover:brightness-110 disabled:opacity-40";
export const btnTinted =
  "pressable inline-flex items-center justify-center gap-1.5 rounded-full bg-tint/12 px-3.5 py-1.5 text-13 font-semibold text-tint hover:bg-tint/20 disabled:opacity-40";
export const btnPlain = "pressable inline-flex items-center gap-1 text-15 font-medium text-tint hover:opacity-70";
