// GET /api/apps/notebook/clearance/nearby
//
// Top clearance offers from ANY verified merchant, capped at 6. Powers
// the Trade Counter drawer's clearance rail — the trade-to-trade
// side lane feed the user wants clearance visible on.
//
// Same 5-day expiry model as the merchant-scoped endpoint.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const TTL_MS = 5 * 24 * 60 * 60 * 1000;

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
  updated_at: string;
};

export async function GET() {
  const { data: products, error } = await supabaseAdmin
    .from("hammerex_xrated_products")
    .select("id, listing_id, slug, name, description, price_pence, compare_price_pence, stock_count, image_url, updated_at")
    .eq("status", "live")
    .order("updated_at", { ascending: false })
    .limit(60);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!products || products.length === 0) return NextResponse.json({ items: [] });

  const merchantIds = Array.from(new Set(products.map((p: ProductRow) => p.listing_id)));
  const { data: merchants } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, display_name")
    .in("id", merchantIds);
  const merchantById = new Map((merchants ?? []).map((m: { id: string; slug: string; display_name: string }) => [m.id, m]));

  const now = Date.now();
  const items = products
    .map((p: ProductRow) => {
      const merchant = merchantById.get(p.listing_id);
      if (!merchant) return null;
      const priceGbp = p.price_pence / 100;
      const compareGbp = p.compare_price_pence !== null ? p.compare_price_pence / 100 : null;
      const savingPct =
        compareGbp && compareGbp > priceGbp
          ? ((compareGbp - priceGbp) / compareGbp) * 100
          : null;
      const lowStock = p.stock_count !== null && p.stock_count > 0 && p.stock_count < 10;
      const qualifies = (savingPct !== null && savingPct >= 15) || lowStock;
      if (!qualifies) return null;

      const postedAt = new Date(p.updated_at).getTime();
      const expiresAt = postedAt + TTL_MS;
      if (expiresAt <= now) return null;

      return {
        productId:     p.id,
        productSlug:   p.slug,
        productName:   p.name,
        spec:          p.description ?? "",
        imageUrl:      p.image_url,
        priceGbp,
        comparePriceGbp: compareGbp,
        savingPct:     savingPct ?? 10,
        lowStock,
        merchantSlug:  merchant.slug,
        merchantName:  merchant.display_name,
        postedAtIso:   new Date(postedAt).toISOString(),
        expiresAtIso:  new Date(expiresAt).toISOString()
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.savingPct - a.savingPct)
    .slice(0, 6);

  return NextResponse.json({ items });
}
