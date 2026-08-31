// src/lib/nex/indonesia/commerce/retrieval.ts
//
// Stage 4 · NEX Commerce · deterministic retrieval primitives (Philip
// 2026-08-31). Data-model layer only · no chat integration, no scoring
// heuristics, no invented data. Just clean filters over the loaded
// canonical state.
//
// Consumers (future Brain commerce intent) will build on these; the
// Brain never touches storage directly.

import type { Market } from "../data/types";
import type { SellerRecord, ProductRecord, OfferRecord } from "./types";
import { listSellers, listProducts, listOffers } from "./storage";

// ─── Sellers ─────────────────────────────────────────────────────────

export type SellerFilter = {
  /** Restrict to a market (ID / UK / US / UNIVERSAL). Records without
   *  a market never surface under a market filter — loud, not silent. */
  market?: Market;
  /** Match sellers whose categories[] contains at least one of these. */
  categoryIn?: string[];
  /** Case-insensitive substring match against name / displayName / aliases. */
  nameContains?: string;
  /** Filter by verification level. */
  minVerification?: "self_declared" | "platform_verified" | "government_verified";
};

const VERIFICATION_RANK: Record<string, number> = {
  unverified: 0,
  self_declared: 1,
  platform_verified: 2,
  government_verified: 3,
};

export function findSellers(f: SellerFilter = {}): SellerRecord[] {
  const all = listSellers();
  return all.filter((s) => {
    if (f.market && s.market !== f.market) return false;
    if (f.categoryIn && f.categoryIn.length > 0) {
      const set = new Set(f.categoryIn.map((c) => c.toLowerCase()));
      if (!s.categories.some((c) => set.has(c.toLowerCase()))) return false;
    }
    if (f.nameContains) {
      const needle = f.nameContains.toLowerCase();
      const bag = [s.name, s.displayName ?? "", ...(s.aliases ?? [])].join(" ").toLowerCase();
      if (!bag.includes(needle)) return false;
    }
    if (f.minVerification) {
      if ((VERIFICATION_RANK[s.verification] ?? 0) < (VERIFICATION_RANK[f.minVerification] ?? 0)) return false;
    }
    return true;
  });
}

// ─── Products ────────────────────────────────────────────────────────

export type ProductFilter = {
  market?: Market;
  /** Exact category match (e.g. "audio.headphones.wireless"). */
  category?: string;
  /** Category prefix match — "audio" matches "audio.*". */
  categoryPrefix?: string;
  /** Substring match against name / brand / keywords / aliases. */
  nameContains?: string;
  brand?: string;
  gtin?: string;
};

export function findProducts(f: ProductFilter = {}): ProductRecord[] {
  const all = listProducts();
  return all.filter((p) => {
    if (f.market && p.market !== f.market) return false;
    if (f.category && p.category !== f.category) return false;
    if (f.categoryPrefix && !(p.category === f.categoryPrefix || p.category.startsWith(f.categoryPrefix + "."))) return false;
    if (f.brand && (p.brand ?? "").toLowerCase() !== f.brand.toLowerCase()) return false;
    if (f.gtin && p.gtin !== f.gtin) return false;
    if (f.nameContains) {
      const needle = f.nameContains.toLowerCase();
      const bag = [p.name, p.brand ?? "", ...(p.keywords ?? []), ...(p.aliases ?? [])].join(" ").toLowerCase();
      if (!bag.includes(needle)) return false;
    }
    return true;
  });
}

// ─── Offers ──────────────────────────────────────────────────────────

export type OfferFilter = {
  market?: Market;
  sellerId?: string;
  productId?: string;
  /** By default only "active" offers are returned. Pass `["active","paused"]`
   *  to include paused. Never returns delisted by default. */
  status?: Array<OfferRecord["status"]>;
  /** Only offers with a published price. */
  hasPrice?: boolean;
  /** Only offers whose stock level is one of these. */
  stockLevelIn?: Array<NonNullable<OfferRecord["stock"]>["level"]>;
  /** Currency filter (useful for cross-market queries). */
  currency?: NonNullable<OfferRecord["price"]>["currency"];
  /** Maximum price (inclusive). Only applies to offers with a published price. */
  maxPrice?: number;
  /** Sort strategy · default is unsorted (input order). */
  sortBy?: "priceAsc" | "priceDesc" | "observedAtDesc";
  /** Cap on results returned. */
  limit?: number;
};

export function findOffers(f: OfferFilter = {}): OfferRecord[] {
  const all = listOffers();
  const statuses = new Set(f.status ?? ["active"]);
  const stockLevels = f.stockLevelIn ? new Set(f.stockLevelIn) : null;

  let out = all.filter((o) => {
    if (!statuses.has(o.status)) return false;
    if (f.market && o.market !== f.market) return false;
    if (f.sellerId && o.sellerId !== f.sellerId) return false;
    if (f.productId && o.productId !== f.productId) return false;
    if (f.hasPrice && (!o.price || typeof o.price.amount !== "number")) return false;
    if (stockLevels && (!o.stock || !stockLevels.has(o.stock.level))) return false;
    if (f.currency && o.price?.currency !== f.currency) return false;
    if (f.maxPrice !== undefined && (o.price?.amount ?? Infinity) > f.maxPrice) return false;
    return true;
  });

  if (f.sortBy === "priceAsc") {
    out = out.slice().sort((a, b) => (a.price?.amount ?? Infinity) - (b.price?.amount ?? Infinity));
  } else if (f.sortBy === "priceDesc") {
    out = out.slice().sort((a, b) => (b.price?.amount ?? -Infinity) - (a.price?.amount ?? -Infinity));
  } else if (f.sortBy === "observedAtDesc") {
    out = out.slice().sort((a, b) => (b.price?.observedAt ?? "").localeCompare(a.price?.observedAt ?? ""));
  }

  return f.limit !== undefined ? out.slice(0, f.limit) : out;
}

// ─── Convenience joins ───────────────────────────────────────────────

export type OfferWithRefs = {
  offer: OfferRecord;
  seller: SellerRecord;
  product: ProductRecord;
};

/** Materialise the offer + its resolved seller + product. Offers whose
 *  FKs can't resolve are DROPPED (should never happen post-load since
 *  the storage layer validates FK integrity at load, but this stays
 *  defensive). */
export function joinOffers(offers: readonly OfferRecord[]): OfferWithRefs[] {
  const sellers = listSellers();
  const products = listProducts();
  const sellerById = new Map(sellers.map((s) => [s.id, s]));
  const productById = new Map(products.map((p) => [p.id, p]));

  const out: OfferWithRefs[] = [];
  for (const o of offers) {
    const s = sellerById.get(o.sellerId);
    const p = productById.get(o.productId);
    if (s && p) out.push({ offer: o, seller: s, product: p });
  }
  return out;
}
