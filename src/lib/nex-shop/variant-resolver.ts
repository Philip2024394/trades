// src/lib/nex-shop/variant-resolver.ts
//
// VARIANT RESOLVER · pure function.
//
// Given a product's options + variants + a user's option-value selections,
// returns the matching variant OR 'UNAVAILABLE' / 'INCOMPLETE_SELECTION' /
// 'INVALID_OPTION'. Never invents a variant.

import type { Product, ProductVariant, ProductOption } from "./types";

export type SelectionMap = Record<string, string>;   // optionName → optionValue (both human-readable)

export interface ResolveOK {
  status: "OK";
  variant: ProductVariant;
  priceIdr: number;
  stock: number;
  sku: string;
  outOfStock: boolean;
}

export interface ResolveUnavailable {
  status: "UNAVAILABLE";
  reason: "COMBINATION_NOT_LISTED" | "VARIANT_INACTIVE";
  detail: string;
}

export interface ResolveIncomplete {
  status: "INCOMPLETE_SELECTION";
  missingOptions: string[];
}

export interface ResolveInvalid {
  status: "INVALID_OPTION";
  detail: string;
}

export interface ResolveBase {
  status: "BASE_PRODUCT";
  priceIdr: number;
  stock: number;
  sku: string | null;
  outOfStock: boolean;
}

export type ResolveResult =
  | ResolveOK
  | ResolveUnavailable
  | ResolveIncomplete
  | ResolveInvalid
  | ResolveBase;

function findOptionValueId(option: ProductOption, value: string): string | null {
  const v = option.values.find((x) => x.value.toLowerCase() === value.toLowerCase());
  return v ? v.optionValueId : null;
}

function sortedIdKey(ids: string[]): string {
  return [...ids].sort().join("|");
}

/**
 * Resolve a customer's selection against a product's variant matrix.
 *
 * Bright-line rules:
 *   1. If the product has no variants → returns BASE_PRODUCT with base price/stock.
 *   2. If any option is unselected → INCOMPLETE_SELECTION lists what's missing.
 *   3. If a chosen option value is not a known value for that option → INVALID_OPTION.
 *   4. If the selection combination exists as a variant but is inactive → UNAVAILABLE / VARIANT_INACTIVE.
 *   5. If the selection combination does not exist as any variant → UNAVAILABLE / COMBINATION_NOT_LISTED.
 *   6. Never falls back to base price when variants exist.
 */
export function resolveVariant(product: Product, selection: SelectionMap): ResolveResult {
  if (!product.hasVariants) {
    return {
      status: "BASE_PRODUCT",
      priceIdr: product.basePriceIdr ?? 0,
      stock: product.baseStock ?? 0,
      sku: product.baseSku,
      outOfStock: (product.baseStock ?? 0) <= 0,
    };
  }

  // Every option must have a selection
  const missing: string[] = [];
  for (const opt of product.options) {
    if (!selection[opt.name]) missing.push(opt.name);
  }
  if (missing.length > 0) {
    return { status: "INCOMPLETE_SELECTION", missingOptions: missing };
  }

  // Every selected value must be a known option value
  const selectedIds: string[] = [];
  for (const opt of product.options) {
    const valueId = findOptionValueId(opt, selection[opt.name]);
    if (!valueId) {
      return {
        status: "INVALID_OPTION",
        detail: `Option '${opt.name}' does not have value '${selection[opt.name]}'.`,
      };
    }
    selectedIds.push(valueId);
  }

  // Find the variant matching this exact combination
  const target = sortedIdKey(selectedIds);
  const match = product.variants.find((v) => sortedIdKey(v.optionValueIds) === target);
  if (!match) {
    return {
      status: "UNAVAILABLE",
      reason: "COMBINATION_NOT_LISTED",
      detail: "This exact combination has not been listed by the seller.",
    };
  }
  if (!match.active) {
    return {
      status: "UNAVAILABLE",
      reason: "VARIANT_INACTIVE",
      detail: `Variant SKU ${match.sku} exists but is currently inactive.`,
    };
  }

  return {
    status: "OK",
    variant: match,
    priceIdr: match.priceIdr,
    stock: match.stock,
    sku: match.sku,
    outOfStock: match.stock <= 0,
  };
}
