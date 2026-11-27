import Image from "next/image";

/**
 * KHETNITI brand artwork from frontend/public/brand (generated from the brand-identity boards by
 * scripts/process_brand_assets.py). Both theme variants are rendered; CSS shows the one that
 * matches the active theme, so there is no flash or hydration mismatch when the theme changes.
 */
const ART = {
  lockup: { w: 1196, h: 388, alt: "KHETNITI" },
  horizontal: { w: 1196, h: 388, alt: "KHETNITI — Smart Decisions. Better Harvests." },
  mark: { w: 240, h: 324, alt: "KHETNITI" },
  vertical: { w: 734, h: 882, alt: "KHETNITI खेतनीति — Smart Decisions. Better Harvests." },
  hindi: { w: 1545, h: 540, alt: "खेतनीति" },
} as const;

const FILE: Record<keyof typeof ART, string> = {
  lockup: "logo-lockup",
  horizontal: "logo-horizontal",
  mark: "logo-mark",
  vertical: "logo-vertical",
  hindi: "wordmark-hindi",
};

export function BrandLogo({
  variant,
  className = "",
  tone = "auto",
  priority = false,
}: {
  variant: keyof typeof ART;
  className?: string;
  /** auto = follow theme; light/dark = force the artwork for that ground. */
  tone?: "auto" | "light" | "dark";
  priority?: boolean;
}) {
  const a = ART[variant];
  const img = (t: "light" | "dark", cls: string) => (
    <Image
      src={`/brand/${FILE[variant]}-${t}.png`}
      alt={a.alt}
      width={a.w}
      height={a.h}
      priority={priority}
      className={`h-full w-auto select-none ${cls}`}
      draggable={false}
    />
  );
  if (tone !== "auto") return <span className={`inline-flex ${className}`}>{img(tone, "")}</span>;
  return (
    <span className={`inline-flex ${className}`}>
      {img("light", "only-light")}
      {img("dark", "only-dark")}
    </span>
  );
}
