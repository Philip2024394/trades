// POST /api/trade-off/materials-network/referrals/fulfil
// Magic-link authenticated (merchant). Body: { slug, edit_token,
// referral_id, fulfilled_order_value_pence, fulfilled_note? }.
//
// Marks a pending referral as fulfilled. Reads the MERCHANT's current
// commission_rate + min_pence and locks them onto the referral row so
// a later rate change doesn't retroactively shift historic earnings.
// Stub-notifies the tradesperson via push_log (event_type='commission').

import { NextResponse, type NextRequest, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  calculateCommissionPence,
  constantTimeEq
} from "@/lib/xratedMaterialsNetwork";
import { sendLeadAlert } from "@/lib/leadAlerts";

export const runtime = "nodejs";

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function nonNegInt(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
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
  const orderValuePence = nonNegInt(body.fulfilled_order_value_pence);
  const noteRaw = s(body.fulfilled_note);
  if (noteRaw.length > 500) {
    return NextResponse.json(
      { ok: false, error: "Note must be 500 characters or fewer." },
      { status: 400 }
    );
  }
  const fulfilled_note = noteRaw.length === 0 ? null : noteRaw;

  if (!slug || !token || !referralId || orderValuePence <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Missing slug, edit_token, referral_id, or fulfilled_order_value_pence."
      },
      { status: 400 }
    );
  }

  const merchant = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(
      "id, edit_token, merchant_commission_rate, merchant_commission_min_pence"
    )
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
    .select("id, merchant_listing_id, status, tradie_listing_id, ref_code")
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
        error: `Referral is already ${referral.data.status} — cannot mark fulfilled.`
      },
      { status: 400 }
    );
  }

  const rate = merchant.data.merchant_commission_rate;
  const minPence = merchant.data.merchant_commission_min_pence ?? 0;
  const commissionPence = calculateCommissionPence({
    order_pence: orderValuePence,
    rate,
    min_pence: minPence
  });

  const upd = await supabaseAdmin
    .from("hammerex_xrated_merchant_referrals")
    .update({
      status: "fulfilled",
      fulfilled_at: new Date().toISOString(),
      fulfilled_order_value_pence: orderValuePence,
      commission_rate_at_fulfilment: rate,
      commission_pence: commissionPence,
      fulfilled_note
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

  // Notify the tradesperson via Lead Alerts. Each per-device push
  // attempt also writes to hammerex_xrated_push_log with a
  // delivery_status — so the log table now reflects REAL deliveries,
  // not just queued events. The previous stub INSERT is gone.
  const merchantNameRow = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("display_name")
    .eq("id", merchant.data.id)
    .maybeSingle();
  const merchantName =
    (merchantNameRow.data?.display_name as string | null) ?? "A merchant";

  // Capture the referral fields into a local before scheduling — TS
  // can't narrow `referral.data` through the closure boundary.
  const tradieListingId = referral.data.tradie_listing_id;
  const refCode = referral.data.ref_code;

  after(async () => {
    try {
      await sendLeadAlert(
        tradieListingId,
        {
          type: "commission",
          data: {
            ref_code: refCode,
            merchant_name: merchantName,
            commission_pence: commissionPence,
            order_value_pence: orderValuePence
          }
        },
        { throttle: false }
      );
    } catch (err) {
      console.error("[materials-network/fulfil] sendLeadAlert failed:", err);
    }
  });

  return NextResponse.json({
    ok: true,
    referral: upd.data,
    commission_pence: commissionPence
  });
}
