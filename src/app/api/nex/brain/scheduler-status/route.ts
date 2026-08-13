// GET /api/nex/brain/scheduler-status
//
// G4 · Truth Contract §5 R12 · Scheduler evidence endpoint.
//
// Answers: "is the scheduler actually firing?"  Reports both possible
// runtime schedulers INDEPENDENTLY · a heartbeat / worker process /
// vercel.json / source-code existence is NEVER treated as evidence.
// The only evidence accepted is a recent authorised invocation.
//
// Sources:
//   local  ← counter `run_once.fired`  · nex-brain-worker.mjs → /run-once
//   vercel ← counter `cron_tick.fired` · Vercel Cron → /cron-tick
//
// Freshness windows (per §5 R12):
//   ≤ 90 s          → "running"      (recent authorised tick observed)
//   > 90 s + last_at present → "idle" (scheduler has fired historically ·
//                                      not fresh · may be paused/stopped)
//   last_at is null → "not_firing"   (no evidence in this process's lifetime)
//   endpoint unreachable → "unknown" (client-side interpretation only)
//
// Notes:
//   · Counters are per-process (see counters.ts) · a server restart
//     resets them to `null`, which reports as "not_firing". This is
//     honest: after a restart, we genuinely have no evidence yet.
//   · Freshness budget matches the 30 s local poll interval (nex-brain-
//     worker.mjs default) with headroom for a missed tick.

import { NextResponse } from "next/server";
import { read as readCounter } from "@/lib/nex/observability/counters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FRESHNESS_MS = 90_000;   // ≤ 90 s = running (matches R12 budget)

type SchedulerState = "running" | "idle" | "not_firing";

function classify(lastAtIso: string | null, nowMs: number): {
  state: SchedulerState;
  age_ms: number | null;
} {
  if (lastAtIso === null) return { state: "not_firing", age_ms: null };
  const t = new Date(lastAtIso).getTime();
  if (!Number.isFinite(t)) return { state: "not_firing", age_ms: null };
  const age = nowMs - t;
  return {
    state: age <= FRESHNESS_MS ? "running" : "idle",
    age_ms: age,
  };
}

export async function GET() {
  try {
    const nowMs = Date.now();

    const localFired  = readCounter("run_once.fired");
    const localFailed = readCounter("run_once.failed");
    const vercelFired  = readCounter("cron_tick.fired");
    const vercelFailed = readCounter("cron_tick.failed");

    const local  = classify(localFired.last_at,  nowMs);
    const vercel = classify(vercelFired.last_at, nowMs);

    return NextResponse.json({
      ok: true,
      generated_at: new Date(nowMs).toISOString(),
      freshness_budget_ms: FRESHNESS_MS,
      // LOCAL scheduler (nex-brain-worker.mjs polling /run-once).
      local: {
        state:            local.state,
        last_fired_at:    localFired.last_at,
        age_ms:           local.age_ms,
        fired_count:      localFired.count,
        failed_count:     localFailed.count,
        source:           "counter:run_once.fired",
        evidence_route:   "/api/nex/brain/run-once",
      },
      // VERCEL Cron scheduler (Vercel-hosted cron hitting /cron-tick).
      vercel: {
        state:            vercel.state,
        last_fired_at:    vercelFired.last_at,
        age_ms:           vercel.age_ms,
        fired_count:      vercelFired.count,
        failed_count:     vercelFailed.count,
        source:           "counter:cron_tick.fired",
        evidence_route:   "/api/nex/brain/cron-tick",
      },
      // Rollup for HQ · true iff at least one scheduler has fresh evidence.
      any_scheduler_running: local.state === "running" || vercel.state === "running",
    });
  } catch (err) {
    console.error("[api.brain.scheduler-status] failed:", err);
    return NextResponse.json(
      { ok: false, error: "scheduler_status_failed" },
      { status: 500 },
    );
  }
}
