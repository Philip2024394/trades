// Marketplace search provider — products.
//
// Registered with the platform Universal Search orchestrator via
// registerProviderHandler("marketplace.products", ...). The
// orchestrator fans out to this handler + every other App's
// provider in parallel and merges results per ADR-041.

import { PRODUCT_FIXTURES, searchProductsFixture } from "../data/products";
import { findMerchant } from "../data/merchants";
import type { SearchResult } from "@/platform/search/orchestrator";

export async function searchProducts(query: string): Promise<SearchResult[]> {
  const hits = searchProductsFixture(query).slice(0, 8);
  const q = query.toLowerCase();
  return hits.map((p) => {
    const merchant = findMerchant(p.merchantSlug);
    // Score decays with match position — exact name match tops.
    const nameHitAt = p.name.toLowerCase().indexOf(q);
    const score = nameHitAt === 0 ? 1.0 : nameHitAt > 0 ? 0.8 : 0.5;
    return {
      id: p.id,
      kind: "products",
      title: p.name,
      subtitle: merchant
        ? `${merchant.displayName} · £${p.priceGbp}`
        : `£${p.priceGbp}`,
      href: `/tc/trade-center/product/${p.slug}`,
      score,
      appSlug: "marketplace",
      payload: p
    };
  });
}

/** For the search harness — expose the total corpus size. */
export const PRODUCTS_CORPUS_SIZE = PRODUCT_FIXTURES.length;
