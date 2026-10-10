// /api/nex/member/marketing/campaigns/[id]
//
// GET    · load campaign summary + preview
// PATCH  · schedule / send-now / cancel  (body: { action: 'schedule' | 'send_now' | 'cancel', reason?: string })

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import {
  resolveMemberAuth,
  loadMemberCampaign,
  previewMemberCampaign,
  scheduleOrSendMemberCampaign,
  cancelMemberCampaign,
  MemberIsolationError,
  MemberValidationError,
} from "@/lib/nex/marketing/member";

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
    const [campaign, preview] = await Promise.all([
      loadMemberCampaign(client, auth, id),
      previewMemberCampaign(client, auth, id).catch(() => null),
    ]);
    return NextResponse.json({ ok: true, campaign, preview });
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

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = resolveMemberAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null) as { action?: "schedule" | "send_now" | "cancel"; reason?: string } | null;
  if (!body?.action) return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });

  const client = await pool.connect();
  try {
    let result;
    if (body.action === "cancel") {
      result = await cancelMemberCampaign(client, auth, id, body.reason ?? "member_cancelled");
    } else {
      result = await scheduleOrSendMemberCampaign(client, auth, id, { send_now: body.action === "send_now" });
    }
    return NextResponse.json({ ok: true, result });
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
