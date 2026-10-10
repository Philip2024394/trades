// GET /api/nex/founder/marketing/campaigns/[id]/review
//
// Final review gate before send · aggregates audience + sender + refusal reasons.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveFounderAuth, reviewFounderCampaign, FounderValidationError, FounderLaneViolationError } from "@/lib/nex/marketing/founder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const { id } = await params;
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    const review = await reviewFounderCampaign(client, auth, id);
    return NextResponse.json({ ok: true, review });
  } catch (e) {
    if (e instanceof FounderValidationError) return NextResponse.json({ ok: false, error: e.reason }, { status: 404 });
    if (e instanceof FounderLaneViolationError) return NextResponse.json({ ok: false, error: "lane_violation", detail: e.message }, { status: 403 });
    throw e;
  } finally {
    client.release();
  }
}
