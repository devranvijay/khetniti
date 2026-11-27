"use client";

import { useState } from "react";
import { Bookmark, Check, CircleCheck, CircleX, History as HistoryIcon, Play, ShieldCheck } from "lucide-react";
import { useApi, useApp } from "@/components/AppContext";
import { BacktestBars, ReplayPath } from "@/components/charts";
import {
  Badge,
  btnPrimary,
  btnTinted,
  Card,
  CardTitle,
  ErrorBox,
  Field,
  HeroCard,
  inputCls,
  LargeTitle,
  List,
  Row,
  SectionHeader,
  Segmented,
  SourceFootnote,
  Stat,
} from "@/components/ui";
import { post, type Backtest, type Replay } from "@/lib/api";
import { inr, longDate, shortDate } from "@/lib/format";

type Window = { earliest: string; latest: string };

export default function ReplayPage() {
  const { crop, location } = useApp();
  const win = useApi<Window>(`/api/replay/window?crop=${crop}`);
  const [mode, setMode] = useState<"single" | "backtest">("single");

  return (
    <>
      <LargeTitle
        title="Decision Replay"
        hindi="पिछले फैसले"
        subtitle="Go back to a past date, let KHETNITI decide using only what was known then, and see what actually happened next."
      >
        <Segmented
          label="Mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "single", label: "Single date" },
            { value: "backtest", label: "Backtest a period" },
          ]}
        />
      </LargeTitle>
      {win.error && <ErrorBox message={win.error} onRetry={win.reload} />}
      {win.data && (mode === "single" ? <Single key={`${crop}-${location}`} win={win.data} /> : <Period key={`${crop}-${location}`} win={win.data} />)}
    </>
  );
}

