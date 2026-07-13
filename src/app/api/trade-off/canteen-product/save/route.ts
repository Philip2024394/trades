// POST /api/trade-off/canteen-product/save
//
// Upsert a canteen product. Powers the merchant editor at
// /trade-off/edit/[slug]/products/[id]. When `id` is "new" a fresh
// row is inserted; otherwise the row is updated in place.
//
// Body:
//   { slug, edit_token, id, product: {
//       name, blurb, description, image_url, gallery_urls,
//       price_gbp, currency, specs,
//       trade_center_listing_id,
//       show_in_canteen_products, show_in_trending, show_in_trade_center,
//       featured
//     } }
//
// Auth: magic-link (slug + edit_token). Only the merchant on the
// listing's canteen may write. Trade Center flag is additionally
// double-checked at read-time by browseAllProductsFromDb which filters
// by show_in_trade_center = true (defence-in-depth).

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readTradeSession } from "@/lib/tradeSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_CURRENCY = new Set(["GBP", "USD", "EUR", "AUD", "CAD"]);

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function n(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const num = Number.parseFloat(v);
    return Number.isFinite(num) ? num : 0;
  }
  return 0;
}
function b(v: unknown, fallback = true): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
}
function arr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function constantTimeEq(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const providedSlug = s(body.slug).trim();
  const providedToken = s(body.edit_token).trim();
  const productId = s(body.id).trim();
  const product = (body.product ?? {}) as Record<string, unknown>;

  // Auth precedence:
  //   1. body { slug, edit_token } — magic-link (product editor page)
  //   2. HMAC trade session cookie — Dev · Pass + inline canteen editor
  // Either path resolves to a `listing` row that owns this product.
  let listing: {
    id: string;
    slug: string;
    edit_token: string;
    status: string;
    display_name: string;
  } | null = null;

  if (providedSlug && providedToken) {
    const { data } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, slug, edit_token, status, display_name")
      .eq("slug", providedSlug)
      .maybeSingle();
    if (data && constantTimeEq(data.edit_token, providedToken)) {
      listing = data;
    }
  }
  if (!listing) {
    const session = readTradeSession(req as NextRequest);
    if (session?.listing_id) {
      const { data } = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("id, slug, edit_token, status, display_name")
        .eq("id", session.listing_id)
        .maybeSingle();
      if (data) listing = data;
    }
  }
  if (!listing) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (listing.status !== "live") {
    return NextResponse.json({ ok: false, error: "listing_not_live" }, { status: 403 });
  }

  // Resolve the merchant's canteen. Canteen host_slug = the listing slug.
  const { data: canteen } = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id, host_slug")
    .eq("host_slug", listing.slug)
    .maybeSingle();
  if (!canteen) {
    return NextResponse.json({ ok: false, error: "no_canteen" }, { status: 404 });
  }

  // Shape the payload — every field defensive-coerced.
  const name = s(product.name).trim().slice(0, 160);
  if (!name) {
    return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
  }
  const blurb = s(product.blurb).trim().slice(0, 240);
  const description = s(product.description).trim().slice(0, 4000);
  const imageUrl = s(product.image_url).trim();
  const galleryUrls = arr(product.gallery_urls).slice(0, 12);
  // Videos: hard-capped at 200 per listing (matches the "Works" fair-use
  // ceiling in the form). Merchant-tier quotas are enforced at upload
  // time by the video-upload endpoint (once wired) — this is the
  // ultimate safety cap even if a merchant somehow accumulates more.
  const videoUrls = arr(product.video_urls).slice(0, 200);
  const priceGbp = Math.max(0, Math.round(n(product.price_gbp)));
  const currencyRaw = s(product.currency).trim().toUpperCase();
  const currency = ALLOWED_CURRENCY.has(currencyRaw) ? currencyRaw : "GBP";
  const specs = arr(product.specs).slice(0, 12);
  const tradeCenterListingId = s(product.trade_center_listing_id).trim() || null;
  const showInCanteenProducts = b(product.show_in_canteen_products, true);
  const showInTrending = b(product.show_in_trending, true);
  const showInTradeCenter = b(product.show_in_trade_center, true);
  const featured = b(product.featured, false);

  // Variants — passed through as JSONB. Sanity-check the shape but
  // don't validate every field so the schema can evolve without an
  // API bump. `null` means "no variants" (single SKU).
  let variants: unknown = null;
  const rawVariants = product.variants;
  if (rawVariants && typeof rawVariants === "object") {
    const v = rawVariants as Record<string, unknown>;
    const axis = s(v.axis);
    if (axis === "size" || axis === "color" || axis === "size_color") {
      // Per-combo overrides — arbitrary keys, each maps to a subset
      // of variant fields (sku / imageUrl / priceGbp / stock / mpn /
      // gtin). Everything defensive-coerced + length-capped.
      let overrides: Record<string, Record<string, unknown>> | undefined;
      if (v.overrides && typeof v.overrides === "object") {
        const rawO = v.overrides as Record<string, unknown>;
        const cleaned: Record<string, Record<string, unknown>> = {};
        for (const [key, raw] of Object.entries(rawO)) {
          if (!raw || typeof raw !== "object") continue;
          const row = raw as Record<string, unknown>;
          const sku = s(row.sku).trim().slice(0, 60);
          const imageUrl = s(row.imageUrl).trim().slice(0, 500);
          const priceGbpRaw = n(row.priceGbp);
          const priceGbp = priceGbpRaw > 0 ? Math.round(priceGbpRaw * 100) / 100 : undefined;
          const stockRaw = n(row.stock);
          const stock = stockRaw >= 0 && stockRaw <= 100000 ? Math.round(stockRaw) : undefined;
          const mpn = s(row.mpn).trim().slice(0, 60);
          const gtin = s(row.gtin).trim().replace(/\s+/g, "").slice(0, 20);
          // Only keep the override if at least one field is set —
          // avoids storing empty stubs.
          const clean: Record<string, unknown> = {};
          if (sku) clean.sku = sku;
          if (imageUrl) clean.imageUrl = imageUrl;
          if (priceGbp !== undefined) clean.priceGbp = priceGbp;
          if (stock !== undefined) clean.stock = stock;
          if (mpn) clean.mpn = mpn;
          if (gtin) clean.gtin = gtin;
          if (Object.keys(clean).length > 0) {
            // Cap key length to prevent unbounded JSON blow-up.
            cleaned[String(key).slice(0, 120)] = clean;
          }
        }
        if (Object.keys(cleaned).length > 0) overrides = cleaned;
      }

      variants = {
        axis,
        sizePreset: typeof v.sizePreset === "string" ? v.sizePreset : undefined,
        sizeOptions: Array.isArray(v.sizeOptions)
          ? v.sizeOptions.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 24)
          : undefined,
        colorOptions: Array.isArray(v.colorOptions)
          ? v.colorOptions
              .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
              .map((c) => ({
                name: s((c as Record<string, unknown>).name).trim(),
                hex: typeof (c as Record<string, unknown>).hex === "string"
                  ? s((c as Record<string, unknown>).hex).trim() || undefined
                  : undefined
              }))
              .filter((c) => c.name.length > 0)
              .slice(0, 24)
          : undefined,
        overrides
      };
    }
  }

  // Commerce — brand, year, condition, shipping, multi-buy, electrical.
  // Same defensive pattern as variants. Null when the merchant has
  // filled nothing meaningful.
  let commerce: unknown = null;
  const rawCommerce = product.commerce;
  if (rawCommerce && typeof rawCommerce === "object") {
    const c = rawCommerce as Record<string, unknown>;

    const brand = s(c.brand).trim().slice(0, 80) || undefined;
    const model = s(c.model).trim().slice(0, 80) || undefined;
    const mpn = s(c.mpn).trim().slice(0, 60) || undefined;
    const gtin = s(c.gtin).trim().replace(/\s+/g, "").slice(0, 20) || undefined;
    const yearMade = (() => {
      const y = n(c.yearMade);
      if (y >= 1900 && y <= new Date().getUTCFullYear() + 1) return Math.round(y);
      return undefined;
    })();
    const ALLOWED_CONDITIONS = new Set([
      "new", "new-other", "certified-refurbished",
      "seller-refurbished", "used", "for-parts"
    ]);
    const conditionRaw = s(c.condition).trim().toLowerCase();
    const condition = ALLOWED_CONDITIONS.has(conditionRaw) ? conditionRaw : undefined;
    const conditionDescription = s(c.conditionDescription).trim().slice(0, 1000) || undefined;
    const countryOfOrigin = s(c.countryOfOrigin).trim().toUpperCase().slice(0, 3) || undefined;
    const warranty = s(c.warranty).trim().slice(0, 240) || undefined;

    // Physical dimensions — all numeric, positive-only, generous caps.
    const weightKg = n(c.weightKg) > 0 ? Math.round(n(c.weightKg) * 100) / 100 : undefined;
    const lengthMm = n(c.lengthMm) > 0 ? Math.round(n(c.lengthMm)) : undefined;
    const widthMm  = n(c.widthMm)  > 0 ? Math.round(n(c.widthMm))  : undefined;
    const heightMm = n(c.heightMm) > 0 ? Math.round(n(c.heightMm)) : undefined;
    const dispatchDays = (() => {
      const d = n(c.dispatchDays);
      if (d >= 0 && d <= 30) return Math.round(d);
      return undefined;
    })();

    // Returns policy
    const rawReturns = (c.returns ?? {}) as Record<string, unknown>;
    const returnsAccepted = typeof rawReturns.accepted === "boolean" ? rawReturns.accepted : false;
    const windowDaysRaw = Math.round(n(rawReturns.windowDays));
    const windowDays = (windowDaysRaw === 14 || windowDaysRaw === 30 || windowDaysRaw === 60)
      ? windowDaysRaw as 14 | 30 | 60
      : undefined;
    const paidByRaw = s(rawReturns.paidBy).trim().toLowerCase();
    const paidBy = (paidByRaw === "buyer" || paidByRaw === "seller") ? paidByRaw : undefined;
    const restockingRaw = n(rawReturns.restockingFeePercent);
    const restockingFeePercent = restockingRaw >= 0 && restockingRaw <= 25
      ? Math.round(restockingRaw)
      : undefined;
    const returns = returnsAccepted
      ? { accepted: true, windowDays, paidBy, restockingFeePercent }
      : { accepted: false };

    // Compatibility fitment
    const rawCompat = Array.isArray(c.compatibility) ? c.compatibility : [];
    const compatibility = rawCompat
      .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
      .map((row) => ({
        label: s(row.label).trim().slice(0, 60),
        value: s(row.value).trim().slice(0, 120)
      }))
      .filter((row) => row.label.length > 0 && row.value.length > 0)
      .slice(0, 20);

    // Age restriction — 16 / 18 / null
    const ageRaw = Math.round(n(c.ageRestriction));
    const ageRestriction = (ageRaw === 16 || ageRaw === 18) ? ageRaw as 16 | 18 : null;

    // Shipping
    const rawShipping = (c.shipping ?? {}) as Record<string, unknown>;
    const freeLocalShipping = typeof rawShipping.freeLocalShipping === "boolean" ? rawShipping.freeLocalShipping : false;
    const localShippingGbp = freeLocalShipping ? 0 : Math.max(0, n(rawShipping.localShippingGbp));
    const shipsInternationally = typeof rawShipping.shipsInternationally === "boolean" ? rawShipping.shipsInternationally : false;
    const rawRates = Array.isArray(rawShipping.internationalRates) ? rawShipping.internationalRates : [];
    const internationalRates = shipsInternationally
      ? rawRates
          .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
          .map((r) => ({
            country: s(r.country).trim().toUpperCase().slice(0, 3),
            priceGbp: Math.max(0, n(r.priceGbp))
          }))
          .filter((r) => r.country.length > 0)
          .slice(0, 60)
      : [];

    // Multi-buy
    const rawMulti = (c.multiBuy ?? {}) as Record<string, unknown>;
    const multiBuyEnabled = typeof rawMulti.enabled === "boolean" ? rawMulti.enabled : false;
    const multiBuyModelRaw = s(rawMulti.model).trim();
    const multiBuyModel = multiBuyModelRaw === "additive" ? "additive" : "tiered";
    const rawTiers = Array.isArray(rawMulti.tiers) ? rawMulti.tiers : [];
    const tiers = rawTiers
      .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
      .map((t) => ({
        qty: Math.max(2, Math.round(n(t.qty))),
        unitPriceGbp: Math.max(0, n(t.unitPriceGbp))
      }))
      .filter((t) => t.qty > 0 && t.unitPriceGbp > 0)
      .slice(0, 8);
    const rawAdditive = (rawMulti.additive ?? {}) as Record<string, unknown>;
    const additive = {
      secondUnitDiscountGbp: Math.max(0, n(rawAdditive.secondUnitDiscountGbp)),
      thirdPlusUnitDiscountGbp: Math.max(0, n(rawAdditive.thirdPlusUnitDiscountGbp))
    };
    const deliveryModelRaw = s(rawMulti.deliveryModel).trim();
    const deliveryModel = deliveryModelRaw === "per-item" ? "per-item" : "single";

    // Electrical
    const rawEle = (c.electrical ?? {}) as Record<string, unknown>;
    const electrical = {
      voltage: s(rawEle.voltage).trim().slice(0, 40) || undefined,
      wattage: s(rawEle.wattage).trim().slice(0, 40) || undefined,
      amps: s(rawEle.amps).trim().slice(0, 40) || undefined,
      plugType: s(rawEle.plugType).trim().slice(0, 40) || undefined,
      certification: s(rawEle.certification).trim().slice(0, 80) || undefined
    };
    const hasElectrical = !!(electrical.voltage || electrical.wattage || electrical.amps || electrical.plugType || electrical.certification);

    commerce = {
      brand,
      model,
      mpn,
      gtin,
      yearMade,
      condition,
      conditionDescription,
      countryOfOrigin,
      warranty,
      weightKg,
      lengthMm,
      widthMm,
      heightMm,
      dispatchDays,
      returns,
      compatibility: compatibility.length > 0 ? compatibility : undefined,
      ageRestriction,
      shipping: {
        freeLocalShipping,
        localShippingGbp: freeLocalShipping ? undefined : localShippingGbp,
        shipsInternationally,
        internationalRates: shipsInternationally ? internationalRates : undefined
      },
      multiBuy: multiBuyEnabled ? {
        enabled: true,
        model: multiBuyModel,
        tiers: multiBuyModel === "tiered" ? tiers : undefined,
        additive: multiBuyModel === "additive" ? additive : undefined,
        deliveryModel
      } : undefined,
      electrical: hasElectrical ? electrical : undefined
    };
  }

  // ─── Category slug + aspects ────────────────────────────
  const categorySlug = s(product.category_slug).trim().toLowerCase() || null;
  let categoryAspects: Record<string, string | number> | null = null;
  if (product.category_aspects && typeof product.category_aspects === "object") {
    const raw = product.category_aspects as Record<string, unknown>;
    const cleaned: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === "string" && v.trim()) cleaned[k] = v.trim().slice(0, 120);
      else if (typeof v === "number" && Number.isFinite(v)) cleaned[k] = v;
    }
    if (Object.keys(cleaned).length > 0) categoryAspects = cleaned;
  }

  const row = {
    canteen_id: canteen.id,
    host_slug: canteen.host_slug,
    name,
    blurb,
    description,
    image_url: imageUrl,
    gallery_urls: galleryUrls,
    video_urls: videoUrls,
    price_gbp: priceGbp,
    currency,
    specs,
    trade_center_listing_id: tradeCenterListingId,
    show_in_canteen_products: showInCanteenProducts,
    show_in_trending: showInTrending,
    show_in_trade_center: showInTradeCenter,
    featured,
    variants,
    commerce,
    category_slug: categorySlug,
    category_aspects: categoryAspects,
    updated_at: new Date().toISOString()
  };

  if (!productId || productId === "new") {
    const { data, error } = await supabaseAdmin
      .from("hammerex_canteen_products")
      .insert(row)
      .select("id")
      .single();
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[canteen-product/save] insert", error);
      return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: data.id, created: true });
  }

  const { error: updErr } = await supabaseAdmin
    .from("hammerex_canteen_products")
    .update(row)
    .eq("id", productId)
    .eq("canteen_id", canteen.id);
  if (updErr) {
    // eslint-disable-next-line no-console
    console.error("[canteen-product/save] update", updErr);
    return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: productId, created: false });
}

