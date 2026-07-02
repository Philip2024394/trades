// POST /api/payments/stripe/onboard — Stripe Connect Express onboarding.
//
// Matches Linktree / Beacons / Stan Store / Snipfeed pattern: merchant
// clicks one button → redirected into Stripe-hosted Express onboarding
// → returns connected. Funds settle direct to merchant's Stripe
// account, never to ours. We hold no card data.
//
// Requires (one-time, platform-level):
//   - STRIPE_SECRET_KEY      Platform live/test secret key from
//                            dashboard.stripe.com
//   - STRIPE_WEBHOOK_SECRET  Webhook signing secret for connected-
//                            account events (see /api/webhooks/stripe)
//   - Stripe Connect Platform application approved at
//     https://stripe.com/connect/apply (free, ~3-5 days review)
//
// Until the env var is set we return 503 with a clear setup-needed
// message so the dashboard can show a "Setup pending" tile.

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { siteUrl } from "@/lib/seo";

export const runtime = "nodejs";

type Body = { slug: string; token: string };

export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error: "stripe_platform_not_configured",
        detail:
          "STRIPE_SECRET_KEY is not set. Apply for a Stripe Connect platform account at https://stripe.com/connect/apply, then set STRIPE_SECRET_KEY in the deployment env to activate one-click onboarding for every merchant."
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
    .select("id, slug, edit_token, display_name, email, payment_provider_data, addons_enabled")
    .eq("slug", body.slug)
    .maybeSingle();
  if (row.error || !row.data) {
    return NextResponse.json({ error: "listing_not_found" }, { status: 404 });
  }
  if (row.data.edit_token !== body.token) {
    return NextResponse.json({ error: "bad_token" }, { status: 403 });
  }

  const stripe = new Stripe(key);
  const data = (row.data.payment_provider_data ?? {}) as Record<string, unknown>;
  let stripeAccountId =
    typeof data.stripe_account_id === "string"
      ? (data.stripe_account_id as string)
      : null;

  try {
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "GB",
        email: (row.data.email as string | null) ?? undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        },
        business_profile: {
          name: row.data.display_name ?? row.data.slug,
          url: `${siteUrl()}/${row.data.slug}`
        }
      });
      stripeAccountId = account.id;
      // Persist immediately — even if AccountLink creation fails, the
      // account exists in Stripe and we want to be able to recover.
      await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .update({
          payment_provider: "stripe",
          payment_provider_data: {
            ...data,
            stripe_account_id: stripeAccountId,
            status: "pending_onboarding",
            created_at: new Date().toISOString()
          }
        })
        .eq("id", row.data.id);
    }

    const returnBase = `${siteUrl()}/trade-off/edit/${encodeURIComponent(
      row.data.slug
    )}/payments?token=${encodeURIComponent(body.token)}`;
    const link = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${returnBase}&refresh=1`,
      return_url: `${returnBase}&connected=1`,
      type: "account_onboarding"
    });

    return NextResponse.json({ ok: true, url: link.url });
  } catch (e) {
    return NextResponse.json(
      { error: "stripe_api_error", detail: (e as Error).message },
      { status: 500 }
    );
  }
}
