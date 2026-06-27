// GET/POST /api/trade-off/products/search
//
// Storefront search + filter + sort + pagination. Public, anonymous,
// reads via the admin client because the new `search_tsv` column is a
// generated column the anon role can also see — we use admin here purely
// for consistency with the other public-storefront reads in this folder.
//
// Inputs (POST body or GET query):
//   slug              listing slug — required.
//   q                 free-text query. ≥3 chars + non-numeric falls into
//                     `websearch_to_tsquery('english', q)` against
//                     search_tsv. Shorter or all-digit queries fall back
//                     to ILIKE on name + a few catch-all fields (we treat
//                     numeric-only as a "ref-number lookup" since we
//                     surface "Ref: <uuid-prefix>" on the public PDP).
//   category          OR-list of category strings.
//   min_price_pence   inclusive lower bound.
//   max_price_pence   inclusive upper bound.
//   in_stock          true → only products with stock_count IS NULL or > 0.
//   sort              featured (default) | price_asc | price_desc | newest.
//   limit             default 24, max 60.
//   offset            default 0.
//
// Returns:
//   { ok, products: [...], total, has_more,
//     filter_counts: { categories: [{name,count}], price_range: { min, max } } }
//
// Cache: edge cached for 30s. Burst-friendly without staleness.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { HammerexXratedProduct } from "@/lib/supabase";

export const runtime = "nodejs";

type SortKey = "featured" | "price_asc" | "price_desc" | "newest";

type SearchInput = {
  slug: string;
  q: string;
  category: string[];
  min_price_pence: number | null;
  max_price_pence: number | null;
  in_stock: boolean;
  sort: SortKey;
  limit: number;
  offset: number;
};

function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function parseSort(raw: unknown): SortKey {
  if (raw === "price_asc" || raw === "price_desc" || raw === "newest") {
    return raw;
  }
  return "featured";
}

function parseCategoryList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === "string").map((s) => s.trim()).filter(Boolean);
  }
  if (typeof raw === "string" && raw.length > 0) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function parsePence(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function parseBool(v: unknown): boolean {
  return v === true || v === "true" || v === "1" || v === 1;
}

function readInput(searchParams: URLSearchParams, body: Record<string, unknown> | null): SearchInput {
  function pick(key: string): unknown {
    if (body && key in body) return body[key];
    const all = searchParams.getAll(key);
    if (all.length === 0) return undefined;
    if (all.length === 1) return all[0];
    return all;
  }
  return {
    slug: typeof pick("slug") === "string" ? (pick("slug") as string).trim() : "",
    q: typeof pick("q") === "string" ? (pick("q") as string).trim() : "",
    category: parseCategoryList(pick("category")),
    min_price_pence: parsePence(pick("min_price_pence")),
    max_price_pence: parsePence(pick("max_price_pence")),
    in_stock: parseBool(pick("in_stock")),
    sort: parseSort(pick("sort")),
    limit: clampInt(pick("limit"), 1, 60, 24),
    offset: clampInt(pick("offset"), 0, 10_000, 0)
  };
}

async function handle(input: SearchInput) {
  if (!input.slug) {
    return NextResponse.json({ ok: false, error: "Missing slug." }, { status: 400 });
  }

  const listingRes = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, status")
    .eq("slug", input.slug)
    .maybeSingle();
  const listing = listingRes.data as { id: string; status: string } | null;
  if (!listing || listing.status !== "live") {
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }
  const listingId = listing.id;

  // Decide which text-search strategy to use. websearch_to_tsquery is the
  // best match for human queries ("drywall corner bead"); short / numeric
  // queries fall back to ILIKE so a customer typing a ref number or a
  // 2-letter brand still gets results.
  const q = input.q.trim();
  const isNumericish = q.length > 0 && /^[\s\d-]+$/.test(q);
  const useTsv = q.length >= 3 && !isNumericish;
  const useIlike = q.length > 0 && !useTsv;

  let query = supabaseAdmin
    .from("hammerex_xrated_products")
    .select("*", { count: "exact" })
    .eq("listing_id", listingId)
    .eq("status", "live");

  if (useTsv) {
    // PostgREST `textSearch` builds the tsv @@ websearch_to_tsquery
    // operator for us. Quote-strip so a stray double-quote in input
    // doesn't confuse the parser.
    query = query.textSearch("search_tsv", q.replace(/"/g, " "), {
      type: "websearch",
      config: "english"
    });
  } else if (useIlike) {
    // OR group across name + category. The `or` filter takes a
    // comma-separated PostgREST string — we URI-encode the user input
    // to keep commas in the query from confusing the parser.
    const safe = q.replace(/[,()*]/g, " ").trim();
    const like = `%${safe}%`;
    query = query.or(`name.ilike.${like},category.ilike.${like}`);
  }

  if (input.category.length > 0) {
    query = query.in("category", input.category);
  }
  if (input.min_price_pence !== null) {
    query = query.gte("price_pence", input.min_price_pence);
  }
  if (input.max_price_pence !== null) {
    query = query.lte("price_pence", input.max_price_pence);
  }
  if (input.in_stock) {
    // `stock_count IS NULL OR stock_count > 0` — NULL means "unlimited /
    // available on enquiry" so we keep those rows in the In-stock view.
    query = query.or("stock_count.is.null,stock_count.gt.0");
  }

  switch (input.sort) {
    case "price_asc":
      query = query.order("price_pence", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price_pence", { ascending: false });
      break;
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "featured":
    default:
      query = query
        .order("featured_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      break;
  }

  query = query.range(input.offset, input.offset + input.limit - 1);

  const res = await query;
  if (res.error) {
    console.error("[trade-off/products/search] query failed:", res.error);
    return NextResponse.json(
      { ok: false, error: res.error.message },
      { status: 500 }
    );
  }
  const products = (res.data ?? []) as HammerexXratedProduct[];
  const total = res.count ?? products.length;

  // Filter counts — facet helper for the sidebar. Always served from the
  // full live catalogue (NOT the filtered result set) so the customer
  // can see e.g. "Adhesives (4)" and click it to broaden their search.
  const facetRes = await supabaseAdmin
    .from("hammerex_xrated_products")
    .select("category, price_pence")
    .eq("listing_id", listingId)
    .eq("status", "live");
  type FacetRow = { category: string | null; price_pence: number };
  const facetRows = (facetRes.data ?? []) as FacetRow[];
  const categoryCounts: Record<string, number> = {};
  let priceMin: number | null = null;
  let priceMax: number | null = null;
  for (const r of facetRows) {
    const cat = (r.category ?? "").trim();
    if (cat.length > 0) {
      categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
    }
    if (typeof r.price_pence === "number") {
      if (priceMin === null || r.price_pence < priceMin) priceMin = r.price_pence;
      if (priceMax === null || r.price_pence > priceMax) priceMax = r.price_pence;
    }
  }
  const categories = Object.entries(categoryCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const has_more = input.offset + products.length < total;

  return NextResponse.json(
    {
      ok: true,
      products,
      total,
      has_more,
      filter_counts: {
        categories,
        price_range: { min: priceMin, max: priceMax }
      }
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120"
      }
    }
  );
}

export async function GET(req: NextRequest) {
  const input = readInput(req.nextUrl.searchParams, null);
  return handle(input);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> | null = null;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = null;
  }
  const input = readInput(req.nextUrl.searchParams, body);
  return handle(input);
}
