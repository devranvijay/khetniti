"use client";

import { Calculator, Database, History, Printer, Trash2, TrendingUp } from "lucide-react";
import { useApi } from "@/components/AppContext";
import { Badge, btnTinted, Card, ErrorBox, IconTile, LargeTitle, List, Loading, Row, SectionHeader, Stat } from "@/components/ui";
import { api, type Report } from "@/lib/api";
import { dateTime, inr, longDate } from "@/lib/format";

type Sources = {
  prices: { crop: string; real: { dates: number; first: string; last: string; fetched_at: string }; demo: { dates: number; first: string; last: string } }[];
  live_api_configured: boolean;
  catalogue: { name: string; use: string; status: string }[];
};

const KIND = {
  advice: { label: "Sell advice", color: "#34C759", icon: Calculator },
  replay: { label: "Replay", color: "#5856D6", icon: History },
  backtest: { label: "Backtest", color: "#007AFF", icon: TrendingUp },
} as const;

const modeBadge = (m: string) =>
  m === "demo" ? <Badge color="var(--orange)">DEMO</Badge> : m === "live" ? <Badge color="var(--green)">LIVE</Badge> : <Badge color="var(--blue)">HISTORICAL</Badge>;

export default function ReportsPage() {
  const reports = useApi<Report[]>("/api/reports");
  const sources = useApi<Sources>("/api/sources");

  async function remove(id: number) {
    await api(`/api/reports/${id}`, { method: "DELETE" });
    reports.reload();
  }

  const list = reports.data ?? [];
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
          {reports.error && <ErrorBox message={reports.error} onRetry={reports.reload} />}
          {reports.loading && !reports.data && (
            <Card>
              <Loading />
            </Card>
          )}
          {reports.data && list.length === 0 && (
            <Card className="text-center text-[15px] text-label-2">Nothing saved yet. Use “Save to Reports” in the Smart Sell Advisor or Decision Replay.</Card>
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
                        <button aria-label="Delete" onClick={() => remove(r.id)} className="no-print text-label-3 transition hover:text-red">
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
                      <IconTile color={s.status.startsWith("active") || s.status === "configured" ? "#34C759" : s.name.includes("demo") ? "#FF9500" : "#8E8E93"}>
                        <Database className="size-4" />
                      </IconTile>
                    }
                    label={s.name}
                    sub={s.use}
                    value={<span className="text-[13px]">{s.status}</span>}
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
                    sub={
                      p.real.dates > 0
                        ? `Real: ${p.real.dates} days, ${longDate(p.real.first)} – ${longDate(p.real.last)}`
                        : `Demo: ${p.demo.dates} days, ${p.demo.first ? longDate(p.demo.first) : "—"} – ${p.demo.last ? longDate(p.demo.last) : "—"}`
                    }
                    value={p.real.dates > 0 ? <Badge color="var(--blue)">REAL</Badge> : <Badge color="var(--orange)">DEMO ONLY</Badge>}
                  />
                ))}
              </List>
            )}
            {sources.data && !sources.data.live_api_configured && (
              <p className="mt-2 px-1 text-[12px] text-label-2">
                Live AGMARKNET prices need a data.gov.in API key set as DATA_GOV_IN_API_KEY on the server. Until then, prices are clearly marked as demo data.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
