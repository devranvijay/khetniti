"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartLine, Calculator, CloudSun, FileText, History, House, MapPin } from "lucide-react";
import { useApp } from "./AppContext";
import { Segmented, Select } from "./ui";

const NAV = [
  { href: "/", label: "Dashboard", short: "Home", icon: House, color: "#1E6B4B" },
  { href: "/harvest", label: "Harvest Intelligence", short: "Harvest", icon: CloudSun, color: "#007AFF" },
  { href: "/mandi", label: "Mandi Intelligence", short: "Mandi", icon: ChartLine, color: "#E9AC27" },
  { href: "/advisor", label: "Smart Sell Advisor", short: "Sell", icon: Calculator, color: "#34C759" },
  { href: "/replay", label: "Decision Replay", short: "Replay", icon: History, color: "#5856D6" },
  { href: "/reports", label: "Reports & Insights", short: "Reports", icon: FileText, color: "#8E8E93" },
];

export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <rect width="100" height="100" rx="23" fill="#0D3B2B" />
      <line x1="35" y1="52" x2="68" y2="29" stroke="#E9AC27" strokeWidth="9" strokeLinecap="round" />
      <circle cx="68" cy="29" r="8.5" fill="#E9AC27" />
      <line x1="35" y1="23" x2="35" y2="77" stroke="#F6EEDC" strokeWidth="10" strokeLinecap="round" />
      <line x1="35" y1="49" x2="65" y2="71" stroke="#F6EEDC" strokeWidth="9" strokeLinecap="round" />
      <circle cx="67" cy="72" r="6.5" fill="#0D3B2B" stroke="#F6EEDC" strokeWidth="5" />
    </svg>
  );
}

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

function Toolbar() {
  const { meta, crop, setCrop, location, setLocation } = useApp();
  const crops = meta?.crops ?? [
    { id: "tomato", name: "Tomato", hindi: "टमाटर" },
    { id: "onion", name: "Onion", hindi: "प्याज" },
    { id: "potato", name: "Potato", hindi: "आलू" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Segmented
        label="Crop"
        value={crop}
        onChange={setCrop}
        options={crops.map((c) => ({
          value: c.id,
          label: (
            <>
              {c.name} <span className="font-hindi text-label-2">{c.hindi}</span>
            </>
          ),
        }))}
      />
      <div className="flex items-center gap-1.5">
        <MapPin className="size-4 text-tint" />
        <Select value={location} onChange={setLocation} className="w-44">
          {(meta?.locations ?? [{ id: "nashik", name: "Nashik" }]).map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} taluka
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { metaError } = useApp();
  const current = NAV.find((n) => isActive(pathname, n.href));

  return (
    <div className="flex min-h-screen">
      {/* macOS-style translucent sidebar */}
      <aside className="no-print sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-separator bg-sidebar px-3 pb-4 pt-5 backdrop-blur-2xl backdrop-saturate-150 lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-2.5 px-2">
          <LogoMark className="size-9" />
          <div className="leading-tight">
            <div className="font-brand text-[17px] tracking-[0.1em] text-label">
              <span className="font-bold">KHET</span>NITI
            </div>
            <div className="font-hindi text-[12px] text-label-2">खेतनीति</div>
          </div>
        </Link>
        <div className="px-2.5 pb-1 text-[11px] font-semibold text-label-3">Decide</div>
        <nav className="space-y-0.5">
          {NAV.map(({ href, label, icon: Icon, color }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 rounded-[8px] px-2 py-[7px] text-[14px] transition-colors ${
                  active ? "bg-tint text-on-tint" : "text-label hover:bg-fill"
                }`}
              >
                <span className="grid size-6 place-items-center rounded-[6px]" style={{ background: active ? "rgba(255,255,255,0.2)" : color }}>
                  <Icon className="size-[15px] text-white" strokeWidth={2.2} />
                </span>
                <span className={active ? "font-semibold" : "font-medium"}>{label}</span>
              </Link>
            );
          })}
        </nav>
        <p className="mt-auto px-2.5 text-[11px] leading-relaxed text-label-3">
          Smart Decisions. Better Harvests.
          <br />
          Estimates only — prices and profits are never guaranteed.
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Translucent toolbar */}
        <div className="no-print sticky top-0 z-20 border-b border-separator bg-material backdrop-blur-2xl backdrop-saturate-150">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 md:px-8">
            <div className="flex items-center gap-2 lg:hidden">
              <LogoMark className="size-7" />
              <span className="text-[15px] font-semibold">{current?.label ?? "KHETNITI"}</span>
            </div>
            <Toolbar />
          </div>
        </div>

        <main className="print-full mx-auto w-full max-w-[1240px] flex-1 px-4 pb-28 pt-6 md:px-8 md:pt-8 lg:pb-12">
          {metaError && (
            <div className="mb-4 rounded-[12px] p-3 text-[13px] text-red" style={{ background: "color-mix(in srgb, var(--red) 10%, transparent)" }}>
              {metaError}
            </div>
          )}
          {children}
        </main>
      </div>

      {/* iOS tab bar on small screens */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-separator bg-material pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl backdrop-saturate-150 lg:hidden">
        {NAV.map(({ href, short, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 pb-1.5 pt-2 text-[10px] font-medium ${active ? "text-tint" : "text-label-2"}`}>
              <Icon className="size-[22px]" strokeWidth={active ? 2.3 : 1.8} />
              {short}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
