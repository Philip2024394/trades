// GET /api/cron/nex-marketing-send-tick
//
// NEX Marketing · Stage 1.2 · send-executor cron
// Founder-authorised programme (three-lane operating doctrine 2026-09-21).
//
// CRON_SECRET-gated (matches existing NEX cron pattern e.g. nex-proactive).
// Invokes the send-queue executor to drain `nex.marketing_send_queue` batch
// by batch. Multi-worker-safe via SKIP LOCKED · returns diagnostic JSON.

import { NextResponse } from "next/server";
import os from "node:os";
import { tick, DEFAULT_BATCH_SIZE } from "@/lib/nex/marketing/send-executor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (secret && bearer !== secret) {
    return NextResponse.json({ ok: false, error: "not-authorised" }, { status: 401 });
  }

  const url = new URL(req.url);
  const batch_size = Math.min(Math.max(1, Number(url.searchParams.get("batch") ?? DEFAULT_BATCH_SIZE)), 200);
  const worker_id = `marketing-send:${os.hostname().slice(0, 30)}-${process.pid}`;

  const t0 = Date.now();
  const result = await tick({ worker_id, batch_size });

  return NextResponse.json({
    ok: true,
    duration_ms: Date.now() - t0,
    ...result,
  });
}
