// GET /api/trade-off/reviews/product-stats?product_id=<uuid>
//
// Returns the aggregate review stats for a single Shop Mode product.
// Powers the ProductModal star-rating row and the flipped reviews-chart
// panel. Aggregates only `status='live'` reviews — pending/hidden/
// disputed/withdrawn rows never contribute to the public number.
//
// Read-only and cached for 60s at the edge so opening the same product
// modal in quick succession doesn't hammer the DB. Returns
// `{ ok: true, total: 0, ...nulls }` when the product is live but has
// no reviews yet — the client uses `total` to decide whether to render
// the star row at all.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function avg(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => typeof v === "number");
  if (nums.length === 0) return null;
  const sum = nums.reduce((acc, n) => acc + n, 0);
  return Number((sum / nums.length).toFixed(2));
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const product_id = (url.searchParams.get("product_id") || "").trim();

  if (!product_id || !UUID_RE.test(product_id)) {
    return NextResponse.json(
      { ok: false, error: "Invalid product_id." },
      { status: 400 }
    );
  }

  // Confirm the product exists and is live; archived/missing rows
  // should never expose stats (404 keeps it clean).
  const product = await supabaseAdmin
    .from("hammerex_xrated_products")
    .select("id, status")
    .eq("id", product_id)
    .maybeSingle();

  if (!product.data) {
    return NextResponse.json(
      { ok: false, error: "Product not found." },
      { status: 404 }
    );
  }
  if (product.data.status !== "live") {
    return NextResponse.json(
      { ok: false, error: "Product is not live." },
      { status: 404 }
    );
  }

  // Pull the per-axis ratings for every live review of this product in
  // one round-trip; aggregate in JS so we keep the supabase-js call
  // simple (no PostgREST aggregate-function gymnastics).
  const reviews = await supabaseAdmin
    .from("hammerex_xrated_reviews")
    .select(
      "overall_rating, workmanship_rating, communication_rating, value_rating, timeliness_rating"
    )
    .eq("product_id", product_id)
    .eq("status", "live");

  if (reviews.error) {
    console.error("[product-stats] reviews query failed:", reviews.error);
    return NextResponse.json(
      { ok: false, error: "Could not load review stats." },
      { status: 500 }
    );
  }

  const rows = reviews.data ?? [];
  const total = rows.length;

  if (total === 0) {
    return NextResponse.json(
      {
        ok: true,
        total: 0,
        overall_avg: null,
        quality_avg: null,
        communication_avg: null,
        value_avg: null,
        delivery_avg: null,
        top_excerpt: null
      },
      {
        headers: { "Cache-Control": "public, s-maxage=60" }
      }
    );
  }

  const overall_avg = avg(rows.map((r) => r.overall_rating ?? null));
  // workmanship is relabelled "Quality" in product context, timeliness
  // becomes "Delivery time" — schema axes are reused 1:1, only the
  // label changes on the rendering side.
  const quality_avg = avg(rows.map((r) => r.workmanship_rating ?? null));
  const communication_avg = avg(
    rows.map((r) => r.communication_rating ?? null)
  );
  const value_avg = avg(rows.map((r) => r.value_rating ?? null));
  const delivery_avg = avg(rows.map((r) => r.timeliness_rating ?? null));

  const excerpt = await supabaseAdmin
    .from("hammerex_xrated_reviews")
    .select("body")
    .eq("product_id", product_id)
    .eq("status", "live")
    .order("goes_live_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let top_excerpt: string | null = null;
  if (excerpt.data?.body) {
    const trimmed = excerpt.data.body.trim();
    top_excerpt =
      trimmed.length > 140 ? `${trimmed.slice(0, 137).trimEnd()}…` : trimmed;
  }

  return NextResponse.json(
    {
      ok: true,
      total,
      overall_avg,
      quality_avg,
      communication_avg,
      value_avg,
      delivery_avg,
      top_excerpt
    },
    {
      headers: { "Cache-Control": "public, s-maxage=60" }
    }
  );
}
