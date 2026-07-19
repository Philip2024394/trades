// POST /api/homeowner/export/checkout — create Stripe checkout session
// for a £9.99 SiteBook export.
//
// STUB — real Stripe integration requires wiring Stripe client (which
// already exists elsewhere in the codebase for merchant payments).
// This endpoint currently:
//   1. Creates a pending export row
//   2. Redirects to a placeholder page
// To productionize:
//   - Replace the placeholder redirect with a Stripe Checkout Session
//   - Add /api/webhooks/stripe/sitebook-export webhook to confirm payment
//   - PDF generation via Puppeteer / PDFKit on payment.succeeded

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPORT_PRICE_PENCE = 999;

export async function POST() {
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });

  // Create pending export row
  const ins = await supabaseAdmin
    .from("hammerex_sitebook_exports")
    .insert({
      homeowner_id: homeowner.id,
      scope:        "all",
      format:       "pdf-zip",
      status:       "pending",
      amount_pence: EXPORT_PRICE_PENCE
    })
    .select("id")
    .single();

  if (ins.error || !ins.data) return NextResponse.json({ ok: false, error: "insert-failed" }, { status: 500 });

  // TODO — replace with real Stripe checkout session creation.
  // For now redirect back to export page with a pending notice.
  return NextResponse.redirect(new URL(`/sitebook/export?pending=${ins.data.id}`, process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
}
