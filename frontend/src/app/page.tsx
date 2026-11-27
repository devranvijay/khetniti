import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BrandLogo } from "@/components/Brand";
import { ReplayDemo } from "@/components/landing/ReplayDemo";
import { SellCalculator } from "@/components/landing/SellCalculator";

export const metadata: Metadata = {
  title: "KHETNITI · Know when and where to sell",
  description: "Weather risk, mandi prices and transport costs in one clear recommendation, so a farmer decides with the whole picture.",
};

/* The hero, Replay band and closing band are always dark (like Apple's product pages); the rest follows the theme. */
const DEEP = "#07241a";

const NAV = [
  { href: "#problem", label: "Problem" },
  { href: "#how", label: "How it works" },
  { href: "#replay", label: "Decision Replay" },
  { href: "#roadmap", label: "Roadmap" },
];

const MODULES = [
  { href: "/harvest", title: "Harvest Intelligence", body: "Flags harvest and transport risk from the 7-day weather forecast." },
  { href: "/mandi", title: "Mandi Intelligence", body: "Current and past prices across nearby mandis, in one place." },
  { href: "/advisor", title: "Smart Sell Advisor", body: "Compares every mandi on what you actually take home, then weighs selling now against waiting." },
  { href: "/replay", title: "Decision Replay", body: "Replays a past decision against what prices did next, with no peeking at the future." },
  { href: "/reports", title: "Reports & Insights", body: "Decisions you saved, how replays scored, and where every number comes from." },
];

const h2 = "text-[clamp(2rem,4.4vw,3.5rem)] font-bold leading-[1.06] tracking-[-0.025em] text-balance";
const eyebrow = "text-13 font-semibold uppercase tracking-[0.14em]";
const pill = "pressable inline-flex min-h-11 items-center justify-center gap-1 rounded-full px-6 text-17 font-semibold";

