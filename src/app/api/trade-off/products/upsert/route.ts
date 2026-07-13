// POST /api/trade-off/products/upsert
// Magic-link authenticated. Body: { slug, edit_token, product: { id?, ... } }.
// When id is present, UPDATE WHERE listing_id matches to prevent cross-listing
// tampering. Otherwise INSERT. All inputs sanitised — name 80, desc 1000,
// price non-neg int, gallery capped 3, compare_with capped 10 uuids.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { productCapForListing } from "@/lib/xratedAddons";

const MERCHANT_CATEGORY_VALUES = new Set([
  "paint", "flooring", "tiles", "aggregates", "concrete", "mortar",
  "bricks_blocks", "plasterboard", "insulation", "decking", "fencing",
  "paving", "skirting", "roof_tiles", "wallpaper", "render", "turf",
  "hand_tools", "fixings", "other"
]);
const CALCULATOR_OVERRIDE_VALUES = new Set([
  "auto", "none",
  "paint", "flooring", "tiles", "gravel", "concrete", "mortar",
  "bricks", "plasterboard", "insulation", "decking", "fencing",
  "paving", "skirting", "roof_tiles", "wallpaper", "render", "turf"
]);
const SERVICE_TRADE_VALUES = new Set([
  "carpenter", "joiner", "tiler", "plasterer", "bricklayer",
  "concrete_finisher", "roofer", "painter_decorator", "landscaper",
  "carpet_fitter", "fencer", "insulation_installer"
]);
const SERVICE_RATE_UNIT_VALUES = new Set([
  "m2", "linear_m", "item", "tonne", "hour", "day"
]);

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

function arrStr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === "string")
    .map((x) => (x as string).trim())
    .filter((x) => x.length > 0);
}

// Variants — single-axis collection. The schema locks every entry to
// share the same `axis` value; we reject the payload outright if a
// mixed-axis array shows up. Each row may carry an optional stock count
// (positive integer, null = inherit parent) and a price delta in pence
// (signed integer in ±£10k to stop runaway typos).
//
// Phase 1 axis types: size · colour · model · material · custom.
// "custom" lets merchants type their own axis name (e.g. "Capacity",
// "Length") — stored on `axis_label` so the PDP can render it as the
// picker heading.
type VariantAxis = "size" | "colour" | "model" | "material" | "custom";
const ALLOWED_AXES: ReadonlySet<VariantAxis> = new Set([
  "size",
  "colour",
  "model",
  "material",
  "custom"
]);
type VariantOut = {
  axis: VariantAxis;
  /** Free-text axis name when axis === 'custom'. NULL otherwise. */
  axis_label: string | null;
  label: string;
  stock_count: number | null;
  price_delta_pence: number | null;
};

const PRICE_DELTA_CAP = 1_000_000;

