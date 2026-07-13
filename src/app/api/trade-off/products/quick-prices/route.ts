// POST /api/trade-off/products/quick-prices
//   { slug, edit_token, items: [{label, price_pence, unit, service_category, description}] }
//
// Bulk INSERT for the quick-prices onboarding — a signed-in trade
// picks 5 starter services from a template list and saves them all
// at once. Every row lands as kind='service' with a service_category
// so the Nearby Installers PDP strip picks them up immediately.
//
// Not an upsert — the quick-prices flow is INSERT-only. Later edits
// go through the normal shop-mode editor (upsert endpoint).

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { SERVICE_CATEGORIES } from "@/lib/serviceCategories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ITEMS = 20;

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

type ItemIn = {
  label?: unknown;
  price_pence?: unknown;
  unit?: unknown;
  service_category?: unknown;
  description?: unknown;
};

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 }
    );
  }

  const slug = s(body.slug).trim();
  const editToken = s(body.edit_token).trim();
  const rawItems = Array.isArray(body.items) ? (body.items as ItemIn[]) : [];

  if (!slug || !editToken) {
    return NextResponse.json(
      { ok: false, error: "missing_auth" },
      { status: 400 }
    );
  }
  if (rawItems.length === 0) {
    return NextResponse.json(
      { ok: false, error: "no_items" },
      { status: 400 }
    );
  }
  if (rawItems.length > MAX_ITEMS) {
    return NextResponse.json(
      { ok: false, error: `max ${MAX_ITEMS} items per bulk save` },
      { status: 400 }
    );
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!listing.data || !constantTimeEq(listing.data.edit_token, editToken)) {
    return NextResponse.json(
      { ok: false, error: "unauthorised" },
      { status: 401 }
    );
  }
  if (listing.data.status !== "live") {
    return NextResponse.json(
      { ok: false, error: "listing_not_live" },
      { status: 403 }
    );
  }

  const validCategorySlugs = new Set(SERVICE_CATEGORIES.map((c) => c.slug));

  const cleaned: Array<{
    listing_id: string;
    kind: "service";
    name: string;
    description: string | null;
    price_pence: number;
    unit: string | null;
    service_category: string;
    status: "live";
    sort_order: number;
  }> = [];
  for (let i = 0; i < rawItems.length; i++) {
    const it = rawItems[i];
    const label = s(it.label).trim().slice(0, 80);
    const description =
      s(it.description).trim().slice(0, 1000) || null;
    const unit = s(it.unit).trim().slice(0, 32) || null;
    const category = s(it.service_category).trim();
    const priceRaw = it.price_pence;
    const price =
      typeof priceRaw === "number" && Number.isFinite(priceRaw)
        ? Math.max(0, Math.round(priceRaw))
        : NaN;

    if (label.length === 0) continue;
    if (!Number.isFinite(price) || price === 0) continue;
    if (!validCategorySlugs.has(category)) continue;
    cleaned.push({
      listing_id: listing.data.id,
      kind: "service",
      name: label,
      description,
      price_pence: price,
      unit,
      service_category: category,
      status: "live",
      sort_order: 900 + i
    });
  }

  if (cleaned.length === 0) {
    return NextResponse.json(
      { ok: false, error: "all_items_invalid" },
      { status: 400 }
    );
  }

  const insertRes = await supabaseAdmin
    .from("hammerex_xrated_products")
    .insert(cleaned)
    .select("id, name");

  if (insertRes.error) {
    return NextResponse.json(
      {
        ok: false,
        error: "insert_failed",
        detail: insertRes.error.message
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    inserted: (insertRes.data ?? []).length,
    ids: (insertRes.data ?? []).map((r) => r.id)
  });
}
