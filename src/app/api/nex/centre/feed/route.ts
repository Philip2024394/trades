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
  // Philip 2026-08-05 · undefined = "no per-source cap" (the intent
  // in the merge phase). Previously fell back to 40 · which silently
  // dropped every seed past #40 for any high-count trade (Kitchen has
  // 181 seeded merchants). Explicit numeric limits still cap at 100.
  const limit = opts.limit === undefined ? out.length : Math.min(opts.limit, 100);
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

    // Cold-start fallback: only fire when there is truly nothing to
    // show — no real data AND no active filter. If the user filtered
    // (category / query / price band), returning random mock items
    // that happened to match the filter is misleading — an active
    // filter on an empty domain must produce an honest empty state
    // so the UI can show "no results for X · try these instead."
    // Philip 2026-08-05 · trade-domain badges surface Doors/Flooring
    // before those seeds exist · truthful empty > misleading match.
    const hasActiveFilter =
      !!query || !!category ||
      typeof min_price_pence === "number" ||
      typeof max_price_pence === "number";
    if (merged.length === 0 && !hasActiveFilter) {
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
