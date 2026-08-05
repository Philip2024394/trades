// POST /api/nex/brain/run-once — drives one processing cycle.
//
// Runs Knowledge Context → Voice Context → Learning Context →
// Knowledge Extractor → Quality Checker batches in order. Returns
// the CycleReport summarising what happened.
//
// Body (optional): {
//   context_batch?, voice_batch?, learning_batch?,
//   extractor_batch?, checker_batch?, skip_dispatch?
// }
//
// Auth (optional): if NEX_BRAIN_CRON_TOKEN is set on the server, the
// caller must send it as X-Brain-Cron-Token header. If it's unset,
// the endpoint is unauthenticated (fine for local dev). When deployed,
// set the token so only your cron service can trigger cycles.
//
// Typical callers:
//   · "Run one cycle" button on /nex-app/nex-brain
//   · scripts/nex-brain-worker.mjs (local always-on worker)
//   · Vercel cron (see vercel.json — activates on deploy)
//   · External cron (cron-job.org, GitHub Actions, Supabase pg_cron)

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { dispatchNewInboxItems, runOneCycle } from "@/lib/nex/brain/manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  // Cron token check (only enforced when the env var is configured)
  const requiredToken = process.env.NEX_BRAIN_CRON_TOKEN;
  if (requiredToken) {
    const providedToken = req.headers.get("x-brain-cron-token") ?? "";
    if (providedToken !== requiredToken) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }
  }

  let body: {
    context_batch?: number;
    voice_batch?: number;
    learning_batch?: number;
    extractor_batch?: number;
    checker_batch?: number;
    skip_dispatch?: boolean;
  } = {};
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
      context_batch: body.context_batch ?? 3,
      voice_batch: body.voice_batch ?? 3,
      learning_batch: body.learning_batch ?? 3,
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

