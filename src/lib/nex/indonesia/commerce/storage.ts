// src/lib/nex/indonesia/commerce/storage.ts
//
// Stage 4 · NEX Commerce · JSON-backed storage with validation on load
// (Philip 2026-08-31). File layout:
//
//   data/indonesia/commerce-sellers.json  → { sellers:  SellerRecord[] }
//   data/indonesia/commerce-products.json → { products: ProductRecord[] }
//   data/indonesia/commerce-offers.json   → { offers:   OfferRecord[] }
//
// Loaded once per process, cached, and re-validated only when the
// caller invokes _resetCommerceCacheForTests(). Corrupt / missing
// files are treated as empty; invalid records are DROPPED with a
// console warning (and are surfaced by loadCommerceReport for the
// guardian). Never a silent accept.
//
// Writes use atomic tmp+rename per the acquisition pipeline pattern.
// FK integrity is enforced at load and at write.

import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SellerRecord, ProductRecord, OfferRecord } from "./types";
import { validateSeller, validateProduct, validateOffer, validateOfferAgainst, type ValidationIssue } from "./validators";

let SELLERS: SellerRecord[] | null = null;
let PRODUCTS: ProductRecord[] | null = null;
let OFFERS: OfferRecord[] | null = null;

let LAST_LOAD_REPORT: LoadReport | null = null;

export type LoadReport = {
  sellers: { total: number; valid: number; dropped: number; issues: Array<{ id: string; issues: ValidationIssue[] }> };
  products: { total: number; valid: number; dropped: number; issues: Array<{ id: string; issues: ValidationIssue[] }> };
  offers: { total: number; valid: number; dropped: number; issues: Array<{ id: string; issues: ValidationIssue[] }> };
};

function dataDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../../../data/indonesia");
}
function sellersPath() { return path.join(dataDir(), "commerce-sellers.json"); }
function productsPath() { return path.join(dataDir(), "commerce-products.json"); }
function offersPath() { return path.join(dataDir(), "commerce-offers.json"); }

function readJson<T>(p: string, wrapperKey: string): T[] {
  try {
    if (!existsSync(p)) return [];
    const raw = readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const arr = parsed[wrapperKey];
    return Array.isArray(arr) ? (arr as T[]) : [];
  } catch {
    return [];
  }
}

function writeJsonAtomic(p: string, payload: unknown): void {
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(payload, null, 2) + "\n", "utf8");
  renameSync(tmp, p);
}

function ensureLoaded(): void {
  if (SELLERS && PRODUCTS && OFFERS) return;
  const rawSellers = readJson<SellerRecord>(sellersPath(), "sellers");
  const rawProducts = readJson<ProductRecord>(productsPath(), "products");
  const rawOffers = readJson<OfferRecord>(offersPath(), "offers");

  const validSellers: SellerRecord[] = [];
  const droppedSellers: LoadReport["sellers"]["issues"] = [];
  for (const s of rawSellers) {
    const v = validateSeller(s);
    if (v.valid) validSellers.push(s);
    else droppedSellers.push({ id: s?.id ?? "(missing id)", issues: v.issues });
  }

  const validProducts: ProductRecord[] = [];
  const droppedProducts: LoadReport["products"]["issues"] = [];
  for (const p of rawProducts) {
    const v = validateProduct(p);
    if (v.valid) validProducts.push(p);
    else droppedProducts.push({ id: p?.id ?? "(missing id)", issues: v.issues });
  }

  const validOffers: OfferRecord[] = [];
  const droppedOffers: LoadReport["offers"]["issues"] = [];
  for (const o of rawOffers) {
    const v = validateOfferAgainst(o, validSellers, validProducts);
    if (v.valid) validOffers.push(o);
    else droppedOffers.push({ id: o?.id ?? "(missing id)", issues: v.issues });
  }

  SELLERS = validSellers;
  PRODUCTS = validProducts;
  OFFERS = validOffers;
  LAST_LOAD_REPORT = {
    sellers: { total: rawSellers.length, valid: validSellers.length, dropped: droppedSellers.length, issues: droppedSellers },
    products: { total: rawProducts.length, valid: validProducts.length, dropped: droppedProducts.length, issues: droppedProducts },
    offers: { total: rawOffers.length, valid: validOffers.length, dropped: droppedOffers.length, issues: droppedOffers },
  };

  if (droppedSellers.length + droppedProducts.length + droppedOffers.length > 0) {
    // Loud, not silent · guardian consumes this via loadCommerceReport.
    // eslint-disable-next-line no-console
    console.warn("[commerce/storage] dropped invalid records:", {
      sellers: droppedSellers.length, products: droppedProducts.length, offers: droppedOffers.length,
    });
  }
}

export function listSellers(): readonly SellerRecord[] {
  ensureLoaded();
  return SELLERS!;
}
export function listProducts(): readonly ProductRecord[] {
  ensureLoaded();
  return PRODUCTS!;
}
export function listOffers(): readonly OfferRecord[] {
  ensureLoaded();
  return OFFERS!;
}
export function loadCommerceReport(): LoadReport {
  ensureLoaded();
  return LAST_LOAD_REPORT!;
}

/** Write current in-memory state to disk atomically. Validates first —
 *  throws when any record fails, so partial writes cannot happen. */
export function persistCommerceState(next: {
  sellers?: SellerRecord[];
  products?: ProductRecord[];
  offers?: OfferRecord[];
}): void {
  const sellers = next.sellers ?? (SELLERS ?? []);
  const products = next.products ?? (PRODUCTS ?? []);
  const offers = next.offers ?? (OFFERS ?? []);

  for (const s of sellers) {
    const v = validateSeller(s);
    if (!v.valid) throw new Error(`invalid seller "${s.id}": ${JSON.stringify(v.issues)}`);
  }
  for (const p of products) {
    const v = validateProduct(p);
    if (!v.valid) throw new Error(`invalid product "${p.id}": ${JSON.stringify(v.issues)}`);
  }
  for (const o of offers) {
    const v = validateOfferAgainst(o, sellers, products);
    if (!v.valid) throw new Error(`invalid offer "${o.id}": ${JSON.stringify(v.issues)}`);
  }

  if (next.sellers) { writeJsonAtomic(sellersPath(), { sellers }); SELLERS = sellers; }
  if (next.products) { writeJsonAtomic(productsPath(), { products }); PRODUCTS = products; }
  if (next.offers) { writeJsonAtomic(offersPath(), { offers }); OFFERS = offers; }
}

/** Test-only · clears the cache so the next call re-reads from disk. */
export function _resetCommerceCacheForTests(): void {
  SELLERS = null;
  PRODUCTS = null;
  OFFERS = null;
  LAST_LOAD_REPORT = null;
}

/** Test-only · inject a fully in-memory state without touching disk. */
export function _seedCommerceForTests(next: {
  sellers?: SellerRecord[];
  products?: ProductRecord[];
  offers?: OfferRecord[];
}): void {
  SELLERS = next.sellers ?? [];
  PRODUCTS = next.products ?? [];
  OFFERS = next.offers ?? [];
  LAST_LOAD_REPORT = {
    sellers: { total: SELLERS.length, valid: SELLERS.length, dropped: 0, issues: [] },
    products: { total: PRODUCTS.length, valid: PRODUCTS.length, dropped: 0, issues: [] },
    offers: { total: OFFERS.length, valid: OFFERS.length, dropped: 0, issues: [] },
  };
}
