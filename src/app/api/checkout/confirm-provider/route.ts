// POST /api/checkout/confirm-provider — called from the cart success
// page after the customer returns from the provider's hosted checkout.
//
// BYO model: no platform-level webhook needed. We verify payment
// completion directly with the provider using the merchant's own API
// key stored on their listing. Simpler + more reliable than routing
// per-merchant webhook subscriptions.
//
// Merchants CAN also configure a webhook in their provider dashboard
// pointing at our /api/webhooks/<provider>/<listing_id> route for
// belt-and-braces async confirmation — but for the happy path (customer
// completes payment + returns), this endpoint is authoritative.

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { decryptCredential } from "@/lib/credentialCrypto";
import { notifyOrderPaid } from "@/lib/notifyOrderPaid";

export const runtime = "nodejs";

type Body = { listing_slug: string; order_ref: string; session_id?: string };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.listing_slug || !body.order_ref) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const listingRes = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, payment_provider, payment_provider_data")
    .eq("slug", body.listing_slug)
    .maybeSingle();
  if (!listingRes.data) {
    return NextResponse.json({ error: "listing_not_found" }, { status: 404 });
  }
  const orderRes = await supabaseAdmin
    .from("hammerex_xrated_orders")
    .select("id, status, provider, provider_session_id, order_ref")
    .eq("order_ref", body.order_ref)
    .eq("listing_id", listingRes.data.id)
    .maybeSingle();
  if (!orderRes.data) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }
  if (orderRes.data.status === "paid") {
    return NextResponse.json({ ok: true, already_paid: true });
  }

  const provider = orderRes.data.provider;
  const data = (listingRes.data.payment_provider_data ?? {}) as Record<string, unknown>;

  try {
    if (provider === "stripe") {
      const encrypted = data.stripe_key_encrypted as string | undefined;
      if (!encrypted) {
        return NextResponse.json(
          { error: "stripe_key_missing" },
          { status: 400 }
        );
      }
      const stripe = new Stripe(decryptCredential(encrypted));
      const sessionId = body.session_id ?? (orderRes.data.provider_session_id as string | null);
      if (!sessionId) {
        return NextResponse.json(
          { error: "session_id_missing" },
          { status: 400 }
        );
      }
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== "paid") {
        return NextResponse.json({
          ok: false,
          status: session.payment_status,
          detail: "Stripe reports payment not completed yet."
        });
      }
      await markPaid(orderRes.data.id, {
        stripe_session_id: sessionId,
        payment_intent: session.payment_intent,
        customer_email: session.customer_details?.email ?? null
      }, session.customer_details?.email ?? undefined);
    } else if (provider === "paypal") {
      // For BYO PayPal, the customer approves the order on PayPal's
      // hosted checkout, PayPal appends ?token=<order_id> to our
      // return URL, we capture the order using the merchant's client
      // credentials.
      const clientId = data.paypal_client_id as string | undefined;
      const clientSecretEnc = data.paypal_client_secret_encrypted as string | undefined;
      const env = (data.paypal_env as string | undefined) ?? "sandbox";
      const orderId = body.session_id ?? (orderRes.data.provider_session_id as string | null);
      if (!clientId || !clientSecretEnc || !orderId) {
        return NextResponse.json(
          { error: "paypal_credentials_missing" },
          { status: 400 }
        );
      }
      const base = env === "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";
      const basic = Buffer.from(
        `${clientId}:${decryptCredential(clientSecretEnc)}`
      ).toString("base64");
      const tokRes = await fetch(`${base}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "grant_type=client_credentials"
      });
      if (!tokRes.ok) {
        return NextResponse.json(
          { error: "paypal_auth_failed" },
          { status: 400 }
        );
      }
      const tok = (await tokRes.json()) as { access_token: string };
      const capRes = await fetch(
        `${base}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tok.access_token}`,
            "Content-Type": "application/json"
          }
        }
      );
      if (!capRes.ok) {
        const t = await capRes.text();
        return NextResponse.json(
          { error: "paypal_capture_failed", detail: t },
          { status: 400 }
        );
      }
      const captured = (await capRes.json()) as {
        status?: string;
        payer?: { email_address?: string };
      };
      if (captured.status !== "COMPLETED") {
        return NextResponse.json({
          ok: false,
          status: captured.status,
          detail: "PayPal reports capture not completed."
        });
      }
      await markPaid(orderRes.data.id, {
        paypal_order_id: orderId,
        payer_email: captured.payer?.email_address ?? null
      }, captured.payer?.email_address);
    } else if (provider === "square") {
      // Square's Payment Link redirects with ?transactionId=... . We
      // verify by fetching the corresponding order via the merchant's
      // access token and checking state === COMPLETED.
      const tokenEnc = data.square_access_token_encrypted as string | undefined;
      const env = (data.square_env as string | undefined) ?? "sandbox";
      const paymentLinkId = orderRes.data.provider_session_id as string | null;
      if (!tokenEnc || !paymentLinkId) {
        return NextResponse.json(
          { error: "square_credentials_missing" },
          { status: 400 }
        );
      }
      const base = env === "production"
        ? "https://connect.squareup.com"
        : "https://connect.squareupsandbox.com";
      // Fetch payment link → gives us the order_id → check order state.
      const plRes = await fetch(
        `${base}/v2/online-checkout/payment-links/${encodeURIComponent(paymentLinkId)}`,
        {
          headers: {
            Authorization: `Bearer ${decryptCredential(tokenEnc)}`,
            "Square-Version": "2025-06-18"
          }
        }
      );
      if (!plRes.ok) {
        return NextResponse.json(
          { error: "square_lookup_failed" },
          { status: 400 }
        );
      }
      const pl = (await plRes.json()) as {
        payment_link?: { order_id?: string };
      };
      const orderId = pl.payment_link?.order_id;
      if (!orderId) {
        return NextResponse.json(
          { error: "square_no_order_id" },
          { status: 400 }
        );
      }
      const oRes = await fetch(`${base}/v2/orders/${orderId}`, {
        headers: {
          Authorization: `Bearer ${decryptCredential(tokenEnc)}`,
          "Square-Version": "2025-06-18"
        }
      });
      const oJson = (await oRes.json()) as {
        order?: { state?: string; total_money?: { amount?: number } };
      };
      if (oJson.order?.state !== "COMPLETED") {
        return NextResponse.json({
          ok: false,
          state: oJson.order?.state,
          detail: "Square reports order not completed."
        });
      }
      await markPaid(orderRes.data.id, { square_order_id: orderId });
    } else if (provider === "payment_link") {
      // Payment Link is trust-the-redirect (no provider API to
      // verify). Flag it in metadata so merchant knows to verify in
      // their own provider dashboard.
      await markPaid(orderRes.data.id, {
        confirmation: "link_return",
        verify_in_provider_dashboard: true
      });
    } else {
      return NextResponse.json(
        { error: "unknown_provider" },
        { status: 400 }
      );
    }

    await notifyOrderPaid(body.order_ref);
    return NextResponse.json({ ok: true, marked_paid: true });
  } catch (e) {
    return NextResponse.json(
      { error: "confirm_failed", detail: (e as Error).message },
      { status: 500 }
    );
  }
}

async function markPaid(orderId: string, metadata: Record<string, unknown>, customerEmail?: string): Promise<void> {
  await supabaseAdmin
    .from("hammerex_xrated_orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      metadata,
      customer_email: customerEmail ?? undefined
    })
    .eq("id", orderId)
    .eq("status", "pending");
}
