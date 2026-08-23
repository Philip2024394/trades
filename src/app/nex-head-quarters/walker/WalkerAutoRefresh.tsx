"use client";

// Task #86 (2026-08-22) · Walker Live Monitor auto-refresh.
//
// Calls router.refresh() every 30s so the server component re-runs its SQL
// queries and the page picks up new heartbeats + cycle_run rows without the
// operator manually reloading. 30s cadence chosen to sit well inside Walker's
// 15-min tick (never miss a cycle) while adding negligible DB load.
//
// Uses the existing worker_heartbeat + worker_cycle_run tables (no new worker,
// no dedicated API route, no additional infrastructure). Complies with the
// "monitor reads existing Walker state" rule.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 30_000;

export default function WalkerAutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
