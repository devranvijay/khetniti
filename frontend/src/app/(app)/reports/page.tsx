"use client";

import { useEffect, useRef, useState } from "react";
import { Calculator, Database, History, Printer, Trash2, TrendingUp } from "lucide-react";
import { useApi } from "@/components/AppContext";
import { Badge, btnTinted, Card, ErrorBox, IconTile, LargeTitle, List, Loading, Row, SectionHeader, Stat } from "@/components/ui";
import { api, type Report } from "@/lib/api";
import { dateTime, inr, longDate } from "@/lib/format";

type Sources = {
  prices: { crop: string; real: { dates: number; first: string; last: string; fetched_at: string } }[];
  live_api_configured: boolean;
  catalogue: { name: string; use: string; status: string }[];
};

const KIND = {
  advice: { label: "Sell advice", color: "#34C759", icon: Calculator },
  replay: { label: "Replay", color: "#5856D6", icon: History },
  backtest: { label: "Backtest", color: "#007AFF", icon: TrendingUp },
} as const;

/** How long a deleted report can be brought back before the delete is sent to the server. */
const UNDO_MS = 5000;

// keepalive lets the request finish even when it is sent as the tab closes.
const deleteReport = (id: number) => api(`/api/reports/${id}`, { method: "DELETE", keepalive: true });

const modeBadge = (m: string) =>
  m === "live" ? <Badge color="var(--green)">LIVE</Badge> : <Badge color="var(--blue)">HISTORICAL</Badge>;

