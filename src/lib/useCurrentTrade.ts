// useCurrentTrade — client-side hook that returns the currently
// signed-in trade profile. Reads from /api/auth/trade/whoami and
// caches the result in memory + localStorage so the second render
// after auth boots is instant.

"use client";

import { useEffect, useState } from "react";

export type CurrentTrade = {
  tradeId: string;
  displayName: string;
  tradeDiscipline: string | null;
  homePostcode: string | null;
  identityComplete: boolean;
  viewerRole: "trade" | "diy";
};

const CACHE_KEY = "tc.current-trade";
const EVT = "tc:current-trade-change";

function readCache(): CurrentTrade | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CurrentTrade) : null;
  } catch {
    return null;
  }
}

function writeCache(t: CurrentTrade | null) {
  if (typeof window === "undefined") return;
  if (t) window.localStorage.setItem(CACHE_KEY, JSON.stringify(t));
  else window.localStorage.removeItem(CACHE_KEY);
  window.dispatchEvent(new Event(EVT));
}

export function useCurrentTrade() {
  const [trade, setTrade] = useState<CurrentTrade | null>(() => readCache());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/trade/whoami", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return;
        if (json?.authenticated) {
          const t: CurrentTrade = {
            tradeId:          json.tradeId,
            displayName:      json.displayName,
            tradeDiscipline:  json.tradeDiscipline ?? null,
            homePostcode:     json.homePostcode ?? null,
            identityComplete: Boolean(json.identityComplete),
            viewerRole:       json.viewerRole === "diy" ? "diy" : "trade"
          };
          setTrade(t);
          writeCache(t);
        } else {
          setTrade(null);
          writeCache(null);
        }
      })
      .catch(() => {
        /* keep cached value */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    function onChange() {
      setTrade(readCache());
    }
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return { trade, loading };
}
