// POST /api/nex/comms-social/oauth-for-me/[platform]/start
//
// Session-based OAuth initiate: derives tenant from the signed-in user
// so the merchant UI never has to pass a tenant_id. Wraps initiateOAuth.

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/nex/brains/_auth";
import { resolveTenantForUser } from "@/lib/nex/comms-social/identity/resolve";
import { initiateOAuth } from "@/lib/nex/comms-social/oauth/flow";
import { resolveTierForTenant } from "@/lib/comms-social-tier/gate";
import type { SocialPlatform } from "@/lib/nex/comms-social/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ platform: SocialPlatform }> }) {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const tenant = await resolveTenantForUser(auth.user.supabase_user_id);
  if (!tenant) {
    return NextResponse.json(
      { ok: false, error: "no_tenant · call POST /api/nex/comms-social/provision first" },
      { status: 409 },
    );
  }

  const tier = await resolveTierForTenant({ tenant_id: tenant.tenant_id, email: auth.user.email });
  if (!tier.has_access) {
    return NextResponse.json(
      { ok: false, error: "tier_locked", detail: `Social Posting requires Professional or higher · current tier: ${tier.tier}`, upgrade_url: "/trade-off/pricing" },
      { status: 403 },
    );
  }

  const { platform } = await ctx.params;

  let body: { redirect_uri?: string; scopes?: string[]; redirect_to?: string; ttl_seconds?: number };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (!body.redirect_uri) {
    return NextResponse.json({ ok: false, error: "redirect_uri required" }, { status: 400 });
  }

  try {
    const r = await initiateOAuth({
      tenant_id:    tenant.tenant_id,
      platform,
      initiated_by: `user:${auth.user.supabase_user_id}`,
      redirect_uri: body.redirect_uri,
      scopes:       body.scopes,
      redirect_to:  body.redirect_to,
      ttl_seconds:  body.ttl_seconds,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
