// POST /api/trade-off/wholesale-origin/upsert
// Magic-link authenticated. Body:
//   { slug, edit_token, address, postcode, lat, lng, distance_fudge,
//     allow_pickup, currency, prices_ex_vat }
// Updates wholesale_origin_* + wholesale_* columns on the listing.
// All inputs sanitised; lat/lng range-checked. Currency forced to a
// 3-letter ISO-ish code (GBP only in v1; schema supports more).

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

function numOrNull(v: unknown, min: number, max: number): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

const CURRENCY_RE = /^[A-Z]{3}$/;

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

  const addressRaw = s(body.address);
  const postcodeRaw = s(body.postcode).toUpperCase().replace(/\s+/g, " ");
  const lat = numOrNull(body.lat, -90, 90);
  const lng = numOrNull(body.lng, -180, 180);
  const fudgeRaw = body.distance_fudge;
  const distance_fudge = fudgeRaw === undefined || fudgeRaw === null || fudgeRaw === ""
    ? 1.4
    : clampNum(fudgeRaw, 1.0, 3.0, 1.4);

  const allow_pickup = body.allow_pickup === true;
  const prices_ex_vat = body.prices_ex_vat === false ? false : true;
  const currencyRaw = s(body.currency).toUpperCase();
  const currency = CURRENCY_RE.test(currencyRaw) ? currencyRaw : "GBP";

  const patch = {
    wholesale_origin_address: addressRaw.length > 0 ? addressRaw.slice(0, 240) : null,
    wholesale_origin_postcode: postcodeRaw.length > 0 ? postcodeRaw.slice(0, 12) : null,
    wholesale_origin_lat: lat,
    wholesale_origin_lng: lng,
    wholesale_distance_fudge: Math.round(distance_fudge * 100) / 100,
    wholesale_allow_pickup: allow_pickup,
    wholesale_currency: currency,
    wholesale_prices_ex_vat: prices_ex_vat
  };

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update(patch)
    .eq("id", listing.data.id)
    .select(
      "id, wholesale_origin_address, wholesale_origin_postcode, wholesale_origin_lat, wholesale_origin_lng, wholesale_distance_fudge, wholesale_allow_pickup, wholesale_currency, wholesale_prices_ex_vat"
    )
    .maybeSingle();

  if (upd.error) {
    console.error("[trade-off/wholesale-origin/upsert] update failed:", upd.error);
    return NextResponse.json({ ok: false, error: upd.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, listing: upd.data });
}
