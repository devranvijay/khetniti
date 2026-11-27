"use client";

import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "./Brand";

const SEEN_KEY = "khetniti.splash";
const MOBILE_QUERY = "(max-aspect-ratio: 1/1)";
const HARD_CAP_MS = 4500;

/**
 * Brand splash, shown once per browser session on a full page load.
 * Plays its intro clip once (the portrait clip on phones, the landscape one elsewhere), then fades.
 * Tap or press any key to skip. Reduced motion shows the static vertical logo briefly instead.
 */
export function Splash() {
  const [state, setState] = useState<"showing" | "leaving" | "gone">("showing");
  const [reduced, setReduced] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (document.documentElement.dataset.splash === "seen") return; // hidden by CSS before paint
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {}

    let done = false;
    let active = true; // false after cleanup, so handlers from a discarded effect run are ignored
    const timers: number[] = [];
    const leave = () => {
      if (done || !active) return;
      done = true;
      setState("leaving");
      timers.push(window.setTimeout(() => setState("gone"), 500));
    };
    const skip = () => leave();
    window.addEventListener("keydown", skip, { once: true });
    timers.push(window.setTimeout(leave, HARD_CAP_MS));

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true); // eslint-disable-line react-hooks/set-state-in-effect -- depends on a browser-only media query
      timers.push(window.setTimeout(leave, 900));
      return () => {
        active = false;
        timers.forEach(clearTimeout);
        window.removeEventListener("keydown", skip);
      };
    }

    const video = videoRef.current;
    const mobile = window.matchMedia(MOBILE_QUERY).matches;
    if (video) {
      // Each clip plays exactly once. (Looping the short mobile clip read as two different videos.)
      video.src = mobile ? "/splash/splash-mobile.mp4" : "/splash/splash-desktop.mp4";
      video.onerror = () => leave();
      video.onended = () => timers.push(window.setTimeout(leave, 200));
      video.play().catch((e: DOMException) => {
        if (e.name !== "AbortError") leave(); // AbortError = superseded by a newer load, not a failure
      });
    }
    return () => {
      active = false;
      timers.forEach(clearTimeout);
      window.removeEventListener("keydown", skip);
    };
  }, []);

  if (state === "gone") return null;
  return (
    <div
      className="splash no-print"
      data-state={state}
      role="presentation"
      aria-label="KHETNITI is loading"
      onClick={() => {
        setState("leaving");
        window.setTimeout(() => setState("gone"), 500);
      }}
    >
      {reduced ? (
        <BrandLogo variant="vertical" tone="dark" className="h-56" priority />
      ) : (
        <video ref={videoRef} muted playsInline preload="auto" aria-hidden />
      )}
    </div>
  );
}
