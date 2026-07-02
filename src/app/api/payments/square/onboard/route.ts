// POST /api/payments/square/onboard — starts Square OAuth flow.
//
// Same UX shape as Stripe + PayPal. Returns the authorize_url the
// merchant clicks into. When they finish granting scopes on Square's
// side, Square redirects them to /api/payments/square/oauth-callback
// with ?code + ?state which we exchange for an access_token.
//
// State token is signed with the listing's edit_token so the callback
// can prove the caller is the same merchant who started the flow.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { squareConfigured, squareAuthorizeUrl } from "@/lib/squareClient";
import { siteUrl } from "@/lib/seo";
import { createHmac } from "node:crypto";

export const runtime = "nodejs";

type Body = { slug: string; token: string };

function signState(slug: string, token: string): string {
  const secret =
    process.env.SQUARE_APPLICATION_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "fallback";
  const payload = `${slug}.${Date.now()}`;
  const sig = createHmac("sha256", secret + token).update(payload).digest("hex").slice(0, 16);
  return `${payload}.${sig}`;
}

export async function POST(req: Request) {
  if (!squareConfigured()) {
    return NextResponse.json(
      {
        error: "square_platform_not_configured",
        detail:
          "SQUARE_APPLICATION_ID / SQUARE_APPLICATION_SECRET / SQUARE_ENV are not set. Create a Square app at https://developer.squareup.com/apps and set the env vars to activate one-click Square onboarding."
      },
      { status: 503 }
    );
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.slug || !body.token) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const row = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, edit_token")
    .eq("slug", body.slug)
    .maybeSingle();
  if (row.error || !row.data) {
    return NextResponse.json({ error: "listing_not_found" }, { status: 404 });
  }
  if (row.data.edit_token !== body.token) {
    return NextResponse.json({ error: "bad_token" }, { status: 403 });
  }

  const redirectUri = `${siteUrl()}/api/payments/square/oauth-callback`;
  const state = signState(body.slug, body.token);
  const url = squareAuthorizeUrl(state, redirectUri);
  return NextResponse.json({ ok: true, url });
}
