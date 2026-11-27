"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api, type Meta } from "@/lib/api";

type Ctx = {
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

  useEffect(() => {
    // Restore the saved selection after mount (reading storage during render would break hydration).
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved.crop) setCropState(saved.crop);
      if (saved.location) setLocationState(saved.location);
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
  const setLocation = (l: string) => {
    setLocationState(l);
    persist(crop, l);
  };

  return <AppCtx.Provider value={{ meta, metaError, crop, location, setCrop, setLocation }}>{children}</AppCtx.Provider>;
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