export async function DELETE(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const providedSlug = s(body.slug).trim();
  const providedToken = s(body.edit_token).trim();
  const productId = s(body.id).trim();
  if (!productId) {
    return NextResponse.json({ ok: false, error: "missing_product_id" }, { status: 400 });
  }

  // Same two-step auth as POST: body token first, cookie session fallback.
  let listing: { id: string; slug: string; edit_token: string } | null = null;
  if (providedSlug && providedToken) {
    const { data } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, slug, edit_token")
      .eq("slug", providedSlug)
      .maybeSingle();
    if (data && constantTimeEq(data.edit_token, providedToken)) {
      listing = data;
    }
  }
  if (!listing) {
    const session = readTradeSession(req as NextRequest);
    if (session?.listing_id) {
      const { data } = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("id, slug, edit_token")
        .eq("id", session.listing_id)
        .maybeSingle();
      if (data) listing = data;
    }
  }
  if (!listing) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { data: canteen } = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id")
    .eq("host_slug", listing.slug)
    .maybeSingle();
  if (!canteen) {
    return NextResponse.json({ ok: false, error: "no_canteen" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("hammerex_canteen_products")
    .delete()
    .eq("id", productId)
    .eq("canteen_id", canteen.id);
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[canteen-product/save] delete", error);
    return NextResponse.json({ ok: false, error: "delete_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
