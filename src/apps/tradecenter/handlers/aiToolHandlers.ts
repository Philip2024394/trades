// Marketplace — AI tool handler implementations.
//
// Registered with the platform Dispatcher via
// registerToolHandler(name, fn) at bootstrap. Each handler is a pure
// function of its args; no shared mutable state.

import { PRODUCT_FIXTURES, findProduct, searchProductsFixture } from "../data/products";
import { findMerchant } from "../data/merchants";
import type { TradeCenterProduct } from "../types";

function decorateWithMerchant(p: TradeCenterProduct) {
  const m = findMerchant(p.merchantSlug);
  return {
    id: p.id,
    name: p.name,
    spec: p.spec,
    priceGbp: p.priceGbp,
    tradePriceGbp: p.tradePriceGbp,
    stockState: p.stockState,
    deliveryPromise: p.deliveryPromise,
    merchant: m
      ? {
          slug: m.slug,
          displayName: m.displayName,
          trustScore: m.trust.score,
          city: m.homeCity
        }
      : null
  };
}

/** marketplace.search_products */
export function searchProductsTool(args: unknown): unknown {
  const query = typeof args === "object" && args && "query" in args
    ? String((args as Record<string, unknown>).query ?? "")
    : "";
  const rows = searchProductsFixture(query).slice(0, 8);
  return {
    query,
    totalMatches: rows.length,
    products: rows.map(decorateWithMerchant)
  };
}

/** marketplace.get_product */
export function getProductTool(args: unknown): unknown {
  const productId =
    typeof args === "object" && args && "productId" in args
      ? String((args as Record<string, unknown>).productId ?? "")
      : "";
  const p = findProduct(productId);
  if (!p) return { error: `product-not-found:${productId}` };
  return decorateWithMerchant(p);
}

/** marketplace.compare_products */
export function compareProductsTool(args: unknown): unknown {
  const ids =
    typeof args === "object" && args && "productIds" in args
      ? ((args as Record<string, unknown>).productIds as string[] | undefined) ?? []
      : [];
  const rows = ids.map(findProduct).filter((p): p is TradeCenterProduct => Boolean(p));
  return {
    products: rows.map(decorateWithMerchant),
    missing: ids.filter((id) => !findProduct(id))
  };
}

/** marketplace.find_alternatives */
export function findAlternativesTool(args: unknown): unknown {
  const productId =
    typeof args === "object" && args && "productId" in args
      ? String((args as Record<string, unknown>).productId ?? "")
      : "";
  const seed = findProduct(productId);
  if (!seed) return { error: `product-not-found:${productId}` };
  const alternatives = PRODUCT_FIXTURES
    .filter(
      (p) =>
        p.id !== seed.id &&
        p.subCategory === seed.subCategory &&
        p.merchantSlug !== seed.merchantSlug
    )
    .slice(0, 5)
    .map(decorateWithMerchant);
  return { seedProductId: productId, alternatives };
}