export default function ReportsPage() {
  const reports = useApi<Report[]>("/api/reports");
  const sources = useApi<Sources>("/api/sources");

  // Deleting is forgiving: the row leaves at once, an Undo toast appears, and the delete is only
  // sent once the undo window closes. If it fails, the row comes back with the reason.
  const [hidden, setHidden] = useState<number[]>([]);
  const [toast, setToast] = useState<{ id: number; title: string; open: boolean } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const timers = useRef(new Map<number, number>());
  const reload = reports.reload;

  useEffect(() => {
    const pending = timers.current;
    // Leaving the page (navigating, reloading or closing the tab) closes the undo window: carry out
    // the pending deletes. A failure here has no screen left to show on; the report simply stays
    // and appears again on the next visit.
    const flush = () => {
      pending.forEach((timer, id) => {
        clearTimeout(timer);
        deleteReport(id).catch(() => undefined);
      });
      pending.clear();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  async function commit(id: number) {
    timers.current.delete(id);
    setToast((t) => (t && t.id === id ? { ...t, open: false } : t));
    try {
      await deleteReport(id);
      reload();
    } catch (e) {
      setHidden((h) => h.filter((x) => x !== id));
      setDeleteError(`Could not delete the report: ${(e as Error).message}`);
    }
  }

  function remove(r: Report) {
    // Only one Undo is offered at a time: a delete still waiting behind the current toast is settled now.
    if (toast && timers.current.has(toast.id)) {
      clearTimeout(timers.current.get(toast.id));
      void commit(toast.id);
    }
    setDeleteError(null);
    setHidden((h) => [...h, r.id]);
    setToast({ id: r.id, title: r.headline, open: true });
    timers.current.set(r.id, window.setTimeout(() => commit(r.id), UNDO_MS));
  }

  function undo() {
    if (!toast) return;
    clearTimeout(timers.current.get(toast.id));
    timers.current.delete(toast.id);
    setHidden((h) => h.filter((x) => x !== toast.id));
    setToast({ ...toast, open: false });
  }

  const list = (reports.data ?? []).filter((r) => !hidden.includes(r.id));
  const advice = list.filter((r) => r.kind === "advice");
  const replays = list.filter((r) => r.kind === "replay");
  const good = replays.filter((r) => r.payload.verdict === "Good call").length;
  const totalNet = advice.reduce((s, r) => s + Number((r.payload.estimated_net as { net: number } | undefined)?.net ?? 0), 0);

  return (
    <>
      <LargeTitle title="Reports & Insights" hindi="रिपोर्ट" subtitle="Decisions you saved, how replays scored, and where every number comes from.">
        <button className={`${btnTinted} no-print`} onClick={() => window.print()}>
          <Printer className="size-4" /> Print or save as PDF
        </button>
      </LargeTitle>

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <Stat label="Saved decisions" value={list.length} sub={`${advice.length} advice · ${replays.length} replays`} />
          </Card>
          <Card>
            <Stat label="Estimated net in saved advice" value={inr(totalNet)} sub="Sum of estimates, not realised income" tone="tint" />
          </Card>
          <Card>
            <Stat label="Replay good-call rate" value={replays.length ? `${Math.round((good / replays.length) * 100)}%` : "—"} sub={`${good} of ${replays.length} saved replays`} tone="gold" />
          </Card>
        </div>

        <div>
          <SectionHeader title="Decision log" />
          {deleteError && <ErrorBox message={deleteError} />}
          {reports.error && <ErrorBox message={reports.error} onRetry={reports.reload} />}
          {reports.loading && !reports.data && (
            <Card>
              <Loading />
            </Card>
          )}
          {reports.data && list.length === 0 && (
            <Card className="text-center text-15 text-label-2">Nothing saved yet. Use “Save to Reports” in the Smart Sell Advisor or Decision Replay.</Card>
          )}
          {list.length > 0 && (
            <List>
              {list.map((r) => {
                const k = KIND[r.kind];
                const Icon = k.icon;
                const p = r.payload as Record<string, unknown>;
                const amount =
                  r.kind === "advice"
                    ? inr((p.estimated_net as { net: number }).net)
                    : r.kind === "replay"
                      ? inr(Number(p.recommended_net))
                      : `${p.good_call_rate}%`;
                return (
                  <Row
                    key={r.id}
                    icon={
                      <IconTile color={k.color}>
                        <Icon className="size-4" />
                      </IconTile>
                    }
                    label={<span className="font-medium">{r.headline}</span>}
                    sub={
                      <span className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {k.label} · {r.crop} · {r.location} · {dateTime(r.created_at)} {modeBadge(r.data_mode)}
                      </span>
                    }
                    value={
                      <span className="flex items-center gap-3">
                        <span className="font-semibold text-label">{amount}</span>
                        <button type="button" aria-label="Delete report" onClick={() => remove(r)} className="pressable no-print -m-2.5 rounded-full p-2.5 text-label-3 hover:text-red">
                          <Trash2 className="size-4" />
                        </button>
                      </span>
                    }
                  />
                );
              })}
            </List>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <SectionHeader title="Data sources" />
            {sources.error && <ErrorBox message={sources.error} onRetry={sources.reload} />}
            {sources.data && (
              <List>
                {sources.data.catalogue.map((s) => (
                  <Row
                    key={s.name}
                    icon={
                      <IconTile color={s.status.startsWith("active") || s.status === "configured" ? "#34C759" : "#8E8E93"}>
                        <Database className="size-4" />
                      </IconTile>
                    }
                    label={s.name}
                    sub={s.use}
                    value={<span className="text-13">{s.status}</span>}
                  />
                ))}
              </List>
            )}
          </div>
          <div>
            <SectionHeader title="Price data loaded" />
            {sources.data && (
              <List>
                {sources.data.prices.map((p) => (
                  <Row
                    key={p.crop}
                    label={<span className="capitalize">{p.crop}</span>}
                    sub={p.real.dates > 0 ? `${p.real.dates} days, ${longDate(p.real.first)} – ${longDate(p.real.last)}` : "No prices loaded yet"}
                    value={p.real.dates > 0 ? <Badge color="var(--blue)">REAL</Badge> : <Badge color="var(--red)">NO DATA</Badge>}
                  />
                ))}
              </List>
            )}
            {sources.data && !sources.data.live_api_configured && (
              <p className="mt-2 px-1 text-12 text-label-2">
                Daily automatic prices need a data.gov.in API key set as DATA_GOV_IN_API_KEY on the server. Until then, prices come from AGMARKNET CSV imports and stop at the last imported date.
              </p>
            )}
          </div>
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        data-open={toast?.open ?? false}
        inert={!toast?.open}
        className="toast material-float no-print fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex w-[min(28rem,calc(100%-2rem))] items-center gap-3 rounded-full py-1.5 pl-5 pr-1.5 lg:bottom-8"
      >
        <Trash2 className="size-4 shrink-0 text-label-2" />
        <span className="min-w-0 flex-1 truncate text-15">Deleted “{toast?.title}”</span>
        <button type="button" onClick={undo} className="pressable min-h-11 rounded-full px-4 text-15 font-semibold text-tint hover:bg-fill">
          Undo
        </button>
      </div>
    </>
  );
}
