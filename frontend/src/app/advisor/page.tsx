"use client";

import { useState } from "react";
import { Bookmark, Check, CircleCheck, Sparkles } from "lucide-react";
import { useApi, useApp } from "@/components/AppContext";
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
  Note,
  Row,
  SectionHeader,
  Select,
  SourceFootnote,
} from "@/components/ui";
import { post, type Advice, type LatestPrices } from "@/lib/api";
import { inr, longDate, num } from "@/lib/format";

type Form = {
  quantity_q: string;
  local_mandi: string;
  transport_rate_per_q_km: string;
  local_transport: string;
  handling_per_q: string;
  fee_pct: string;
  spoilage_pct_per_day: string;
  storage_cost_per_q_day: string;
};

const n = (s: string) => (s.trim() === "" ? null : Number(s));

export default function AdvisorPage() {
  const { crop, location } = useApp();
  // Remount on crop/location change so the form and result reset cleanly.
  return <Advisor key={`${crop}-${location}`} />;
}

function Advisor() {
  const { crop, location, meta } = useApp();
  const cropInfo = meta?.crops.find((c) => c.id === crop);
  const latest = useApi<LatestPrices>(`/api/prices/latest?crop=${crop}&location=${location}`);
  const [form, setForm] = useState<Form>({
    quantity_q: "20",
    local_mandi: "",
    transport_rate_per_q_km: "1",
    local_transport: "",
    handling_per_q: "10",
    fee_pct: "0",
    spoilage_pct_per_day: "",
    storage_cost_per_q_day: "",
  });
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const localMandi = form.local_mandi || latest.data?.local_mandi || "";
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const qty = n(form.quantity_q);
  const valid = qty != null && qty > 0 && [form.transport_rate_per_q_km, form.handling_per_q, form.fee_pct].every((v) => v === "" || Number(v) >= 0);

  async function run() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const overrides = n(form.local_transport) != null && localMandi ? { [localMandi]: n(form.local_transport)! } : null;
      const res = await post<Advice>("/api/advisor", {
        crop,
        location,
        quantity_q: qty,
        local_mandi: localMandi || null,
        transport_rate_per_q_km: n(form.transport_rate_per_q_km) ?? 0,
        transport_overrides: overrides,
        handling_per_q: n(form.handling_per_q) ?? 0,
        fee_pct: n(form.fee_pct) ?? 0,
        spoilage_pct_per_day: n(form.spoilage_pct_per_day),
        storage_cost_per_q_day: n(form.storage_cost_per_q_day),
      });
      if (!res.ok) setError(res.message ?? "No recommendation could be made.");
      setAdvice(res.ok ? res : null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!advice) return;
    await post("/api/reports", {
      kind: "advice",
      crop,
      location,
      headline: advice.headline,
      data_mode: advice.provenance.mode,
      payload: {
        quantity_q: qty,
        estimated_net: advice.estimated_net,
        confidence: advice.confidence,
        reference_date: advice.reference_date,
        best_now: { market: advice.best_now.market_name, net: advice.best_now.net, price: advice.best_now.price_per_q },
        local: advice.local ? { market: advice.local.market_name, net: advice.local.net, price: advice.local.price_per_q } : null,
        reasons: advice.reasons,
        risk_level: advice.risk_level,
        source: advice.provenance.source,
      },
    });
    setSaved(true);
  }

  return (
    <>
      <LargeTitle title="Smart Sell Advisor" hindi="बिक्री सलाह" subtitle="Compare every mandi on what you actually take home, then decide whether to sell now or wait." />

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Inputs */}
        <div className="space-y-4">
          <Card>
            <CardTitle title="Your harvest" />
            <div className="space-y-3.5">
              <Field label="Quantity (quintals)" hint="1 quintal = 100 kg">
                <input type="number" inputMode="decimal" min={0} className={inputCls} value={form.quantity_q} onChange={set("quantity_q")} />
              </Field>
              <Field label="Your usual (local) mandi">
                <Select value={localMandi} onChange={(v) => setForm({ ...form, local_mandi: v })}>
                  {(latest.data?.markets ?? []).map((m) => (
                    <option key={m.market_id} value={m.market_id}>
                      {m.market_name} · {m.distance_km} km
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>
          <Card>
            <CardTitle title="Costs" subtitle="Edit to match what you pay" />
            <div className="space-y-3.5">
              <Field label="Transport rate (₹ per quintal per km)" hint="Applied to the estimated road distance of each mandi">
                <input type="number" inputMode="decimal" min={0} step="0.1" className={inputCls} value={form.transport_rate_per_q_km} onChange={set("transport_rate_per_q_km")} />
              </Field>
              <Field label="Actual transport to local mandi (₹, optional)" hint="If you know the exact fare, it replaces the estimate">
                <input type="number" inputMode="decimal" min={0} placeholder="Estimate" className={inputCls} value={form.local_transport} onChange={set("local_transport")} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Handling (₹/q)">
                  <input type="number" inputMode="decimal" min={0} className={inputCls} value={form.handling_per_q} onChange={set("handling_per_q")} />
                </Field>
                <Field label="Market fee (%)">
                  <input type="number" inputMode="decimal" min={0} className={inputCls} value={form.fee_pct} onChange={set("fee_pct")} />
                </Field>
                <Field label="Weight loss (%/day)">
                  <input type="number" inputMode="decimal" min={0} step="0.1" className={inputCls} value={form.spoilage_pct_per_day} placeholder={cropInfo ? `${cropInfo.spoilage_pct_per_day} (default)` : ""} onChange={set("spoilage_pct_per_day")} />
                </Field>
                <Field label="Storage (₹/q/day)">
                  <input type="number" inputMode="decimal" min={0} className={inputCls} value={form.storage_cost_per_q_day} placeholder={cropInfo ? `${cropInfo.storage_cost_per_q_day} (default)` : ""} onChange={set("storage_cost_per_q_day")} />
                </Field>
              </div>
            </div>
          </Card>
          <button className={`${btnPrimary} w-full`} disabled={!valid || busy} onClick={run}>
            <Sparkles className="size-4" /> {busy ? "Calculating…" : "Get recommendation"}
          </button>
          {latest.error && <ErrorBox message={latest.error} onRetry={latest.reload} />}
        </div>

        {/* Results */}
        <div className="min-w-0 space-y-5">
          {error && <ErrorBox message={error} />}
          {!advice && !error && (
            <Card className="grid min-h-[320px] place-items-center text-center">
              <div className="max-w-sm">
                <div className="mx-auto mb-3 grid size-14 place-items-center rounded-[16px] bg-tint/12 text-tint">
                  <Sparkles className="size-7" />
                </div>
                <h3 className="text-[20px] font-semibold">Ready when you are</h3>
                <p className="mt-1 text-[15px] text-label-2">Enter your quantity and costs, then tap Get recommendation. Every number in the result shows how it was calculated.</p>
              </div>
            </Card>
          )}
          {advice && <AdviceResult a={advice} onSave={save} saved={saved} />}
        </div>
      </div>
    </>
  );
}

function AdviceResult({ a, onSave, saved }: { a: Advice; onSave: () => void; saved: boolean }) {
  const decision = a.action === "WAIT" ? a.scenarios.find((s) => s.days === a.wait_days)!.expected : a.best_now;
  return (
    <>
      <HeroCard>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-lg">
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-white/70">
              Recommendation · prices as of {longDate(a.reference_date)}
              {a.provenance.mode === "demo" && <span className="rounded-full bg-[#FF9500] px-2 py-0.5 text-[11px] font-semibold text-white">DEMO DATA</span>}
            </div>
            <h2 className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.02em]">{a.headline}</h2>
            <div className="mt-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-[13px] font-medium">Confidence: {a.confidence}</div>
          </div>
          <div className="sm:text-right">
            <div className="text-[13px] text-white/70">Estimated net revenue</div>
            <div className="text-[40px] font-bold tracking-[-0.03em] text-[#F2BB3C]">{inr(a.estimated_net.net)}</div>
            {a.action === "WAIT" && (
              <div className="text-[13px] text-white/70">
                80% range {inr(a.estimated_net.low)} – {inr(a.estimated_net.high)}
              </div>
            )}
          </div>
        </div>
      </HeroCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <div>
          <SectionHeader title="Why" />
          <List>
            {a.reasons.map((r) => (
              <Row key={r} icon={<CircleCheck className="size-5 shrink-0 text-tint" />} label={<span className="text-[14px]">{r}</span>} />
            ))}
          </List>
        </div>
        <div>
          <SectionHeader title="How the number is calculated" />
          <List>
            <Row label="Saleable quantity" value={`${num(decision.saleable_q, 2)} q`} />
            <Row label="× Price" value={`${inr(decision.price_per_q)}/q`} />
            <Row label="Gross revenue" value={inr(decision.gross)} strong />
            <Row label="− Transport" value={inr(decision.transport)} sub={a.action === "SELL_NOW" ? a.best_now.transport_basis : undefined} />
            <Row label="− Handling" value={inr(decision.handling)} />
            <Row label="− Market fee" value={inr(decision.market_fee)} />
            {decision.storage > 0 && <Row label="− Storage" value={inr(decision.storage)} />}
            <Row label="Net revenue" value={inr(decision.net)} strong />
          </List>
        </div>
      </div>

      <Card pad={false}>
        <div className="px-5 pt-5">
          <CardTitle title="Sell now: every mandi compared" subtitle="Net = Gross − Transport − Handling − Market fee" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-[14px]">
            <thead>
              <tr className="text-left text-[12px] text-label-2">
                <th className="px-5 py-2 font-medium">Mandi</th>
                <th className="px-3 py-2 text-right font-medium">Modal</th>
                <th className="px-3 py-2 text-right font-medium">Gross</th>
                <th className="px-3 py-2 text-right font-medium">Transport</th>
                <th className="px-3 py-2 text-right font-medium">Other</th>
                <th className="px-3 py-2 text-right font-medium">Net</th>
                <th className="px-5 py-2 text-right font-medium">vs local</th>
              </tr>
            </thead>
            <tbody>
              {a.options.map((o) => {
                const isBest = o.market_id === a.best_now.market_id;
                return (
                  <tr key={o.market_id} className={`border-t border-separator ${isBest ? "bg-tint/8" : ""} ${o.stale ? "opacity-50" : ""}`}>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-1.5 font-medium">
                        {o.market_name}
                        {isBest && <Badge>Best</Badge>}
                        {o.is_local && <Badge color="var(--label-2)">Local</Badge>}
                        {o.stale && <Badge color="var(--red)">Stale</Badge>}
                      </div>
                      <div className="text-[12px] text-label-2">{o.transport_basis}</div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{inr(o.price_per_q)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-label-2">{inr(o.gross)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-label-2">−{inr(o.transport)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-label-2">−{inr(o.handling + o.market_fee)}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{inr(o.net)}</td>
                    <td className="px-5 py-3 text-right tabular-nums" style={{ color: a.local && o.net - a.local.net >= 0 ? "var(--green)" : "var(--red)" }}>
                      {a.local ? (o.market_id === a.local.market_id ? "—" : `${o.net - a.local.net >= 0 ? "+" : "−"}${inr(Math.abs(o.net - a.local.net))}`) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="h-3" />
      </Card>

      <Card>
        <CardTitle title="Wait scenarios" subtitle={a.scenarios.length ? `At ${a.best_now.market_name}, using the recent price trend` : undefined} />
        {a.scenarios.length === 0 ? (
          <Note>Not enough recent price history to model waiting, so only selling now is evaluated.</Note>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[14px] bg-surface-2 p-4">
              <div className="text-[13px] font-medium text-label-2">Sell today</div>
              <div className="mt-1 text-[22px] font-semibold tabular-nums">{inr(a.best_now.net)}</div>
              <div className="text-[12px] text-label-2">at {inr(a.best_now.price_per_q)}/q</div>
            </div>
            {a.scenarios.map((s) => {
              const better = s.expected.net > a.best_now.net;
              return (
                <div key={s.days} className={`rounded-[14px] p-4 ${a.action === "WAIT" && a.wait_days === s.days ? "bg-tint/10 ring-1 ring-tint/40" : "bg-surface-2"}`}>
                  <div className="text-[13px] font-medium text-label-2">Wait {s.days} days</div>
                  <div className="mt-1 text-[22px] font-semibold tabular-nums" style={{ color: better ? "var(--green)" : undefined }}>
                    {inr(s.expected.net)}
                  </div>
                  <div className="text-[12px] text-label-2">
                    Range {inr(s.net_low)} – {inr(s.net_high)}
                  </div>
                  <div className="mt-1 text-[12px] text-label-2">
                    ~{inr(s.price_expected)}/q · −{s.loss_pct}% weight{s.expected.storage > 0 ? ` · −${inr(s.expected.storage)} storage` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {a.trend && (
          <p className="mt-3 text-[13px] text-label-2">
            Trend {a.trend.slope_pct_per_day > 0 ? "+" : ""}
            {a.trend.slope_pct_per_day}%/day over {a.trend.points} price days ({longDate(a.trend.from)} – {longDate(a.trend.to)}); half of it is carried forward. Day-to-day volatility{" "}
            {a.trend.volatility_pct_per_day}%. {a.formulas.wait_price}.
          </p>
        )}
      </Card>

      <div className="space-y-3">
        {a.caveats.map((c) => (
          <Note key={c} tone="warn">
            {c}
          </Note>
        ))}
        {a.weather_error && <Note tone="warn">Weather risk was not included: {a.weather_error}</Note>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SourceFootnote p={a.provenance} />
        <button className={btnTinted} onClick={onSave} disabled={saved}>
          {saved ? <Check className="size-4" /> : <Bookmark className="size-4" />} {saved ? "Saved to Reports" : "Save to Reports"}
        </button>
      </div>
    </>
  );
}
