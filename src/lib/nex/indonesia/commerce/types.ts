// src/lib/nex/indonesia/commerce/types.ts
//
// Stage 4 · NEX Commerce World · canonical data models (Philip 2026-08-31).
//
// Per the Chat-First Indonesian Commerce doctrine, commerce lives on
// FOUR strict canonical models: SellerRecord + ProductRecord +
// OfferRecord + OrderRecord. This file defines the first three. Order
// is intentionally deferred until Seller/Product/Offer are proven and
// a real inventory pipeline exists — no payment, no checkout, no fake
// marketplace before then.
//
// Design tenets (Philip 2026-08-31 · Stage 4):
//   · Never mixed with EntityRecord. Commerce is a separate world.
//     Sellers/products/offers do NOT flow through knowledge-entities.json
//     and are NOT surfaced by retrieveKnowledge. This keeps the market-
//     scoped-knowledge doctrine unpolluted by commerce records.
//   · Provenance is mandatory on every record. Same shape as EntityRecord
//     (ProvenanceRef with market + tier + reliability). Every record
//     tells you where it came from.
//   · FK integrity is enforced at load. An OfferRecord referencing a
//     non-existent sellerId or productId fails validation loud rather
//     than being silently accepted.
//   · Zero fabrication. Files start empty. Records enter only through
//     a vetted source classified REAL/AVAILABLE/CREDENTIALS/UNSUITABLE
//     per the acquisition doctrine.
//   · Every price/stock field carries provenance timestamps so the
//     reply layer can honestly say "as of X" or "not published yet".

import type { Market, ProvenanceRef, RecordLifecycle, GeoLocation, ContactChannel } from "../data/types";

// ─── SellerRecord ─────────────────────────────────────────────────────

export type SellerVerification =
  | "unverified"            // discovered, no verification yet
  | "self_declared"         // seller has an account with us but hasn't proven identity
  | "platform_verified"     // verified on an established platform (Tokopedia badge, Shopee Star, etc.)
  | "government_verified";  // has a registered business (NIB · NPWP · SIUP)

export type SellerRecord = {
  /** Canonical NEX seller ID (stable). REQUIRED. */
  id: string;
  /** Discriminator · always "seller". REQUIRED. */
  kind: "seller";
  /** Legal / registered business name. REQUIRED. */
  name: string;
  /** Trading name if different. */
  displayName?: string;
  /** REQUIRED per market-scoped-knowledge doctrine. */
  market: Market;
  /** Lifecycle stage. */
  lifecycle: RecordLifecycle;
  lifecycleChangedAt: string;
  lifecycleReason?: string;
  /** Every source that has observed this seller. Non-empty. */
  provenance: ProvenanceRef[];
  /** Where the seller operates from · optional for pure-online sellers. */
  geo?: GeoLocation;
  /** Verified contact channels. */
  contacts?: ContactChannel[];
  /** Verification level (what proof do we have this seller is real?). */
  verification: SellerVerification;
  /** What the seller sells at a coarse level · e.g. ["electronics", "audio"]. */
  categories: string[];
  /** Free-text description of the business. */
  description?: string;
  /** Free-form kind-specific attributes (business registration number,
   *  tax ID, marketplace platform IDs, founding year, etc.). */
  attributes?: Record<string, unknown>;
  /** Aliases used by the seller in the wild. */
  aliases?: string[];
};

// ─── ProductRecord ────────────────────────────────────────────────────

export type ProductRecord = {
  /** Canonical NEX product ID (stable). REQUIRED. */
  id: string;
  /** Discriminator · always "product". REQUIRED. */
  kind: "product";
  /** Canonical product name. REQUIRED. */
  name: string;
  /** Manufacturer / brand. */
  brand?: string;
  /** Category · e.g. "audio.headphones.wireless" · dotted hierarchy. REQUIRED. */
  category: string;
  /** REQUIRED per market-scoped-knowledge doctrine.
   *  Note: many products are truly global (Sony headphones). Use
   *  "UNIVERSAL" only when the product is not market-specific. */
  market: Market;
  lifecycle: RecordLifecycle;
  lifecycleChangedAt: string;
  lifecycleReason?: string;
  provenance: ProvenanceRef[];
  /** Universal identifiers where available. */
  gtin?: string;    // barcode (EAN/UPC/JAN)
  mpn?: string;     // manufacturer part number
  /** Longer description. */
  description?: string;
  /** Product images with provenance. */
  images?: ProductImage[];
  /** Structured specifications · specific to the category. */
  specs?: Record<string, unknown>;
  /** Free-text tags for retrieval. */
  keywords?: string[];
  aliases?: string[];
};

