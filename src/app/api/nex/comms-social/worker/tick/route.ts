// POST /api/nex/comms-social/worker/tick
// Runs ONE worker iteration (leases at most one job · dispatches through
// the pipeline · records outcome). Cron/loop callers invoke repeatedly.
// Optional body: { worker_id?, lease_ttl_s? }
import { NextResponse } from "next/server";
import { runWorkerTickOnce } from "@/lib/nex/comms-social/worker/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { worker_id?: string; lease_ttl_s?: number } = {};
  try { body = await request.json() as typeof body; } catch { /* body optional */ }
  try {
    const r = await runWorkerTickOnce({ worker_id: body.worker_id, lease_ttl_s: body.lease_ttl_s });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
