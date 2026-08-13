// GET/POST /api/nex/brain/router — Brain Router surface
//
// GET   returns brain stats (memories per brain · last added) OR memories
//       for one brain when ?brain=<slug> is provided.
//
// POST  routes work. Body forms:
//         { job_id: "..." }         → route ONE completed job to its target brains
//         { scan: true, limit?: N } → scan every completed job that isn't fully routed
//
// Turns Brain Router from 🔴 Not Installed → 🟢 Running.
//
// Doctrine:
// · project_nex_phase8_backend_build_starts_2026_08_07.md
// · Nex Record Constitution clauses 1 (one owner) + 7 (traceable to record)
// · ADR-0033 brain isolation

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  brainStats,
  listMemories,
  routeJob,
  routeAllCompleted,
} from "@/lib/nex/brain/router";
// Wave 11 · F21 brain allowlist + F24 error envelope. Every route in
// this file validates its brain slug against the shared allowlist
// BEFORE touching storage, and surfaces errors via the safe envelope.
import { assertBrainSlug } from "@/lib/nex/api/validators";
import { toClientError } from "@/lib/nex/api/error-envelope";
// V-1b · D9 route-boundary validation adopted 2026-08-10 (schemas cover
// shape + range; F21 assertBrainSlug still runs for the domain check).
import { validateSearchParams, validateJsonBody } from "@/lib/nex/brain/http/validate-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GetQuerySchema = z.object({
  brain: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  since_hours: z.coerce.number().int().min(1).max(8760).default(720),
});

const PostBodySchema = z.object({
  job_id: z.string().min(1).optional(),
  scan: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).optional(),
}).refine((d) => d.scan === true || (typeof d.job_id === "string" && d.job_id.length > 0), {
  message: "either scan: true OR job_id required",
  path: ["job_id"],
});

// ── GET · brain stats or per-brain memories ───────────────────────

export async function GET(req: NextRequest) {
  const parsed = validateSearchParams(req, GetQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { brain, limit, since_hours: hours } = parsed.data;

  try {
    if (brain) {
      // Wave 11 · F21 · validate the brain slug BEFORE touching storage.
      // Rejects path-traversal shapes, unknown/typoed brains, and
      // fingerprinting attempts (case/whitespace variants).
      const check = assertBrainSlug(brain);
      if (!check.ok) {
        const code =
          check.reason === "unknown_brain" ? "unknown_brain" :
          check.reason === "invalid_format" ? "invalid_param" :
          "invalid_param";
        return NextResponse.json({ ok: false, error: code }, { status: 400 });
      }
      const memories = await listMemories(check.slug, { limit, since_ms: hours * 60 * 60 * 1000 });
      return NextResponse.json({
        ok: true,
        backend: "filesystem",
        brain_slug: check.slug,
        memories,
        count: memories.length,
        since_hours: hours,
      });
    }
    const stats = await brainStats();
    const total_memories = stats.reduce((n, s) => n + s.memories, 0);
    return NextResponse.json({
      ok: true,
      backend: "filesystem",
      brains: stats,
      brain_count: stats.length,
      total_memories,
    });
  } catch (err) {
    // Wave 11 · F24 · error envelope replaces the prior err.message leak.
    // Full detail is logged server-side with a correlation id.
    return NextResponse.json(
      toClientError(err, { defaultCode: "read_failed", logTag: "brain-router.GET" }),
      { status: 500 },
    );
  }
}

// ── POST · route one job OR scan every unrouted completed job ─────

export async function POST(req: NextRequest) {
  const parsed = await validateJsonBody(req, PostBodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  try {
    if (body.scan === true) {
      const limit = typeof body.limit === "number" ? body.limit : 100;
      const result = await routeAllCompleted(limit);
      const routed_count = result.results.reduce((n, r) => n + r.routed.length, 0);
      return NextResponse.json({
        ok: true,
        mode: "scan",
        backend: "filesystem",
        scanned: result.scanned,
        jobs_routed: result.results.length,
        memories_added: routed_count,
        results: result.results,
      });
    }

    const job_id = (body.job_id ?? "").trim();
    // zod refine already guarantees job_id when scan !== true, but the
    // trim() may reduce a whitespace-only value to "" · keep the guard.
    if (!job_id) {
      return NextResponse.json({ ok: false, error: "job_id_or_scan_required" }, { status: 400 });
    }
    const result = await routeJob(job_id);
    return NextResponse.json({
      ok: true,
      mode: "single",
      backend: "filesystem",
      ...result,
    });
  } catch (err) {
    console.error("[brain-router.POST] failed:", err);
    return NextResponse.json(
      { ok: false, error: "route_failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
