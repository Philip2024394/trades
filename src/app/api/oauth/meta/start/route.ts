// GET /api/oauth/meta/start?merchantId=...
//
// Kicks off the Meta OAuth dance. Redirects the merchant's browser to
// Facebook's consent screen. On approval the merchant is bounced back
// to /api/oauth/meta/callback which persists the tokens.

import { NextResponse } from "next/server";
import { metaAuthStartUrl } from "@/lib/oauth/meta";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const merchantId = url.searchParams.get("merchantId");
  if (!merchantId) {
    return NextResponse.json(
      { error: "merchantId required" },
      { status: 400 }
    );
  }
  const authUrl = metaAuthStartUrl(merchantId);
  if (!authUrl) {
    return NextResponse.json(
      {
        error: "meta_not_configured",
        detail:
          "META_APP_ID + META_APP_SECRET + META_REDIRECT_URI must be set in the environment."
      },
      { status: 503 }
    );
  }
  return NextResponse.redirect(authUrl);
}
