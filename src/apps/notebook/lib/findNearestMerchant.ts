// Given a notebook item, find the nearest merchant selling a matching
// product. "Matching" is a loose name/spec match against the marketplace
// product fixtures — real Trade Center uses the shared catalogue index,
// this fixture-side matcher exists so the notebook page renders end-to-
// end in the demo.
//
// Constitution reminder: we sort by DISTANCE only, never price. That's
// how we keep merchants on the platform.

import { MERCHANT_FIXTURES, findMerchant } from "@/apps/marketplace/data/merchants";
import { PRODUCT_FIXTURES } from "@/apps/marketplace/data/products";
import { milesBetweenCities } from "@/apps/marketplace/lib/distance";
import type { MarketplaceProduct } from "@/apps/marketplace/types";
import type { MarketplaceMerchant } from "@/apps/marketplace/data/merchants";
import type { NotebookItem } from "../data/notebook";

export type NearestMatch = {
  product: MarketplaceProduct;
  merchant: MarketplaceMerchant;
  distanceMi: number;
};

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(normalise(a).split(" ").filter(Boolean));
  const tb = new Set(normalise(b).split(" ").filter(Boolean));
  let overlap = 0;
  ta.forEach((t) => {
    if (tb.has(t)) overlap++;
  });
  return overlap;
}

/**
 * Best match = highest-overlap product name across the catalogue, then
 * the merchant with the closest home city to the viewer.
 */
export function findNearestForNotebookItem(
  item: NotebookItem,
  viewerCity: string
): NearestMatch | null {
  // Score every candidate product across every merchant, then pick the
  // one with the best token match. If two products tie on match, prefer
  // the merchant closer to the viewer.
  let best: NearestMatch | null = null;

  for (const product of PRODUCT_FIXTURES) {
    const overlap = tokenOverlap(item.productName, product.name);
    if (overlap === 0) continue;

    const merchant = findMerchant(product.merchantSlug);
    if (!merchant) continue;

    const distance = milesBetweenCities(viewerCity, merchant.homeCity) ?? Infinity;

    if (!best) {
      best = { product, merchant, distanceMi: distance };
      continue;
    }

    const bestOverlap = tokenOverlap(item.productName, best.product.name);
    if (overlap > bestOverlap) {
      best = { product, merchant, distanceMi: distance };
    } else if (overlap === bestOverlap && distance < best.distanceMi) {
      best = { product, merchant, distanceMi: distance };
    }
  }

  return best;
}

/** Statistics for the header — how many notebook items resolved to a
 *  nearest merchant, and the total unique merchants involved. */
export function summariseNotebookMatches(
  items: NotebookItem[],
  viewerCity: string
): { matched: number; unmatched: number; uniqueMerchants: number } {
  const merchantSlugs = new Set<string>();
  let matched = 0;
  let unmatched = 0;
  for (const item of items) {
    const match = findNearestForNotebookItem(item, viewerCity);
    if (match) {
      matched++;
      merchantSlugs.add(match.merchant.slug);
    } else {
      unmatched++;
    }
  }
  return { matched, unmatched, uniqueMerchants: merchantSlugs.size };
}

/** All merchants known to the platform — used by the loading spinner
 *  to display "checking 4 merchants..." style status. */
export function totalMerchantsIndexed(): number {
  return MERCHANT_FIXTURES.length;
}
