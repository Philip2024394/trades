// POST /api/payments/stripe/refresh-status — re-fetches a connected
// account's status from Stripe and updates payment_provider_data.
// Called from the dashboard after the merchant returns from Stripe's
// hosted onboarding (?connected=1 in the URL), so the UI can flip
// instantly from "Setup pending" to "Connected" without waiting on a
// webhook.
//
// We mirror Stripe's account fields onto our row so the cart-time
// check is a single read from our DB, not a round-trip to Stripe:
//   - charges_enabled  → can accept payments
//   - payouts_enabled  → can receive payouts
//   - details_submitted → has finished the onboarding form

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Body = { slug: string; token: string };

export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "stripe_platform_not_configured" },
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
  const accountId = data.stripe_account_id as string | undefined;
  if (!accountId) {
    return NextResponse.json(
      { error: "no_stripe_account_yet" },
      { status: 400 }
    );
  }

  const stripe = new Stripe(key);
  try {
    const acct = await stripe.accounts.retrieve(accountId);
    const ready = acct.charges_enabled === true && acct.details_submitted === true;
    await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .update({
        payment_provider_data: {
          ...data,
          stripe_account_id: accountId,
          status: ready ? "ready" : "pending_onboarding",
          charges_enabled: acct.charges_enabled === true,
          payouts_enabled: acct.payouts_enabled === true,
          details_submitted: acct.details_submitted === true,
          refreshed_at: new Date().toISOString()
        }
      })
      .eq("id", row.data.id);
    return NextResponse.json({
      ok: true,
      ready,
      charges_enabled: acct.charges_enabled === true,
      details_submitted: acct.details_submitted === true
    });
  } catch (e) {
    return NextResponse.json(
      { error: "stripe_retrieve_failed", detail: (e as Error).message },
      { status: 500 }
    );
  }
}
