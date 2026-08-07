// POST /api/nex/comms-social/oauth/[platform]/initiate
// Body: { tenant_id, initiated_by, redirect_uri, scopes?, redirect_to?, ttl_seconds? }
// Returns: { ok, authorize_url, state, expires_at }
//
// Charter §S-IX · never logs the state; state is returned to the caller
// who is expected to redirect the merchant to authorize_url immediately.
import { NextResponse } from "next/server";
import { initiateOAuth } from "@/lib/nex/comms-social/oauth/flow";
import type { SocialPlatform } from "@/lib/nex/comms-social/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ platform: SocialPlatform }> }) {
  const { platform } = await ctx.params;
  let body: { tenant_id?: string; initiated_by?: string; redirect_uri?: string; scopes?: string[]; redirect_to?: string; ttl_seconds?: number };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  if (!body.tenant_id || !body.initiated_by || !body.redirect_uri) {
    return NextResponse.json({ ok: false, error: "tenant_id + initiated_by + redirect_uri required" }, { status: 400 });
  }

  try {
    const r = await initiateOAuth({
      tenant_id:    body.tenant_id,
      platform,
      initiated_by: body.initiated_by,
      redirect_uri: body.redirect_uri,
      scopes:       body.scopes,
      redirect_to:  body.redirect_to,
      ttl_seconds:  body.ttl_seconds,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
