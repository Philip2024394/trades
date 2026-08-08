// GET /api/nex/brain/workers-live — Phase 12.3 · derived worker liveness
//
// Reads every heartbeat within LIVENESS_THRESHOLD_MS × 5 (safety
// margin so recently-stopped workers still surface as Offline rather
// than vanishing) and maps them through deriveLiveness so the response
// carries the five states the future Factory UI needs:
//   working · waiting_llm · standby · failed · offline
//
// Distinct from /cloud-status which just reports raw age tiers
// (online/lagging/stale) for the top-level "cloud worker" tile.
// This endpoint is the source of truth for the per-worker cards.
//
// The response also lists workers that SHOULD have a heartbeat
// (BRAIN_WORKER_TYPES) but don't — those are reported as Offline so
// the UI shows every worker slot always, even before the first cycle.

import { NextResponse } from "next/server";
import { brainStore } from "@/lib/nex/brain/storage";
import {
  BRAIN_WORKER_TYPES,
  LIVENESS_THRESHOLD_MS,
  deriveLiveness,
  workerHostId,
} from "@/lib/nex/brain/heartbeat";
import type { WorkerHeartbeat, WorkerType } from "@/lib/nex/brain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Pull a generous window so recently-stopped workers still show up
    // as Offline rather than being filtered out entirely.
    const since = new Date(Date.now() - LIVENESS_THRESHOLD_MS * 5).toISOString();
    const heartbeats = await brainStore().listHeartbeats({ since, limit: 100 });

    // Index heartbeats by host_id for O(1) lookup per worker slot.
    const byHost = new Map<string, WorkerHeartbeat>();
    for (const hb of heartbeats) byHost.set(hb.host_id, hb);

    const now = Date.now();
    const workers = BRAIN_WORKER_TYPES.map((worker_type: WorkerType) => {
      const expected_host_id = workerHostId(worker_type);
      // Prefer this-process heartbeat; fall back to any heartbeat for
      // this worker type (multi-process deployments write different
      // host_ids). We report the freshest one.
      let hb = byHost.get(expected_host_id) ?? null;
      if (!hb) {
        const candidates = heartbeats.filter((h) =>
          h.host_id.startsWith(`${worker_type}@`)
        );
        candidates.sort((a, b) =>
          new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime()
        );
        hb = candidates[0] ?? null;
      }
      const status = deriveLiveness(hb, now);
      const summary = (hb?.last_cycle_summary ?? {}) as {
        current_job_id?: string | null;
        current_stage?: string | null;
        input_ref?: string | null;
      };
      const age_ms = hb ? now - new Date(hb.last_seen_at).getTime() : null;
      return {
        worker_type,
        host_id: hb?.host_id ?? expected_host_id,
        status,
        last_seen_at: hb?.last_seen_at ?? null,
        age_ms,
        current_job_id: summary.current_job_id ?? null,
        current_stage: summary.current_stage ?? null,
        input_ref: summary.input_ref ?? null,
        last_error: hb?.last_error ?? null,
        uptime_ms: hb?.uptime_ms ?? null,
      };
    });

    return NextResponse.json({
      ok: true,
      liveness_threshold_ms: LIVENESS_THRESHOLD_MS,
      generated_at: new Date(now).toISOString(),
      workers,
      totals: {
        working:     workers.filter((w) => w.status === "working").length,
        waiting_llm: workers.filter((w) => w.status === "waiting_llm").length,
        standby:     workers.filter((w) => w.status === "standby").length,
        failed:      workers.filter((w) => w.status === "failed").length,
        offline:     workers.filter((w) => w.status === "offline").length,
      },
    });
  } catch (err) {
    console.error("[api.brain.workers-live] failed:", err);
    return NextResponse.json(
      { ok: false, error: "workers_live_failed" },
      { status: 500 }
    );
  }
}
