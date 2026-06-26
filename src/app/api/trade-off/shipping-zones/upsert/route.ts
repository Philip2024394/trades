// POST /api/trade-off/shipping-zones/upsert
// Magic-link authenticated. Body: { slug, edit_token, zone: { id?, ... } }.
// UNIQUE (listing_id, country_code) — when id is missing we upsert by
// country_code so the editor never throws a 409 the user can't recover from.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;
const CC_RE = /^[A-Z]{2}$/;

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function nonNegIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
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
  const zoneIn = (body.zone && typeof body.zone === "object" ? body.zone : {}) as Record<string, unknown>;

  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or edit_token." },
      { status: 400 }
    );
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", slug)
    .maybeSingle();

  if (!listing.data) {
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }
  if (!constantTimeEq(listing.data.edit_token, token)) {
    return NextResponse.json({ ok: false, error: "Invalid edit token." }, { status: 403 });
  }

  const country_code = s(zoneIn.country_code).toUpperCase();
  if (!CC_RE.test(country_code)) {
    return NextResponse.json(
      { ok: false, error: "country_code must be 2 upper-case letters." },
      { status: 400 }
    );
  }
  const country_name = s(zoneIn.country_name).slice(0, 80);
  if (!country_name) {
    return NextResponse.json(
      { ok: false, error: "country_name is required." },
      { status: 400 }
    );
  }
  const air_price_pence = nonNegIntOrNull(zoneIn.air_price_pence);
  const sea_price_pence = nonNegIntOrNull(zoneIn.sea_price_pence);
  const eta_min_days = nonNegIntOrNull(zoneIn.eta_min_days);
  const eta_max_days = nonNegIntOrNull(zoneIn.eta_max_days);
  const sort_order = nonNegInt(zoneIn.sort_order);

  const patch = {
    country_code,
    country_name,
    air_price_pence,
    sea_price_pence,
    eta_min_days,
    eta_max_days,
    sort_order
  };

  const idRaw = s(zoneIn.id);
  if (idRaw) {
    if (!UUID_RE.test(idRaw)) {
      return NextResponse.json(
        { ok: false, error: "Invalid zone id." },
        { status: 400 }
      );
    }
    const upd = await supabaseAdmin
      .from("hammerex_xrated_shipping_zones")
      .update(patch)
      .eq("id", idRaw)
      .eq("listing_id", listing.data.id)
      .select("*")
      .maybeSingle();
    if (upd.error) {
      console.error("[trade-off/shipping-zones/upsert] update failed:", upd.error);
      return NextResponse.json(
        { ok: false, error: upd.error.message },
        { status: 500 }
      );
    }
    if (!upd.data) {
      return NextResponse.json(
        { ok: false, error: "Zone not found." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, zone: upd.data });
  }

  // Insert-or-update by (listing_id, country_code).
  const existing = await supabaseAdmin
    .from("hammerex_xrated_shipping_zones")
    .select("id")
    .eq("listing_id", listing.data.id)
    .eq("country_code", country_code)
    .maybeSingle();

  if (existing.data) {
    const upd = await supabaseAdmin
      .from("hammerex_xrated_shipping_zones")
      .update(patch)
      .eq("id", existing.data.id)
      .select("*")
      .maybeSingle();
    if (upd.error || !upd.data) {
      console.error("[trade-off/shipping-zones/upsert] conflict update failed:", upd.error);
      return NextResponse.json(
        { ok: false, error: upd.error?.message ?? "Update failed" },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, zone: upd.data });
  }

  const ins = await supabaseAdmin
    .from("hammerex_xrated_shipping_zones")
    .insert({ ...patch, listing_id: listing.data.id })
    .select("*")
    .maybeSingle();
  if (ins.error || !ins.data) {
    console.error("[trade-off/shipping-zones/upsert] insert failed:", ins.error);
    return NextResponse.json(
      { ok: false, error: ins.error?.message ?? "Insert failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, zone: ins.data });
}
