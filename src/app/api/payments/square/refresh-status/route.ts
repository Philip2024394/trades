// POST /api/payments/square/refresh-status — verifies the merchant's
// Square account is still active and the token hasn't expired.
//
// Square OAuth tokens last ~30 days; the refresh flow uses the stored
// refresh_token to grab a new access_token when we're within 7 days
// of expiry.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { squareConfigured, squareBase } from "@/lib/squareClient";

export const runtime = "nodejs";

type Body = { slug: string; token: string };

async function refreshTokenIfNearExpiry(row: {
  id: string;
  payment_provider_data: Record<string, unknown>;
}): Promise<{ access_token: string; merchant_id: string } | null> {
  const data = row.payment_provider_data ?? {};
  const access = data.square_access_token as string | undefined;
  const refresh = data.square_refresh_token as string | undefined;
  const expiresAt = data.square_expires_at as string | undefined;
  const merchantId = data.square_merchant_id as string | undefined;
  if (!access || !merchantId) return null;
  // Refresh if within 7 days of expiry.
  if (expiresAt && refresh) {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms < 7 * 24 * 3600 * 1000) {
      const res = await fetch(`${squareBase()}/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Square-Version": "2025-06-18"
        },
        body: JSON.stringify({
          client_id: process.env.SQUARE_APPLICATION_ID,
          client_secret: process.env.SQUARE_APPLICATION_SECRET,
          grant_type: "refresh_token",
          refresh_token: refresh
        })
      });
      if (res.ok) {
        const j = (await res.json()) as {
          access_token: string;
          refresh_token: string;
          expires_at: string;
        };
        await supabaseAdmin
          .from("hammerex_trade_off_listings")
          .update({
            payment_provider_data: {
              ...data,
              square_access_token: j.access_token,
              square_refresh_token: j.refresh_token,
              square_expires_at: j.expires_at,
              square_refreshed_at: new Date().toISOString()
            }
          })
          .eq("id", row.id);
        return { access_token: j.access_token, merchant_id: merchantId };
      }
    }
  }
  return { access_token: access, merchant_id: merchantId };
}

export async function POST(req: Request) {
  if (!squareConfigured()) {
    return NextResponse.json(
      { error: "square_platform_not_configured" },
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
    .select("id, edit_token, payment_provider_data")
    .eq("slug", body.slug)
    .maybeSingle();
  if (row.error || !row.data) {
    return NextResponse.json({ error: "listing_not_found" }, { status: 404 });
  }
  if (row.data.edit_token !== body.token) {
    return NextResponse.json({ error: "bad_token" }, { status: 403 });
  }
  const data = (row.data.payment_provider_data ?? {}) as Record<string, unknown>;
  const merchantId = data.square_merchant_id as string | undefined;
  if (!merchantId) {
    return NextResponse.json({ error: "no_square_account" }, { status: 400 });
  }
  const refreshed = await refreshTokenIfNearExpiry({
    id: row.data.id,
    payment_provider_data: data
  });
  const ready =
    !!refreshed?.access_token && typeof data.square_location_id === "string";
  await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({
      payment_provider_data: {
        ...data,
        square_status: ready ? "ready" : "pending_location",
        square_refreshed_at: new Date().toISOString()
      }
    })
    .eq("id", row.data.id);
  return NextResponse.json({
    ok: true,
    ready,
    location_id: data.square_location_id ?? null
  });
}
