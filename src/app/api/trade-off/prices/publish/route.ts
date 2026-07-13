// POST /api/trade-off/prices/publish
//
// A live listing publishes (or updates) a live price for a material
// item. UPSERTs on (merchant_listing_id, item_slug) so republishing
// the same item just refreshes the price and its expiry window.
//
// Body:
//   { slug, edit_token,
//     item_slug, item_label, unit_label,
//     price_pounds, currency?, qty_included?,
//     postcode_prefix?, region?, notes? }
//
// Auth: magic-link (slug + edit_token). Any live listing can publish
// prices — v1 doesn't gate this behind paid tiers so we build the
// data volume fast. If the pattern becomes exploitable, gate to
// paid merchants in v2.

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_CURRENCY = new Set(["GBP", "USD", "EUR"]);

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function n(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const num = Number.parseFloat(v);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function constantTimeEq(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400 }
    );
  }

  const slug = s(body.slug).trim();
  const editToken = s(body.edit_token).trim();
  const itemLabel = s(body.item_label).trim();
  const itemSlugRaw = s(body.item_slug).trim();
  const itemSlug = itemSlugRaw ? slugify(itemSlugRaw) : slugify(itemLabel);
  const unitLabel = s(body.unit_label).trim() || "each";
  const currencyRaw = s(body.currency).trim().toUpperCase();
  const currency = ALLOWED_CURRENCY.has(currencyRaw) ? currencyRaw : "GBP";
  const pricePoundsN = n(body.price_pounds);
  const qtyIncludedN = n(body.qty_included);
  const postcodePrefixRaw = s(body.postcode_prefix).trim().toUpperCase();
  const postcodePrefix = postcodePrefixRaw
    ? postcodePrefixRaw.slice(0, 6)
    : null;
  const region = s(body.region).trim() || null;
  const notes = s(body.notes).trim() || null;

  if (!slug || !editToken) {
    return NextResponse.json(
      { ok: false, error: "missing_auth" },
      { status: 401 }
    );
  }
  if (!itemLabel || itemLabel.length > 140) {
    return NextResponse.json(
      { ok: false, error: "invalid_item_label" },
      { status: 400 }
    );
  }
  if (!itemSlug) {
    return NextResponse.json(
      { ok: false, error: "invalid_item_slug" },
      { status: 400 }
    );
  }
  if (pricePoundsN === null || pricePoundsN < 0) {
    return NextResponse.json(
      { ok: false, error: "invalid_price" },
      { status: 400 }
    );
  }

  const { data: listing } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token, status")
    .eq("slug", slug)
    .maybeSingle();

  if (!listing || !constantTimeEq(listing.edit_token, editToken)) {
    return NextResponse.json(
      { ok: false, error: "unauthorised" },
      { status: 401 }
    );
  }
  if (listing.status !== "live") {
    return NextResponse.json(
      { ok: false, error: "listing_not_live" },
      { status: 403 }
    );
  }

  const pricePence = Math.round(pricePoundsN * 100);
  const qtyIncluded =
    qtyIncludedN !== null && qtyIncludedN >= 1
      ? Math.floor(qtyIncludedN)
      : 1;

  const expiresAt = new Date(
    Date.now() + 14 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: inserted, error } = await supabaseAdmin
    .from("hammerex_material_prices")
    .upsert(
      {
        merchant_listing_id: listing.id,
        item_slug: itemSlug,
        item_label: itemLabel,
        unit_label: unitLabel,
        price_pence: pricePence,
        currency,
        qty_included: qtyIncluded,
        postcode_prefix: postcodePrefix,
        region,
        notes,
        is_live: true,
        expires_at: expiresAt
      },
      { onConflict: "merchant_listing_id,item_slug" }
    )
    .select("id, updated_at, expires_at")
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      { ok: false, error: "insert_failed", detail: error?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    priceId: inserted.id,
    updatedAt: inserted.updated_at,
    expiresAt: inserted.expires_at
  });
}


// DELETE — same auth, sets is_live=false rather than deleting so history
// is preserved. Body: { slug, edit_token, item_slug }
export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const slug = s(body.slug).trim();
  const editToken = s(body.edit_token).trim();
  const itemSlug = slugify(s(body.item_slug).trim());
  if (!slug || !editToken || !itemSlug) {
    return NextResponse.json(
      { ok: false, error: "missing_auth" },
      { status: 401 }
    );
  }
  const { data: listing } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!listing || !constantTimeEq(listing.edit_token, editToken)) {
    return NextResponse.json(
      { ok: false, error: "unauthorised" },
      { status: 401 }
    );
  }
  const { error } = await supabaseAdmin
    .from("hammerex_material_prices")
    .update({ is_live: false })
    .eq("merchant_listing_id", listing.id)
    .eq("item_slug", itemSlug);
  if (error) {
    return NextResponse.json(
      { ok: false, error: "update_failed", detail: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
