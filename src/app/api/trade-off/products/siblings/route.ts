// GET /api/trade-off/products/siblings?product_id=<uuid>&limit=<1-5>
//
// Phase 2 fallback for the Compare modal — when the tradesperson hasn't
// hand-picked compare_with siblings on the dashboard, the customer-facing
// modal calls this endpoint and we auto-suggest 0-3 sibling products from
// the same listing.
//
// Selection logic:
//   1. Same listing_id.
//   2. Same kind ("product" or "service").
//   3. status = 'live' and NOT the anchor itself.
//   4. Score each candidate: +3 if same category, plus a price-similarity
//      bonus that rewards rows close in price to the anchor.
//   5. Return the top `limit` (default 3, capped 1-5) by score, ordered
//      score-desc.
//
// Read-only, anonymous, edge-cached for two minutes. The compare modal
// is a low-frequency surface — caching the same anchor for 2 min absorbs
// the burst when several customers open the same product in sequence
// without ever staling the recommendation past one editor session.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AnchorRow = {
  id: string;
  listing_id: string;
  kind: "product" | "service";
  category: string | null;
  price_pence: number;
  status: "live" | "archived";
};

type SiblingRow = {
  id: string;
  name: string;
  cover_url: string | null;
  price_pence: number;
  dispatch_days: number | null;
  stock_count: number | null;
  category: string | null;
  unit: string | null;
};

function parseLimit(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return 3;
  if (n < 1) return 1;
  if (n > 5) return 5;
  return n;
}

// Score a candidate against the anchor. Categories that match score a
// flat +3; the price-similarity bonus tops out at +1 when prices are
// identical and decays toward 0 as the absolute % difference grows.
// Candidates outside ±30% still appear (we don't hard-filter on price)
// but at the very bottom of the ranked list.
function scoreCandidate(
  anchor: AnchorRow,
  candidate: { category: string | null; price_pence: number }
): number {
  let score = 0;
  if (
    anchor.category &&
    candidate.category &&
    anchor.category === candidate.category
  ) {
    score += 3;
  }
  const anchorPrice = anchor.price_pence || 1;
  const diffPct = Math.abs(candidate.price_pence - anchor.price_pence) / anchorPrice;
  // 1 / (1 + 10x) — at parity score is 1; at 30% drift it's ~0.25;
  // way off (200%) it's ~0.05. Smooth, no division-by-zero edge case.
  score += 1 / (1 + diffPct * 10);
  return score;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const product_id = (url.searchParams.get("product_id") || "").trim();
  const limit = parseLimit(url.searchParams.get("limit"));

  if (!product_id || !UUID_RE.test(product_id)) {
    return NextResponse.json(
      { ok: false, error: "Invalid product_id." },
      { status: 400 }
    );
  }

  const anchorRes = await supabaseAdmin
    .from("hammerex_xrated_products")
    .select("id, listing_id, kind, category, price_pence, status")
    .eq("id", product_id)
    .maybeSingle();

  if (anchorRes.error) {
    console.error("[siblings] anchor query failed:", anchorRes.error);
    return NextResponse.json(
      { ok: false, error: "Could not load product." },
      { status: 500 }
    );
  }
  if (!anchorRes.data) {
    return NextResponse.json(
      { ok: false, error: "Product not found." },
      { status: 404 }
    );
  }
  const anchor = anchorRes.data as AnchorRow;
  if (anchor.status !== "live") {
    return NextResponse.json(
      { ok: false, error: "Product is not live." },
      { status: 404 }
    );
  }

  const candidatesRes = await supabaseAdmin
    .from("hammerex_xrated_products")
    .select(
      "id, name, cover_url, price_pence, dispatch_days, stock_count, category, unit"
    )
    .eq("listing_id", anchor.listing_id)
    .eq("kind", anchor.kind)
    .eq("status", "live")
    .neq("id", anchor.id);

  if (candidatesRes.error) {
    console.error("[siblings] candidates query failed:", candidatesRes.error);
    return NextResponse.json(
      { ok: false, error: "Could not load siblings." },
      { status: 500 }
    );
  }

  const candidates = (candidatesRes.data ?? []) as SiblingRow[];
  if (candidates.length === 0) {
    return NextResponse.json(
      { ok: true, siblings: [] },
      { headers: { "Cache-Control": "public, s-maxage=120" } }
    );
  }

  const ranked = candidates
    .map((c) => ({
      row: c,
      score: scoreCandidate(anchor, {
        category: c.category,
        price_pence: c.price_pence
      })
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row }) => row);

  return NextResponse.json(
    { ok: true, siblings: ranked },
    { headers: { "Cache-Control": "public, s-maxage=120" } }
  );
}
