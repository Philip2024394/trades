// GET /api/nex/centre/feed
//
// Public feed reader for /nex-app/centre. Returns real published
// products (opt-in via nex_centre_visible) plus their active banner
// overlay, ranked by promotion + proximity (when postcode supplied).
//
// This is what the NexPinterestFeed will consume once its hardcoded
// demo data is replaced (separate follow-up). In the meantime this
// endpoint is queryable directly and returns a fully-formed feed the
// UI can render.
//
// Query params:
//   postcode  optional UK postcode for proximity ranking
//   q         optional keyword filter
//   category  optional category-path substring filter
//   min_price optional minimum price in pence
//   max_price optional maximum price in pence
//   limit     default 40, max 100
//   offset    default 0
//
// Returns:
//   200 { ok: true, items: CentreFeedItem[], count: number }
//   500 { ok: false, error: "internal" }
//
// Reference: docs/brains/PHASE_7_IMPLEMENTATION_PLAN.md · Amendment B
// Reference: docs/architecture/NEX_MASTER_DATA_FLOW_ARCHITECTURE.md · Flow 1

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { listCentreFeedItems } from "@/lib/nex/centre-publishing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const postcode = url.searchParams.get("postcode") ?? undefined;
  const query = url.searchParams.get("q") ?? undefined;
  const category = url.searchParams.get("category") ?? undefined;
  const minPriceRaw = url.searchParams.get("min_price");
  const maxPriceRaw = url.searchParams.get("max_price");
  const limitRaw = url.searchParams.get("limit");
  const offsetRaw = url.searchParams.get("offset");

  const min_price_pence = minPriceRaw ? Number.parseInt(minPriceRaw, 10) : undefined;
  const max_price_pence = maxPriceRaw ? Number.parseInt(maxPriceRaw, 10) : undefined;
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : undefined;

  try {
    const items = await listCentreFeedItems({
      postcode,
      query,
      category,
      min_price_pence,
      max_price_pence,
      limit,
      offset,
    });
    return NextResponse.json({ ok: true, items, count: items.length });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[centre/feed] error", err);
    return NextResponse.json(
      { ok: false, error: "internal" },
      { status: 500 }
    );
  }
}