function sanitiseVariants(v: unknown): { variants: VariantOut[]; error: string | null } {
  if (v === null || v === undefined) return { variants: [], error: null };
  if (!Array.isArray(v)) {
    return { variants: [], error: "variants must be an array." };
  }
  if (v.length === 0) return { variants: [], error: null };
  if (v.length > 20) {
    return { variants: [], error: "variants capped at 20 entries." };
  }
  const out: VariantOut[] = [];
  let lockedAxis: VariantAxis | null = null;
  let lockedAxisLabel: string | null = null;
  for (const raw of v) {
    if (!raw || typeof raw !== "object") {
      return { variants: [], error: "Each variant must be an object." };
    }
    const rec = raw as Record<string, unknown>;
    const axisRaw = typeof rec.axis === "string" ? rec.axis.trim().toLowerCase() : "";
    if (!ALLOWED_AXES.has(axisRaw as VariantAxis)) {
      return {
        variants: [],
        error: "variant axis must be one of: size, colour, model, material, custom."
      };
    }
    const axis = axisRaw as VariantAxis;
    let axis_label: string | null = null;
    if (axis === "custom") {
      const raw = typeof rec.axis_label === "string" ? rec.axis_label.trim() : "";
      if (raw.length === 0 || raw.length > 30) {
        return {
          variants: [],
          error: "Custom variants need an axis_label (1-30 chars)."
        };
      }
      axis_label = raw;
    }
    if (lockedAxis === null) {
      lockedAxis = axis;
      lockedAxisLabel = axis_label;
    } else if (axis !== lockedAxis || axis_label !== lockedAxisLabel) {
      return { variants: [], error: "All variants must share the same axis." };
    }
    const label = typeof rec.label === "string" ? rec.label.trim() : "";
    if (label.length === 0 || label.length > 32) {
      return { variants: [], error: "variant label must be 1-32 chars." };
    }
    let stock_count: number | null = null;
    if (rec.stock_count !== null && rec.stock_count !== undefined && rec.stock_count !== "") {
      const sc = Number(rec.stock_count);
      if (!Number.isFinite(sc) || sc < 0 || sc > 1_000_000) {
        return { variants: [], error: "variant stock_count must be 0 or a positive integer." };
      }
      stock_count = Math.round(sc);
    }
    let price_delta_pence: number | null = null;
    if (
      rec.price_delta_pence !== null &&
      rec.price_delta_pence !== undefined &&
      rec.price_delta_pence !== ""
    ) {
      const pd = Number(rec.price_delta_pence);
      if (!Number.isFinite(pd) || pd < -PRICE_DELTA_CAP || pd > PRICE_DELTA_CAP) {
        return { variants: [], error: "variant price_delta_pence out of range." };
      }
      price_delta_pence = Math.round(pd);
    }
    out.push({
      axis,
      axis_label,
      label: label.slice(0, 32),
      stock_count,
      price_delta_pence
    });
  }
  return { variants: out, error: null };
}

const SIZE_CHART_UNITS = new Set(["size", "kg", "litre", "cm", "other"]);

// PDP tabbed-details parsers. Each one returns `[parsed, null]` on
// success or `[null, errorMessage]` so the caller can fail-fast with a
// 400 before hitting the DB CHECK constraint. NULL is the canonical
// "unset" value for all three (matches the chk_xrated_*_array CHECKs).

function sanitiseSpecs(v: unknown): { specs: { label: string; value: string }[] | null; error: string | null } {
  if (v === null || v === undefined) return { specs: null, error: null };
  if (!Array.isArray(v)) {
    return { specs: null, error: "specs must be an array or null." };
  }
  if (v.length === 0) return { specs: null, error: null };
  if (v.length > 40) {
    return { specs: null, error: "specs capped at 40 rows." };
  }
  const out: { label: string; value: string }[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") {
      return { specs: null, error: "Each spec must be a {label, value} object." };
    }
    const rec = raw as Record<string, unknown>;
    const label = typeof rec.label === "string" ? rec.label.trim() : "";
    const value = typeof rec.value === "string" ? rec.value.trim() : "";
    if (label.length === 0 || value.length === 0) {
      return { specs: null, error: "spec rows need both a label and a value." };
    }
    out.push({ label: label.slice(0, 80), value: value.slice(0, 200) });
  }
  return { specs: out, error: null };
}

// Per-product FAQ. Max 3 { q, a } pairs — rendered as a collapsible
// Q&A accordion under the cover image. Empty array / null = the live
// PDP hides the section entirely.
function sanitiseFaq(v: unknown): { faq: { q: string; a: string }[] | null; error: string | null } {
  if (v === null || v === undefined) return { faq: null, error: null };
  if (!Array.isArray(v)) {
    return { faq: null, error: "faq must be an array or null." };
  }
  if (v.length === 0) return { faq: null, error: null };
  if (v.length > 3) {
    return { faq: null, error: "faq capped at 3 items per product." };
  }
  const out: { q: string; a: string }[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") {
      return { faq: null, error: "Each faq item must be a {q, a} object." };
    }
    const rec = raw as Record<string, unknown>;
    const q = typeof rec.q === "string" ? rec.q.trim() : "";
    const a = typeof rec.a === "string" ? rec.a.trim() : "";
    if (q.length === 0 || a.length === 0) continue;
    out.push({ q: q.slice(0, 140), a: a.slice(0, 500) });
  }
  return { faq: out.length > 0 ? out : null, error: null };
}

