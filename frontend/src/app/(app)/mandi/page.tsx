"use client";

import { useMemo, useState } from "react";
import { useApi, useApp } from "@/components/AppContext";
import { PriceBand, PriceLines, SERIES } from "@/components/charts";
import { Badge, Card, CardTitle, ErrorBox, LargeTitle, Loading, ProvenanceBadge, Segmented, SourceFootnote } from "@/components/ui";
import type { History, LatestPrices } from "@/lib/api";
import { inr, num, pct, shortDate } from "@/lib/format";

const RANGES = [
  { value: 30, label: "1M" },
  { value: 90, label: "3M" },
  { value: 180, label: "6M" },
  { value: 365, label: "1Y" },
];

export default function MandiPage() {
  const { crop, location, meta } = useApp();
  const latest = useApi<LatestPrices>(`/api/prices/latest?crop=${crop}&location=${location}`);
  const [days, setDays] = useState(90);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [focus, setFocus] = useState<string | null>(null);

  const markets = latest.data?.markets ?? [];
  const allIds = markets.map((m) => m.market_id);
  const selected = picked[crop] ?? allIds.slice(0, 4);
  const focusId = focus && allIds.includes(focus) ? focus : (latest.data?.local_mandi ?? allIds[0]);

  const history = useApi<History>(latest.data ? `/api/prices/history?crop=${crop}&days=${days}&markets=${allIds.join(",")}` : null);
  const idsKey = allIds.join(",");
  const colorOf = useMemo(() => {
    const idx = new Map(idsKey.split(",").map((id, i) => [id, SERIES[i % SERIES.length]]));
    return (id: string) => idx.get(id) ?? "var(--label-2)";
  }, [idsKey]);

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setPicked({ ...picked, [crop]: next });
  };
  const cropName = meta?.crops.find((c) => c.id === crop)?.name ?? crop;
  const shownSeries = history.data ? Object.fromEntries(Object.entries(history.data.series).filter(([k]) => selected.includes(k))) : {};

  return (
    <>
      <LargeTitle title="Mandi Intelligence" hindi="मंडी भाव" subtitle={`${cropName} prices across mandis around Nashik. All prices in ₹ per quintal.`} />
      {latest.error && <ErrorBox message={latest.error} onRetry={latest.reload} />}
      {latest.loading && !latest.data && (
        <Card>
          <Loading rows={5} />
        </Card>
      )}

      {latest.data && (
        <div className="space-y-6">
          <Card pad={false}>
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-2 pt-5">
              <div>
                <h3 className="text-17 font-semibold">Latest prices</h3>
                <p className="text-13 text-label-2">Sorted by distance from your farm. Tap a row to inspect it below.</p>
              </div>
              <ProvenanceBadge p={latest.data.provenance} />
            </div>
            {/* Phones: grouped list */}
            <div className="md:hidden">
              {markets.map((m) => (
                <button
                  key={m.market_id}
                  type="button"
                  aria-pressed={m.market_id === focusId}
                  onClick={() => setFocus(m.market_id)}
                  className={`highlight flex w-full items-start gap-3 border-t border-separator px-5 py-3 text-left ${m.market_id === focusId ? "bg-tint/8" : ""}`}
                >
                  <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: colorOf(m.market_id) }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 text-15 font-medium">
                      {m.market_name.replace(" APMC", "")}
                      {m.market_id === latest.data!.local_mandi && <Badge>Local</Badge>}
                      {m.stale && <Badge color="var(--red)">{m.age_days}d old</Badge>}
                    </span>
                    <span className="block text-12 text-label-2">
                      {inr(m.min_price)} – {inr(m.max_price)} · {m.distance_km} km{m.arrivals_tonnes != null ? ` · ${num(m.arrivals_tonnes)} t` : ""} · {shortDate(m.date)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-17 font-semibold tabular-nums">{inr(m.modal_price)}</span>
                    <span className="block text-12 tabular-nums" style={{ color: m.change_7d_pct == null ? undefined : m.change_7d_pct >= 0 ? "var(--green)" : "var(--red)" }}>
                      {pct(m.change_7d_pct)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            {/* Tablets and up: full table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-14">
                <thead>
                  <tr className="text-left text-12 text-label-2">
                    <th className="px-5 py-2 font-medium">Mandi</th>
                    <th className="px-3 py-2 text-right font-medium">Min</th>
                    <th className="px-3 py-2 text-right font-medium">Modal</th>
                    <th className="px-3 py-2 text-right font-medium">Max</th>
                    <th className="px-3 py-2 text-right font-medium">7-day</th>
                    <th className="px-3 py-2 text-right font-medium">Arrivals</th>
                    <th className="px-3 py-2 text-right font-medium">Distance</th>
                    <th className="px-5 py-2 text-right font-medium">Price date</th>
                  </tr>
                </thead>
                <tbody>
                  {markets.map((m) => (
                    <tr
                      key={m.market_id}
                      onClick={() => setFocus(m.market_id)}
                      className={`highlight cursor-pointer border-t border-separator hover:bg-fill ${m.market_id === focusId ? "bg-tint/8" : ""}`}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ background: colorOf(m.market_id) }} />
                          <span className="font-medium">{m.market_name}</span>
                          {m.market_id === latest.data!.local_mandi && <Badge>Local</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-label-2">{inr(m.min_price)}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">{inr(m.modal_price)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-label-2">{inr(m.max_price)}</td>
                      <td className="px-3 py-3 text-right tabular-nums" style={{ color: m.change_7d_pct == null ? undefined : m.change_7d_pct >= 0 ? "var(--green)" : "var(--red)" }}>
                        {pct(m.change_7d_pct)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-label-2">{m.arrivals_tonnes != null ? `${num(m.arrivals_tonnes)} t` : "—"}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-label-2">{m.distance_km} km</td>
                      <td className="px-5 py-3 text-right">
                        <span className="tabular-nums text-label-2">{shortDate(m.date)}</span>
                        {m.stale && (
                          <span className="ml-2">
                            <Badge color="var(--red)">{m.age_days}d old</Badge>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 pb-5">
              <SourceFootnote p={latest.data.provenance} extra="Distances are estimated (straight line × 1.3)" />
            </div>
          </Card>

          <Card>
            <CardTitle title="Price history" subtitle="Modal price trend by mandi">
              <Segmented label="Range" value={days} onChange={setDays} options={RANGES} size="sm" />
            </CardTitle>
            <div className="mb-4 flex flex-wrap gap-2">
              {markets.map((m) => {
                const on = selected.includes(m.market_id);
                return (
                  <button
                    key={m.market_id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(m.market_id)}
                    className={`pressable inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-13 font-medium ${on ? "bg-surface-2 text-label ring-1 ring-separator" : "text-label-3 hover:text-label-2"}`}
                  >
                    <span className="size-2 rounded-full" style={{ background: on ? colorOf(m.market_id) : "var(--label-3)" }} />
                    {m.market_name.replace(" APMC", "")}
                  </button>
                );
              })}
            </div>
            {history.error && <ErrorBox message={history.error} onRetry={history.reload} />}
            {history.loading && !history.data && <Loading rows={6} />}
            {history.data && <PriceLines series={shownSeries} names={history.data.markets} colorOf={colorOf} />}
            {history.data && <SourceFootnote p={history.data.provenance} />}
          </Card>

          {history.data && focusId && history.data.series[focusId] && (
            <Card>
              <CardTitle
                title={`${history.data.markets[focusId]} · price range and arrivals`}
                subtitle="Gold band = daily minimum to maximum price; line = modal price; grey bars = arrivals in tonnes"
              />
              <PriceBand points={history.data.series[focusId]} />
            </Card>
          )}
        </div>
      )}
    </>
  );
}
