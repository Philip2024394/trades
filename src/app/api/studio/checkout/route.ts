// POST /api/studio/checkout
// Bundle checkout — hands off to Stripe when STRIPE_SECRET_KEY is set.
// Reports stripe_not_configured cleanly when it isn't, so the Store UI
// can show "Coming online soon" instead of a hard error.

import { NextResponse, type NextRequest } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { bundleById, type BundleId } from "@/lib/design/pricing/bundles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await loadStudioSession();
  if (!session) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null) as { bundle_id?: BundleId } | null;
  const bundle = body?.bundle_id ? bundleById(body.bundle_id) : undefined;
  if (!bundle) return NextResponse.json({ ok: false, error: "unknown_bundle" }, { status: 400 });

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ ok: false, error: "stripe_not_configured" }, { status: 503 });
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const origin = req.headers.get("origin") ?? "https://thenetworkers.app";

  const checkout = await stripe.checkout.sessions.create({
    mode:                 "payment",
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency:     "gbp",
        product_data: { name: `${bundle.name} — ${bundle.headline}` },
        unit_amount:  bundle.price_pence
      },
      quantity: 1
    }],
    success_url: `${origin}/studio/vault?bundle=${bundle.id}&status=success`,
    cancel_url:  `${origin}/studio/store?bundle=${bundle.id}&status=cancel`,
    metadata: {
      merchant_slug: session.merchant.slug,
      bundle_id:     bundle.id
    }
  });

  return NextResponse.json({ ok: true, checkout_url: checkout.url });
}
