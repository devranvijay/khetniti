"use client";

import { useState } from "react";
import { Bookmark, CalendarClock, Check, CircleCheck, RefreshCw, Sparkles } from "lucide-react";
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
import { ApiError, post, type Advice, type LatestPrices } from "@/lib/api";
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

/** The same limits the server enforces, checked as you type so a request never bounces back. */
const LIMITS: Partial<Record<keyof Form, { max: number; required?: boolean }>> = {
  quantity_q: { max: 100000, required: true },
  transport_rate_per_q_km: { max: 100 },
  local_transport: { max: 10_000_000 },
  handling_per_q: { max: 10000 },
  fee_pct: { max: 50 },
  spoilage_pct_per_day: { max: 50 },
  storage_cost_per_q_day: { max: 1000 },
};

function validate(form: Form): Partial<Record<keyof Form, string>> {
  return Object.fromEntries(
    (Object.keys(LIMITS) as (keyof Form)[]).flatMap((k) => {
      const lim = LIMITS[k]!;
      const raw = form[k].trim();
      if (raw === "") return lim.required ? [[k, "Enter how many quintals you have"]] : [];
      const v = Number(raw);
      if (!Number.isFinite(v)) return [[k, "Enter a number"]];
      if (v < 0) return [[k, "Can’t be negative"]];
      if (lim.required && v === 0) return [[k, "Must be more than 0"]];
      if (v > lim.max) return [[k, `Must be ${num(lim.max)} or less`]];
      return [];
    }),
  );
}

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
  const [error, setError] = useState<{ message: string; retry: boolean } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ranWith, setRanWith] = useState<string | null>(null);
  const [runs, setRuns] = useState(0);

  const localMandi = form.local_mandi || latest.data?.local_mandi || "";
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const qty = n(form.quantity_q);
  const errors = validate(form);
  const valid = Object.keys(errors).length === 0;
  // The result on screen belongs to the inputs it was calculated from; flag it once they change.
  const formKey = JSON.stringify({ ...form, local_mandi: localMandi });
  const outdated = advice != null && ranWith !== formKey;
  const input = (k: keyof Form) => ({
    value: form[k],
    onChange: set(k),
    "aria-invalid": errors[k] ? true : undefined,
    className: `${inputCls} ${errors[k] ? "ring-2 ring-red/50" : ""}`,
  });

  async function run() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const key = formKey;
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
      if (res.ok) {
        setAdvice(res);
        setRanWith(key);
        setRuns((r) => r + 1);
      } else {
        setAdvice(null);
        setNotice(res.message ?? "No recommendation could be made from the prices available right now.");
      }
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      setError({ message: (e as Error).message, retry: status === 0 || status >= 500 });
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
  }

  return (
    <>
      <LargeTitle title="Smart Sell Advisor" hindi="बिक्री सलाह" subtitle="Compare every mandi on what you actually take home, then decide whether to sell now or wait." />

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        {/* Inputs: two columns on tablets, a sidebar column on wide screens */}
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
          className="grid content-start gap-4 md:grid-cols-2 xl:grid-cols-1"
        >
          <Card>
            <CardTitle title="Your harvest" />
            <div className="space-y-3.5">
              <Field label="Quantity (quintals)" hint="1 quintal = 100 kg" error={errors.quantity_q}>
                <input type="number" inputMode="decimal" min={0} {...input("quantity_q")} />
              </Field>
              <Field label="Your usual (local) mandi">
                <Select value={localMandi} onChange={(v) => setForm({ ...form, local_mandi: v })}>
                  {!latest.data && <option value="">{latest.loading ? "Loading mandis…" : "Nearest mandi (automatic)"}</option>}
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
              <Field label="Transport rate (₹ per quintal per km)" hint="Applied to the estimated road distance of each mandi" error={errors.transport_rate_per_q_km}>
                <input type="number" inputMode="decimal" min={0} step="0.1" {...input("transport_rate_per_q_km")} />
              </Field>
              <Field label="Actual transport to local mandi (₹, optional)" hint="If you know the exact fare, it replaces the estimate" error={errors.local_transport}>
                <input type="number" inputMode="decimal" min={0} placeholder="Estimate" {...input("local_transport")} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Handling (₹/q)" error={errors.handling_per_q}>
                  <input type="number" inputMode="decimal" min={0} {...input("handling_per_q")} />
                </Field>
                <Field label="Market fee (%)" error={errors.fee_pct}>
                  <input type="number" inputMode="decimal" min={0} {...input("fee_pct")} />
                </Field>
                <Field label="Weight loss (%/day)" error={errors.spoilage_pct_per_day}>
                  <input type="number" inputMode="decimal" min={0} step="0.1" placeholder={cropInfo ? `${cropInfo.spoilage_pct_per_day} (default)` : ""} {...input("spoilage_pct_per_day")} />
                </Field>
                <Field label="Storage (₹/q/day)" error={errors.storage_cost_per_q_day}>
                  <input type="number" inputMode="decimal" min={0} placeholder={cropInfo ? `${cropInfo.storage_cost_per_q_day} (default)` : ""} {...input("storage_cost_per_q_day")} />
                </Field>
              </div>
            </div>
          </Card>
          <button type="submit" className={`${btnPrimary} w-full md:col-span-2 xl:col-span-1`} disabled={!valid || busy}>
            <Sparkles className={`size-4 ${busy ? "animate-pulse" : ""}`} /> {busy ? "Calculating…" : advice ? "Update recommendation" : "Get recommendation"}
          </button>
          {!valid && <p className="-mt-2 text-center text-13 text-label-2 md:col-span-2 xl:col-span-1">Fix the highlighted field to continue.</p>}
          {latest.error && (
            <div className="md:col-span-2 xl:col-span-1">
              <ErrorBox message={`Couldn’t load the mandi list: ${latest.error}`} onRetry={latest.reload} />
            </div>
          )}
        </form>

        {/* Results */}
        <div className="min-w-0 space-y-5" aria-live="polite" aria-busy={busy}>
          {error && <ErrorBox message={error.message} onRetry={error.retry ? run : undefined} />}
          {notice && (
            <Card className="grid min-h-[240px] place-items-center text-center">
              <div className="max-w-md">
                <div className="mx-auto mb-3 grid size-14 place-items-center rounded-[16px] bg-orange/12 text-orange">
                  <CalendarClock className="size-7" />
                </div>
                <h3 className="text-20 font-semibold">No recommendation right now</h3>
                <p className="mt-1 text-15 text-label-2">{notice}</p>
                <p className="mt-2 text-13 text-label-3">Mandi prices refresh daily from AGMARKNET. Try again later or choose another crop.</p>
              </div>
            </Card>
          )}
          {!advice && !error && !notice && (
            <Card className="grid min-h-[320px] place-items-center text-center">
              <div className="max-w-sm">
                <div className="mx-auto mb-3 grid size-14 place-items-center rounded-[16px] bg-tint/12 text-tint">
                  <Sparkles className={`size-7 ${busy ? "animate-pulse" : ""}`} />
                </div>
                <h3 className="text-20 font-semibold">{busy ? "Comparing every mandi…" : "Ready when you are"}</h3>
                <p className="mt-1 text-15 text-label-2">
                  {busy ? "Checking today’s prices, transport and the weather." : "Enter your quantity and costs, then tap Get recommendation. Every number in the result shows how it was calculated."}
                </p>
              </div>
            </Card>
          )}
          {advice && outdated && !busy && (
            <div className="enter flex flex-wrap items-center justify-between gap-3 rounded-[14px] px-4 py-3 text-14" style={{ background: "color-mix(in srgb, var(--blue) 10%, transparent)" }}>
              <span>You changed your inputs. This result is for the previous values.</span>
              <button type="button" onClick={run} disabled={!valid} className={btnTinted}>
                <RefreshCw className="size-3.5" /> Update
              </button>
            </div>
          )}
          {advice && (
            <div key={runs} className={`enter space-y-5 transition-opacity duration-200 ${outdated || busy ? "opacity-50" : ""}`}>
              <AdviceResult a={advice} onSave={save} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function SaveButton({ onSave }: { onSave: () => Promise<void> }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  async function save() {
    setState("saving");
    try {
      await onSave();
      setState("saved");
    } catch {
      setState("error");
    }
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" className={btnTinted} onClick={save} disabled={state === "saving" || state === "saved"}>
        {state === "saved" ? <Check className="size-4" /> : <Bookmark className="size-4" />}
        {state === "saved" ? "Saved to Reports" : state === "saving" ? "Saving…" : state === "error" ? "Try saving again" : "Save to Reports"}
      </button>
      {state === "error" && (
        <span className="text-12 text-red" role="alert">
          Couldn’t save. Check your connection and try again.
        </span>
      )}
    </div>
  );
}

function AdviceResult({ a, onSave }: { a: Advice; onSave: () => Promise<void> }) {
  const decision = a.action === "WAIT" ? a.scenarios.find((s) => s.days === a.wait_days)!.expected : a.best_now;
  const losing = a.estimated_net.net < 0;
  return (
    <>
      <HeroCard>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-lg">
            <div className="flex flex-wrap items-center gap-2 text-13 text-white/70">
              Recommendation · prices as of {longDate(a.reference_date)}
            </div>
            <h2 className="mt-2 text-22 font-bold leading-tight sm:text-28">{a.headline}</h2>
            <div className="mt-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-13 font-medium">Confidence: {a.confidence}</div>
          </div>
          <div className="sm:text-right">
            <div className="text-13 text-white/70">{losing ? "Estimated loss at the best mandi" : "Estimated net revenue"}</div>
            <div className={`text-32 font-bold sm:text-40 ${losing ? "text-[#FFB4A8]" : "text-[#F2BB3C]"}`}>{inr(a.estimated_net.net)}</div>
            {a.action === "WAIT" && (
              <div className="text-13 text-white/70">
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
              <Row key={r} icon={<CircleCheck className="size-5 shrink-0 text-tint" />} label={<span className="text-14">{r}</span>} />
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
        {/* Phones: one row per mandi */}
        <div className="md:hidden">
          {a.options.map((o) => {
            const isBest = o.market_id === a.best_now.market_id;
            const diff = a.local ? o.net - a.local.net : null;
            return (
              <div key={o.market_id} className={`flex items-start gap-3 border-t border-separator px-5 py-3 ${isBest ? "bg-tint/8" : ""} ${o.stale ? "opacity-50" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-15 font-medium">
                    {o.market_name.replace(" APMC", "")}
                    {isBest && <Badge>Best</Badge>}
                    {o.is_local && <Badge color="var(--label-2)">Local</Badge>}
                    {o.stale && <Badge color="var(--red)">Stale</Badge>}
                  </div>
                  <div className="text-12 text-label-2">
                    {inr(o.price_per_q)}/q · gross {inr(o.gross)} · transport −{inr(o.transport)} · other −{inr(o.handling + o.market_fee)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-17 font-semibold tabular-nums">{inr(o.net)}</div>
                  {diff != null && !o.is_local && (
                    <div className="text-12 tabular-nums" style={{ color: diff >= 0 ? "var(--green)" : "var(--red)" }}>
                      {diff >= 0 ? "+" : "−"}
                      {inr(Math.abs(diff))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[680px] text-14">
            <thead>
              <tr className="text-left text-12 text-label-2">
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
                      <div className="text-12 text-label-2">{o.transport_basis}</div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{inr(o.price_per_q)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-label-2">{inr(o.gross)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-label-2">−{inr(o.transport)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-label-2">−{inr(o.handling + o.market_fee)}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{inr(o.net)}</td>
                    {a.local && o.market_id !== a.local.market_id ? (
                      <td className="px-5 py-3 text-right tabular-nums" style={{ color: o.net - a.local.net >= 0 ? "var(--green)" : "var(--red)" }}>
                        {o.net - a.local.net >= 0 ? "+" : "−"}
                        {inr(Math.abs(o.net - a.local.net))}
                      </td>
                    ) : (
                      <td className="px-5 py-3 text-right text-label-3">—</td>
                    )}
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
              <div className="text-13 font-medium text-label-2">Sell today</div>
              <div className="mt-1 text-22 font-semibold tabular-nums">{inr(a.best_now.net)}</div>
              <div className="text-12 text-label-2">at {inr(a.best_now.price_per_q)}/q</div>
            </div>
            {a.scenarios.map((s) => {
              const better = s.expected.net > a.best_now.net;
              return (
                <div key={s.days} className={`rounded-[14px] p-4 ${a.action === "WAIT" && a.wait_days === s.days ? "bg-tint/10 ring-1 ring-tint/40" : "bg-surface-2"}`}>
                  <div className="text-13 font-medium text-label-2">Wait {s.days} days</div>
                  <div className="mt-1 text-22 font-semibold tabular-nums" style={{ color: better ? "var(--green)" : undefined }}>
                    {inr(s.expected.net)}
                  </div>
                  <div className="text-12 text-label-2">
                    Range {inr(s.net_low)} – {inr(s.net_high)}
                  </div>
                  <div className="mt-1 text-12 text-label-2">
                    ~{inr(s.price_expected)}/q · −{s.loss_pct}% weight{s.expected.storage > 0 ? ` · −${inr(s.expected.storage)} storage` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {a.trend && (
          <p className="mt-3 text-13 text-label-2">
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
        <SaveButton onSave={onSave} />
      </div>
    </>
  );
}
