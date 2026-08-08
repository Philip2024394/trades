// GET /api/cron/comms-social-worker
// Auth: header 'x-cron-secret' must match CRON_SECRET.
//
// Vercel-scheduled tick for the NEX Comms Centre Social worker.
// Runs the worker loop up to MAX_ITERATIONS times per invocation so
// a single cron fire can drain a small burst of queued posts. Every
// iteration goes through the existing runWorkerTickOnce (leases one
// job · verifies two-phase publish · records outcome).
//
// This is the Phase 10 wiring · does NOT touch the older
// hammerex-side /api/cron/nex-social-publish route (that one drives
// the legacy Hammerex Social module).

import { NextResponse, type NextRequest } from "next/server";
import { runWorkerTickOnce } from "@/lib/nex/comms-social/worker/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ITERATIONS = 10;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;
  // In dev (no CRON_SECRET set) allow open access · matches the pattern
  // used by other cron routes in this repo (e.g. affiliate-fraud-check).
  if (expected && secret !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  const results: Array<{ iteration: number; processed: number; outcomes: unknown[] }> = [];
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    try {
      const r = await runWorkerTickOnce({ worker_id: `vercel-cron-${i}` });
      results.push({ iteration: i, processed: r.processed, outcomes: r.outcomes });
      if (r.processed === 0) break; // no more work → stop draining
    } catch (e) {
      results.push({ iteration: i, processed: 0, outcomes: [`error:${e instanceof Error ? e.message : String(e)}`] });
      break;
    }
  }

  return NextResponse.json({ ok: true, iterations: results.length, results });
}
