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
import { MOCK_CENTRE_FEED } from "@/lib/nex/centre-publishing/mockFeed";
import { loadDirectorySeedsAsFeedItems } from "@/lib/nex/centre-publishing/directorySeedLoader";
import type { CentreFeedItem } from "@/lib/nex/centre-publishing/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Naive in-memory filter that mirrors what the real DB query does, so
// the mock feed still responds sensibly to ?q, ?category, ?min_price,
// ?max_price, ?limit, ?offset.
function filterMock(
  items: CentreFeedItem[],
  opts: {
    query?: string;
    category?: string;
    min_price_pence?: number;
    max_price_pence?: number;
    limit?: number;
    offset?: number;
  }
): CentreFeedItem[] {
  let out = items;
  if (opts.query) {
    const q = opts.query.toLowerCase();
    out = out.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q) ||
        i.brand_name.toLowerCase().includes(q) ||
        (i.merchant_display_name ?? "").toLowerCase().includes(q)
    );
  }
  if (opts.category) {
    const c = opts.category.toLowerCase();
    out = out.filter((i) =>
      i.category_path.some((seg) => seg.toLowerCase().includes(c))
    );
  }
  if (typeof opts.min_price_pence === "number") {
    out = out.filter((i) => i.price_pence >= (opts.min_price_pence as number));
  }
  if (typeof opts.max_price_pence === "number") {
    out = out.filter((i) => i.price_pence <= (opts.max_price_pence as number));
  }
  const offset = opts.offset ?? 0;
  const limit = Math.min(opts.limit ?? 40, 100);
  return out.slice(offset, offset + limit);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const postcode = url.searchParams.get("postcode") ?? undefined;
  const query = url.searchParams.get("q") ?? undefined;
  const category = url.searchParams.get("category") ?? undefined;
  const minPriceRaw = url.searchParams.get("min_price");
  const maxPriceRaw = url.searchParams.get("max_price");
  const limitRaw = url.searchParams.get("limit");
  const offsetRaw = url.searchParams.get("offset");
  const mock = url.searchParams.get("mock");

  const min_price_pence = minPriceRaw ? Number.parseInt(minPriceRaw, 10) : undefined;
  const max_price_pence = maxPriceRaw ? Number.parseInt(maxPriceRaw, 10) : undefined;
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : undefined;

  // Explicit mock mode: ?mock=1 always returns the demo feed.
  if (mock === "1") {
    const items = filterMock(MOCK_CENTRE_FEED, {
      query,
      category,
      min_price_pence,
      max_price_pence,
      limit,
      offset,
    });
    return NextResponse.json({ ok: true, items, count: items.length, source: "mock" });
  }

  try {
    const [dbItems, directoryItems] = await Promise.all([
      listCentreFeedItems({
        postcode,
        query,
        category,
        min_price_pence,
        max_price_pence,
        limit,
        offset,
      }),
      loadDirectorySeedsAsFeedItems(),
    ]);

    // Merge: directory seeds first (they're the seeded UK trade
    // directory per ADR-0023), then any real merchant products from
    // the DB behind them.
    const filteredDirectory = filterMock(directoryItems, {
      query,
      category,
      min_price_pence,
      max_price_pence,
      limit: undefined, // apply limit after merge, not per-source
      offset: 0,
    });
    const merged: CentreFeedItem[] = [...filteredDirectory, ...dbItems];

    // Cold-start fallback: if BOTH the DB and directory came back
    // empty, use the mock feed so the page never looks abandoned.
    if (merged.length === 0) {
      const mockItems = filterMock(MOCK_CENTRE_FEED, {
        query,
        category,
        min_price_pence,
        max_price_pence,
        limit,
        offset,
      });
      return NextResponse.json({
        ok: true,
        items: mockItems,
        count: mockItems.length,
        source: "mock-fallback",
      });
    }

    // Paginate the merged feed
    const start = offset ?? 0;
    const end = start + Math.min(limit ?? 40, 100);
    const paged = merged.slice(start, end);

    return NextResponse.json({
      ok: true,
      items: paged,
      count: paged.length,
      total: merged.length,
      directory_count: filteredDirectory.length,
      merchant_count: dbItems.length,
      source: dbItems.length > 0 ? "live+directory" : "directory",
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[centre/feed] error", err);
    return NextResponse.json(
      { ok: false, error: "internal" },
      { status: 500 }
    );
  }
}
