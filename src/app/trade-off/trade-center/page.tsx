// /trade-off/trade-center — Cross-merchant product browse.
//
// Discovery layer. Every product card routes into the host's canteen
// product-focus view (see productToCanteenLink / RETURN_ORIGINS).
// Server-reads `?trade=`, `?sort=`, `?q=` so filter state is
// share-linkable and SEO-crawlable.

import type { Metadata } from "next";
import { type BrowseSort } from "@/lib/canteens";
import { browseAllProductsFromDb, browseTradeFacetsFromDb, browseCategoryFacetsFromDb } from "@/lib/canteens.server";
import { TradeCenterBrowseShell } from "./TradeCenterBrowseShell";
import { BRAND, absolute } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trade Center — Every UK trade product in one place | Thenetworkers",
  description:
    "Browse products from every trade on Thenetworkers. Every listing routes into the merchant's canteen — real people, real trades, real WhatsApp handoff. No middleman.",
  alternates: { canonical: "/trade-off/trade-center" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Trade Center — Thenetworkers",
    description: "Trades-to-trades marketplace. Every listing lands in a real trade community.",
    url: absolute("/trade-off/trade-center")
  }
};

const VALID_SORTS: BrowseSort[] = ["boosted", "price-asc", "price-desc", "newest"];

export default async function TradeCenterPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const trade = typeof sp.trade === "string" ? sp.trade : undefined;
  const sort = typeof sp.sort === "string" ? sp.sort : undefined;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const category = typeof sp.category === "string" ? sp.category : undefined;
  const sortValue: BrowseSort = VALID_SORTS.includes(sort as BrowseSort)
    ? (sort as BrowseSort)
    : "boosted";

  // Aspect filters: every `?a.{key}=value` search param is a facet
  // filter. Product must match ALL of them. Example URL:
  //   /trade-off/trade-center?category=paint-decor&a.finish=Matt&a.base=Water-based
  const aspectFilters: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (!k.startsWith("a.")) continue;
    const key = k.slice(2);
    const value = typeof v === "string" ? v : Array.isArray(v) ? v[0] : "";
    if (key && value) aspectFilters[key] = value;
  }

  const [rows, tradeFacets, categoryFacets] = await Promise.all([
    browseAllProductsFromDb({
      tradeSlug: trade || undefined,
      sort: sortValue,
      q: q || undefined,
      categorySlug: category || undefined,
      aspectFilters: Object.keys(aspectFilters).length > 0 ? aspectFilters : undefined
    }),
    browseTradeFacetsFromDb(),
    browseCategoryFacetsFromDb({ activeCategorySlug: category || undefined })
  ]);

  return (
    <TradeCenterBrowseShell
      rows={rows}
      facets={tradeFacets}
      categoryFacets={categoryFacets.categories}
      aspectFacets={categoryFacets.aspectFacets}
      activeTradeSlug={trade || null}
      activeCategorySlug={category || null}
      activeAspectFilters={aspectFilters}
      activeSort={sortValue}
      activeQuery={q || ""}
    />
  );
}
