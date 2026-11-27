"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Calculator, ChartLine, CloudSun, FileText, History, House, MapPin, Monitor, Moon, Sun } from "lucide-react";
import { useApp, type ThemePref } from "./AppContext";
import { BrandLogo } from "./Brand";
import { ErrorBox, Segmented, Select } from "./ui";
import { useTrackSelect } from "./useTrackSelect";

const NAV = [
  { href: "/dashboard", label: "Dashboard", short: "Home", icon: House, color: "#1E6B4B" },
  { href: "/harvest", label: "Harvest Intelligence", short: "Harvest", icon: CloudSun, color: "#007AFF" },
  { href: "/mandi", label: "Mandi Intelligence", short: "Mandi", icon: ChartLine, color: "#E9AC27" },
  { href: "/advisor", label: "Smart Sell Advisor", short: "Sell", icon: Calculator, color: "#34C759" },
  { href: "/replay", label: "Decision Replay", short: "Replay", icon: History, color: "#5856D6" },
  { href: "/reports", label: "Reports & Insights", short: "Reports", icon: FileText, color: "#8E8E93" },
];

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** Sidebar rows are a fixed height so the selection pill can slide between them. */
const NAV_ROW_PX = 36;
const NAV_GAP_PX = 2;

/** True once the page has scrolled, so bars show their edge only when content is underneath. */
function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 2);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return scrolled;
}

/**
 * iOS 26-style floating tab bar: a glass capsule whose selection lens slides on a spring.
 * Press and drag the lens across tabs; release to go. Keyboard users Tab between plain links.
 */
function TabBar({ pathname }: { pathname: string }) {
  const router = useRouter();
  const index = NAV.findIndex((n) => isActive(pathname, n.href));
  const { shown, pressed, track, onClickCapture } = useTrackSelect(NAV.length, index, (i) => router.push(NAV[i].href));
  return (
    <nav aria-label="Sections" className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(env(safe-area-inset-bottom),12px)] lg:hidden">
      <div
        {...track}
        className="material-float pointer-events-auto relative mx-auto grid max-w-[520px] touch-pan-y select-none grid-cols-6 rounded-full p-1"
      >
        {shown >= 0 && (
          <span
            aria-hidden
            className="slide absolute inset-y-1 left-1 rounded-full bg-fill-strong"
            style={{ width: "calc((100% - 8px) / 6)", transform: `translateX(${shown * 100}%) scale(${pressed ? 1.08 : 1})` }}
          />
        )}
        {NAV.map(({ href, short, icon: Icon }, i) => {
          const lit = i === shown;
          return (
            <Link
              key={href}
              href={href}
              aria-current={i === index ? "page" : undefined}
              onClickCapture={onClickCapture}
              draggable={false}
              className={`relative flex flex-col items-center gap-0.5 rounded-full pb-1.5 pt-2 text-10 font-medium transition-colors duration-200 [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] ${lit ? "text-tint" : "text-label"}`}
            >
              <Icon className="size-[22px]" strokeWidth={lit ? 2.3 : 1.8} />
              {short}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

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
  const { metaError, retryMeta } = useApp();
  const activeIndex = NAV.findIndex((n) => isActive(pathname, n.href));
  const current = NAV[activeIndex];
  const scrolled = useScrolled();

  return (
    <div className="flex min-h-dvh">
      {/* macOS-style translucent sidebar (desktop): the heaviest material, it carries structure */}
      <aside className="no-print material-sidebar sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-separator px-3 pb-4 pt-5 lg:flex">
        <Link href="/" className="mb-6 block px-2" aria-label="KHETNITI home page">
          <div className="flex flex-col items-start">
            <BrandLogo variant="lockup" className="h-[38px]" priority />
            <BrandLogo variant="hindi" className="-mt-0.5 h-[16px] pl-[33px] opacity-85" />
          </div>
        </Link>
        <div className="px-2.5 pb-1 text-11 font-semibold text-label-3">Decide</div>
        <nav aria-label="Sections" className="relative flex flex-col" style={{ gap: NAV_GAP_PX }}>
          {activeIndex >= 0 && (
            <span
              aria-hidden
              className="slide absolute inset-x-0 top-0 rounded-[8px] bg-tint"
              style={{ height: NAV_ROW_PX, transform: `translateY(${activeIndex * (NAV_ROW_PX + NAV_GAP_PX)}px)` }}
            />
          )}
          {NAV.map(({ href, label, icon: Icon, color }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                style={{ height: NAV_ROW_PX }}
                className={`relative flex items-center gap-2.5 rounded-[8px] px-2 text-14 transition-colors duration-200 ${active ? "text-on-tint" : "text-label hover:bg-fill active:bg-fill-strong"}`}
              >
                <span className="grid size-6 place-items-center rounded-[6px] transition-colors duration-200" style={{ background: active ? "rgba(255,255,255,0.2)" : color }}>
                  <Icon className="size-[15px] text-white" strokeWidth={2.2} />
                </span>
                <span className={active ? "font-semibold" : "font-medium"}>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3 px-1">
          <div>
            <div className="px-1.5 pb-1.5 text-11 font-semibold text-label-3">Appearance</div>
            <ThemeSwitch withLabels />
          </div>
          <p className="px-1.5 text-11 leading-relaxed text-label-3">
            Smart Decisions. Better Harvests.
            <br />
            Estimates only — prices and profits are never guaranteed.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Translucent toolbar: content scrolls underneath; its edge appears only once it does */}
        <div
          className={`no-print material-bar sticky top-0 z-20 border-b pt-[env(safe-area-inset-top)] transition-[border-color] duration-300 ${scrolled ? "border-separator" : "border-transparent"}`}
        >
          <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 md:px-8">
            <Link href="/" className="flex min-w-0 items-center gap-2 lg:hidden" aria-label="KHETNITI home page">
              <BrandLogo variant="mark" className="h-7" priority />
              <span className="truncate text-17 font-semibold">{current?.label ?? "KHETNITI"}</span>
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
            <div className="mb-4">
              <ErrorBox message={`${metaError} Retrying automatically…`} onRetry={retryMeta} />
            </div>
          )}
          <div key={pathname} className="enter">
            {children}
          </div>
        </main>
      </div>

      {/* Floating glass tab bar (phones and tablets) */}
      <TabBar pathname={pathname} />
    </div>
  );
}