function sanitiseFeatures(v: unknown): { features: string[] | null; error: string | null } {
  if (v === null || v === undefined) return { features: null, error: null };
  if (!Array.isArray(v)) {
    return { features: null, error: "features must be an array or null." };
  }
  if (v.length === 0) return { features: null, error: null };
  if (v.length > 40) {
    return { features: null, error: "features capped at 40 rows." };
  }
  const out: string[] = [];
  for (const raw of v) {
    if (typeof raw !== "string") {
      return { features: null, error: "Each feature must be a string." };
    }
    const t = raw.trim();
    if (t.length === 0) continue;
    out.push(t.slice(0, 200));
  }
  return { features: out.length > 0 ? out : null, error: null };
}

const YOUTUBE_RE = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i;

function sanitiseVideoUrl(v: unknown): { video_url: string | null; error: string | null } {
  if (v === null || v === undefined || v === "") {
    return { video_url: null, error: null };
  }
  if (typeof v !== "string") {
    return { video_url: null, error: "video_url must be a string or null." };
  }
  const t = v.trim();
  if (t.length === 0) return { video_url: null, error: null };
  if (t.length > 300 || !YOUTUBE_RE.test(t)) {
    return { video_url: null, error: "video_url must be a YouTube link (youtube.com or youtu.be)." };
  }
  return { video_url: t, error: null };
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
  const productIn = (body.product && typeof body.product === "object" ? body.product : {}) as Record<string, unknown>;

  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or edit_token." },
      { status: 400 }
    );
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token, primary_trade, tier")
    .eq("slug", slug)
    .maybeSingle();

  if (!listing.data) {
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }
  if (!constantTimeEq(listing.data.edit_token, token)) {
    return NextResponse.json({ ok: false, error: "Invalid edit token." }, { status: 403 });
  }

  const name = s(productIn.name).slice(0, 80);
  if (!name) {
    return NextResponse.json(
      { ok: false, error: "Product name is required." },
      { status: 400 }
    );
  }

  const descriptionRaw = s(productIn.description);
  const description = descriptionRaw.length > 0 ? descriptionRaw.slice(0, 1000) : null;
  const price_pence = nonNegInt(productIn.price_pence);
  const stock_count = nonNegIntOrNull(productIn.stock_count);
  const dispatch_days = nonNegIntOrNull(productIn.dispatch_days);
  // warranty_years — nullable, 1–25 clamp mirrors the DB CHECK
  // constraint so a bad client payload is rejected with a clean error
  // rather than a Postgres constraint violation.
  const warranty_years = (() => {
    const raw = productIn.warranty_years;
    if (raw === null || raw === undefined || raw === "") return null;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n)) return null;
    const rounded = Math.round(n);
    if (rounded < 1 || rounded > 25) return null;
    return rounded;
  })();

  // Phase A taxonomy — install pairing. Both fields are nullable
  // strings, whitelisted against SERVICE_CATEGORIES. A slug not in
  // the taxonomy is coerced to null rather than rejected so a stale
  // client (browser cache running an old taxonomy) doesn't hard-fail
  // the whole save.
  const { SERVICE_CATEGORIES } = await import("@/lib/serviceCategories");
  const validServiceSlugs = new Set(SERVICE_CATEGORIES.map((c) => c.slug));
  const service_category = (() => {
    const raw = productIn.service_category;
    if (typeof raw !== "string") return null;
    const slug = raw.trim();
    return slug && validServiceSlugs.has(slug) ? slug : null;
  })();
  const install_service_category = (() => {
    const raw = productIn.install_service_category;
    if (typeof raw !== "string") return null;
    const slug = raw.trim();
    return slug && validServiceSlugs.has(slug) ? slug : null;
  })();
  const cover_url_raw = s(productIn.cover_url);
  const cover_url = cover_url_raw.length > 0 ? cover_url_raw.slice(0, 600) : null;
  const gallery_urls = arrStr(productIn.gallery_urls)
    .map((u) => u.slice(0, 600))
    .slice(0, 3);
  const compare_with = arrStr(productIn.compare_with)
    .filter((id) => UUID_RE.test(id))
    .slice(0, 10);
  const statusRaw = s(productIn.status);
  const status: "live" | "archived" = statusRaw === "archived" ? "archived" : "live";
  const sort_order = nonNegInt(productIn.sort_order);

  // Services Prices add-on extension. `kind` swaps the same row between
  // physical product (Shop Mode) and labour-by-unit service (Services
  // Prices). `unit` is the per-X label rendered alongside the price, and
  // `category` optionally buckets services on the dedicated grid page.
  const kindRaw = s(productIn.kind);
  const kind: "product" | "service" =
    kindRaw === "service" ? "service" : "product";
  const unitRaw = s(productIn.unit);
  const unit = unitRaw.length > 0 ? unitRaw.slice(0, 32) : null;
  const categoryRaw = s(productIn.category);
  const category = categoryRaw.length > 0 ? categoryRaw.slice(0, 40) : null;

  // Phase 2 — variants (single-axis), size chart upload (image + unit).
  // Variants reject the whole payload on mixed-axis / oversized labels;
  // size chart unit must be one of the five enum values or null when no
  // chart is uploaded.
  const variantsParsed = sanitiseVariants(productIn.variants);
  if (variantsParsed.error) {
    return NextResponse.json(
      { ok: false, error: variantsParsed.error },
      { status: 400 }
    );
  }
  const variants = variantsParsed.variants;

  const sizeChartRaw = s(productIn.size_chart_url);
  const size_chart_url = sizeChartRaw.length > 0 ? sizeChartRaw.slice(0, 400) : null;
  const sizeChartUnitRaw = s(productIn.size_chart_unit).toLowerCase();
  let size_chart_unit: "size" | "kg" | "litre" | "cm" | "other" | null = null;
  if (size_chart_url && sizeChartUnitRaw.length > 0) {
    if (!SIZE_CHART_UNITS.has(sizeChartUnitRaw)) {
      return NextResponse.json(
        { ok: false, error: "size_chart_unit must be size/kg/litre/cm/other." },
        { status: 400 }
      );
    }
    size_chart_unit = sizeChartUnitRaw as "size" | "kg" | "litre" | "cm" | "other";
  }

  // PDP tabbed-details. Each parser returns null on absent/empty input so
  // the DB column is set to NULL rather than `[]`. Validation failures
  // bounce as 400s so the editor surfaces the precise reason.
  const specsParsed = sanitiseSpecs(productIn.specs);
  if (specsParsed.error) {
    return NextResponse.json({ ok: false, error: specsParsed.error }, { status: 400 });
  }
  const specs = specsParsed.specs;
  const featuresParsed = sanitiseFeatures(productIn.features);
  if (featuresParsed.error) {
    return NextResponse.json({ ok: false, error: featuresParsed.error }, { status: 400 });
  }
  const features = featuresParsed.features;
  const faqParsed = sanitiseFaq(productIn.faq);
  if (faqParsed.error) {
    return NextResponse.json({ ok: false, error: faqParsed.error }, { status: 400 });
  }
  const faq = faqParsed.faq;
  const videoParsed = sanitiseVideoUrl(productIn.video_url);
  if (videoParsed.error) {
    return NextResponse.json({ ok: false, error: videoParsed.error }, { status: 400 });
  }
  const video_url = videoParsed.video_url;

  // product_kind — 'stock' is the standard add-to-cart flow; 'install'
  // routes the customer to a WhatsApp site-visit request on the PDP
  // (used by UK stair / kitchen fitters who price after a measurement).
  // Anything else (or missing) gets silently coerced to 'stock' so old
  // callers don't break and the chk_product_kind constraint never trips.
  const productKindRaw = s(productIn.product_kind).toLowerCase();
  const product_kind: "stock" | "install" =
    productKindRaw === "install" ? "install" : "stock";

  // Warranty + Returns tab overrides — NULL means the PDP falls back to
  // the platform default copy (1-year workmanship / 14-day window). Empty
  // strings are treated as null so a trade who clears the textarea
  // reverts cleanly. Capped at 500 chars to stop a trade pasting a wall
  // of legalese into the tab body.
  function bounded(v: unknown, cap: number): string | null {
    if (typeof v !== "string") return null;
    const t = v.trim();
    if (t.length === 0) return null;
    return t.slice(0, cap);
  }
  const warranty_header = bounded(productIn.warranty_header, 80);
  const warranty_text = bounded(productIn.warranty_text, 500);
  // returns_text is deprecated — the dashboard now sends null. We accept
  // any incoming value but coerce to null to stop persisting it.
  const returns_text: string | null = null;

  // VAT — both columns must agree per the chk_vat_consistency CHECK.
  // vat_inclusive=null + vat_rate_pct=null ⇒ tradesperson is not VAT
  // registered. Otherwise vat_rate_pct must be 0-100 and vat_inclusive
  // is a bool. Any malformed combo gets rejected here so the DB constraint
  // never has to bounce a row.
  let vat_inclusive: boolean | null = null;
  let vat_rate_pct: number | null = null;
  const vatIncRaw = productIn.vat_inclusive;
  const vatRateRaw = productIn.vat_rate_pct;
  const vatBothNull =
    (vatIncRaw === null || vatIncRaw === undefined) &&
    (vatRateRaw === null || vatRateRaw === undefined);
  if (!vatBothNull) {
    if (typeof vatIncRaw !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "vat_inclusive must be a boolean or null." },
        { status: 400 }
      );
    }
    const rate = Number(vatRateRaw);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      return NextResponse.json(
        { ok: false, error: "vat_rate_pct must be between 0 and 100." },
        { status: 400 }
      );
    }
    vat_inclusive = vatIncRaw;
    vat_rate_pct = Math.round(rate * 100) / 100;
  }

  // Free-delivery qualifier — NULL means no offer; integer ≥ 1 means
  // "free delivery within zones when qty ≥ this". Coerced through the
  // same nonNegIntOrNull helper as stock, then bounced to NULL when 0
  // (the CHECK constraint enforces > 0 or NULL).
  let free_delivery_min_qty: number | null = null;
  if (
    productIn.free_delivery_min_qty !== undefined &&
    productIn.free_delivery_min_qty !== null &&
    productIn.free_delivery_min_qty !== ""
  ) {
    const n = Number(productIn.free_delivery_min_qty);
    if (!Number.isFinite(n) || n < 1) {
      return NextResponse.json(
        {
          ok: false,
          error: "free_delivery_min_qty must be a positive integer or null."
        },
        { status: 400 }
      );
    }
    free_delivery_min_qty = Math.round(n);
  }

  // Merchant category + calculator override + service (trade installer)
  // fields. All optional; bad values bounce as 400 so the editor surfaces
  // the precise reason. Empty string → null (clears the field).
  function enumOrNull(v: unknown, allowed: Set<string>): string | null | false {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v !== "string") return false;
    return allowed.has(v) ? v : false;
  }
  const merchant_category_in = enumOrNull(productIn.merchant_category, MERCHANT_CATEGORY_VALUES);
  if (merchant_category_in === false) {
    return NextResponse.json(
      { ok: false, error: "merchant_category is not a recognised value." },
      { status: 400 }
    );
  }
  // merchant_subcategory is intentionally free-text + indexed, NOT
  // enum-constrained server-side, so a new calc scenario can register
  // new subcategory slugs by code without an API change. Editor UI
  // surfaces the controlled vocabulary; raw API trusts the merchant.
  const merchant_subcategory_in: string | null =
    typeof productIn.merchant_subcategory === "string" &&
    productIn.merchant_subcategory.trim().length > 0
      ? productIn.merchant_subcategory.trim().slice(0, 40)
      : null;
  const calculator_override_in = enumOrNull(productIn.calculator_override, CALCULATOR_OVERRIDE_VALUES);
  if (calculator_override_in === false) {
    return NextResponse.json(
      { ok: false, error: "calculator_override is not a recognised value." },
      { status: 400 }
    );
  }
  const service_trade_type_in = enumOrNull(productIn.service_trade_type, SERVICE_TRADE_VALUES);
  if (service_trade_type_in === false) {
    return NextResponse.json(
      { ok: false, error: "service_trade_type is not a recognised value." },
      { status: 400 }
    );
  }
  const service_rate_unit_in = enumOrNull(productIn.service_rate_unit, SERVICE_RATE_UNIT_VALUES);
  if (service_rate_unit_in === false) {
    return NextResponse.json(
      { ok: false, error: "service_rate_unit is not a recognised value." },
      { status: 400 }
    );
  }
  const service_rate_pence = nonNegIntOrNull(productIn.service_rate_pence);

  const patch = {
    name,
    description,
    price_pence,
    stock_count,
    dispatch_days,
    warranty_years,
    service_category,
    install_service_category,
    cover_url,
    gallery_urls,
    compare_with,
    status,
    sort_order,
    kind,
    unit,
    category,
    variants,
    size_chart_url,
    size_chart_unit,
    vat_inclusive,
    vat_rate_pct,
    product_kind,
    specs,
    features,
    faq,
    video_url,
    warranty_header,
    warranty_text,
    returns_text,
    free_delivery_min_qty,
    merchant_category: merchant_category_in,
    merchant_subcategory: merchant_subcategory_in,
    calculator_override: calculator_override_in,
    service_trade_type: service_trade_type_in,
    service_rate_pence,
    service_rate_unit: service_rate_unit_in
  };

  const idRaw = s(productIn.id);
  if (idRaw) {
    if (!UUID_RE.test(idRaw)) {
      return NextResponse.json(
        { ok: false, error: "Invalid product id." },
        { status: 400 }
      );
    }
    const upd = await supabaseAdmin
      .from("hammerex_xrated_products")
      .update(patch)
      .eq("id", idRaw)
      .eq("listing_id", listing.data.id)
      .select("*")
      .maybeSingle();
    if (upd.error) {
      console.error("[trade-off/products/upsert] update failed:", upd.error);
      return NextResponse.json(
        { ok: false, error: upd.error.message },
        { status: 500 }
      );
    }
    if (!upd.data) {
      return NextResponse.json(
        { ok: false, error: "Product not found." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, product: upd.data });
  }

  // Merchant Pro product cap — only enforced on INSERT (an UPDATE to an
  // existing row can't grow the catalogue). Counts 'live' rows only so an
  // archived backlog doesn't lock a merchant out. productCapForListing
  // returns null = unlimited (Verified tier or non-Merchant-Pro trade).
  const cap = productCapForListing({
    primary_trade: listing.data.primary_trade ?? null,
    tier: listing.data.tier ?? null
  });
  if (cap !== null) {
    const countRes = await supabaseAdmin
      .from("hammerex_xrated_products")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listing.data.id)
      .eq("status", "live");
    const liveCount = countRes.count ?? 0;
    if (liveCount >= cap) {
      return NextResponse.json(
        {
          ok: false,
          error: `You've hit your ${cap}-product cap. Archive an old product, or upgrade your plan to add more.`,
          code: "PRODUCT_CAP_REACHED",
          cap,
          live_count: liveCount
        },
        { status: 403 }
      );
    }
  }

  const ins = await supabaseAdmin
    .from("hammerex_xrated_products")
    .insert({ ...patch, listing_id: listing.data.id })
    .select("*")
    .maybeSingle();
  if (ins.error || !ins.data) {
    console.error("[trade-off/products/upsert] insert failed:", ins.error);
    return NextResponse.json(
      { ok: false, error: ins.error?.message ?? "Insert failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, product: ins.data });
}