export default function LandingPage() {
  return (
    <div className="bg-bg">
      <nav
        aria-label="Main"
        className="sticky top-0 z-30 -mb-14 border-b border-white/10 bg-[#07241a]/75 pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150 [@media(prefers-reduced-transparency:reduce)]:bg-[#07241a]"
      >
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-6 px-4 md:px-6">
          <Link href="/" aria-label="KHETNITI home page" className="flex items-center">
            <BrandLogo variant="lockup" tone="dark" className="h-8" priority />
          </Link>
          <div className="flex items-center gap-7 text-14">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="hidden text-white/70 transition-colors hover:text-white md:inline">
                {n.label}
              </a>
            ))}
            <Link href="/dashboard" className="pressable rounded-full bg-gold px-4 py-1.5 text-14 font-semibold text-[#0d3b2b]">
              Open app
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* ------------------------------------------------------------ hero */}
        <header
          className="relative overflow-hidden text-white"
          style={{ background: `linear-gradient(180deg, #061d15 0%, ${DEEP} 45%, #0d3b2b 100%)` }}
        >
          <div
            aria-hidden
            className="sunrise pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse 70% 55% at 78% 100%, rgba(233,172,39,0.38), transparent 62%)" }}
          />
          <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-4 pb-20 pt-30 md:px-6 md:pt-38 lg:grid-cols-[1.05fr_0.95fr] lg:pb-28">
            <div className="stagger">
              <p className={`${eyebrow} text-gold`}>Decision intelligence for Indian farmers</p>
              <h1 className="mt-4 text-[clamp(2.75rem,6.4vw,5rem)] font-bold leading-[1.03] tracking-[-0.032em] text-balance">
                Know when and <span className="text-gold">where</span> to sell.
              </h1>
              <p className="mt-6 max-w-[30em] text-[clamp(1.125rem,1.6vw,1.375rem)] leading-[1.45] tracking-[-0.012em] text-white/80">
                KhetNiti brings weather risk, mandi prices and transport costs into one clear recommendation, so a farmer decides with the whole picture.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Link href="/dashboard" className={`${pill} bg-gold text-[#0d3b2b]`}>
                  Open KhetNiti
                </Link>
                <a href="#replay" className="inline-flex min-h-11 items-center gap-0.5 text-17 font-medium text-gold hover:underline">
                  Watch Decision Replay <ChevronRight className="size-4" aria-hidden />
                </a>
              </div>
              <p className="mt-10 font-hindi text-20 font-semibold text-white/55">खेतनीति · Smart Decisions. Better Harvests.</p>
            </div>
            <div className="enter [animation-delay:200ms]">
              <SellCalculator />
            </div>
          </div>
        </header>

        {/* ------------------------------------------------------------ problem */}
        <section id="problem" className="scroll-mt-14 py-24 md:py-32">
          <div className="mx-auto max-w-[1200px] px-4 md:px-6">
            <div className="reveal max-w-[760px]">
              <p className={`${eyebrow} text-tint`}>The problem</p>
              <h2 className={`mt-3 ${h2}`}>Farmers don’t just need data. They need better decisions.</h2>
              <p className="mt-5 text-20 leading-[1.45] text-label-2">The hard part is rarely growing the crop. It is choosing the day, the market and the route.</p>
            </div>
            <div className="reveal-group mt-14 grid gap-5 md:grid-cols-3">
              <Challenge n={1} title="Weather uncertainty" body="A rain window changes what is safe to harvest and move.">
                <path d="M136 76a27 27 0 0 1 7-52 34 34 0 0 1 65-5 27 27 0 0 1 41 27 23 23 0 0 1-5 30z" fill="var(--surface)" stroke="var(--tint)" strokeWidth={4} />
                <g className="rain" stroke="var(--blue)" strokeWidth={5} strokeLinecap="round">
                  {[160, 190, 220, 250].map((x) => (
                    <line key={x} x1={x} y1={92} x2={x - 6} y2={108} />
                  ))}
                </g>
              </Challenge>
              <Challenge n={2} title="Changing mandi prices" body="Prices differ by market and move day to day, so yesterday’s number misleads.">
                <g stroke="var(--separator)" strokeWidth={2}>
                  {[35, 65, 95].map((y) => (
                    <line key={y} x1={20} y1={y} x2={380} y2={y} />
                  ))}
                </g>
                <g className="draw">
                  <polyline points="20,95 80,80 140,88 200,52 260,60 320,30 380,40" fill="none" stroke="var(--tint)" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="20,70 80,76 140,50 200,66 260,36 320,70 380,58" fill="none" stroke="var(--gold)" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
                </g>
              </Challenge>
              <Challenge n={3} title="Transport and market choice" body="A higher price can lose to a longer, costlier trip.">
                <circle cx={70} cy={66} r={14} fill="var(--label)" />
                <g className="draw">
                  <line x1={70} y1={66} x2={320} y2={30} stroke="var(--tint)" strokeWidth={4} strokeDasharray="6 8" />
                  <line x1={70} y1={66} x2={320} y2={104} stroke="var(--gold)" strokeWidth={4} strokeDasharray="6 8" />
                  <circle cx={320} cy={30} r={12} fill="var(--tint)" />
                  <circle cx={320} cy={104} r={12} fill="var(--gold)" />
                </g>
              </Challenge>
            </div>
            <p className="reveal mt-8 rounded-[24px] bg-[#0d3b2b] px-8 py-9 text-[clamp(1.375rem,3vw,2.125rem)] font-semibold leading-[1.2] tracking-[-0.02em] text-white md:px-10">
              The challenge is not just growing the crop. It is knowing <span className="text-gold">when and where to sell it.</span>
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------------ how it works */}
        <section id="how" className="scroll-mt-14 bg-surface py-24 md:py-32">
          <div className="mx-auto max-w-[1200px] px-4 md:px-6">
            <div className="reveal max-w-[760px]">
              <p className={`${eyebrow} text-tint`}>How it works</p>
              <h2 className={`mt-3 ${h2}`}>From scattered public data to one decision.</h2>
              <p className="mt-5 text-20 leading-[1.45] text-label-2">Five stages take raw market and weather feeds to a screen a farmer can act on.</p>
            </div>

            <ol className="pipeline relative mt-14 grid gap-5 md:grid-cols-5 md:gap-0">
              <span aria-hidden className="pipeline-line absolute left-[10%] right-[10%] top-7 hidden h-0.5 rounded-full bg-gold/60 md:block" />
              {["Data collection", "Data cleaning", "Weather & market analysis", "Recommendation engine", "Farmer dashboard"].map((s, i, all) => (
                <li key={s} className="relative flex items-center gap-4 md:flex-col md:px-2 md:text-center">
                  <span
                    className={`grid size-14 shrink-0 place-items-center rounded-full text-22 font-bold ring-4 ring-surface ${i === all.length - 1 ? "bg-gold text-[#0d3b2b]" : "bg-[#0d3b2b] text-gold"}`}
                  >
                    {i + 1}
                  </span>
                  <span className="text-17 font-semibold md:mt-3">{s}</span>
                </li>
              ))}
            </ol>

            <div className="reveal-group mt-14 grid gap-5 md:grid-cols-3">
              <Column title="Data sources" items={["AGMARKNET mandi prices via data.gov.in", "Open-Meteo 7-day forecasts (IMD has no open forecast API)"]} />
              <Column title="Intelligence engine" items={["Python, Pandas and NumPy", "Price trend and weather risk analysis", "Recommendation logic", "Historical backtesting"]} />
              <Column title="Technology" items={["Next.js and TypeScript", "Python and FastAPI", "PostgreSQL on Supabase", "Recharts"]} />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ modules */}
        <section id="modules" className="scroll-mt-14 py-24 md:py-32">
          <div className="mx-auto max-w-[1200px] px-4 md:px-6">
            <div className="reveal max-w-[760px]">
              <p className={`${eyebrow} text-tint`}>Inside KhetNiti</p>
              <h2 className={`mt-3 ${h2}`}>Five tools. One decision.</h2>
            </div>
            <ul className="mt-12 overflow-hidden rounded-[22px] bg-surface shadow-card">
              {MODULES.map((m, i) => (
                <li key={m.href} className="reveal border-b border-separator last:border-b-0">
                  <Link href={m.href} className="highlight group grid grid-cols-[48px_1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-5 hover:bg-fill md:grid-cols-[72px_280px_1fr_auto] md:px-7">
                    <span className="text-28 font-bold tabular-nums text-tint md:text-34">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-20 font-semibold md:text-22">{m.title}</span>
                    <span className="col-span-full row-start-2 text-15 text-label-2 md:col-span-1 md:col-start-3 md:row-start-1 md:text-17">{m.body}</span>
                    <ChevronRight className="col-start-3 row-start-1 size-5 text-label-3 transition-[translate] duration-300 ease-[var(--spring)] group-hover:translate-x-1 md:col-start-4" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------------ replay */}
        <section id="replay" className="scroll-mt-14 py-24 text-white md:py-32" style={{ background: DEEP }}>
          <div className="mx-auto max-w-[1200px] px-4 md:px-6">
            <div className="reveal max-w-[760px]">
              <p className={`${eyebrow} text-gold`}>Signature feature</p>
              <h2 className={`mt-3 ${h2}`}>Historical Decision Replay.</h2>
              <p className="mt-5 text-20 leading-[1.45] text-[#bfd8cb]">
                Pick a decision date. Everything after it is hidden from the engine. Then see how the advice would have performed.
              </p>
            </div>
            <div className="mt-12">
              <ReplayDemo />
            </div>
            <p className="mt-6 text-14 text-[#bfd8cb]">
              Illustrative series generated for this page, not real mandi data and not a performance claim. The{" "}
              <Link href="/replay" className="font-semibold text-gold hover:underline">
                Replay tool
              </Link>{" "}
              runs the same test on real AGMARKNET history.
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------------ roadmap */}
        <section id="roadmap" className="scroll-mt-14 py-24 md:py-32">
          <div className="mx-auto max-w-[1200px] px-4 md:px-6">
            <div className="reveal max-w-[760px]">
              <p className={`${eyebrow} text-tint`}>Impact and roadmap</p>
              <h2 className={`mt-3 ${h2}`}>Better information, in the farmer’s hands.</h2>
            </div>
            <div className="reveal-group mt-12 grid gap-5 md:grid-cols-2">
              <div className="rounded-[24px] bg-[#0d3b2b] p-8 text-white">
                <h3 className="text-24 font-semibold text-gold">Expected impact</h3>
                <Bullets
                  dot="rounded-full bg-gold"
                  items={["Better-informed harvesting decisions", "Mandi price visibility", "Transparent selling comparisons", "Transport-cost awareness", "Use of historical market information", "Accessible agricultural intelligence"]}
                />
              </div>
              <div className="rounded-[24px] border-2 border-dashed border-tint/50 bg-surface p-8">
                <h3 className="flex items-center gap-3 text-24 font-semibold">
                  Future scope <span className="rounded-full border border-current px-2.5 py-0.5 text-12 font-semibold uppercase tracking-[0.08em] text-tint">Planned</span>
                </h3>
                <Bullets
                  dot="rounded-full border-[3px] border-tint"
                  items={["More crops and mandis", "Regional language support", "Farmer-specific recommendations", "Mobile-first experience", "Advanced crop and weather risk", "More data integrations"]}
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------ close */}
      <footer className="relative overflow-hidden px-4 pb-10 pt-28 text-center text-white md:px-6" style={{ background: `linear-gradient(180deg, ${DEEP}, #0d3b2b)` }}>
        <div
          aria-hidden
          className="sun-scroll pointer-events-none absolute bottom-[-420px] left-1/2 size-[900px] -translate-x-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(233,172,39,0.4), transparent 62%)" }}
        />
        <div className="relative mx-auto max-w-[1200px]">
          <h2 className="reveal mx-auto max-w-[14em] text-[clamp(2.25rem,5.6vw,4.5rem)] font-bold leading-[1.04] tracking-[-0.03em] text-balance">
            Every harvest deserves a <span className="text-gold">smarter decision.</span>
          </h2>
          <Link href="/dashboard" className={`${pill} mt-10 bg-gold text-[#0d3b2b]`}>
            Open KhetNiti
          </Link>
          <div className="mt-24 flex flex-wrap justify-between gap-4 border-t border-white/15 pt-7 text-left text-14 text-[#bfd8cb]">
            <span>
              <span className="font-hindi text-20 font-semibold text-gold">खेतनीति</span> &nbsp;KHETNITI
            </span>
            <span>Built by Ranvijay Singh and Anushka · Hackathon prototype</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Challenge({ n, title, body, children }: { n: number; title: string; body: string; children: React.ReactNode }) {
  return (
    <article className="rounded-[22px] bg-surface p-6 shadow-card transition-[translate,box-shadow] duration-300 ease-[var(--spring)] hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(13,59,43,0.12)]">
      <svg viewBox="0 0 400 130" aria-hidden className="mb-5 block h-[130px] w-full rounded-[14px] bg-surface-2">
        {children}
      </svg>
      <p className={`${eyebrow} text-tint`}>Challenge {n}</p>
      <h3 className="mt-1.5 text-22 font-semibold">{title}</h3>
      <p className="mt-1.5 text-17 text-label-2">{body}</p>
    </article>
  );
}

function Column({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[22px] bg-surface-2 p-7">
      <h3 className="mb-3 text-20 font-semibold text-tint">{title}</h3>
      <Bullets dot="rounded-[3px] bg-gold" items={items} small />
    </div>
  );
}

function Bullets({ items, dot, small = false }: { items: string[]; dot: string; small?: boolean }) {
  return (
    <ul className={`mt-4 grid ${small ? "gap-2 text-17" : "gap-3 text-18"}`}>
      {items.map((t) => (
        <li key={t} className="flex items-start gap-3">
          <span aria-hidden className={`mt-[0.45em] size-2.5 shrink-0 ${dot}`} />
          {t}
        </li>
      ))}
    </ul>
  );
}
