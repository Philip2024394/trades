// GET /api/nex/comms-social/content/validator-runs?tenant_id=&draft_id=&limit=
import { NextResponse } from "next/server";
import { withTenantClient } from "@/lib/nex/comms-social/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenant_id = url.searchParams.get("tenant_id");
  const draft_id  = url.searchParams.get("draft_id");
  if (!tenant_id) return NextResponse.json({ ok: false, error: "tenant_id required" }, { status: 400 });
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));

  const rows = await withTenantClient(tenant_id, async (c) => {
    if (draft_id) {
      const r = await c.query(
        `SELECT run_id, tenant_id, draft_id, subject, started_at, completed_at, total_ms,
                stages, outcome, rejection_summary
           FROM nex.social_validator_runs
          WHERE tenant_id = $1 AND draft_id = $2
          ORDER BY started_at DESC
          LIMIT $3`,
        [tenant_id, draft_id, limit]);
      return r.rows;
    }
    const r = await c.query(
      `SELECT run_id, tenant_id, draft_id, subject, started_at, completed_at, total_ms,
              stages, outcome, rejection_summary
         FROM nex.social_validator_runs
        WHERE tenant_id = $1
        ORDER BY started_at DESC
        LIMIT $2`,
      [tenant_id, limit]);
    return r.rows;
  });
  return NextResponse.json({ ok: true, runs: rows ?? [] });
}
