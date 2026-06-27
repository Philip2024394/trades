// POST /api/trade-off/materials-network/commission/upsert
// Magic-link authenticated (merchant). Body: { slug, edit_token,
// commission_rate?, commission_min_pence?, commission_terms?, paused? }.
//
// Lets a merchant configure their commission settings. Rate is a
// percentage (0-50). Min is the floor pence per fulfilled referral.
// Terms is optional free-text shown to the tradesperson before they pick
// the merchant. Paused stops new referrals from being created (existing
// pending ones remain actionable).
//
// First successful save sets materials_network_opted_in_at if it isn't
// already populated — this is the merchant's audit-trail timestamp.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { constantTimeEq } from "@/lib/xratedMaterialsNetwork";

export const runtime = "nodejs";

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

  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or edit_token." },
      { status: 400 }
    );
  }

  const patch: Record<string, unknown> = {};

  if (body.commission_rate !== undefined && body.commission_rate !== null && body.commission_rate !== "") {
    const n = Number(body.commission_rate);
    if (!Number.isFinite(n) || n < 0 || n > 50) {
      return NextResponse.json(
        { ok: false, error: "commission_rate must be between 0 and 50." },
        { status: 400 }
      );
    }
    patch.merchant_commission_rate = Math.round(n * 100) / 100;
  } else if (body.commission_rate === null || body.commission_rate === "") {
    patch.merchant_commission_rate = null;
  }

  if (body.commission_min_pence !== undefined) {
    const n = Number(body.commission_min_pence);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json(
        { ok: false, error: "commission_min_pence must be a non-negative integer." },
        { status: 400 }
      );
    }
    patch.merchant_commission_min_pence = Math.round(n);
  }

  if (body.commission_terms !== undefined) {
    const t = s(body.commission_terms);
    if (t.length > 500) {
      return NextResponse.json(
        { ok: false, error: "commission_terms must be 500 characters or fewer." },
        { status: 400 }
      );
    }
    patch.merchant_commission_terms = t.length === 0 ? null : t;
  }

  if (body.paused !== undefined) {
    patch.materials_network_paused = body.paused === true || body.paused === "true";
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { ok: false, error: "Nothing to update." },
      { status: 400 }
    );
  }

  const merchant = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(
      "id, edit_token, materials_network_opted_in_at"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!merchant.data) {
    return NextResponse.json({ ok: false, error: "Merchant not found." }, { status: 404 });
  }
  if (!constantTimeEq(merchant.data.edit_token, token)) {
    return NextResponse.json({ ok: false, error: "Invalid edit token." }, { status: 403 });
  }

  if (!merchant.data.materials_network_opted_in_at) {
    patch.materials_network_opted_in_at = new Date().toISOString();
  }

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update(patch)
    .eq("id", merchant.data.id)
    .select(
      "merchant_commission_rate, merchant_commission_min_pence, merchant_commission_terms, materials_network_paused, materials_network_opted_in_at"
    )
    .maybeSingle();

  if (upd.error || !upd.data) {
    return NextResponse.json(
      { ok: false, error: upd.error?.message ?? "Update failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, commission: upd.data });
}
