// GET/POST /api/nex/brain/recovery — Recovery Manager surface
//
// GET   returns current ladder state for every blocked worker plus a
//       tail of the attempt log · consumed by the Recovery Timeline UI.
//
// POST  runs one recovery scan pass. Body:
//         {
//           workers:   WorkerSnapshot[],
//           providers: ProviderSnapshot[],
//           dry_run?:  boolean   // default true
//         }
//       In dry_run mode NEX still logs every attempt (attempts ARE the
//       audit trail) and emits Intelligence Events · but does not perform
//       the underlying action (worker restart · reassignment · etc.)
//       until the Dispatch API + worker control plane exist.
//
// Turns Recovery Manager from 🔴 Not Installed → 🟡 API-triggered scans
// (green upgrade once wired to a scheduled cron or worker heartbeat).
//
// Doctrine:
// · feedback_nex_worker_recovery_and_self_healing_2026_08_07.md
// · feedback_nex_recovery_ladder_and_timeline_2026_08_07.md
// · project_nex_phase8_backend_build_starts_2026_08_07.md

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  listAttempts,
  scanForRecovery,
  type ProviderSnapshot,
  type WorkerSnapshot,
} from "@/lib/nex/recovery/manager";
// V-1b · D9 route-boundary validation adopted 2026-08-10.
import { validateSearchParams, validateJsonBody } from "@/lib/nex/brain/http/validate-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GetQuerySchema = z.object({
  job_id: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

// Snapshots come from trusted internal callers; validate shape at the
// boundary + preserve the existing per-entry filter for defensive robustness.
const PostBodySchema = z.object({
  workers: z.array(z.unknown()).optional().default([]),
  providers: z.array(z.unknown()).optional().default([]),
  dry_run: z.boolean().optional().default(true),
});

// ── GET · attempt tail + last scan summary ────────────────────────

export async function GET(req: NextRequest) {
  const parsed = validateSearchParams(req, GetQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { job_id, limit } = parsed.data;

  try {
    const attempts = await listAttempts(job_id);
    const tail = attempts.slice(-limit).reverse();

    // Roll up by job for a quick "how is each blocked job doing" view.
    const perJob = new Map<string, {
      job_id: string;
      total_attempts: number;
      highest_level: number;
      last_action: string;
      last_outcome: string;
      last_at: string;
      escalated: boolean;
    }>();
    for (const a of attempts) {
      const prev = perJob.get(a.job_id);
      if (!prev || a.at > prev.last_at) {
        perJob.set(a.job_id, {
          job_id: a.job_id,
          total_attempts: (prev?.total_attempts ?? 0) + 1,
          highest_level: Math.max(prev?.highest_level ?? 0, a.level),
          last_action: a.action,
          last_outcome: a.outcome,
          last_at: a.at,
          escalated: (prev?.escalated ?? false) || a.level === 5,
        });
      } else {
        prev.total_attempts += 1;
        prev.highest_level = Math.max(prev.highest_level, a.level);
        if (a.level === 5) prev.escalated = true;
      }
    }

    return NextResponse.json({
      ok: true,
      backend: "filesystem",
      attempts: tail,
      count: tail.length,
      total_attempts: attempts.length,
      per_job: [...perJob.values()].sort((a, b) => (a.last_at < b.last_at ? 1 : -1)),
    });
  } catch (err) {
    console.error("[recovery.GET] failed:", err);
    return NextResponse.json(
      { ok: false, error: "list_failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}

// ── POST · run a scan pass ────────────────────────────────────────

export async function POST(req: NextRequest) {
  const parsed = await validateJsonBody(req, PostBodySchema);
  if (!parsed.ok) return parsed.response;
  const { workers, providers, dry_run } = parsed.data;

  // Loose per-entry validation — snapshots come from trusted internal callers,
  // but guard against obvious corruption so a single bad payload doesn't
  // poison the attempt log. Preserved from the pre-V-1b implementation.
  const validWorkers = (workers as WorkerSnapshot[]).filter(
    (w) => w && typeof w.worker_type === "string" && typeof w.state === "string",
  );
  const validProviders = (providers as ProviderSnapshot[]).filter(
    (p) => p && typeof p.provider === "string" && typeof p.status === "string",
  );

  try {
    const result = await scanForRecovery({
      workers: validWorkers,
      providers: validProviders,
      dry_run,
    });
    return NextResponse.json({
      ok: true,
      backend: "filesystem",
      dry_run,
      ...result,
    });
  } catch (err) {
    console.error("[recovery.POST] scan failed:", err);
    return NextResponse.json(
      { ok: false, error: "scan_failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
