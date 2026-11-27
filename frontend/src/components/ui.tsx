"use client";

import { ChevronDown, Info, RefreshCw, TriangleAlert } from "lucide-react";
import type { Provenance, RiskLevel } from "@/lib/api";
import { dateTime, longDate } from "@/lib/format";

/* ---------------------------------------------------------------- layout */

export function Card({ children, className = "", pad = true }: { children: React.ReactNode; className?: string; pad?: boolean }) {
  return <section className={`rounded-[20px] bg-surface shadow-card ${pad ? "p-5" : ""} ${className}`}>{children}</section>;
}

/** Prominent tinted card for the key decision (like an iOS widget). */
export function HeroCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`relative overflow-hidden rounded-[22px] p-6 text-white shadow-card ${className}`}
      style={{ background: "linear-gradient(145deg, #1E6B4B 0%, #0D3B2B 70%)" }}
    >
      {children}
    </section>
  );
}

export function LargeTitle({ title, hindi, subtitle, children }: { title: string; hindi?: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[34px] font-bold leading-[41px] tracking-[-0.022em] text-label">
          {title}
          {hindi && <span className="ml-2.5 font-hindi text-[22px] font-medium tracking-normal text-label-2">{hindi}</span>}
        </h1>
        {subtitle && <p className="mt-1 max-w-2xl text-[15px] text-label-2">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}

/** Section header above a card, like an inset grouped list header. */
export function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-2 mt-1 flex items-end justify-between gap-3 px-1">
      <h2 className="text-[20px] font-semibold tracking-[-0.016em] text-label">{title}</h2>
      {children}
    </div>
  );
}

export function CardTitle({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-[17px] font-semibold tracking-[-0.012em] text-label">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-label-2">{subtitle}</p>}
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
          <div className={`text-[15px] ${strong ? "font-semibold" : ""} text-label`}>{label}</div>
          {sub && <div className="text-[12px] text-label-2">{sub}</div>}
        </div>
        {value != null && <div className={`text-right text-[15px] tabular-nums ${strong ? "font-semibold text-label" : "text-label-2"}`}>{value}</div>}
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
      <div className="text-[13px] font-medium text-label-2">{label}</div>
      <div className={`mt-0.5 font-semibold leading-tight tracking-[-0.02em] tabular-nums ${compact ? "text-[20px]" : "text-[28px]"} ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[13px] text-label-2">{sub}</div>}
    </div>
  );
}

export function Badge({ children, color = "var(--tint)", solid = false }: { children: React.ReactNode; color?: string; solid?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-semibold"
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
  if (p.mode === "historical") return <Badge color="var(--blue)">REAL · HISTORICAL</Badge>;
  return <Badge color="var(--orange)">DEMO DATA</Badge>;
}

export function SourceFootnote({ p, extra }: { p: Provenance; extra?: string }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-label-2">
      <ProvenanceBadge p={p} />
      <span>Source: {p.source}</span>
      {p.latest_price_date && <span>· Price date {longDate(p.latest_price_date)}</span>}
      {p.last_updated && <span>· Updated {dateTime(p.last_updated)}</span>}
      {extra && <span>· {extra}</span>}
      {p.notice && <span className={`w-full ${p.mode === "demo" ? "text-orange" : ""}`}>{p.notice}</span>}
    </div>
  );
}

export function WeatherFootnote({ source, fetchedAt, stale, error }: { source: string; fetchedAt: string; stale: boolean; error: string | null }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-label-2">
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
      <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[15px] font-semibold text-white" style={{ background: RISK_COLOR[level] }}>
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
    <div className="flex items-start gap-3 rounded-[14px] p-4 text-[14px]" style={{ background: "color-mix(in srgb, var(--red) 10%, transparent)" }}>
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-red" />
      <div className="flex-1 text-label">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="inline-flex items-center gap-1 font-semibold text-tint">
          <RefreshCw className="size-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

export function Note({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" }) {
  const color = tone === "warn" ? "var(--orange)" : "var(--blue)";
  return (
    <div className="flex items-start gap-2.5 rounded-[12px] p-3 text-[13px] text-label" style={{ background: `color-mix(in srgb, ${color} 10%, transparent)` }}>
      <Info className="mt-0.5 size-4 shrink-0" style={{ color }} />
      <div>{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- controls */

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  size = "md",
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[9px] bg-fill p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`rounded-[7px] font-medium transition-all duration-200 ${size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3.5 py-1.5 text-[13px]"} ${
              active ? "bg-surface text-label shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.04)] dark:bg-[#636366]" : "text-label hover:opacity-70"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-label-2">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-[12px] text-label-3">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-[10px] bg-fill px-3 py-2 text-[15px] text-label outline-none transition placeholder:text-label-3 focus:bg-surface focus:ring-2 focus:ring-tint/40";

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
  "inline-flex items-center justify-center gap-2 rounded-[12px] bg-tint px-5 py-2.5 text-[15px] font-semibold text-on-tint transition active:scale-[0.98] hover:brightness-110 disabled:opacity-40";
export const btnTinted =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-tint/12 px-3.5 py-1.5 text-[13px] font-semibold text-tint transition hover:bg-tint/20 active:scale-[0.98] disabled:opacity-40";
export const btnPlain = "inline-flex items-center gap-1 text-[15px] font-medium text-tint hover:opacity-70";
