// POST /api/trade-off/payments/byo-save — merchant pastes their own
// provider credentials. We test them against the provider's API before
// saving so the merchant gets instant confirmation the keys work, then
// encrypt at rest.
//
// No platform-level API keys involved. xratedtrade.com is the middleman
// on the CODE side only; every network call to a payment provider uses
// the merchant's own credentials.

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { encryptCredential } from "@/lib/credentialCrypto";

export const runtime = "nodejs";

type StripeBody = {
  provider: "stripe";
  slug: string;
  token: string;
  secret_key: string;
};

type PaypalBody = {
  provider: "paypal";
  slug: string;
  token: string;
  client_id: string;
  client_secret: string;
  env: "sandbox" | "live";
};

type SquareBody = {
  provider: "square";
  slug: string;
  token: string;
  access_token: string;
  location_id: string;
  env: "sandbox" | "production";
};

type Body = StripeBody | PaypalBody | SquareBody;

async function authListing(slug: string, token: string) {
  const row = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token, payment_provider_data")
    .eq("slug", slug)
    .maybeSingle();
  if (row.error || !row.data) return { error: "listing_not_found" as const };
  if (row.data.edit_token !== token) return { error: "bad_token" as const };
  return { data: row.data };
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const auth = await authListing(body.slug, body.token);
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "bad_token" ? 403 : 404 }
    );
  }
  const listing = auth.data;
  const existing = (listing.payment_provider_data ?? {}) as Record<string, unknown>;

  try {
    if (body.provider === "stripe") {
      if (!body.secret_key || !/^sk_(test|live)_/.test(body.secret_key)) {
        return NextResponse.json(
          { error: "invalid_stripe_key" },
          { status: 400 }
        );
      }
      // Test the key by calling accounts.retrieve — surfaces the
      // merchant's account name so we can also cache it for the
      // dashboard status card.
      const stripe = new Stripe(body.secret_key);
      const account = await stripe.accounts.retrieve();
      const patched = {
        ...existing,
        stripe_key_encrypted: encryptCredential(body.secret_key),
        stripe_key_mode: body.secret_key.startsWith("sk_live_") ? "live" : "test",
        stripe_account_id: account.id,
        stripe_account_name:
          account.business_profile?.name ?? account.settings?.dashboard?.display_name ?? null,
        stripe_country: account.country ?? null,
        stripe_charges_enabled: account.charges_enabled === true,
        stripe_status:
          account.charges_enabled === true ? "ready" : "restricted",
        stripe_saved_at: new Date().toISOString()
      };
      await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .update({
          payment_provider: "stripe",
          payment_provider_data: patched
        })
        .eq("id", listing.id);
      return NextResponse.json({
        ok: true,
        provider: "stripe",
        account_name: patched.stripe_account_name,
        country: patched.stripe_country,
        charges_enabled: patched.stripe_charges_enabled
      });
    }

    if (body.provider === "paypal") {
      if (!body.client_id || !body.client_secret) {
        return NextResponse.json(
          { error: "missing_paypal_credentials" },
          { status: 400 }
        );
      }
      const base =
        body.env === "live"
          ? "https://api-m.paypal.com"
          : "https://api-m.sandbox.paypal.com";
      const basic = Buffer.from(
        `${body.client_id}:${body.client_secret}`
      ).toString("base64");
      const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "grant_type=client_credentials"
      });
      if (!tokenRes.ok) {
        const txt = await tokenRes.text();
        return NextResponse.json(
          { error: "paypal_credentials_invalid", detail: txt },
          { status: 400 }
        );
      }
      const patched = {
        ...existing,
        paypal_client_id: body.client_id,
        paypal_client_secret_encrypted: encryptCredential(body.client_secret),
        paypal_env: body.env,
        paypal_status: "ready",
        paypal_saved_at: new Date().toISOString()
      };
      await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .update({
          payment_provider: "paypal",
          payment_provider_data: patched
        })
        .eq("id", listing.id);
      return NextResponse.json({ ok: true, provider: "paypal" });
    }

    if (body.provider === "square") {
      if (!body.access_token || !body.location_id) {
        return NextResponse.json(
          { error: "missing_square_credentials" },
          { status: 400 }
        );
      }
      const base =
        body.env === "production"
          ? "https://connect.squareup.com"
          : "https://connect.squareupsandbox.com";
      const locRes = await fetch(`${base}/v2/locations/${body.location_id}`, {
        headers: {
          Authorization: `Bearer ${body.access_token}`,
          "Square-Version": "2025-06-18"
        }
      });
      if (!locRes.ok) {
        const txt = await locRes.text();
        return NextResponse.json(
          { error: "square_credentials_invalid", detail: txt },
          { status: 400 }
        );
      }
      const locJson = (await locRes.json()) as {
        location?: { name?: string; merchant_id?: string; country?: string };
      };
      const patched = {
        ...existing,
        square_access_token_encrypted: encryptCredential(body.access_token),
        square_location_id: body.location_id,
        square_location_name: locJson.location?.name ?? null,
        square_merchant_id: locJson.location?.merchant_id ?? null,
        square_country: locJson.location?.country ?? null,
        square_env: body.env,
        square_status: "ready",
        square_saved_at: new Date().toISOString()
      };
      await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .update({
          payment_provider: "square",
          payment_provider_data: patched
        })
        .eq("id", listing.id);
      return NextResponse.json({
        ok: true,
        provider: "square",
        location_name: patched.square_location_name
      });
    }

    return NextResponse.json(
      { error: "unknown_provider" },
      { status: 400 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: "save_failed", detail: (e as Error).message },
      { status: 400 }
    );
  }
}