export type ProductImage = {
  url: string;
  source: string;                // where the image came from
  isPrimary?: boolean;
  license?: string;              // license/permission (e.g. "manufacturer_press", "seller_provided")
  observedAt: string;            // ISO date
};

// ─── OfferRecord ──────────────────────────────────────────────────────

export type OfferRecord = {
  /** Canonical NEX offer ID (stable). REQUIRED. */
  id: string;
  /** Discriminator · always "offer". REQUIRED. */
  kind: "offer";
  /** FK to SellerRecord.id. REQUIRED · validated at load. */
  sellerId: string;
  /** FK to ProductRecord.id. REQUIRED · validated at load. */
  productId: string;
  /** REQUIRED · inherited from the offer's seller market normally. */
  market: Market;
  lifecycle: RecordLifecycle;
  lifecycleChangedAt: string;
  lifecycleReason?: string;
  provenance: ProvenanceRef[];
  /**
   * Price · null when the seller has not published a price. NEVER
   * fabricate; a null price is honest, an invented price is a doctrine
   * violation. observedAt tells the reply layer how stale a shown
   * price is.
   */
  price?: PriceInfo | null;
  /**
   * Stock · null when unknown. When known, level is coarse-grained
   * ("available" / "limited" / "out_of_stock") so we don't need
   * real-time counts to be useful.
   */
  stock?: StockInfo | null;
  /**
   * Status · active listings are surfaced to users. Paused/delisted
   * offers are retained for audit but never returned by findOffers by
   * default.
   */
  status: OfferStatus;
  /** Variant identifier (color/size/edition) · differentiates offers
   *  from the same seller for the same product. */
  variant?: string;
  /** Shipping metadata · optional per doctrine (some sellers don't
   *  publish shipping until checkout). */
  shipping?: ShippingInfo;
  /** Free-form kind-specific attributes. */
  attributes?: Record<string, unknown>;
};

export type PriceInfo = {
  amount: number;
  currency: "IDR" | "USD" | "SGD" | "MYR" | "AUD";
  /** Per-unit description · "each" | "kg" | "night" | "hour" etc. */
  unit: string;
  /** ISO date · when we last verified this price. */
  observedAt: string;
  /** Source of this specific price observation. */
  sourceKey: string;
};

export type StockInfo = {
  level: "available" | "limited" | "out_of_stock" | "unknown";
  /** Only populated when the source publishes a real number. */
  quantity?: number;
  observedAt: string;
  sourceKey: string;
};

export type OfferStatus =
  | "active"     // seller confirms listing is live
  | "paused"     // temporarily hidden by seller
  | "delisted"   // permanently removed
  | "unknown";   // discovered without status signal

export type ShippingInfo = {
  /** e.g. ["JNE", "SiCepat", "Gojek"] */
  couriers?: string[];
  /** Free-form origin location (city). */
  originCity?: string;
  /** True when the seller offers same-day/instant courier. */
  sameDay?: boolean;
  observedAt?: string;
};

// ─── Type guards (discriminated unions in downstream code) ───────────

export type CommerceRecord = SellerRecord | ProductRecord | OfferRecord;

export function isSeller(r: CommerceRecord): r is SellerRecord {
  return r.kind === "seller";
}
export function isProduct(r: CommerceRecord): r is ProductRecord {
  return r.kind === "product";
}
export function isOffer(r: CommerceRecord): r is OfferRecord {
  return r.kind === "offer";
}
