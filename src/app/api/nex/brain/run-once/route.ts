// POST /api/nex/brain/run-once — drives one processing cycle.
//
// Runs the Knowledge Extractor batch, then the Quality Checker batch.
// Returns the CycleReport (which drafts were authored, which passed
// review, which need attention).
//
// Body (optional): { extractor_batch?: number, checker_batch?: number }
//
// Typical use:
//   · From the "Run one cycle" button on /nex-app/nex-brain
//   · From a cron trigger (external service, Vercel cron, or eventually
//     Supabase pg_cron once the Supabase backend is live)

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { dispatchNewInboxItems, runOneCycle } from "@/lib/nex/brain/manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: { extractor_batch?: number; checker_batch?: number; skip_dispatch?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* body is optional */
  }

  try {
    // Dispatch first so any newly-arrived inbox items are enqueued
    // before we drain the workers. Skip on request for pure worker runs.
    const dispatchSummary = body.skip_dispatch
      ? null
      : await dispatchNewInboxItems();

    const cycle = await runOneCycle({
      extractor_batch: body.extractor_batch ?? 3,
      checker_batch: body.checker_batch ?? 6,
    });

    return NextResponse.json({
      ok: true,
      dispatch: dispatchSummary,
      cycle,
    });
  } catch (err) {
    console.error("[api.brain.run-once] failed:", err);
    return NextResponse.json({ ok: false, error: "run_failed" }, { status: 500 });
  }
}
