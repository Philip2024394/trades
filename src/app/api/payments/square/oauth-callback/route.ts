// GET /api/payments/square/oauth-callback — Square OAuth return URL.
//
// Square appends ?code=... &state=... after the merchant grants access.
// We:
//   1. Validate the state signature (proves this is the same merchant
//      that initiated the flow — the signing key includes their
//      edit_token)
//   2. Exchange the code for access_token + refresh_token +
//      merchant_id
//   3. Fetch the merchant's default location_id (needed for payments)
//   4. Store all of that in payment_provider_data
//   5. Redirect the merchant back to their /payments dashboard with
//      ?square_connected=1

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  squareConfigured,
  squareExchangeCode,
  squareGet
} from "@/lib/squareClient";
import { siteUrl } from "@/lib/seo";
import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

function verifyState(state: string, listingEditToken: string): { slug: string } | null {
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [slug, ts, sig] = parts;
  const secret =
    process.env.SQUARE_APPLICATION_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "fallback";
  const expected = createHmac("sha256", secret + listingEditToken)
    .update(`${slug}.${ts}`)
    .digest("hex")
    .slice(0, 16);
  try {
    if (timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return { slug };
    }
  } catch {
    /* length mismatch → fall through */
  }
  return null;
}

export async function GET(req: Request) {
  if (!squareConfigured()) {
    return NextResponse.redirect(`${siteUrl()}/?square_error=platform_not_configured`);
  }
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(`${siteUrl()}/?square_error=missing_code`);
  }
  const slug = state.split(".")[0];
  const row = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, edit_token, payment_provider_data")
    .eq("slug", slug)
    .maybeSingle();
  if (!row.data) {
    return NextResponse.redirect(`${siteUrl()}/?square_error=listing_not_found`);
  }
  const verified = verifyState(state, row.data.edit_token);
  if (!verified) {
    return NextResponse.redirect(
      `${siteUrl()}/trade-off/edit/${slug}/payments?square_error=bad_state`
    );
  }

  const redirectUri = `${siteUrl()}/api/payments/square/oauth-callback`;
  try {
    const token = await squareExchangeCode(code, redirectUri);
    // Look up the merchant's default location. Square requires a
    // location_id on every Payments API call.
    type ListLocationsRes = {
      locations?: { id: string; status?: string; type?: string }[];
    };
    const locations = await squareGet<ListLocationsRes>(
      "/v2/locations",
      token.access_token
    );
    const defaultLocation =
      locations.locations?.find((l) => l.status === "ACTIVE") ??
      locations.locations?.[0];

    const data = (row.data.payment_provider_data ?? {}) as Record<string, unknown>;
    await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .update({
        payment_provider_data: {
          ...data,
          square_merchant_id: token.merchant_id,
          square_access_token: token.access_token,
          square_refresh_token: token.refresh_token,
          square_expires_at: token.expires_at,
          square_location_id: defaultLocation?.id ?? null,
          square_status: defaultLocation ? "ready" : "pending_location",
          square_refreshed_at: new Date().toISOString()
        }
      })
      .eq("id", row.data.id);

    // Redirect back to dashboard with the success flag so the UI can
    // flip instantly.
    return NextResponse.redirect(
      `${siteUrl()}/trade-off/edit/${encodeURIComponent(slug)}/payments?token=${encodeURIComponent(row.data.edit_token)}&square_connected=1`
    );
  } catch (e) {
    return NextResponse.redirect(
      `${siteUrl()}/trade-off/edit/${encodeURIComponent(slug)}/payments?token=${encodeURIComponent(row.data.edit_token)}&square_error=${encodeURIComponent((e as Error).message)}`
    );
  }
}
