// POST /api/store/portal
//
// Create a Stripe Customer Portal session for the current member.
// Reads si-member cookie → resolves membership → uses its
// stripe_customer_id to open a portal session. Buyer can update
// their card, download invoices, and cancel the subscription
// entirely from Stripe's hosted UI.

import { NextResponse } from "next/server";
import { memberEmailFromRequest } from "@/lib/storeMemberSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getStripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const email = memberEmailFromRequest(req);
  if (!email) {
    return NextResponse.json({ ok: false, error: "not-member" }, { status: 401 });
  }

  const res = await supabaseAdmin
    .from("hammerex_store_memberships")
    .select("stripe_customer_id, status")
    .eq("email",  email)
    .eq("status", "active")
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (res.error || !res.data?.stripe_customer_id) {
    return NextResponse.json({ ok: false, error: "no-customer" }, { status: 404 });
  }

  try {
    const stripe = getStripe();
    const origin = new URL(req.url).origin;
    const session = await stripe.billingPortal.sessions.create({
      customer:   res.data.stripe_customer_id as string,
      return_url: `${origin}/store`
    });
    return NextResponse.json({ ok: true, redirect: session.url });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "stripe-error", detail: (err as Error).message }, { status: 500 });
  }
}
