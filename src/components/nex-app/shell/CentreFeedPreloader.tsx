"use client";

// CentreFeedPreloader — fires a single background fetch of the default
// Trade Centre feed the moment the user enters any /nex-app/* surface.
//
// The Trade Centre lives in a separate route (/nex-app/centre), and
// navigating to it should feel instant — the seamless-flow expectation
// on both mobile and desktop. This component pre-warms the feed cache
// so the first fetch on the Centre surface hits the in-memory cache
// rather than paying the API round-trip.
//
// Session-scoped guard prevents redundant preloads on route changes
// within the same session. The preload runs once per session; a full
// tab reload re-primes.

import { useEffect } from "react";
import { primeCentreFeedCache } from "@/lib/nex/centre-publishing/preloadCache";
import type { CentreFeedItem } from "@/lib/nex/centre-publishing/types";

const PRELOAD_URL = "/api/nex/centre/feed?limit=24&offset=0";
const SESSION_KEY = "nex-centre-feed-preload";

type ApiResponse = {
  ok?: boolean;
  items?: CentreFeedItem[];
  total?: number;
};

export function CentreFeedPreloader() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.sessionStorage.getItem(SESSION_KEY) === "1") return;
    } catch {
      // sessionStorage can throw in privacy modes — proceed anyway
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(PRELOAD_URL, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as ApiResponse;
        if (cancelled || !data.ok || !data.items) return;
        primeCentreFeedCache(PRELOAD_URL, data.items, data.total ?? null);
        try {
          window.sessionStorage.setItem(SESSION_KEY, "1");
        } catch {
          // ignore
        }
      } catch {
        // Silent — preload is not a critical path
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return null;
}
