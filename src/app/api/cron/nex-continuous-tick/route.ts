// GET/POST /api/cron/nex-continuous-tick
//
// Founder-authorised programme · Session-19 · World-proof gate #2 · 2026-09-22.
//
// Continuous 5-minute orchestration tick endpoint. Gated on
// NEX_DISCOVERY_CRON_ACTIVATION === "on". When gate off → 503 dormant.
// When gate on → runs orchestrator tick + reaper · returns typed outcome.
//
// Idempotency (UNIQUE(worker_id, minute_bucket)) is enforced at the SQL layer
// in the orchestrator itself. External schedulers may safely retry.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { runOrchestrationTick, runReaper } from "@/lib/nex/discovery-world/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function run(req: Request) {
  if (process.env.NEX_DISCOVERY_CRON_ACTIVATION !== "on") {
    return NextResponse.json({
      ok: false,
      state: "endpoint_dormant",
      note: "set NEX_DISCOVERY_CRON_ACTIVATION=on to activate the continuous tick",
    }, { status: 503 });
  }
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  const worker_id = req.headers.get("x-worker-id") || process.env.NEX_CRON_WORKER_ID || "cron-default";
  try {
    const tick = await runOrchestrationTick(client, { worker_id, now: new Date() }).catch((e: any) => ({
      kind: "error", detail: e?.message ?? String(e),
    }));
    const reap = await runReaper(client, { now: new Date() }).catch((e: any) => ({
      kind: "error", detail: e?.message ?? String(e),
    }));
    return NextResponse.json({ ok: true, state: "active", tick, reap });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "internal_error", detail: (e as Error).message }, { status: 500 });
  } finally { client.release(); }
}

export async function GET(req: Request)  { return run(req); }
export async function POST(req: Request) { return run(req); }
