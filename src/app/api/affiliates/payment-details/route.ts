// POST /api/affiliates/payment-details — upsert payment details +
// flip the three agreement timestamps on the affiliate row.
import { NextResponse, type NextRequest } from "next/server";
import { readAffiliateSession } from "@/lib/affiliateSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const TRADING_STATUSES = new Set([
  "sole_trader",
  "limited_company",
  "partnership"
]);
const PAYMENT_METHODS = new Set(["bank", "paypal", "wise"]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = readAffiliateSession(req);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const trading_status = String(body.trading_status ?? "");
  const legal_name = String(body.legal_name ?? "").trim();
  const country_iso2 = String(body.country_iso2 ?? "").trim();
  const payment_method = String(body.payment_method ?? "");

  if (!TRADING_STATUSES.has(trading_status)) {
    return NextResponse.json(
      { ok: false, error: "Invalid trading status." },
      { status: 400 }
    );
  }
  if (!legal_name) {
    return NextResponse.json(
      { ok: false, error: "Legal name is required." },
      { status: 400 }
    );
  }
  if (!country_iso2) {
    return NextResponse.json(
      { ok: false, error: "Country is required." },
      { status: 400 }
    );
  }
  if (!PAYMENT_METHODS.has(payment_method)) {
    return NextResponse.json(
      { ok: false, error: "Invalid payment method." },
      { status: 400 }
    );
  }
  if (
    !body.tax_agreement ||
    !body.content_agreement ||
    !body.timing_agreement
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "All three agreements must be accepted."
      },
      { status: 400 }
    );
  }

  const id = session.affiliate_id;
  const now = new Date().toISOString();

  // Upsert payment-details row (affiliate_id is unique).
  const pmExisting = await supabaseAdmin
    .from("hammerex_affiliate_payment_methods")
    .select("id")
    .eq("affiliate_id", id)
    .maybeSingle();

  const pmPatch = {
    affiliate_id: id,
    trading_status,
    legal_name: legal_name.slice(0, 200),
    country_iso2: country_iso2.slice(0, 80),
    payment_method,
    bank_account_name:
      typeof body.bank_account_name === "string"
        ? body.bank_account_name.slice(0, 200)
        : null,
    bank_account_number:
      typeof body.bank_account_number === "string"
        ? body.bank_account_number.slice(0, 40)
        : null,
    bank_sort_code:
      typeof body.bank_sort_code === "string"
        ? body.bank_sort_code.slice(0, 20)
        : null,
    iban: typeof body.iban === "string" ? body.iban.slice(0, 40) : null,
    swift_bic:
      typeof body.swift_bic === "string" ? body.swift_bic.slice(0, 20) : null,
    paypal_email:
      typeof body.paypal_email === "string"
        ? body.paypal_email.slice(0, 160)
        : null,
    wise_email:
      typeof body.wise_email === "string"
        ? body.wise_email.slice(0, 160)
        : null,
    updated_at: now
  };

  if (pmExisting.data) {
    const upd = await supabaseAdmin
      .from("hammerex_affiliate_payment_methods")
      .update(pmPatch)
      .eq("affiliate_id", id);
    if (upd.error) {
      console.error("[affiliates/payment-details] update failed:", upd.error);
      return NextResponse.json(
        { ok: false, error: upd.error.message },
        { status: 500 }
      );
    }
  } else {
    const ins = await supabaseAdmin
      .from("hammerex_affiliate_payment_methods")
      .insert(pmPatch);
    if (ins.error) {
      console.error("[affiliates/payment-details] insert failed:", ins.error);
      return NextResponse.json(
        { ok: false, error: ins.error.message },
        { status: 500 }
      );
    }
  }

  // Stamp the agreements + payment_details_completed_at on the
  // affiliate row.
  const affPatch = {
    payment_details_completed_at: now,
    tax_agreement_accepted_at: now,
    content_agreement_accepted_at: now,
    payment_timing_agreement_accepted_at: now,
    payment_alert_flag: false
  };
  const updAff = await supabaseAdmin
    .from("hammerex_affiliates")
    .update(affPatch)
    .eq("affiliate_id", id);
  if (updAff.error) {
    console.error("[affiliates/payment-details] affiliate update failed:", updAff.error);
  }

  await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
    actor_type: "affiliate",
    actor_id: String(id),
    action: "payment_details.save",
    target_id: String(id),
    details: {
      trading_status,
      country_iso2,
      payment_method
    }
  });

  return NextResponse.json({ ok: true, completed_at: now });
}
