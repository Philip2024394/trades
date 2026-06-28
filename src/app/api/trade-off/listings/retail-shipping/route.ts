// POST /api/trade-off/listings/retail-shipping
// Magic-link authenticated. Body: { slug, edit_token, mode, uk_pence,
// uk_areas, international }.
//
// Full-replace save (not partial) — the editor always sends the whole
// shape so validation can normalise empty arrays → NULL in the DB. That
// keeps the read path on the PDP / BuyColumnDetails simple (NULL means
// "Shipping confirmed by WhatsApp" everywhere).
//
// Validation rules:
//   - mode ∈ { 'free', 'uk_flat', 'uk_areas', null }
//   - uk_pence integer ≥0 (only used when mode='uk_flat')
//   - uk_areas ≤30 rows with area string (1..80 chars) + integer pence ≥0
//   - international ≤50 rows with 2-letter ISO country_code, name ≤60 chars,
//     non-negative integer pence + dispatch_days + delivery_days
//
// Empty arrays normalise to NULL so the read side can treat NULL ==
// "not configured" without juggling "[]" vs null.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  RetailShippingArea,
  RetailShippingIntl
} from "@/lib/supabase";

export const runtime = "nodejs";

const MODES = new Set([
  "free",
  "uk_flat",
  "uk_areas",
  "pickup",
  "uk_over_threshold"
]);
const ISO2 = /^[A-Z]{2}$/;

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function intOrNull(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (!Number.isInteger(v)) return null;
  if (v < 0) return null;
  return v;
}

function validateAreas(
  raw: unknown
): { ok: true; rows: RetailShippingArea[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: true, rows: [] };
  if (raw.length > 30) {
    return { ok: false, error: "Too many UK areas (max 30)." };
  }
  const rows: RetailShippingArea[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") {
      return { ok: false, error: "Bad UK-area row." };
    }
    const r = row as Record<string, unknown>;
    const area = s(r.area);
    if (area.length === 0 || area.length > 80) {
      return { ok: false, error: "UK-area name must be 1..80 chars." };
    }
    const price = intOrNull(r.price_pence);
    if (price === null) {
      return { ok: false, error: "UK-area price must be an integer ≥0 pence." };
    }
    rows.push({ area, price_pence: price });
  }
  return { ok: true, rows };
}

function validateIntl(
  raw: unknown
):
  | { ok: true; rows: RetailShippingIntl[] }
  | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: true, rows: [] };
  if (raw.length > 50) {
    return { ok: false, error: "Too many international rows (max 50)." };
  }
  const rows: RetailShippingIntl[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") {
      return { ok: false, error: "Bad international row." };
    }
    const r = row as Record<string, unknown>;
    const code = s(r.country_code).toUpperCase();
    if (!ISO2.test(code)) {
      return { ok: false, error: "country_code must be a 2-letter ISO code." };
    }
    const name = s(r.country_name);
    if (name.length === 0 || name.length > 60) {
      return { ok: false, error: "country_name must be 1..60 chars." };
    }
    const price = intOrNull(r.price_pence);
    if (price === null) {
      return { ok: false, error: "International price must be an integer ≥0 pence." };
    }
    const dispatchDays = intOrNull(r.dispatch_days);
    if (dispatchDays === null) {
      return { ok: false, error: "dispatch_days must be an integer ≥0." };
    }
    const deliveryDays = intOrNull(r.delivery_days);
    if (deliveryDays === null) {
      return { ok: false, error: "delivery_days must be an integer ≥0." };
    }
    rows.push({
      country_code: code,
      country_name: name,
      price_pence: price,
      dispatch_days: dispatchDays,
      delivery_days: deliveryDays
    });
  }
  return { ok: true, rows };
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

  // mode: null / undefined / "" → null (clears UK config).
  let mode: "free" | "uk_flat" | "uk_areas" | null = null;
  if (typeof body.mode === "string") {
    const raw = body.mode.trim();
    if (raw.length > 0) {
      if (!MODES.has(raw)) {
        return NextResponse.json(
          { ok: false, error: "Invalid shipping mode." },
          { status: 400 }
        );
      }
      mode = raw as "free" | "uk_flat" | "uk_areas";
    }
  }

  let ukPence: number | null = null;
  if (body.uk_pence !== null && body.uk_pence !== undefined && body.uk_pence !== "") {
    const v = intOrNull(typeof body.uk_pence === "number" ? body.uk_pence : Number(body.uk_pence));
    if (v === null) {
      return NextResponse.json(
        { ok: false, error: "uk_pence must be an integer ≥0." },
        { status: 400 }
      );
    }
    ukPence = v;
  }

  const areasResult = validateAreas(body.uk_areas);
  if (!areasResult.ok) {
    return NextResponse.json({ ok: false, error: areasResult.error }, { status: 400 });
  }
  const intlResult = validateIntl(body.international);
  if (!intlResult.ok) {
    return NextResponse.json({ ok: false, error: intlResult.error }, { status: 400 });
  }

  // Mode-aware nulling: when mode is not 'uk_flat', uk_pence is forced
  // NULL; when not 'uk_areas', the uk_areas array is forced NULL. Keeps
  // the read side from rendering stale partial state.
  const ukAreas = mode === "uk_areas" && areasResult.rows.length > 0 ? areasResult.rows : null;
  const ukPenceFinal = mode === "uk_flat" ? ukPence : null;
  const intlFinal = intlResult.rows.length > 0 ? intlResult.rows : null;

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

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({
      retail_shipping_mode: mode,
      retail_shipping_uk_pence: ukPenceFinal,
      retail_shipping_uk_areas: ukAreas,
      retail_shipping_international: intlFinal
    })
    .eq("id", listing.data.id)
    .select(
      "retail_shipping_mode, retail_shipping_uk_pence, retail_shipping_uk_areas, retail_shipping_international"
    )
    .maybeSingle();

  if (upd.error || !upd.data) {
    console.error("[trade-off/listings/retail-shipping] update failed:", upd.error);
    return NextResponse.json(
      { ok: false, error: upd.error?.message ?? "Update failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, retail_shipping: upd.data });
}
