// /trade-off/trade-center — Cross-merchant product browse.
//
// Discovery layer. Every product card routes into the host's canteen
// product-focus view (see productToCanteenLink / RETURN_ORIGINS).
// Server-reads `?trade=`, `?sort=`, `?q=` so filter state is
// share-linkable and SEO-crawlable.

import type { Metadata } from "next";
import { type BrowseSort } from "@/lib/canteens";
import { browseAllProductsFromDb, browseTradeFacetsFromDb } from "@/lib/canteens.server";
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
  searchParams: Promise<{ trade?: string; sort?: string; q?: string }>;
}) {
  const { trade, sort, q } = await searchParams;
  const sortValue: BrowseSort = VALID_SORTS.includes(sort as BrowseSort)
    ? (sort as BrowseSort)
    : "boosted";
  const [rows, facets] = await Promise.all([
    browseAllProductsFromDb({
      tradeSlug: trade || undefined,
      sort: sortValue,
      q: q || undefined
    }),
    browseTradeFacetsFromDb()
  ]);

  return (
    <TradeCenterBrowseShell
      rows={rows}
      facets={facets}
      activeTradeSlug={trade || null}
      activeSort={sortValue}
      activeQuery={q || ""}
    />
  );
}
