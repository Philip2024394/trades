// GET /api/nex/comms-social/scheduling/jobs?tenant_id=&status=&limit=
import { NextResponse } from "next/server";
import { withTenantClient } from "@/lib/nex/comms-social/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenant_id = url.searchParams.get("tenant_id");
  if (!tenant_id) return NextResponse.json({ ok: false, error: "tenant_id required" }, { status: 400 });
  const status = url.searchParams.get("status");
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
  const rows = await withTenantClient(tenant_id, async (c) => {
    const params: unknown[] = [tenant_id];
    let sql = `SELECT scheduled_id, tenant_id, draft_id, account_id, platform, run_at, attempts,
                       max_attempts, status, lease_owner, lease_expires_at, intent_id, last_error,
                       refused_reasons, enqueued_by, enqueued_at, finished_at
                  FROM nex.social_scheduled_posts
                 WHERE tenant_id = $1`;
    if (status) { params.push(status); sql += ` AND status = $${params.length}`; }
    params.push(limit);
    sql += ` ORDER BY enqueued_at DESC LIMIT $${params.length}`;
    const r = await c.query(sql, params);
    return r.rows;
  });
  return NextResponse.json({ ok: true, jobs: rows ?? [] });
}
