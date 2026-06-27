// POST /api/trade-off/wholesale-zones/upsert
// Magic-link authenticated. Body:
//   { slug, edit_token, zone: { id?, free_radius_km, free_postcodes,
//     banded_pricing, min_order_pence, max_delivery_km, sort_order } }
//
// banded_pricing is a jsonb array of distance bands. Each row:
//   { max_km, price_pence, min_order_pence? }
// Bands MUST ascend by max_km without overlap; the customer's distance
// is matched to the first band whose max_km covers it. Beyond the
// largest max_km the cart shows "outside delivery area — WhatsApp for
// custom quote".

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function nonNegIntOrZero(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function nonNegNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

type BandOut = {
  max_km: number;
  price_pence: number;
  min_order_pence: number;
};

function sanitiseBands(v: unknown): { bands: BandOut[]; error: string | null } {
  if (v === null || v === undefined) return { bands: [], error: null };
  if (!Array.isArray(v)) {
    return { bands: [], error: "banded_pricing must be an array." };
  }
  if (v.length === 0) return { bands: [], error: null };
  if (v.length > 10) {
    return { bands: [], error: "Up to 10 delivery bands per zone." };
  }
  const out: BandOut[] = [];
  let prevMaxKm = 0;
  for (const raw of v) {
    if (!raw || typeof raw !== "object") {
      return { bands: [], error: "Each band must be an object." };
    }
    const rec = raw as Record<string, unknown>;
    const maxKm = Number(rec.max_km);
    if (!Number.isFinite(maxKm) || maxKm <= 0 || maxKm > 10_000) {
      return { bands: [], error: "Band max_km must be positive (≤ 10,000)." };
    }
    if (maxKm <= prevMaxKm) {
      return { bands: [], error: "Bands must ascend by max_km without overlap." };
    }
    const priceP = Number(rec.price_pence);
    if (!Number.isFinite(priceP) || priceP < 0 || priceP > 1_000_000_00) {
      return { bands: [], error: "Band price_pence must be ≥ 0." };
    }
    const minOrder = nonNegIntOrZero(rec.min_order_pence);
    out.push({
      max_km: Math.round(maxKm * 100) / 100,
      price_pence: Math.round(priceP),
      min_order_pence: minOrder
    });
    prevMaxKm = maxKm;
  }
  return { bands: out, error: null };
}

function arrPostcodes(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim().toUpperCase().replace(/\s+/g, ""))
    .filter((x) => x.length > 0 && x.length <= 10)
    .slice(0, 200);
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

  const bandsParsed = sanitiseBands(zoneIn.banded_pricing);
  if (bandsParsed.error) {
    return NextResponse.json({ ok: false, error: bandsParsed.error }, { status: 400 });
  }

  const free_radius_km = nonNegNumOrNull(zoneIn.free_radius_km);
  const max_delivery_km = nonNegNumOrNull(zoneIn.max_delivery_km);
  const min_order_pence = nonNegIntOrZero(zoneIn.min_order_pence);
  const sort_order = nonNegIntOrZero(zoneIn.sort_order);
  const free_postcodes = arrPostcodes(zoneIn.free_postcodes);

  const patch = {
    free_radius_km,
    free_postcodes,
    banded_pricing: bandsParsed.bands,
    min_order_pence,
    max_delivery_km,
    sort_order
  };

  const idRaw = s(zoneIn.id);
  if (idRaw) {
    if (!UUID_RE.test(idRaw)) {
      return NextResponse.json({ ok: false, error: "Invalid zone id." }, { status: 400 });
    }
    const upd = await supabaseAdmin
      .from("hammerex_xrated_wholesale_zones")
      .update(patch)
      .eq("id", idRaw)
      .eq("listing_id", listing.data.id)
      .select("*")
      .maybeSingle();
    if (upd.error) {
      console.error("[trade-off/wholesale-zones/upsert] update failed:", upd.error);
      return NextResponse.json({ ok: false, error: upd.error.message }, { status: 500 });
    }
    if (!upd.data) {
      return NextResponse.json({ ok: false, error: "Zone not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, zone: upd.data });
  }

  const ins = await supabaseAdmin
    .from("hammerex_xrated_wholesale_zones")
    .insert({ ...patch, listing_id: listing.data.id })
    .select("*")
    .maybeSingle();
  if (ins.error || !ins.data) {
    console.error("[trade-off/wholesale-zones/upsert] insert failed:", ins.error);
    return NextResponse.json(
      { ok: false, error: ins.error?.message ?? "Insert failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, zone: ins.data });
}
