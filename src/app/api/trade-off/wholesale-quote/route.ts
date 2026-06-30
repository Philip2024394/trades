// POST /api/trade-off/wholesale-quote
// Body: {
//   slug,
//   customer_lat,
//   customer_lng,
//   cart_total_pence,
//   cart_lines?: [{ product_id, qty }]
// }
// Returns:
//   { ok: true, delivery_pence, eta_label, applied_band_km,
//     distance_km, qualifies_for_free, qualifies_for_min_order,
//     free_delivery_unlocked_by?: { product_id, name, min_qty },
//     error?: "outside_zone" }
//
// Distance: Haversine straight-line km × the listing's fudge factor
// (default 1.4). Beyond max_delivery_km (or beyond the largest band's
// max_km when max_delivery_km is null) we return outside_zone so the
// cart surfaces "WhatsApp for custom quote".
//
// Per-product free-delivery override: when cart_lines is sent, we look
// up each line's free_delivery_min_qty. If ANY line's qty meets/exceeds
// its threshold (and the customer is INSIDE the merchant's max delivery
// reach), delivery_pence is forced to 0 — whole-order free shipping
// driven by the qualifying product. The qualifying line is echoed back
// via free_delivery_unlocked_by so the cart can render the green
// confirmation chip.

import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

type ZoneVatMode = "inc" | "ex" | "pay_driver";

type Band = {
  max_km: number;
  price_pence: number;
  min_order_pence?: number;
  vat_mode?: ZoneVatMode;
};

function readVatMode(raw: unknown): ZoneVatMode {
  if (raw === "inc" || raw === "ex" || raw === "pay_driver") return raw;
  return "inc"; // UK Price Marking Order 2004 — consumer-safe default
}

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

  // cart_lines is optional — when present we'll check each line against
  // the product's free_delivery_min_qty to decide whether to zero
  // delivery. Cap at 50 lines to keep the lookup query bounded.
  const cartLines: Array<{ product_id: string; qty: number }> = [];
  if (Array.isArray(body.cart_lines)) {
    for (const raw of body.cart_lines.slice(0, 50)) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const pid = typeof r.product_id === "string" ? r.product_id.trim() : "";
      const qtyN = Number(r.qty);
      if (pid.length === 0 || !Number.isFinite(qtyN) || qtyN <= 0) continue;
      cartLines.push({ product_id: pid, qty: Math.floor(qtyN) });
    }
  }

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
      min_order_pence: Number((b as Record<string, unknown>).min_order_pence ?? 0),
      vat_mode: readVatMode((b as Record<string, unknown>).vat_mode)
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
  // to the WhatsApp custom-quote flow). Free-delivery override does NOT
  // apply outside the zones (a 50-bag-of-cement offer doesn't extend to
  // Aberdeen).
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

  // Per-product free-delivery override — check each cart line against
  // its product's free_delivery_min_qty. If any line meets the
  // threshold, the WHOLE order ships free (whole-order model picked
  // for simpler customer UX; see project_xratedtrade_merchant_pro.md).
  let freeDeliveryUnlockedBy:
    | { product_id: string; name: string; min_qty: number }
    | null = null;
  if (cartLines.length > 0) {
    const ids = cartLines.map((l) => l.product_id);
    const productsRes = await supabase
      .from("hammerex_xrated_products")
      .select("id, name, free_delivery_min_qty")
      .in("id", ids)
      .eq("listing_id", listing.id);
    const productMap = new Map<
      string,
      { name: string; free_delivery_min_qty: number | null }
    >();
    for (const p of productsRes.data ?? []) {
      productMap.set(p.id, {
        name: typeof p.name === "string" ? p.name : "",
        free_delivery_min_qty:
          typeof p.free_delivery_min_qty === "number"
            ? p.free_delivery_min_qty
            : null
      });
    }
    for (const line of cartLines) {
      const p = productMap.get(line.product_id);
      if (!p) continue;
      if (
        typeof p.free_delivery_min_qty === "number" &&
        p.free_delivery_min_qty > 0 &&
        line.qty >= p.free_delivery_min_qty
      ) {
        freeDeliveryUnlockedBy = {
          product_id: line.product_id,
          name: p.name,
          min_qty: p.free_delivery_min_qty
        };
        break;
      }
    }
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
      eta_label: freeDeliveryUnlockedBy
        ? `Free delivery — unlocked by ${freeDeliveryUnlockedBy.name}`
        : "Free delivery (inside merchant's free radius)",
      applied_band_km: freeRadius,
      distance_km: distanceKm,
      qualifies_for_free: true,
      qualifies_for_min_order: qualifiesFreeMinOrder,
      free_delivery_unlocked_by: freeDeliveryUnlockedBy,
      vat_mode: "ex" as ZoneVatMode
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

  // Per-product free-delivery override wins over the banded price —
  // whole-order zeroing when the customer is inside the merchant's
  // delivery footprint and has a qualifying line in the cart.
  const finalDeliveryPence = freeDeliveryUnlockedBy ? 0 : band.price_pence;
  const finalEtaLabel = freeDeliveryUnlockedBy
    ? `Free delivery — unlocked by ${freeDeliveryUnlockedBy.name}`
    : `Within ${band.max_km} km band`;

  return NextResponse.json({
    ok: true,
    delivery_pence: finalDeliveryPence,
    eta_label: finalEtaLabel,
    applied_band_km: band.max_km,
    distance_km: distanceKm,
    qualifies_for_free: finalDeliveryPence === 0,
    qualifies_for_min_order: qualifies,
    min_order_pence: effectiveMinOrder,
    free_delivery_unlocked_by: freeDeliveryUnlockedBy,
    vat_mode: band.vat_mode ?? "ex"
  });
}
