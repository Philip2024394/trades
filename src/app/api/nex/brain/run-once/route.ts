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
// Auth is delegated to src/lib/nex/brain/auth/require-cron-token.ts ·
// the SINGLE shared boundary for every pipeline-triggering endpoint.
// Prior to Wave 11 remediation this route implemented its own auth
// block that silently opened the endpoint in production if
// NEX_BRAIN_CRON_TOKEN was unset (F15). The shared boundary
// fails-closed in production.
//
// Typical callers:
//   · "Run one cycle" button on /nex-app/nex-brain
//   · scripts/nex-brain-worker.mjs (local always-on worker)
//   · Vercel cron (see vercel.json — activates on deploy)
//   · External cron (cron-job.org, GitHub Actions, Supabase pg_cron)

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { dispatchNewInboxItems, runOneCycle } from "@/lib/nex/brain/manager";
import { checkCronAuth, cronAuthErrorBody } from "@/lib/nex/brain/auth/require-cron-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const auth = checkCronAuth(req);
  if (!auth.ok) {
    if (auth.code === "misconfigured") {
      console.error("[api.brain.run-once] " + auth.message);
    }
    return NextResponse.json(cronAuthErrorBody(auth), { status: auth.status });
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

