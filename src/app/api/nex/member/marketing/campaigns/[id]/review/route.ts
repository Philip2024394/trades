// GET /api/nex/member/marketing/campaigns/[id]/review
//
// Full pre-send review: audience count + sender health/capacity + package
// state + refusal reasons. Never exposes contact addresses.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveMemberAuth, reviewMemberCampaign, MemberIsolationError, MemberValidationError } from "@/lib/nex/marketing/member";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = resolveMemberAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const { id } = await ctx.params;
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });

  const client = await pool.connect();
  try {
    const review = await reviewMemberCampaign(client, auth, id);
    return NextResponse.json({ ok: true, review });
  } catch (e) {
    if (e instanceof MemberIsolationError) {
      return NextResponse.json({ ok: false, error: "not_found_or_forbidden" }, { status: 404 });
    }
    if (e instanceof MemberValidationError) {
      return NextResponse.json({ ok: false, error: "validation_error", detail: e.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "internal_error", detail: String(e).slice(0, 200) }, { status: 500 });
  } finally {
    client.release();
  }
}
