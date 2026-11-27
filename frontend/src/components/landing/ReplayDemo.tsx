"use client";

import { useEffect, useRef, useState } from "react";
import { inr } from "@/lib/format";

const DAYS = 60;
const MIN_DAY = 14;
const MAX_DAY = 52;
const WINDOW = 7; // the demo rule compares today's price with its trailing 7-day average
const HORIZON = 7; // and scores the advice against the price one week later
const TICK_MS = 140;

/** Deterministic, illustrative series (seeded) so server and client render the same chart. Not real mandi data. */
const SERIES = (() => {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: DAYS }, (_, i) => Math.round(1650 + 170 * Math.sin(i / 6.5) + 85 * Math.sin(i / 2.7 + 1) + (rnd() - 0.5) * 70));
})();

const [X0, X1, Y0, Y1, LO, HI] = [56, 880, 40, 290, 1350, 2000];
const x = (i: number) => X0 + ((X1 - X0) * i) / (DAYS - 1);
const y = (v: number) => Y1 - ((Y1 - Y0) * (v - LO)) / (HI - LO);
const points = (from: number, to: number) =>
  SERIES.slice(from, to + 1)
    .map((v, k) => `${x(from + k).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");

/** The engine sees only prices up to and including `day`; `later` is used to score, never to advise. */
function replay(day: number) {
  const known = SERIES.slice(day - WINDOW + 1, day + 1);
  const price = SERIES[day];
  const avg = Math.round(known.reduce((a, b) => a + b, 0) / WINDOW);
  const sell = price >= avg;
  const later = SERIES[day + HORIZON];
  const delta = later - price;
  return { price, avg, sell, later, delta, helped: sell ? delta <= 0 : delta > 0 };
}

export function ReplayDemo() {
  const [day, setDay] = useState(30);
  const [playing, setPlaying] = useState(false);
  const running = playing && day < MAX_DAY;

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setDay((d) => Math.min(d + 1, MAX_DAY)), TICK_MS);
    return () => window.clearInterval(t);
  }, [running]);

  // Plays itself once the first time it is mostly on screen, so the idea explains itself.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        setPlaying(true);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const r = replay(day);
  const labelRight = x(day) > 700;

  return (
    <div ref={root} className="grid items-start gap-6 lg:grid-cols-[1.7fr_1fr]">
      <div className="rounded-[24px] bg-[#0d3b2b] p-4 sm:p-5">
        <svg viewBox="0 0 900 340" className="block h-auto w-full" role="img" aria-label={`Illustrative price series with the decision on day ${day + 1}`}>
          {[1400, 1600, 1800, 2000].map((v) => (
            <g key={v}>
              <line x1={X0} x2={X1} y1={y(v)} y2={y(v)} stroke="#1e6b4b" strokeOpacity={0.5} />
              <text x={X0 - 10} y={y(v) + 5} textAnchor="end" fontSize={14} fill="#bfd8cb">
                {v.toLocaleString("en-IN")}
              </text>
            </g>
          ))}
          {[0, 10, 20, 30, 40, 50].map((d) => (
            <text key={d} x={x(d)} y={Y1 + 28} textAnchor="middle" fontSize={14} fill="#bfd8cb">
              Day {d + 1}
            </text>
          ))}
          <text x={14} y={14} fontSize={13} fill="#bfd8cb">
            ₹ per quintal
          </text>
          <rect x={x(day)} y={Y0} width={X1 - x(day)} height={Y1 - Y0} fill="#07241a" fillOpacity={0.55} />
          <polyline points={points(day, DAYS - 1)} fill="none" stroke="#e9ac27" strokeWidth={3} strokeDasharray="7 7" strokeOpacity={0.6} strokeLinecap="round" />
          <polyline points={points(0, day)} fill="none" stroke="#3dbe85" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          <line x1={x(day)} x2={x(day)} y1={Y0} y2={Y1} stroke="#e9ac27" strokeWidth={2} />
          <circle cx={x(day)} cy={y(r.price)} r={8} fill="#e9ac27" stroke="#0d3b2b" strokeWidth={3} />
          <circle cx={x(day + HORIZON)} cy={y(r.later)} r={6} fill="#0d3b2b" stroke="#e9ac27" strokeWidth={3} />
          <text x={labelRight ? x(day) - 10 : x(day) + 10} y={Y0 + 14} textAnchor={labelRight ? "end" : "start"} fontSize={14} fontWeight={600} fill="#e9ac27">
            Decision day {day + 1}
          </text>
        </svg>

        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-13 text-[#bfd8cb]">
          <span className="inline-flex items-center gap-2">
            <i className="inline-block w-5 border-t-[3px] border-[#3dbe85]" /> Known at decision time
          </span>
          <span className="inline-flex items-center gap-2">
            <i className="inline-block w-5 border-t-[3px] border-dashed border-[#e9ac27]" /> Hidden from the engine
          </span>
        </div>

        <div className="mt-3 flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              if (running) return setPlaying(false);
              if (day >= MAX_DAY) setDay(MIN_DAY);
              setPlaying(true);
            }}
            className="pressable min-h-11 min-w-[84px] rounded-full bg-[#e9ac27] px-5 text-15 font-semibold text-[#0d3b2b]"
          >
            {running ? "Pause" : "Play"}
          </button>
          <label htmlFor="replay-day" className="whitespace-nowrap text-14 text-[#bfd8cb]">
            Decision day <output className="font-semibold tabular-nums text-white">{day + 1}</output>
          </label>
          <input
            id="replay-day"
            type="range"
            min={MIN_DAY}
            max={MAX_DAY}
            value={day}
            onChange={(e) => {
              setPlaying(false);
              setDay(Number(e.target.value));
            }}
            className="min-w-0 flex-1 accent-[#e9ac27]"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3" aria-live="polite">
        <Fact step="1 · Known then" title={`${inr(r.price)} / quintal`} sub={`7-day average ${inr(r.avg)}. Nothing after day ${day + 1} is used.`} />
        <Fact step="2 · KhetNiti would advise" title={r.sell ? "Sell now" : "Hold for 7 days"} sub="Demo rule: sell when the price is at or above its 7-day average." />
        <Fact
          step="3 · Prices afterwards"
          title={`${inr(r.later)} on day ${day + 1 + HORIZON}`}
          sub={`${r.delta >= 0 ? "Up" : "Down"} ${inr(Math.abs(r.delta))} per quintal in the week after.`}
        />
        <Fact
          gold
          step="4 · How it performed"
          title={r.helped ? "Advice helped" : "Advice missed"}
          sub={`${r.sell ? "Selling that day" : "Holding"} ${r.helped ? "avoided or gained" : "gave up"} ${inr(Math.abs(r.delta))} per quintal versus the alternative.`}
        />
        <span className="self-start rounded-full bg-[#f6efdc] px-3.5 py-1.5 text-13 font-semibold text-[#0d3b2b]">No future-data leakage</span>
      </div>
    </div>
  );
}

function Fact({ step, title, sub, gold = false }: { step: string; title: string; sub: string; gold?: boolean }) {
  return (
    <div className={`rounded-[18px] px-5 py-4 ${gold ? "bg-[#e9ac27] text-[#0d3b2b]" : "bg-[#0d3b2b] text-white"}`}>
      <small className={`mb-1 block text-12 font-semibold uppercase tracking-[0.12em] ${gold ? "" : "text-[#e9ac27]"}`}>{step}</small>
      <strong className="block text-22 font-bold">{title}</strong>
      <span className={`text-15 ${gold ? "" : "text-[#bfd8cb]"}`}>{sub}</span>
    </div>
  );
}
