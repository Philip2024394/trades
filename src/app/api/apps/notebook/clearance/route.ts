// GET /api/apps/notebook/clearance?merchants=slug-1,slug-2
//
// Returns clearance/end-of-line products from the specific merchants
// the trade already uses. Criteria:
//   • stock_count is set and < 10 (end-of-line signal), OR
//   • status is 'live' AND merchant flagged a compare_price higher than price
//
// No global "Deals" query — merchant list is required and MUST come
// from the caller's own notebook matches. This keeps the strip
// Notebook-native (per Constitution rule 3).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type MerchantRow = { id: string; slug: string; display_name: string };
type ProductRow = {
  id: string;
  listing_id: string;
  slug: string;
  name: string;
  description: string | null;
  price_pence: number;
  compare_price_pence: number | null;
  stock_count: number | null;
  image_url: string | null;
  status: string;
  updated_at: string;
};

// Clearance offers are only visible for 5 days after the merchant last
// updated the product. Re-editing the product effectively re-posts it.
const CLEARANCE_TTL_MS = 5 * 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const merchants = (url.searchParams.get("merchants") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (merchants.length === 0) {
    return NextResponse.json({ items: [] });
  }

  // Look up merchant IDs from their slugs
  const { data: merchantRows, error: merchantError } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, display_name")
    .in("slug", merchants);
  if (merchantError) return NextResponse.json({ error: merchantError.message }, { status: 500 });
  const merchantById = new Map((merchantRows ?? []).map((m: MerchantRow) => [m.id, m]));
  const merchantIds = Array.from(merchantById.keys());

  if (merchantIds.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const { data: products, error: productsError } = await supabaseAdmin
    .from("hammerex_xrated_products")
    .select("id, listing_id, slug, name, description, price_pence, compare_price_pence, stock_count, image_url, status, updated_at")
    .in("listing_id", merchantIds)
    .eq("status", "live");
  if (productsError) return NextResponse.json({ error: productsError.message }, { status: 500 });

  const items = (products as ProductRow[] | null ?? [])
    .map((p) => {
      const merchant = merchantById.get(p.listing_id);
      if (!merchant) return null;
      const priceGbp = p.price_pence / 100;
      const comparePriceGbp = p.compare_price_pence !== null ? p.compare_price_pence / 100 : null;
      const savingPct =
        comparePriceGbp && comparePriceGbp > priceGbp
          ? ((comparePriceGbp - priceGbp) / comparePriceGbp) * 100
          : null;
      const lowStock = p.stock_count !== null && p.stock_count > 0 && p.stock_count < 10;

      // Clearance criteria: ≥15% off OR low stock
      const qualifies = (savingPct !== null && savingPct >= 15) || lowStock;
      if (!qualifies) return null;

      const postedAt = new Date(p.updated_at);
      const expiresAt = new Date(postedAt.getTime() + CLEARANCE_TTL_MS);
      // Skip anything already past the 5-day window — the merchant
      // needs to re-post (i.e. edit the product) to bring it back.
      if (expiresAt.getTime() <= Date.now()) return null;

      return {
        productId:     p.id,
        productSlug:   p.slug,
        productName:   p.name,
        spec:          p.description ?? "",
        imageUrl:      p.image_url,
        priceGbp,
        comparePriceGbp,
        savingPct:     savingPct ?? 10, // fallback for low-stock-only entries
        stockCount:    p.stock_count,
        lowStock,
        merchantSlug:  merchant.slug,
        merchantName:  merchant.display_name,
        postedAtIso:   postedAt.toISOString(),
        expiresAtIso:  expiresAt.toISOString()
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.savingPct - a.savingPct)
    .slice(0, 12);

  return NextResponse.json({ items });
}
