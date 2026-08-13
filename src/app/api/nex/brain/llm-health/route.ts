// GET /api/nex/brain/llm-health
//
// Returns per-provider health snapshot for the AI Connection Manager.
// Feeds the dashboard's "AI Connection" strip so the health of the
// underlying LLM providers is visible at a glance:
//
//   Groq (primary) → Gemini (fallback) → Anthropic (fallback) → Mock (last resort)
//   ✓ healthy       · idle              · idle                 · idle
//
// State: circuit breakers, consecutive failures, 24h success rate,
// average latency, and the reason the last failure happened.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { providerReports, consumerUsageSnapshot } from "@/lib/nex/brain/llm";
import { snapshot as countersSnapshot } from "@/lib/nex/observability/counters";
import { evaluateAlertRules } from "@/lib/nex/observability/alert-evaluator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// D5 · silent-failure counter names surfaced with a friendlier
// operator-view alongside LLM state. F12 · derive `stale_cron_alert`
// from `cron_tick.fired` last_at so dashboards can flag stale
// scheduler without an extra endpoint.
const STALE_CRON_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes = >2× the 1-minute schedule

export async function GET(_req: NextRequest) {
  try {
    const report = providerReports();
    const counters = countersSnapshot();
    const cronFired = counters["cron_tick.fired"];
    const cronLastMs = cronFired.last_at ? new Date(cronFired.last_at).getTime() : null;
    const cronAge = cronLastMs ? Date.now() - cronLastMs : null;
    const stale_cron_alert = cronAge === null ? "unknown" : (cronAge > STALE_CRON_THRESHOLD_MS ? "stale" : "fresh");

    // F5 phase 2 · evaluate rules against current counters. Best-effort:
    // if the alert_rules table is unreachable (e.g. migration 048 not yet
    // applied), we skip the block silently rather than 500 the whole route.
    let alerts: unknown = null;
    try { alerts = await evaluateAlertRules(); } catch { alerts = null; }

    return NextResponse.json({
      ok: true,
      ...report,
      // D2 · per-consumer LLM budget slice (empty array until callers opt in)
      per_consumer_usage: consumerUsageSnapshot(),
      observability: {
        counters,
        cron: {
          last_fired: cronFired.last_at,
          age_ms: cronAge,
          stale: stale_cron_alert,
          threshold_ms: STALE_CRON_THRESHOLD_MS,
        },
        alerts, // { evaluated_at, rules_total, rules_enabled, fires: [...] } or null on read error
      },
    });
  } catch (err) {
    console.error("[api.brain.llm-health] failed:", err);
    return NextResponse.json({ ok: false, error: "llm_health_failed" }, { status: 500 });
  }
}
