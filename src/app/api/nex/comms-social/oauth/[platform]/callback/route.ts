// GET /api/nex/comms-social/oauth/[platform]/callback?code=&state=&tenant_id=&redirect_uri=
// Returns: { ok, account?, redirect_to?, error? }
//
// Providers redirect the merchant here with `code` + `state`. We
// deliberately require tenant_id + redirect_uri as query params so
// this route stays stateless (the initiate flow returned the URL to
// use). In a real deployment those may be stored in a session cookie
// or in the state token itself; Phase 1 keeps them explicit.
//
// Charter §S-IX · the incoming `code` is never logged. Redaction is
// enforced via the emit-audit path in connectAccount().
import { NextResponse } from "next/server";
import { handleCallback } from "@/lib/nex/comms-social/oauth/flow";
import type { SocialPlatform } from "@/lib/nex/comms-social/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ platform: SocialPlatform }> }) {
  const { platform } = await ctx.params;
  const url = new URL(request.url);
  const code         = url.searchParams.get("code");
  const state        = url.searchParams.get("state");
  const tenant_id    = url.searchParams.get("tenant_id");
  const redirect_uri = url.searchParams.get("redirect_uri");
  const providerErr  = url.searchParams.get("error");

  if (providerErr) {
    return NextResponse.json({ ok: false, error: `provider_denied:${providerErr}` }, { status: 400 });
  }
  if (!code || !state || !tenant_id || !redirect_uri) {
    return NextResponse.json({ ok: false, error: "code + state + tenant_id + redirect_uri required" }, { status: 400 });
  }

  try {
    const r = await handleCallback({ tenant_id, platform, code, state, redirect_uri });
    if (!r.ok) return NextResponse.json({ ok: false, error: r.reason }, { status: 400 });
    return NextResponse.json({ ok: true, account: r.account, redirect_to: r.redirect_to });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
