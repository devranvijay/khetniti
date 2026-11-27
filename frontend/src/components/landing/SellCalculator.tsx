"use client";

import { useState } from "react";
import { inr } from "@/lib/format";

/** Illustrative prices for the landing-page demo. The live advisor at /advisor uses AGMARKNET data. */
const PRICE_A = 1500;
const PRICE_B = 1800;

type Mandi = "A" | "B";

/**
 * Two-mandi net-earnings demo. Every value follows the slider 1:1 while it is dragged (no tweening
 * on the input path); only the bars spring to their new length.
 */
export function SellCalculator() {
  const [qty, setQty] = useState(10);
  const [transport, setTransport] = useState(100);
  const [rain, setRain] = useState(false);

  const netA = PRICE_A * qty;
  const grossB = PRICE_B * qty;
  const transportCost = transport * qty;
  const netB = grossB - transportCost;
  const best = Math.max(netA, netB, 1);
  const winner: Mandi | null = netA === netB ? null : netB > netA ? "B" : "A";

  return (
    <div className="rounded-[26px] bg-surface p-5 text-label shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:p-6" role="group" aria-label="Sell decision calculator">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-17 font-semibold">Tomato · where to sell?</h2>
        <span className="rounded-full bg-gold/15 px-2.5 py-1 text-12 font-semibold text-gold-text">Illustrative</span>
      </div>

      <Slider id="qty" label="Quantity" value={qty} min={1} max={50} step={1} onChange={setQty} display={`${qty} ${qty === 1 ? "quintal" : "quintals"}`} />
      <Slider id="transport" label="Transport to Mandi B" value={transport} min={0} max={400} step={10} onChange={setTransport} display={`${inr(transport)} / quintal`} />

      <div className="flex flex-col gap-2.5">
        <MandiRow name="A" price={PRICE_A} net={netA} share={netA / best} win={winner === "A"} detail={`Gross ${inr(netA)} · nearby, no transport cost`} />
        <MandiRow name="B" price={PRICE_B} net={netB} share={Math.max(netB, 0) / best} win={winner === "B"} detail={`Gross ${inr(grossB)} − transport ${inr(transportCost)}`} />
      </div>

      <p className="mt-3 rounded-[14px] bg-tint-deep px-4 py-3 text-15 text-white" aria-live="polite">
        {winner ? (
          <>
            Sell at <b className="text-gold">Mandi {winner}</b>. You take home <b className="text-gold">{inr(Math.abs(netB - netA))} more</b> after transport.
          </>
        ) : (
          <>
            Both mandis net the <b className="text-gold">same amount</b>. Choose the nearer one.
          </>
        )}
      </p>

      <button
        type="button"
        role="switch"
        aria-checked={rain}
        onClick={() => setRain((r) => !r)}
        className="pressable mt-3 flex min-h-11 w-full items-center gap-3 rounded-[12px] bg-fill px-3.5 py-2 text-left text-15"
      >
        <span className={`relative h-[24px] w-[40px] shrink-0 rounded-full transition-colors duration-200 ${rain ? "bg-blue" : "bg-fill-strong"}`}>
          <span className="slide absolute left-[2px] top-[2px] size-5 rounded-full bg-white shadow-sm" style={{ transform: rain ? "translateX(16px)" : "none" }} />
        </span>
        Possible heavy rain in 3 days
      </button>
      {rain && (
        <p className="enter mt-2 px-1 text-13 text-label-2">
          A risk signal, not a crop-maturity forecast. Wet roads raise transport time and cost, so recheck Mandi B before you load.
        </p>
      )}
    </div>
  );
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 flex justify-between gap-3 text-14 text-label-2">
        {label}
        <output htmlFor={id} className="font-semibold tabular-nums text-label">
          {display}
        </output>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-tint" />
    </div>
  );
}

function MandiRow({ name, price, net, detail, share, win }: { name: Mandi; price: number; net: number; detail: string; share: number; win: boolean }) {
  return (
    <div className={`rounded-[16px] border-2 px-4 py-3 transition-colors duration-300 ${win ? "border-gold bg-gold/10" : "border-separator"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-15 font-semibold">
          Mandi {name} · {inr(price)}/q
        </span>
        <span className="text-24 font-bold tabular-nums">{inr(net)}</span>
      </div>
      <p className="text-13 text-label-2">{detail}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fill">
        <div className="slide h-full origin-left rounded-full" style={{ transform: `scaleX(${share})`, background: win ? "var(--gold)" : "var(--tint)" }} />
      </div>
    </div>
  );
}
