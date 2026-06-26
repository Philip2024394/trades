// POST /api/trade-off/products/upsert
// Magic-link authenticated. Body: { slug, edit_token, product: { id?, ... } }.
// When id is present, UPDATE WHERE listing_id matches to prevent cross-listing
// tampering. Otherwise INSERT. All inputs sanitised — name 80, desc 1000,
// price non-neg int, gallery capped 3, compare_with capped 10 uuids.

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
type VariantOut = {
  axis: "size" | "colour";
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
  let lockedAxis: "size" | "colour" | null = null;
  for (const raw of v) {
    if (!raw || typeof raw !== "object") {
      return { variants: [], error: "Each variant must be an object." };
    }
    const rec = raw as Record<string, unknown>;
    const axisRaw = typeof rec.axis === "string" ? rec.axis.trim().toLowerCase() : "";
    if (axisRaw !== "size" && axisRaw !== "colour") {
      return { variants: [], error: "variant axis must be 'size' or 'colour'." };
    }
    const axis = axisRaw as "size" | "colour";
    if (lockedAxis === null) lockedAxis = axis;
    else if (axis !== lockedAxis) {
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
    out.push({ axis, label: label.slice(0, 32), stock_count, price_delta_pence });
  }
  return { variants: out, error: null };
}

const SIZE_CHART_UNITS = new Set(["size", "kg", "litre", "cm", "other"]);

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
    .select("id, edit_token")
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

  const patch = {
    name,
    description,
    price_pence,
    stock_count,
    dispatch_days,
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
    size_chart_unit
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
