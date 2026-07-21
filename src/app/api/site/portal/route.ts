// POST /api/site/portal
//
// Creates a Stripe Billing Portal session for the caller's active
// The Site subscription — the £14.99/mo plan created by
// /api/site/checkout/subscribe. Portal handles cancel / update payment
// method / view invoices without us building any of that UI.
//
// Auth: prefers the signed-in merchant session; falls back to an
// ?email= query param for anonymous subscribers (Site sub can be
// bought without a trade account — see hammerex_site_subscriptions
// identity CHECK). Only "active" or "trialing" subs qualify — a
// canceled sub has nothing to manage.
//
// Response: { url } → client redirects to Stripe portal.

import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getMerchantSlug } from "@/lib/merchantSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function siteOrigin(req: NextRequest): string {
  const envOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (envOrigin && /^https?:\/\//.test(envOrigin)) {
    return envOrigin.replace(/\/$/, "");
  }
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const merchantSlug = await getMerchantSlug();

  // Anonymous fallback — accept ?email= (matches the anonymous
  // checkout flow). Body-based email is also read so the same call
  // works from JSON clients.
  let bodyEmail = "";
  try {
    const parsed = (await req.json().catch(() => ({}))) as { email?: unknown };
    bodyEmail = typeof parsed.email === "string" ? parsed.email.trim().toLowerCase() : "";
  } catch {
    bodyEmail = "";
  }
  const qEmail = (req.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase();
  const email  = bodyEmail || qEmail;

  if (!merchantSlug && !email) {
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 }
    );
  }

  // Look up the active sub — merchant slug takes precedence over
  // email so a signed-in merchant who also has an anonymous sub on
  // record still gets their tied-to-account subscription.
  let query = supabaseAdmin
    .from("hammerex_site_subscriptions")
    .select("stripe_customer_id, status, current_period_end")
    .in("status", ["active", "trialing"])
    .gt("current_period_end", new Date().toISOString())
    .order("current_period_end", { ascending: false })
    .limit(1);

  if (merchantSlug) {
    query = query.eq("merchant_slug", merchantSlug);
  } else {
    query = query.eq("buyer_email", email);
  }

  const sub = await query.maybeSingle();
  if (sub.error) {
    console.error("[site/portal] sub lookup failed:", sub.error.message);
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (!sub.data?.stripe_customer_id) {
    return NextResponse.json(
      { error: "no_active_subscription" },
      { status: 404 }
    );
  }

  const origin = siteOrigin(req);
  const returnUrl = `${origin}/trade-off/search?tab=inspiration&portal=return`;

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer:   sub.data.stripe_customer_id as string,
      return_url: returnUrl
    });
    if (!session.url) {
      return NextResponse.json({ error: "stripe_no_url" }, { status: 502 });
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[site/portal] failed:", message);
    return NextResponse.json({ error: `stripe_failed: ${message}` }, { status: 500 });
  }
}
