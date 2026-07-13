// GET /api/trade-off/prices/lookup?item=X&postcode=Y
//
// Public price lookup. Fuzzy match on item_label OR item_slug via
// ILIKE; optional postcode prefix filter. Returns up to 25 rows
// ordered by proximity (postcode-prefix match > region match > any)
// and recency.
//
// Also returns a small stats block (min/max/avg) so trades and the
// beacon composer can render a "market range" hint without a second
// round-trip.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const itemRaw = (url.searchParams.get("item") ?? "").trim();
  const postcodeRaw = (url.searchParams.get("postcode") ?? "")
    .trim()
    .toUpperCase();
  const prefix = postcodeRaw ? postcodeRaw.split(/\s+/)[0] : null;

  if (!itemRaw) {
    return NextResponse.json(
      { ok: false, error: "missing_item" },
      { status: 400 }
    );
  }
  const safe = itemRaw.replace(/[%_,]/g, "").slice(0, 60);
  if (!safe) {
    return NextResponse.json(
      { ok: false, error: "invalid_item" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("hammerex_material_prices")
    .select(
      "id, merchant_listing_id, item_slug, item_label, unit_label, price_pence, currency, qty_included, postcode_prefix, region, updated_at"
    )
    .eq("is_live", true)
    .or(`item_label.ilike.%${safe}%,item_slug.ilike.%${safe}%`)
    .gt("expires_at", new Date().toISOString())
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "query_failed", detail: error.message },
      { status: 500 }
    );
  }

  const rows = data ?? [];

  // Merchant identities so the client can render "who".
  const ids = Array.from(new Set(rows.map((r) => r.merchant_listing_id)));
  const merchants: Record<
    string,
    { slug: string; display_name: string; trading_name: string | null }
  > = {};
  if (ids.length > 0) {
    const { data: mrows } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, slug, display_name, trading_name")
      .in("id", ids);
    for (const m of mrows ?? []) {
      merchants[m.id] = {
        slug: m.slug,
        display_name: m.display_name,
        trading_name: m.trading_name
      };
    }
  }

  // Proximity re-sort: postcode-prefix matches first (score 2), then
  // rows with any postcode (score 1), then rows with no postcode (0).
  // Ties broken by recency (already in ORDER BY).
  const scored = rows
    .map((r) => ({
      row: r,
      score:
        prefix && r.postcode_prefix === prefix
          ? 2
          : r.postcode_prefix
            ? 1
            : 0
    }))
    .sort((a, b) => b.score - a.score);

  const top = scored.slice(0, 25).map((s) => ({
    id: s.row.id,
    itemSlug: s.row.item_slug,
    itemLabel: s.row.item_label,
    unitLabel: s.row.unit_label,
    pricePence: s.row.price_pence,
    currency: s.row.currency,
    qtyIncluded: s.row.qty_included,
    postcodePrefix: s.row.postcode_prefix,
    region: s.row.region,
    updatedAt: s.row.updated_at,
    isLocal: prefix ? s.row.postcode_prefix === prefix : false,
    merchant: merchants[s.row.merchant_listing_id] ?? null
  }));

  // Stats — computed on the same currency as the majority of results
  // to avoid mixing GBP/USD. Simpler + honest v1.
  const currencyCounts: Record<string, number> = {};
  for (const r of top) {
    currencyCounts[r.currency] = (currencyCounts[r.currency] ?? 0) + 1;
  }
  const majorityCurrency = (Object.entries(currencyCounts).sort(
    (a, b) => b[1] - a[1]
  )[0] ?? ["GBP", 0])[0];
  const majorityRows = top.filter((r) => r.currency === majorityCurrency);
  const stats =
    majorityRows.length === 0
      ? null
      : {
          currency: majorityCurrency,
          count: majorityRows.length,
          minPence: Math.min(...majorityRows.map((r) => r.pricePence)),
          maxPence: Math.max(...majorityRows.map((r) => r.pricePence)),
          avgPence: Math.round(
            majorityRows.reduce((sum, r) => sum + r.pricePence, 0) /
              majorityRows.length
          )
        };

  return NextResponse.json(
    { ok: true, results: top, stats },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300"
      }
    }
  );
}
