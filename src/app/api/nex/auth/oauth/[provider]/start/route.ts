// src/app/api/nex/auth/oauth/[provider]/start/route.ts
//
// Founder Phase 24 · P24-2 · OAuth authorization-code flow start.
//
// Returns 302 → provider's authorize URL with:
//   · response_type=code
//   · client_id
//   · redirect_uri (this host + /api/nex/auth/oauth/{provider}/callback)
//   · scope
//   · state         (opaque, single-use, TTL 10 minutes)
//   · code_challenge + code_challenge_method=S256 (PKCE)
//
// When creds are missing returns 503 with oauth_not_configured — never fabricates.

import { NextResponse } from "next/server";
import { getProvider, isConfigured } from "@/lib/nex/oauth/providers";
import { issueState } from "@/lib/nex/oauth/state";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const p = getProvider(provider);
  if (!p) return NextResponse.json({ error: "unknown_provider", provider }, { status: 404 });
  if (!isConfigured(p)) {
    return NextResponse.json({
      error: "oauth_not_configured",
      provider: p.id,
      hint: `Set ${p.id.toUpperCase()}_OAUTH_CLIENT_ID and ${p.id.toUpperCase()}_OAUTH_CLIENT_SECRET in .env.local, then restart.`,
    }, { status: 503 });
  }

  const url = new URL(req.url);
  const redirect_after = url.searchParams.get("redirect_after") ?? "/nex/settings";
  const host = req.headers.get("host") ?? "localhost:3008";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const redirect_uri = `${proto}://${host}/api/nex/auth/oauth/${p.id}/callback`;

  const { state, code_challenge } = issueState({ provider_id: p.id, redirect_after });

  const authUrl = new URL(p.authorize_url);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", p.client_id);
  authUrl.searchParams.set("redirect_uri", redirect_uri);
  authUrl.searchParams.set("scope", p.scopes.join(" "));
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", code_challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  return NextResponse.redirect(authUrl.toString(), { status: 302 });
}
