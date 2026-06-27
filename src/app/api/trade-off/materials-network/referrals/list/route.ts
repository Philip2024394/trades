// GET /api/trade-off/materials-network/referrals/list?slug=…&token=…&role=tradie|merchant&status=…
// Magic-link authenticated. Returns the referral ledger for the listing.
//
// role=tradie    → Earnings ledger view. PRIVACY BOUNDARY: customer
//                  name / wa / postcode are STRIPPED before serialising
//                  so a leaked dashboard link can't dox the customer.
//                  Optionally include role=tradie&include_aggregate=1 to
//                  ride the earnings view in the same payload.
// role=merchant  → Fulfilment panel view. Returns the full customer
//                  contact details so the merchant can WhatsApp the
//                  customer directly.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { constantTimeEq } from "@/lib/xratedMaterialsNetwork";

export const runtime = "nodejs";

const ALLOWED_STATUS = new Set(["pending", "fulfilled", "declined", "expired", "disputed"]);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") ?? "").trim();
  const token = (url.searchParams.get("token") ?? "").trim();
  const role = (url.searchParams.get("role") ?? "tradie").trim();
  const status = (url.searchParams.get("status") ?? "").trim();

  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or token." },
      { status: 400 }
    );
  }
  if (role !== "tradie" && role !== "merchant") {
    return NextResponse.json(
      { ok: false, error: "role must be 'tradie' or 'merchant'." },
      { status: 400 }
    );
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token, display_name")
    .eq("slug", slug)
    .maybeSingle();

  if (!listing.data) {
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }
  if (!constantTimeEq(listing.data.edit_token, token)) {
    return NextResponse.json({ ok: false, error: "Invalid edit token." }, { status: 403 });
  }

  const column = role === "tradie" ? "tradie_listing_id" : "merchant_listing_id";

  let query = supabaseAdmin
    .from("hammerex_xrated_merchant_referrals")
    .select("*")
    .eq(column, listing.data.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status && ALLOWED_STATUS.has(status)) {
    query = query.eq("status", status);
  }

  const res = await query;
  if (res.error) {
    return NextResponse.json(
      { ok: false, error: res.error.message },
      { status: 500 }
    );
  }

  const counterpartColumn = role === "tradie" ? "merchant_listing_id" : "tradie_listing_id";
  const counterpartIds = Array.from(
    new Set((res.data ?? []).map((r) => r[counterpartColumn]))
  );
  let counterpartMap = new Map<
    string,
    { slug: string; display_name: string; city: string; primary_trade: string }
  >();
  if (counterpartIds.length > 0) {
    const cRes = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, slug, display_name, city, primary_trade")
      .in("id", counterpartIds);
    counterpartMap = new Map(
      (cRes.data ?? []).map((r) => [
        r.id,
        {
          slug: r.slug,
          display_name: r.display_name,
          city: r.city,
          primary_trade: r.primary_trade
        }
      ])
    );
  }

  const rows = (res.data ?? []).map((r) => {
    const counterpart = counterpartMap.get(r[counterpartColumn]);
    if (role === "tradie") {
      // Privacy boundary — strip customer PII so the tradie's ledger
      // never carries the customer's name/wa/postcode.
      return {
        id: r.id,
        ref_code: r.ref_code,
        status: r.status,
        merchant_slug: counterpart?.slug ?? null,
        merchant_display_name: counterpart?.display_name ?? null,
        merchant_city: counterpart?.city ?? null,
        estimated_cart_total_pence: r.estimated_cart_total_pence,
        fulfilled_order_value_pence: r.fulfilled_order_value_pence,
        commission_pence: r.commission_pence,
        commission_rate_at_fulfilment: r.commission_rate_at_fulfilment,
        fulfilled_at: r.fulfilled_at,
        declined_reason: r.declined_reason,
        expires_at: r.expires_at,
        created_at: r.created_at
      };
    }
    return {
      id: r.id,
      ref_code: r.ref_code,
      status: r.status,
      tradie_slug: counterpart?.slug ?? null,
      tradie_display_name: counterpart?.display_name ?? null,
      tradie_city: counterpart?.city ?? null,
      customer_name: r.customer_name,
      customer_wa_e164: r.customer_wa_e164,
      cart_items_snapshot: r.cart_items_snapshot,
      estimated_cart_total_pence: r.estimated_cart_total_pence,
      fulfilled_order_value_pence: r.fulfilled_order_value_pence,
      commission_pence: r.commission_pence,
      commission_rate_at_fulfilment: r.commission_rate_at_fulfilment,
      fulfilled_at: r.fulfilled_at,
      declined_reason: r.declined_reason,
      declined_note: r.declined_note,
      fulfilled_note: r.fulfilled_note,
      expires_at: r.expires_at,
      created_at: r.created_at
    };
  });

  let aggregate: {
    pending_count: number;
    pending_estimate_pence: number;
    fulfilled_count: number;
    commission_total_pence: number;
    declined_count: number;
  } | null = null;

  if (role === "tradie" && url.searchParams.get("include_aggregate") === "1") {
    const aggRes = await supabaseAdmin
      .from("hammerex_xrated_tradie_earnings_v")
      .select("*")
      .eq("tradie_listing_id", listing.data.id)
      .maybeSingle();
    aggregate = aggRes.data
      ? {
          pending_count: aggRes.data.pending_count ?? 0,
          pending_estimate_pence: aggRes.data.pending_estimate_pence ?? 0,
          fulfilled_count: aggRes.data.fulfilled_count ?? 0,
          commission_total_pence: aggRes.data.commission_total_pence ?? 0,
          declined_count: aggRes.data.declined_count ?? 0
        }
      : {
          pending_count: 0,
          pending_estimate_pence: 0,
          fulfilled_count: 0,
          commission_total_pence: 0,
          declined_count: 0
        };
  }

  return NextResponse.json({ ok: true, referrals: rows, aggregate });
}
