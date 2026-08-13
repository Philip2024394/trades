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
import { z } from "zod";
import { dispatchNewInboxItems, runOneCycle } from "@/lib/nex/brain/manager";
import { checkCronAuth, cronAuthErrorBody } from "@/lib/nex/brain/auth/require-cron-token";
// V-1b · D9 route-boundary validation adopted 2026-08-10.
import { validateJsonBody } from "@/lib/nex/brain/http/validate-input";
// G4 · scheduler-liveness counter. Ticked on every authorised call so
// /api/nex/brain/scheduler-status can report positive evidence that
// the LOCAL script scheduler (nex-brain-worker.mjs) is actually firing ·
// distinct from the Vercel Cron path (which increments `cron_tick.fired`).
import { incr } from "@/lib/nex/observability/counters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BodySchema = z.object({
  context_batch: z.number().int().min(0).max(100).optional(),
  voice_batch: z.number().int().min(0).max(100).optional(),
  learning_batch: z.number().int().min(0).max(100).optional(),
  extractor_batch: z.number().int().min(0).max(100).optional(),
  checker_batch: z.number().int().min(0).max(100).optional(),
  skip_dispatch: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const auth = checkCronAuth(req);
  if (!auth.ok) {
    if (auth.code === "misconfigured") {
      console.error("[api.brain.run-once] " + auth.message);
    }
    return NextResponse.json(cronAuthErrorBody(auth), { status: auth.status });
  }

  const parsed = await validateJsonBody(req, BodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  // G4 · scheduler-fired signal. Ticked after auth+parse succeed · counts
  // the trigger itself, not the cycle's success. Same placement as
  // `incr("cron_tick.fired")` in cron-tick/route.ts. Mirrors the
  // "invocation observed" semantic required by Truth Contract §5 R12.
  incr("run_once.fired");

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
    incr("run_once.failed");
    return NextResponse.json({ ok: false, error: "run_failed" }, { status: 500 });
  }
}

