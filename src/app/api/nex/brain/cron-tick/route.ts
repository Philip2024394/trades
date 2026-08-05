// GET /api/nex/brain/cron-tick — Vercel Cron entrypoint
//
// Vercel Cron issues GET requests, so this is a small GET wrapper that
// calls the same manager pipeline as POST /api/nex/brain/run-once.
//
// Vercel automatically authenticates cron requests with a bearer token
// (Authorization: Bearer $CRON_SECRET set in Vercel project env). We
// verify that in addition to our own NEX_BRAIN_CRON_TOKEN if it's set.
//
// External cron services (cron-job.org, GitHub Actions, etc.) can also
// hit this endpoint — they just need to send the NEX_BRAIN_CRON_TOKEN
// as either Authorization: Bearer <token> or X-Brain-Cron-Token: <token>.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { dispatchNewInboxItems, runOneCycle } from "@/lib/nex/brain/manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const vercelSecret = process.env.CRON_SECRET;
  const brainToken = process.env.NEX_BRAIN_CRON_TOKEN;

  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";
  const cronHeader = req.headers.get("x-brain-cron-token") ?? "";

  // Vercel Cron: bearer must match CRON_SECRET
  // External cron: bearer OR x-brain-cron-token must match NEX_BRAIN_CRON_TOKEN
  const vercelOk = vercelSecret ? bearer === vercelSecret : false;
  const brainOk = brainToken
    ? bearer === brainToken || cronHeader === brainToken
    : false;
  const openIfNoTokens = !vercelSecret && !brainToken; // dev / local

  if (!vercelOk && !brainOk && !openIfNoTokens) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
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
