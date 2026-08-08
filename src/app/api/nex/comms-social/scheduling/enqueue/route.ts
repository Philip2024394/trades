// POST /api/nex/comms-social/scheduling/enqueue
// Body: { tenant_id, draft_id, account_id, platform, run_at, enqueued_by, max_attempts? }
import { NextResponse } from "next/server";
import { withTenantClient } from "@/lib/nex/comms-social/db";
import { enqueuePublish } from "@/lib/nex/comms-social/scheduling/enqueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: {
    tenant_id?: string; draft_id?: string; account_id?: string;
    platform?: string; run_at?: string; enqueued_by?: string; max_attempts?: number;
  };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (!body.tenant_id || !body.draft_id || !body.account_id || !body.platform || !body.run_at || !body.enqueued_by) {
    return NextResponse.json({ ok: false, error: "tenant_id + draft_id + account_id + platform + run_at + enqueued_by required" }, { status: 400 });
  }
  const r = await withTenantClient(body.tenant_id, async (c) =>
    await enqueuePublish({
      client: c, tenant_id: body.tenant_id!, draft_id: body.draft_id!,
      account_id: body.account_id!, platform: body.platform!,
      run_at: body.run_at!, enqueued_by: body.enqueued_by!,
      max_attempts: body.max_attempts,
    }));
  if (!r || r.ok === false) {
    return NextResponse.json({ ok: false, error: r?.error_class ?? "enqueue_failed", detail: r?.detail }, { status: 400 });
  }
  return NextResponse.json({ ok: true, scheduled_id: r.scheduled_id, status: r.status });
}
