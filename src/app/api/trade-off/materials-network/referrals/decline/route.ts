// POST /api/trade-off/materials-network/referrals/decline
// Magic-link authenticated (merchant). Body: { slug, edit_token,
// referral_id, declined_reason, declined_note? }.
//
// Marks a pending referral as declined. Reasons are constrained to a
// small enum so we can later aggregate dispute trends. Free-text note
// captures the merchant's specifics (≤500 chars).

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { constantTimeEq } from "@/lib/xratedMaterialsNetwork";

export const runtime = "nodejs";

const VALID_REASONS = new Set([
  "no_order_placed",
  "out_of_stock",
  "customer_cancelled",
  "duplicate",
  "out_of_area",
  "other"
]);

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
  const referralId = s(body.referral_id);
  const reason = s(body.declined_reason);
  const noteRaw = s(body.declined_note);
  if (noteRaw.length > 500) {
    return NextResponse.json(
      { ok: false, error: "Note must be 500 characters or fewer." },
      { status: 400 }
    );
  }
  const declined_note = noteRaw.length === 0 ? null : noteRaw;

  if (!slug || !token || !referralId) {
    return NextResponse.json(
      { ok: false, error: "Missing slug, edit_token, or referral_id." },
      { status: 400 }
    );
  }
  if (!VALID_REASONS.has(reason)) {
    return NextResponse.json(
      { ok: false, error: "Invalid declined_reason." },
      { status: 400 }
    );
  }

  const merchant = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", slug)
    .maybeSingle();

  if (!merchant.data) {
    return NextResponse.json({ ok: false, error: "Merchant not found." }, { status: 404 });
  }
  if (!constantTimeEq(merchant.data.edit_token, token)) {
    return NextResponse.json({ ok: false, error: "Invalid edit token." }, { status: 403 });
  }

  const referral = await supabaseAdmin
    .from("hammerex_xrated_merchant_referrals")
    .select("id, merchant_listing_id, status")
    .eq("id", referralId)
    .maybeSingle();

  if (!referral.data) {
    return NextResponse.json({ ok: false, error: "Referral not found." }, { status: 404 });
  }
  if (referral.data.merchant_listing_id !== merchant.data.id) {
    return NextResponse.json(
      { ok: false, error: "This referral does not belong to your listing." },
      { status: 403 }
    );
  }
  if (referral.data.status !== "pending") {
    return NextResponse.json(
      {
        ok: false,
        error: `Referral is already ${referral.data.status} — cannot decline.`
      },
      { status: 400 }
    );
  }

  const upd = await supabaseAdmin
    .from("hammerex_xrated_merchant_referrals")
    .update({
      status: "declined",
      declined_reason: reason,
      declined_note
    })
    .eq("id", referralId)
    .select("*")
    .maybeSingle();

  if (upd.error || !upd.data) {
    return NextResponse.json(
      { ok: false, error: upd.error?.message ?? "Update failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, referral: upd.data });
}
