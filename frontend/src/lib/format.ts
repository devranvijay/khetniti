const inrFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Negative amounts read "−₹1,200", not "₹-1,200". */
export const inr = (v: number | null | undefined) =>
  v == null || Number.isNaN(v) ? "—" : `${Math.round(v) < 0 ? "−" : ""}₹${inrFmt.format(Math.abs(Math.round(v)))}`;
export const num = (v: number | null | undefined, digits = 0) =>
  v == null || Number.isNaN(v) ? "—" : new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v);
export const pct = (v: number | null | undefined, digits = 1) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`);

export const shortDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
export const longDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
export const weekday = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" });
export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

