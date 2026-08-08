// GET /api/nex/comms-social/oauth-for-me/[platform]/callback
//
// Merchant-facing OAuth return endpoint. Behaves identically to the
// existing callback route (calls handleCallback), but responds with a
// small HTML page that posts a message to the opener window and
// closes itself. This is what powers the popup-based Connect flow in
// the First-Post Wizard.
//
// The window.opener.postMessage payload is minimal and never contains
// tokens: { source: "nex-comms-social", platform, ok, account? }

import { NextResponse } from "next/server";
import { handleCallback } from "@/lib/nex/comms-social/oauth/flow";
import { resolveTenantForUser } from "@/lib/nex/comms-social/identity/resolve";
import { getAuthenticatedUser } from "@/lib/nex/brains/_auth";
import type { SocialPlatform } from "@/lib/nex/comms-social/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function htmlResponse(payload: Record<string, unknown>): Response {
  const safe = JSON.stringify(payload).replace(/</g, "\\u003c");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Connected</title>
<style>body{background:#0b0f14;color:#e5e9ef;font:14px system-ui;display:grid;place-items:center;height:100vh;margin:0}
.card{padding:24px;text-align:center}</style></head>
<body><div class="card"><div style="font-weight:800;font-size:16px">Nex Social · finishing up</div>
<div style="opacity:.7;margin-top:8px">This window will close in a moment.</div></div>
<script>(function(){try{if(window.opener){window.opener.postMessage(${safe},window.location.origin);}}catch(e){}setTimeout(function(){try{window.close();}catch(e){}},600);}());</script>
</body></html>`;
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function GET(request: Request, ctx: { params: Promise<{ platform: SocialPlatform }> }) {
  const { platform } = await ctx.params;
  const url          = new URL(request.url);
  const code         = url.searchParams.get("code");
  const state        = url.searchParams.get("state");
  const providerErr  = url.searchParams.get("error");

  const auth = await getAuthenticatedUser();
  if (!auth.ok) {
    return htmlResponse({ source: "nex-comms-social", platform, ok: false, error: "sign_in_required" });
  }
  const tenant = await resolveTenantForUser(auth.user.supabase_user_id);
  if (!tenant) {
    return htmlResponse({ source: "nex-comms-social", platform, ok: false, error: "no_tenant" });
  }
  if (providerErr) {
    return htmlResponse({ source: "nex-comms-social", platform, ok: false, error: `provider_denied:${providerErr}` });
  }
  if (!code || !state) {
    return htmlResponse({ source: "nex-comms-social", platform, ok: false, error: "code_and_state_required" });
  }

  const originHere = url.origin;
  const redirect_uri = `${originHere}/api/nex/comms-social/oauth-for-me/${platform}/callback`;

  try {
    const r = await handleCallback({ tenant_id: tenant.tenant_id, platform, code, state, redirect_uri });
    if (!r.ok) return htmlResponse({ source: "nex-comms-social", platform, ok: false, error: r.reason });
    return htmlResponse({
      source: "nex-comms-social",
      platform,
      ok: true,
      account: {
        account_id:   r.account?.account_id,
        display_name: r.account?.display_name ?? null,
        status:       r.account?.status,
      },
    });
  } catch (e) {
    return htmlResponse({ source: "nex-comms-social", platform, ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

// Suppress an unused-import warning for NextResponse if the linter cares —
// we deliberately return raw Response objects here.
void NextResponse;
