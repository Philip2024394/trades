// POST /api/os/billing/portal — creates a Stripe Billing Portal session.
// Merchant clicks a "Manage billing" button, we return a Stripe-hosted
// URL where they can upgrade / downgrade / cancel / update card.
import { NextResponse } from "next/server";
import { requireMerchantSession, MerchantNotAuthenticatedError } from "@/lib/os/merchantSession";
import { stripeClient } from "@/lib/os/billing/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  let session;
  try {
    session = await requireMerchantSession();
  } catch (e) {
    if (e instanceof MerchantNotAuthenticatedError) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated." },
        { status: 401 }
      );
    }
    throw e;
  }
  const { data: customer } = await supabaseAdmin
    .from("os_billing_customers")
    .select("stripe_customer_id")
    .eq("merchant_id", session.merchantId)
    .maybeSingle();
  if (!customer) {
    return NextResponse.json(
      { ok: false, error: "No billing account yet." },
      { status: 400 }
    );
  }
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://thenetworkers.app";
  const portal = await stripeClient().billingPortal.sessions.create({
    customer: customer.stripe_customer_id,
    return_url: `${base}/site-office/hub`
  });
  return NextResponse.json({ ok: true, url: portal.url });
}
