"use client";

// NEX HQ · global auto-refresh (Philip 2026-08-22).
//
// Doctrine anchor: feedback_nex_hq_refresh_every_1_minute_2026_08_22
//   Philip verbatim: "we must have time frame where the head quaters refresh
//   every 1 minute so we have updated information displaying for philip all
//   the time"
//
// Lives inside the HQ layout · every /nex-head-quarters/* page gets a fresh
// server render every 60 seconds without individual pages needing to opt in.
//
// Why this is safe:
//   · router.refresh() re-runs the current route's server component · no
//     client-state mutation · no double-fetch races.
//   · Idempotent · overlapping shorter-cadence refreshes (e.g. Walker Monitor
//     at 30s) coexist harmlessly.
//   · Zero UI · zero flicker · admin sees fresh counters every minute.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const HQ_REFRESH_INTERVAL_MS = 60_000; // 1 minute · Philip 2026-08-22

export function HQAutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), HQ_REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
