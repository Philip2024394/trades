// POST /api/trade-off/request-upgrade
// Body: { slug, edit_token, plan: 'monthly' | 'annual' }.
//
// Returns a pre-formatted WhatsApp deep link the tradie can open to confirm
// they want to pay. We do NOT flip the row to `app_paid` here — that's
// admin-driven after payment is verified by hand. Manual review is fine at
// the scale we're at (<100 listings) and avoids us touching card data.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { XRATED_PRICING } from "@/lib/xratedTrades";
import { whatsappDigits } from "@/lib/tradeOff";
import { adminWhatsapp } from "@/lib/whatsapp";

export const runtime = "nodejs";

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const slug = s(body.slug);
  const token = s(body.edit_token);
  const planRaw = s(body.plan).toLowerCase();
  const plan = planRaw === "annual" ? "annual" : planRaw === "monthly" ? "monthly" : null;

  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or edit_token." },
      { status: 400 }
    );
  }
  if (!plan) {
    return NextResponse.json(
      { ok: false, error: "Plan must be 'monthly' or 'annual'." },
      { status: 400 }
    );
  }

  const row = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, display_name, edit_token")
    .eq("slug", slug)
    .maybeSingle();
  if (!row.data) {
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }
  if (!constantTimeEq(row.data.edit_token, token)) {
    return NextResponse.json({ ok: false, error: "Invalid edit token." }, { status: 403 });
  }

  const amountLabel = plan === "annual"
    ? `£${XRATED_PRICING.annualGbp}/year`
    : `£${XRATED_PRICING.monthlyGbp}/month`;

  const lines = [
    `Hi Xrated Trades — I'd like to upgrade my Trade Off profile to the App tier (${plan}).`,
    "",
    `Tradie: ${row.data.display_name}`,
    `Slug: ${row.data.slug}`,
    `Plan: ${plan}`,
    `Amount: ${amountLabel}`,
    "",
    "Please confirm payment instructions — once paid I'll send proof here and you can flip my tier to App Paid."
  ];
  const text = encodeURIComponent(lines.join("\n"));
  const adminDigits = whatsappDigits(adminWhatsapp());
  const whatsapp_url = `https://wa.me/${adminDigits}?text=${text}`;

  return NextResponse.json({
    ok: true,
    plan,
    amount_label: amountLabel,
    whatsapp_url
  });
}
