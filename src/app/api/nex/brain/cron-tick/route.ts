// GET /api/nex/brain/cron-tick — Vercel Cron entrypoint
//
// Vercel Cron issues GET requests, so this is a small GET wrapper that
// calls the same manager pipeline as POST /api/nex/brain/run-once.
//
// Auth is delegated to src/lib/nex/brain/auth/require-cron-token.ts ·
// the SINGLE shared boundary for every pipeline-triggering endpoint.
// Prior to Wave 11 remediation this route implemented its own auth
// block that silently opened the endpoint in production if both
// CRON_SECRET and NEX_BRAIN_CRON_TOKEN were unset (F14). The shared
// boundary fails-closed in production.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { dispatchNewInboxItems, runOneCycle } from "@/lib/nex/brain/manager";
import { checkCronAuth, cronAuthErrorBody } from "@/lib/nex/brain/auth/require-cron-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const auth = checkCronAuth(req);
  if (!auth.ok) {
    if (auth.code === "misconfigured") {
      console.error("[api.brain.cron-tick] " + auth.message);
    }
    return NextResponse.json(cronAuthErrorBody(auth), { status: auth.status });
  }

  try {
    const dispatchSummary = await dispatchNewInboxItems();
    const cycle = await runOneCycle({});
    return NextResponse.json({ ok: true, dispatch: dispatchSummary, cycle });
  } catch (err) {
    console.error("[api.brain.cron-tick] failed:", err);
    return NextResponse.json({ ok: false, error: "run_failed" }, { status: 500 });
  }
}
