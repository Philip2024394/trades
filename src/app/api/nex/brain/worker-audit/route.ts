// GET /api/nex/brain/worker-audit — real Worker Activity Audit for the
// trailing 24h window (or ?hours=N).
//
// Every value in the response is either:
//   · Available: computed from real telemetry (worker_jobs, worker_results,
//     worker_heartbeats, contradictions, knowledge_records)
//   · Unavailable: null-typed with an explicit `reason` + `needs` prescription
//     for the new telemetry required to unblock the metric
//
// See src/lib/nex/brain/worker-audit.ts for the pure aggregator.
// Doctrine: feedback_nex_observable_ai_doctrine_2026_08_07.md +
// feedback_nex_never_pretends_work_done_2026_08_07.md.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
// V-1b · D9 route-boundary validation adopted 2026-08-10.
import { validateSearchParams } from "@/lib/nex/brain/http/validate-input";

const QuerySchema = z.object({
  hours: z.coerce.number().int().min(1).max(720).default(24),
});
import {
  computeWorkerActivityAudit,
  type AuditInputs,
  type RawCloudWorker,
  type RawContradiction,
  type RawRecordChange,
  type RawWorkerJob,
  type RawWorkerResult,
} from "@/lib/nex/brain/worker-audit";
import type { WorkerType } from "@/lib/nex/brain/types";
// Wave 11 · F25 · strict env reader rejects empty/whitespace values
// (the prior `!url || !key` check let whitespace pass and later leaked
// createClient's internal error text).
import { readEnvOrNull } from "@/lib/nex/api/validators";
// Wave 11 · F24 · safe error envelope for the catch path.
import { toClientError } from "@/lib/nex/api/error-envelope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Canonical worker types — matches WORKER_LABEL in the shell + the pipeline.
const WORKER_TYPES: WorkerType[] = [
  "knowledge-context",
  "voice-context",
  "learning-context",
  "knowledge-extractor",
  "image-analyst",
  "quality-checker",
  "memory-guardian",
];

// Heartbeat-freshness threshold — >60s means the worker is stale, not counted as online.
const HEARTBEAT_ONLINE_MS = 60 * 1000;

export async function GET(req: NextRequest) {
  const parsed = validateSearchParams(req, QuerySchema);
  if (!parsed.ok) return parsed.response;
  const { hours } = parsed.data;
  const now = Date.now();
  const to = new Date(now).toISOString();
  const from = new Date(now - hours * 60 * 60 * 1000).toISOString();

  try {
    // Match the env pattern used by src/lib/nex/brain/storage.ts so the
    // audit reads from the SAME Supabase project that owns worker_jobs.
    // (Do not use @/lib/supabaseAdmin — that points at a different project.)
    // Wave 11 · F25 · readEnvOrNull rejects whitespace-only values.
    // The cascade order preserves the original precedence.
    const url =
      readEnvOrNull("NEX_SUPABASE_URL") ??
      readEnvOrNull("NEXT_PUBLIC_NEX_SUPABASE_URL") ??
      readEnvOrNull("SUPABASE_URL");
    const key =
      readEnvOrNull("NEX_SUPABASE_SERVICE_ROLE_KEY") ??
      readEnvOrNull("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      // Wave 11 · F24 · stable safe code · no env-var names leak to client.
      return NextResponse.json(
        { ok: false, error: "misconfigured" },
        { status: 500 }
      );
    }
    const sb = createClient(url, key, { auth: { persistSession: false } });

    // Parallel telemetry fetch — all scoped to the window.
    // NOTE: for very high-volume windows this pulls a lot of rows; we cap
    // reasonably. Server-side aggregation via SQL RPC would be more
    // efficient; deferred until row counts justify.
    const [jobsRes, resultsRes, heartbeatsRes, contradictionsRes, recordsRes] = await Promise.all([
      sb.from("worker_jobs")
        .select("id,worker_type,status,created_at,assigned_at,completed_at,attempts,last_error")
        .or(`completed_at.gte.${from},created_at.gte.${from}`)
        .limit(50000),
      sb.from("worker_results")
        .select("id,job_id,worker_type,llm_provider,llm_ms,llm_tokens_in,llm_tokens_out,created_at")
        .gte("created_at", from)
        .limit(50000),
      sb.from("worker_heartbeats")
        .select("host_id,last_seen_at,uptime_ms,cycles_total,cycles_failed,metadata")
        .gte("last_seen_at", new Date(now - HEARTBEAT_ONLINE_MS).toISOString()),
      sb.from("contradictions")
        .select("id,detected_at,resolved_at")
        .or(`detected_at.gte.${from},resolved_at.gte.${from}`),
      // Approximation for "records promoted in window": records whose
      // last_reviewed_at falls in the window AND status is AUTHORITATIVE.
      // Not perfect — a re-review of an already-authoritative record counts
      // too. Prescribed fix in missing_telemetry: record_status_transitions.
      sb.from("knowledge_records")
        .select("id,status,created_at,last_reviewed_at")
        .or(`last_reviewed_at.gte.${from},created_at.gte.${from}`)
        .limit(50000),
    ]);

    if (jobsRes.error)          return err("jobs", jobsRes.error.message);
    if (resultsRes.error)       return err("results", resultsRes.error.message);
    if (heartbeatsRes.error)    return err("heartbeats", heartbeatsRes.error.message);
    if (contradictionsRes.error)return err("contradictions", contradictionsRes.error.message);
    if (recordsRes.error)       return err("records", recordsRes.error.message);

    const inputs: AuditInputs = {
      window_from: from,
      window_to: to,
      jobs: (jobsRes.data ?? []) as RawWorkerJob[],
      results: (resultsRes.data ?? []) as RawWorkerResult[],
      cloud_workers: (heartbeatsRes.data ?? []) as RawCloudWorker[],
      // Normalise contradictions column: schema uses `detected_at`,
      // aggregator expects `created_at`.
      contradictions: ((contradictionsRes.data ?? []) as Array<{ id: string; detected_at: string; resolved_at: string | null }>)
        .map((c) => ({ id: c.id, created_at: c.detected_at, resolved_at: c.resolved_at })),
      // Normalise last_reviewed_at → updated_at for the aggregator shape.
      record_changes: ((recordsRes.data ?? []) as Array<{ id: string; status: string; created_at: string; last_reviewed_at: string | null }>)
        .map((r) => ({ id: r.id, status: r.status, created_at: r.created_at, updated_at: r.last_reviewed_at })),
      worker_types: WORKER_TYPES,
    };

    const audit = computeWorkerActivityAudit(inputs);
    return NextResponse.json({
      ok: true,
      audit,
      row_counts: {
        jobs: inputs.jobs.length,
        results: inputs.results.length,
        cloud_workers: inputs.cloud_workers.length,
        contradictions: inputs.contradictions.length,
        record_changes: inputs.record_changes.length,
      },
    });
  } catch (e) {
    // Wave 11 · F24 · safe envelope · full detail logged with correlation id.
    return NextResponse.json(
      toClientError(e, { defaultCode: "read_failed", logTag: "api.brain.worker-audit" }),
      { status: 500 }
    );
  }
}

function err(source: string, _msg: string) {
  // Wave 11 · F24 · source identifier retained for server-side context
  // (already logged elsewhere) but never included in the client body.
  return NextResponse.json(
    { ok: false, error: "read_failed" },
    { status: 500 }
  );
}
