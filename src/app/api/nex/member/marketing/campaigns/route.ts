// /api/nex/member/marketing/campaigns
//
// GET   · list member's own campaigns
// POST  · create draft campaign

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveMemberAuth, listMemberCampaigns, createDraftCampaign, MemberValidationError, MemberIsolationError } from "@/lib/nex/marketing/member";
import type { CampaignComposerInput } from "@/lib/nex/marketing/member";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = resolveMemberAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });

  const client = await pool.connect();
  try {
    const campaigns = await listMemberCampaigns(client, auth);
    return NextResponse.json({ ok: true, member_id: auth.member_id, campaigns });
  } finally {
    client.release();
  }
}

export async function POST(req: Request) {
  const auth = resolveMemberAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null) as CampaignComposerInput | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });

  const client = await pool.connect();
  try {
    const campaign = await createDraftCampaign(client, auth, body);
    return NextResponse.json({ ok: true, campaign });
  } catch (e) {
    if (e instanceof MemberIsolationError) {
      return NextResponse.json({ ok: false, error: "member_isolation_violation", detail: e.message }, { status: 403 });
    }
    if (e instanceof MemberValidationError) {
      return NextResponse.json({ ok: false, error: "validation_error", detail: e.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "internal_error", detail: String(e).slice(0, 200) }, { status: 500 });
  } finally {
    client.release();
  }
}