function Single({ win }: { win: Window }) {
  const { crop, location } = useApp();
  const [asOf, setAsOf] = useState(() => {
    // Default to ~45 days before the latest valid date.
    const d = new Date(`${win.latest}T00:00:00`);
    d.setDate(d.getDate() - 45);
    const iso = d.toISOString().slice(0, 10);
    return iso < win.earliest ? win.latest : iso;
  });
  const [qty, setQty] = useState("20");
  const [res, setRes] = useState<Replay | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [runs, setRuns] = useState(0);

  async function run() {
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      setRes(await post<Replay>("/api/replay", { crop, location, as_of: asOf, quantity_q: Number(qty) }));
      setRuns((r) => r + 1);
    } catch (e) {
      setErr((e as Error).message);
      setRes(null);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!res) return;
    await post("/api/reports", {
      kind: "replay",
      crop,
      location,
      headline: `${longDate(res.as_of)}: ${res.advice.headline} — ${res.verdict}`,
      data_mode: res.provenance.mode,
      payload: {
        as_of: res.as_of,
        quantity_q: Number(qty),
        recommendation: res.advice.headline,
        recommended_net: res.recommended_outcome.net,
        best_option: res.best_outcome.label,
        best_net: res.best_outcome.net,
        regret: res.regret,
        verdict: res.verdict,
        source: res.provenance.source,
      },
    });
    setSaved(true);
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <Field label="Replay date" hint={`Available ${longDate(win.earliest)} – ${longDate(win.latest)}`}>
            <input type="date" className={inputCls} min={win.earliest} max={win.latest} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </Field>
          <Field label="Quantity (quintals)">
            <input type="number" min={1} className={inputCls} value={qty} onChange={(e) => setQty(e.target.value)} />
          </Field>
          <button className={`${btnPrimary} sm:mb-[22px]`} disabled={busy || !asOf || !(Number(qty) > 0)} onClick={run}>
            <Play className="size-4" /> {busy ? "Replaying…" : "Replay"}
          </button>
        </div>
      </Card>
      {err && <ErrorBox message={err} />}
      {!res && !err && (
        <Card className="grid min-h-[220px] place-items-center text-center">
          <div className="max-w-sm">
            <div className="mx-auto mb-3 grid size-14 place-items-center rounded-[16px] bg-[#5856D6]/12 text-[#5856D6]">
              <HistoryIcon className="size-7" />
            </div>
            <h3 className="text-20 font-semibold">Pick a date to replay</h3>
            <p className="mt-1 text-15 text-label-2">The recommendation is rebuilt from prices dated on or before that day only. Later prices are used just to score it.</p>
          </div>
        </Card>
      )}
      {res && (
        <div key={runs} className="enter space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <HeroCard>
              <div className="text-13 text-white/70">
                What KHETNITI would have said on {longDate(res.as_of)}
              </div>
              <h2 className="mt-2 text-20 font-bold leading-tight sm:text-24">{res.advice.headline}</h2>
              <div className="mt-3 text-13 text-white/70">Expected net then</div>
              <div className="text-30 font-bold text-[#F2BB3C]">{inr(res.advice.estimated_net.net)}</div>
            </HeroCard>
            <Card className="flex flex-col justify-between">
              <div className="flex items-center gap-3">
                {res.good_call ? <CircleCheck className="size-9 text-green" /> : <CircleX className="size-9 text-orange" />}
                <div>
                  <div className="text-13 text-label-2">What actually happened</div>
                  <div className="text-24 font-bold">{res.verdict}</div>
                </div>
              </div>
              <p className="mt-3 text-15 text-label-2">{res.verdict_detail}</p>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <Stat label="Recommendation earned" value={inr(res.recommended_outcome.net)} tone="tint" />
                <Stat label="Missed vs best" value={inr(res.regret)} tone={res.regret > 0 ? "gold" : undefined} />
              </div>
            </Card>
          </div>

          <Card>
            <CardTitle title={`Price path at ${res.advice.options.find((o) => o.market_id === res.path_market)?.market_name ?? res.path_market}`} subtitle="Solid: visible at decision time · Dashed: revealed afterwards" />
            <ReplayPath path={res.path} asOf={res.as_of} />
          </Card>

          <div className="grid gap-5 xl:grid-cols-2">
            <div>
              <SectionHeader title="All options, scored with actual prices" />
              <List>
                {res.outcomes.map((o) => (
                  <Row
                    key={o.label}
                    label={
                      <span className="flex flex-wrap items-center gap-1.5">
                        {o.label}
                        {o.label === res.recommended_outcome.label && <Badge>Recommended</Badge>}
                        {o.label === res.best_outcome.label && <Badge color="var(--gold-text)">Best</Badge>}
                      </span>
                    }
                    sub={
                      o.kind === "wait" && o.predicted_range
                        ? `Actual ${inr(o.price)}/q on ${shortDate(o.price_date)} · predicted ${inr(o.predicted_net)} (${inr(o.predicted_range[0])}–${inr(o.predicted_range[1])})`
                        : `${inr(o.price)}/q on ${shortDate(o.price_date)}`
                    }
                    value={<span className="font-semibold text-label">{inr(o.net)}</span>}
                  />
                ))}
              </List>
            </div>
            <div>
              <SectionHeader title="Look-ahead check" />
              <Card>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="size-7 shrink-0 text-green" />
                  <div>
                    <div className="text-17 font-semibold">No future data used</div>
                    <p className="mt-1 text-14 text-label-2">{res.leakage_check.note}</p>
                  </div>
                </div>
                <List className="mt-4 !shadow-none ring-1 ring-separator">
                  <Row label="Decision cutoff" value={longDate(res.leakage_check.decision_cutoff)} />
                  <Row label="Latest price used for decision" value={longDate(res.leakage_check.latest_row_used_for_decision)} />
                  <Row label="Check" value={<span className="font-semibold text-green">Passed</span>} />
                </List>
              </Card>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <SourceFootnote p={res.provenance} />
            <button className={btnTinted} onClick={save} disabled={saved}>
              {saved ? <Check className="size-4" /> : <Bookmark className="size-4" />} {saved ? "Saved to Reports" : "Save to Reports"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Period({ win }: { win: Window }) {
  const { crop, location } = useApp();
  const defaultStart = (() => {
    const d = new Date(`${win.latest}T00:00:00`);
    d.setFullYear(d.getFullYear() - 1);
    const iso = d.toISOString().slice(0, 10);
    return iso < win.earliest ? win.earliest : iso;
  })();
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(win.latest);
  const [step, setStep] = useState(7);
  const [qty, setQty] = useState("20");
  const [res, setRes] = useState<Backtest | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [runs, setRuns] = useState(0);

  async function run() {
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      setRes(await post<Backtest>("/api/replay/backtest", { crop, location, start, end, step_days: step, quantity_q: Number(qty) }));
      setRuns((r) => r + 1);
    } catch (e) {
      setErr((e as Error).message);
      setRes(null);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!res) return;
    const s = res.summary;
    await post("/api/reports", {
      kind: "backtest",
      crop,
      location,
      headline: `Backtest ${longDate(res.start)} – ${longDate(res.end)}: ${s.good_call_rate}% good calls`,
      data_mode: res.provenance.mode,
      payload: { ...s, start: res.start, end: res.end, step_days: res.step_days, quantity_q: Number(qty), source: res.provenance.source },
    });
    setSaved(true);
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_120px_auto]">
          <Field label="From">
            <input type="date" className={inputCls} min={win.earliest} max={win.latest} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" className={inputCls} min={win.earliest} max={win.latest} value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
          <Field label="Decide every">
            <Segmented
              label="Step"
              value={step}
              onChange={setStep}
              options={[
                { value: 7, label: "Week" },
                { value: 14, label: "2 weeks" },
                { value: 30, label: "Month" },
              ]}
            />
          </Field>
          <Field label="Quintals">
            <input type="number" min={1} className={inputCls} value={qty} onChange={(e) => setQty(e.target.value)} />
          </Field>
          <button className={btnPrimary} disabled={busy || !(Number(qty) > 0)} onClick={run}>
            <Play className="size-4" /> {busy ? "Running…" : "Run backtest"}
          </button>
        </div>
      </Card>
      {err && <ErrorBox message={err} />}
      {res && (
        <div key={runs} className="enter space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <Stat label="Decisions replayed" value={res.summary.decisions} sub={`${res.summary.wait_recommendations} said wait`} />
            </Card>
            <Card>
              <Stat label="Good calls" value={`${res.summary.good_call_rate}%`} sub={`${res.summary.good_calls} within 2% of the best option`} tone="tint" />
            </Card>
            <Card>
              <Stat
                label="vs always selling locally"
                value={res.summary.uplift_vs_local_pct == null ? "—" : `${res.summary.uplift_vs_local_pct > 0 ? "+" : ""}${res.summary.uplift_vs_local_pct}%`}
                sub={res.summary.baseline_local_total != null ? `${inr(res.summary.recommended_total)} vs ${inr(res.summary.baseline_local_total)}` : undefined}
                tone="gold"
              />
            </Card>
            <Card>
              <Stat label="Average missed value" value={inr(res.summary.avg_regret)} sub="per decision, vs best in hindsight" />
            </Card>
          </div>
          <Card>
            <CardTitle title="Net revenue per decision" subtitle={res.summary.baseline_note} />
            <BacktestBars runs={res.runs} />
            <SourceFootnote p={res.provenance} extra="Each decision used only prices on or before its own date" />
          </Card>
          <div className="flex justify-end">
            <button className={btnTinted} onClick={save} disabled={saved}>
              {saved ? <Check className="size-4" /> : <Bookmark className="size-4" />} {saved ? "Saved to Reports" : "Save to Reports"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
