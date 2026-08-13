// GET/PATCH /api/nex/brain/jobs — Knowledge Jobs Queue
//
// GET returns latest snapshot per job with filters. PATCH transitions a
// job's status (used by workers claiming/completing). This is the read
// + control surface for the filesystem-backed queue in
// `src/lib/nex/jobs/fs-store.ts`.
//
// GET query params:
//   limit               1..500  (default 50)
//   status              received | queued | claimed | processing | completed | failed
//   since_hours         1..168  (default 168 = 7 days)
//   include_all         true|false — include completed+failed (default false)
//
// PATCH body: { job_id, status?, progress?, completion_result? }
//
// Doctrine: project_nex_phase8_backend_build_starts_2026_08_07.md
// Turns Knowledge Jobs Queue from 🔴 Not Installed → 🟢 Running.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { listJobs, updateJob, jobStats, type JobStatus } from "@/lib/nex/jobs/fs-store";
import { routeJobSafe } from "@/lib/nex/brain/router";
import { validateSearchParams, validateJsonBody } from "@/lib/nex/brain/http/validate-input";
import { logger } from "@/lib/nex/observability/logger";
// W-OBS-1 Path A Layer 1 · Wave 3 H2.a · adopted 2026-08-10.
import { runFromRequest } from "@/lib/nex/observability/correlation";

const log = logger("api.brain.jobs");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// D9 · route-boundary schemas
const JOB_STATUSES = ["received", "queued", "claimed", "processing", "completed", "failed"] as const;
const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  since_hours: z.coerce.number().int().min(1).max(168).default(168),
  status: z.enum(JOB_STATUSES).optional(),
  include_all: z.coerce.boolean().default(false),
});
const PatchBodySchema = z.object({
  job_id: z.string().trim().min(1),
  status: z.enum(JOB_STATUSES).optional(),
  progress: z.number().min(0).max(100).optional(),
  completion_result: z.object({
    memories_added: z.number().optional(),
    brains_linked: z.array(z.string()).optional(),
    error: z.string().optional(),
  }).partial().optional(),
});

// ── GET · list jobs + stats ───────────────────────────────────────

export async function GET(req: NextRequest) {
  return runFromRequest(req, () => jobsGetHandler(req));
}

async function jobsGetHandler(req: NextRequest) {
  const parsed = validateSearchParams(req, ListQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { limit, since_hours: hours, status, include_all: includeAll } = parsed.data;

  try {
    const [jobs, stats] = await Promise.all([
      listJobs({
        limit,
        status,
        include_all_states: includeAll,
        since_ms: hours * 60 * 60 * 1000,
      }),
      jobStats(),
    ]);
    return NextResponse.json({
      ok: true,
      jobs,
      count: jobs.length,
      stats,
      backend: "filesystem",
      since_hours: hours,
    });
  } catch (err) {
    log.error("list_failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { ok: false, error: "list_failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}

// ── PATCH · transition a job's status ─────────────────────────────

export async function PATCH(req: NextRequest) {
  return runFromRequest(req, () => jobsPatchHandler(req));
}

async function jobsPatchHandler(req: NextRequest) {
  const parsed = await validateJsonBody(req, PatchBodySchema);
  if (!parsed.ok) return parsed.response;
  const { job_id, status, progress, completion_result } = parsed.data;

  try {
    const updated = await updateJob(job_id, { status, progress, completion_result });
    if (!updated) {
      return NextResponse.json({ ok: false, error: "job_not_found", job_id }, { status: 404 });
    }
    // Auto-route on completion · fire-and-forget so the PATCH response
    // returns fast · router idempotent-per-brain so replays are safe.
    if (updated.status === "completed") routeJobSafe(updated.job_id);
    return NextResponse.json({ ok: true, job: updated });
  } catch (err) {
    log.error("update_failed", { job_id, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { ok: false, error: "update_failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
