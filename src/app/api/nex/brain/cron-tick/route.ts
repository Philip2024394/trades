// GET /api/nex/brain/cron-tick — Vercel Cron entrypoint
//
// Vercel Cron issues GET requests, so this is a small GET wrapper that
// calls the same manager pipeline as POST /api/nex/brain/run-once.
//
// Auth is delegated to src/lib/nex/brain/auth/require-cron-token.ts ·
// the SINGLE shared boundary for every pipeline-triggering endpoint.
// Prior to Wave 11 remediation this route implemented its own auth
// block that silently opened the endpoint in production if both
// CRON_SECRET and NEX_BRAIN_CRON_TOKEN were unset (F14). The shared
// boundary fails-closed in production.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { dispatchNewInboxItems, runOneCycle } from "@/lib/nex/brain/manager";
import { checkCronAuth, cronAuthErrorBody } from "@/lib/nex/brain/auth/require-cron-token";
import { incr } from "@/lib/nex/observability/counters";
import { logger } from "@/lib/nex/observability/logger";
// W-OBS-1 Path A Layer 1 · ALS scope for cron → dispatch → worker CID chain.
// Wave 3 H2.a · adopted 2026-08-10 per WAVE-3-H2-CID-LOGGER.md.
import { runFromRequest } from "@/lib/nex/observability/correlation";
import { isRollupAsync } from "@/lib/nex/analytics/ingest";
import { drainAnalyticsRollupQueue } from "@/lib/nex/analytics/rollup-worker";
// Wave 3 · H5 · alert evaluate + dispatch, gated by NEX_ALERTS_DISPATCH_ENABLED.
// When the gate is off (default), the alerts subsystem is not invoked from
// cron. When on, evaluate() runs each tick and dispatches per rule config.
import { evaluate as evaluateAlerts, isDispatchEnabled as isAlertsDispatchEnabled } from "@/lib/nex/alerts/evaluator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const log = logger("api.brain.cron-tick");

export async function GET(req: NextRequest) {
  // Cron platform (Vercel Cron) is trusted post-auth; adopt inbound
  // x-request-id if the caller supplied one, otherwise mint fresh.
  return runFromRequest(req, { trustInbound: true }, () => cronTickHandler(req));
}

async function cronTickHandler(req: NextRequest) {
  const auth = checkCronAuth(req);
  if (!auth.ok) {
    if (auth.code === "misconfigured") {
      log.error("misconfigured", { message: auth.message });
    }
    return NextResponse.json(cronAuthErrorBody(auth), { status: auth.status });
  }

  try {
    // F12 · liveness signal · fired BEFORE dispatch so a hung dispatcher
    // still updates the last-fired timestamp. Operators watching the
    // `nex_cron_tick_fired_last_at_seconds` gauge see the cron IS firing
    // even if it's stuck downstream.
    incr("cron_tick.fired");
    const dispatchSummary = await dispatchNewInboxItems();
    const cycle = await runOneCycle({});
    // D6 · async analytics rollup drain, gated on env flag. When the
    // flag is off (default), this call short-circuits at the isRollupAsync
    // check without touching the DB.
    let analytics_rollup: unknown = undefined;
    if (isRollupAsync()) {
      try {
        analytics_rollup = await drainAnalyticsRollupQueue({ batch_size: 50, worker_id: "cron-tick" });
      } catch (rollupErr) {
        // Never let rollup drain fail the cron-tick — that would stop
        // dispatch + cycle from running on the next tick.
        log.warn("rollup_drain_failed", { error: rollupErr instanceof Error ? rollupErr.message : String(rollupErr) });
      }
    }
    // Wave 3 · H5 · alert evaluate/dispatch behind the gate. Same
    // fail-safe wrapping as rollup · a broken evaluate must never stop
    // dispatch + cycle from running on the next tick.
    let alerts: unknown = undefined;
    if (isAlertsDispatchEnabled()) {
      try {
        alerts = await evaluateAlerts();
      } catch (alertsErr) {
        log.warn("alerts_evaluate_failed", { error: alertsErr instanceof Error ? alertsErr.message : String(alertsErr) });
      }
    }
    return NextResponse.json({ ok: true, dispatch: dispatchSummary, cycle, analytics_rollup, alerts });
  } catch (err) {
    incr("cron_tick.failed");
    log.error("run_failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, error: "run_failed" }, { status: 500 });
  }
}
