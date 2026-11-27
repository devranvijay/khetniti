"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, ChartLine, CloudSun, FileText, History, House, MapPin, Monitor, Moon, Sun } from "lucide-react";
import { useApp, type ThemePref } from "./AppContext";
import { BrandLogo } from "./Brand";
import { Segmented, Select } from "./ui";

const NAV = [
  { href: "/", label: "Dashboard", short: "Home", icon: House, color: "#1E6B4B" },
  { href: "/harvest", label: "Harvest Intelligence", short: "Harvest", icon: CloudSun, color: "#007AFF" },
  { href: "/mandi", label: "Mandi Intelligence", short: "Mandi", icon: ChartLine, color: "#E9AC27" },
  { href: "/advisor", label: "Smart Sell Advisor", short: "Sell", icon: Calculator, color: "#34C759" },
  { href: "/replay", label: "Decision Replay", short: "Replay", icon: History, color: "#5856D6" },
  { href: "/reports", label: "Reports & Insights", short: "Reports", icon: FileText, color: "#8E8E93" },
];

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

export function ThemeSwitch({ withLabels = false }: { withLabels?: boolean }) {
  const { theme, setTheme } = useApp();
  const opts: { value: ThemePref; icon: typeof Sun; text: string }[] = [
    { value: "system", icon: Monitor, text: "System" },
    { value: "light", icon: Sun, text: "Light" },
    { value: "dark", icon: Moon, text: "Dark" },
  ];
  return (
    <Segmented
      label="Appearance"
      size="sm"
      full={withLabels}
      value={theme}
      onChange={setTheme}
      options={opts.map(({ value, icon: Icon, text }) => ({
        value,
        title: `${text} appearance`,
        label: (
          <>
            <Icon className="size-3.5" />
            {withLabels && text}
          </>
        ),
      }))}
    />
  );
}

function CropAndPlace() {
  const { meta, crop, setCrop, location, setLocation } = useApp();
  const crops = meta?.crops ?? [
    { id: "tomato", name: "Tomato", hindi: "टमाटर" },
    { id: "onion", name: "Onion", hindi: "प्याज" },
    { id: "potato", name: "Potato", hindi: "आलू" },
  ];
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-2.5">
      <div className="w-full sm:w-auto">
        <Segmented
          label="Crop"
          value={crop}
          onChange={setCrop}
          full
          options={crops.map((c) => ({
            value: c.id,
            label: (
              <>
                {c.name} <span className="font-hindi text-label-2">{c.hindi}</span>
              </>
            ),
          }))}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <MapPin className="size-4 shrink-0 text-tint" />
        <Select value={location} onChange={setLocation} className="w-full sm:w-44">
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
    <div className="flex min-h-dvh">
      {/* macOS-style translucent sidebar (desktop) */}
      <aside className="no-print sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-separator bg-sidebar px-3 pb-4 pt-5 backdrop-blur-2xl backdrop-saturate-150 lg:flex">
        <Link href="/" className="mb-6 block px-2" aria-label="KHETNITI home">
          <div className="flex flex-col items-start">
            <BrandLogo variant="lockup" className="h-[38px]" priority />
            <BrandLogo variant="hindi" className="-mt-0.5 h-[16px] pl-[33px] opacity-85" />
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
        <div className="mt-auto space-y-3 px-1">
          <div>
            <div className="px-1.5 pb-1.5 text-[11px] font-semibold text-label-3">Appearance</div>
            <ThemeSwitch withLabels />
          </div>
          <p className="px-1.5 text-[11px] leading-relaxed text-label-3">
            Smart Decisions. Better Harvests.
            <br />
            Estimates only — prices and profits are never guaranteed.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Translucent toolbar */}
        <div className="no-print sticky top-0 z-20 border-b border-separator bg-material pt-[env(safe-area-inset-top)] backdrop-blur-2xl backdrop-saturate-150">
          <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 md:px-8">
            <Link href="/" className="flex min-w-0 items-center gap-2 lg:hidden" aria-label="KHETNITI home">
              <BrandLogo variant="mark" className="h-7" priority />
              <span className="truncate text-[15px] font-semibold">{current?.label ?? "KHETNITI"}</span>
            </Link>
            <div className="ml-auto lg:hidden">
              <ThemeSwitch />
            </div>
            <div className="w-full sm:w-auto lg:flex-1">
              <CropAndPlace />
            </div>
          </div>
        </div>

        {/* Print header */}
        <div className="hidden px-8 pt-6 print:block">
          <BrandLogo variant="horizontal" tone="light" className="h-12" />
        </div>

        <main className="print-full mx-auto w-full max-w-[1240px] flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 md:px-8 md:pt-8 lg:pb-12">
          {metaError && (
            <div className="mb-4 rounded-[12px] p-3 text-[13px] text-red" style={{ background: "color-mix(in srgb, var(--red) 10%, transparent)" }}>
              {metaError}
            </div>
          )}
          {children}
        </main>
      </div>

      {/* iOS-style tab bar (phones and tablets) */}
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
