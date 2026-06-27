// POST /api/trade-off/wholesale-quote
// Body: { slug, customer_lat, customer_lng, cart_total_pence }
// Returns:
//   { ok: true, delivery_pence, eta_label, applied_band_km,
//     distance_km, qualifies_for_free, qualifies_for_min_order,
//     error?: "outside_zone" }
//
// Distance: Haversine straight-line km × the listing's fudge factor
// (default 1.4). Beyond max_delivery_km (or beyond the largest band's
// max_km when max_delivery_km is null) we return outside_zone so the
// cart surfaces "WhatsApp for custom quote".

import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

type Band = {
  max_km: number;
  price_pence: number;
  min_order_pence?: number;
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
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

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const slug = s(body.slug);
  const lat = numOrNull(body.customer_lat, -90, 90);
  const lng = numOrNull(body.customer_lng, -180, 180);
  const cartTotalPence = Math.max(0, Math.round(Number(body.cart_total_pence) || 0));

  if (!slug || lat === null || lng === null) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or customer coordinates." },
      { status: 400 }
    );
  }

  const listingRes = await supabase
    .from("hammerex_trade_off_listings")
    .select(
      "id, slug, wholesale_origin_lat, wholesale_origin_lng, wholesale_distance_fudge, wholesale_allow_pickup"
    )
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  const listing = listingRes.data;
  if (!listing) {
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }
  if (
    typeof listing.wholesale_origin_lat !== "number" ||
    typeof listing.wholesale_origin_lng !== "number"
  ) {
    return NextResponse.json(
      { ok: false, error: "Merchant has no yard origin yet." },
      { status: 409 }
    );
  }

  const fudge =
    typeof listing.wholesale_distance_fudge === "number" &&
    listing.wholesale_distance_fudge >= 1.0 &&
    listing.wholesale_distance_fudge <= 3.0
      ? listing.wholesale_distance_fudge
      : 1.4;

  const rawKm = haversineKm(
    listing.wholesale_origin_lat,
    listing.wholesale_origin_lng,
    lat,
    lng
  );
  const distanceKm = Math.round(rawKm * fudge * 100) / 100;

  const zoneRes = await supabase
    .from("hammerex_xrated_wholesale_zones")
    .select("free_radius_km, banded_pricing, min_order_pence, max_delivery_km")
    .eq("listing_id", listing.id)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  const zone = zoneRes.data;
  if (!zone) {
    return NextResponse.json(
      { ok: false, error: "No delivery zones configured." },
      { status: 409 }
    );
  }

  const bandsRaw = Array.isArray(zone.banded_pricing) ? zone.banded_pricing : [];
  const bands: Band[] = bandsRaw
    .filter((b: unknown): b is Record<string, unknown> => Boolean(b && typeof b === "object"))
    .map((b) => ({
      max_km: Number((b as Record<string, unknown>).max_km),
      price_pence: Number((b as Record<string, unknown>).price_pence),
      min_order_pence: Number((b as Record<string, unknown>).min_order_pence ?? 0)
    }))
    .filter((b) => Number.isFinite(b.max_km) && Number.isFinite(b.price_pence))
    .sort((a, b) => a.max_km - b.max_km);

  const maxDelivery: number | null =
    typeof zone.max_delivery_km === "number" && zone.max_delivery_km > 0
      ? zone.max_delivery_km
      : bands.length > 0
        ? bands[bands.length - 1].max_km
        : null;

  // Outside the merchant's reach — return outside_zone (the cart pivots
  // to the WhatsApp custom-quote flow).
  if (maxDelivery !== null && distanceKm > maxDelivery) {
    return NextResponse.json({
      ok: true,
      delivery_pence: null,
      eta_label: null,
      applied_band_km: null,
      distance_km: distanceKm,
      qualifies_for_free: false,
      qualifies_for_min_order: cartTotalPence >= (zone.min_order_pence ?? 0),
      error: "outside_zone"
    });
  }

  // Inside the free radius? Zero delivery, no min-order gate beyond the
  // listing-wide one (zone.min_order_pence).
  const freeRadius =
    typeof zone.free_radius_km === "number" && zone.free_radius_km > 0
      ? zone.free_radius_km
      : null;
  if (freeRadius !== null && distanceKm <= freeRadius) {
    const qualifiesFreeMinOrder = cartTotalPence >= (zone.min_order_pence ?? 0);
    return NextResponse.json({
      ok: true,
      delivery_pence: 0,
      eta_label: "Free delivery (inside merchant's free radius)",
      applied_band_km: freeRadius,
      distance_km: distanceKm,
      qualifies_for_free: true,
      qualifies_for_min_order: qualifiesFreeMinOrder
    });
  }

  // Otherwise pick the first band whose max_km covers the distance.
  const band = bands.find((b) => distanceKm <= b.max_km) ?? null;
  if (!band) {
    return NextResponse.json({
      ok: true,
      delivery_pence: null,
      eta_label: null,
      applied_band_km: null,
      distance_km: distanceKm,
      qualifies_for_free: false,
      qualifies_for_min_order: cartTotalPence >= (zone.min_order_pence ?? 0),
      error: "outside_zone"
    });
  }

  const bandMinOrder = band.min_order_pence ?? 0;
  const effectiveMinOrder = Math.max(bandMinOrder, zone.min_order_pence ?? 0);
  const qualifies = cartTotalPence >= effectiveMinOrder;

  return NextResponse.json({
    ok: true,
    delivery_pence: band.price_pence,
    eta_label: `Within ${band.max_km} km band`,
    applied_band_km: band.max_km,
    distance_km: distanceKm,
    qualifies_for_free: band.price_pence === 0,
    qualifies_for_min_order: qualifies,
    min_order_pence: effectiveMinOrder
  });
}
