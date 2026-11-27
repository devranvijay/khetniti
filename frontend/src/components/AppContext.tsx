"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api, type Meta } from "@/lib/api";

export type ThemePref = "system" | "light" | "dark";
const THEME_KEY = "khetniti.theme";

type Ctx = {
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  meta: Meta | null;
  metaError: string | null;
  crop: string;
  location: string;
  setCrop: (c: string) => void;
  setLocation: (l: string) => void;
};

const AppCtx = createContext<Ctx | null>(null);
const KEY = "khetniti.selection";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [crop, setCropState] = useState("tomato");
  const [location, setLocationState] = useState("nashik");
  const [theme, setThemeState] = useState<ThemePref>("system");

  useEffect(() => {
    // Restore the saved selection after mount (reading storage during render would break hydration).
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved.crop) setCropState(saved.crop);
      if (saved.location) setLocationState(saved.location);
      const t = localStorage.getItem(THEME_KEY);
      if (t === "light" || t === "dark") setThemeState(t);
    } catch {}
    api<Meta>("/api/meta")
      .then(setMeta)
      .catch((e) => setMetaError(e.message));
  }, []);

  const persist = (c: string, l: string) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ crop: c, location: l }));
    } catch {}
  };
  const setCrop = (c: string) => {
    setCropState(c);
    persist(c, location);
  };
  const setTheme = (t: ThemePref) => {
    setThemeState(t);
    const root = document.documentElement;
    const apply = () => (t === "system" ? root.removeAttribute("data-theme") : root.setAttribute("data-theme", t));
    // Cross-fade between appearances instead of an abrupt brightness jump (where supported).
    const doc = document as Document & { startViewTransition?: (update: () => void) => unknown };
    if (doc.startViewTransition) doc.startViewTransition(apply);
    else apply();
    try {
      if (t === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, t);
    } catch {}
  };
  const setLocation = (l: string) => {
    setLocationState(l);
    persist(crop, l);
  };

  return <AppCtx.Provider value={{ theme, setTheme, meta, metaError, crop, location, setCrop, setLocation }}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

/**
 * Fetch JSON from the backend. While a new request is in flight the previous data stays visible
 * (stale-while-revalidate); `loading` is derived from whether the latest request has settled.
 */
export function useApi<T>(path: string | null) {
  const [nonce, setNonce] = useState(0);
  const key = path ? `${path}#${nonce}` : null;
  const [state, setState] = useState<{ key?: string; data?: T; error?: string }>({});
  useEffect(() => {
    if (!path || !key) return;
    let alive = true;
    api<T>(path)
      .then((data) => alive && setState({ key, data }))
      .catch((e: Error) => alive && setState((s) => ({ key, data: s.data, error: e.message })));
    return () => {
      alive = false;
    };
  }, [path, key]);
  const settled = key !== null && state.key === key;
  return {
    data: state.data,
    error: settled ? state.error : undefined,
    loading: key !== null && !settled,
    reload: () => setNonce((n) => n + 1),
  };
}
