// src/lib/nex/indonesia/commerce/validators.ts
//
// Stage 4 · NEX Commerce · pure validation for the three canonical
// records (Philip 2026-08-31). Every load and every write goes through
// these — invalid records fail LOUD, never silently persisted.
//
// FK integrity for offers is enforced by validateOfferAgainst — an
// offer whose sellerId or productId doesn't resolve is rejected. This
// keeps the commerce world referentially clean without needing a
// database engine.

import type {
  SellerRecord,
  ProductRecord,
  OfferRecord,
  PriceInfo,
  StockInfo,
} from "./types";
import type { Market, ProvenanceRef, RecordLifecycle } from "../data/types";

export type ValidationIssue = { field: string; message: string };
export type ValidationResult = { valid: boolean; issues: ValidationIssue[] };

const REQUIRED_MARKETS: Market[] = ["ID", "UK", "US", "UNIVERSAL", "UNKNOWN"];
const REQUIRED_LIFECYCLES: RecordLifecycle[] = [
  "DISCOVERED", "ACQUIRED", "NORMALIZED", "VALIDATING", "VERIFIED",
  "ENRICHED", "PUBLISHED", "STALE", "REFRESHING", "UPDATED",
  "SUPERSEDED", "FAILED",
];

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

function validateProvenance(p: unknown, prefix: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!Array.isArray(p) || p.length === 0) {
    issues.push({ field: `${prefix}.provenance`, message: "provenance must be a non-empty array" });
    return issues;
  }
  for (let i = 0; i < p.length; i++) {
    const ref = p[i] as Partial<ProvenanceRef>;
    if (!isNonEmptyString(ref?.walkerId)) issues.push({ field: `${prefix}.provenance[${i}].walkerId`, message: "required" });
    if (!isNonEmptyString(ref?.sourceKey)) issues.push({ field: `${prefix}.provenance[${i}].sourceKey`, message: "required" });
    if (!isNonEmptyString(ref?.sourceName)) issues.push({ field: `${prefix}.provenance[${i}].sourceName`, message: "required" });
    if (!ref?.sourceTier || !["A", "B", "C", "D"].includes(ref.sourceTier)) issues.push({ field: `${prefix}.provenance[${i}].sourceTier`, message: "must be A|B|C|D" });
    if (ref?.market !== undefined && !REQUIRED_MARKETS.includes(ref.market)) {
      issues.push({ field: `${prefix}.provenance[${i}].market`, message: "must be one of ID|UK|US|UNIVERSAL|UNKNOWN when set" });
    }
    if (!isNonEmptyString(ref?.firstDiscoveredAt)) issues.push({ field: `${prefix}.provenance[${i}].firstDiscoveredAt`, message: "required ISO date" });
    if (!isNonEmptyString(ref?.lastCheckedAt)) issues.push({ field: `${prefix}.provenance[${i}].lastCheckedAt`, message: "required ISO date" });
    if (!isNonEmptyString(ref?.lastChangedAt)) issues.push({ field: `${prefix}.provenance[${i}].lastChangedAt`, message: "required ISO date" });
    if (!isNonEmptyString(ref?.observedAt)) issues.push({ field: `${prefix}.provenance[${i}].observedAt`, message: "required ISO date" });
  }
  return issues;
}

function validateLifecycle(r: { lifecycle?: unknown; lifecycleChangedAt?: unknown }, prefix: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (typeof r.lifecycle !== "string" || !REQUIRED_LIFECYCLES.includes(r.lifecycle as RecordLifecycle)) {
    issues.push({ field: `${prefix}.lifecycle`, message: `must be one of the RecordLifecycle values` });
  }
  if (!isNonEmptyString(r.lifecycleChangedAt)) {
    issues.push({ field: `${prefix}.lifecycleChangedAt`, message: "required ISO date" });
  }
  return issues;
}

function validateMarket(m: unknown, prefix: string): ValidationIssue[] {
  if (typeof m !== "string" || !REQUIRED_MARKETS.includes(m as Market)) {
    return [{ field: `${prefix}.market`, message: `must be one of ID|UK|US|UNIVERSAL|UNKNOWN (per market-scoped-knowledge doctrine)` }];
  }
  return [];
}

// ─── Seller ──────────────────────────────────────────────────────────

export function validateSeller(s: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  const r = (s ?? {}) as Partial<SellerRecord>;
  if (r.kind !== "seller") issues.push({ field: "kind", message: 'must be "seller"' });
  if (!isNonEmptyString(r.id)) issues.push({ field: "id", message: "required" });
  if (!isNonEmptyString(r.name)) issues.push({ field: "name", message: "required" });
  issues.push(...validateMarket(r.market, ""));
  issues.push(...validateLifecycle(r, ""));
  issues.push(...validateProvenance(r.provenance, ""));
  if (!r.verification || !["unverified", "self_declared", "platform_verified", "government_verified"].includes(r.verification)) {
    issues.push({ field: "verification", message: 'required · unverified|self_declared|platform_verified|government_verified' });
  }
  if (!Array.isArray(r.categories) || r.categories.length === 0 || !r.categories.every((c) => typeof c === "string")) {
    issues.push({ field: "categories", message: "must be a non-empty string array" });
  }
  return { valid: issues.length === 0, issues };
}

// ─── Product ─────────────────────────────────────────────────────────

export function validateProduct(p: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  const r = (p ?? {}) as Partial<ProductRecord>;
  if (r.kind !== "product") issues.push({ field: "kind", message: 'must be "product"' });
  if (!isNonEmptyString(r.id)) issues.push({ field: "id", message: "required" });
  if (!isNonEmptyString(r.name)) issues.push({ field: "name", message: "required" });
  if (!isNonEmptyString(r.category)) issues.push({ field: "category", message: "required" });
  issues.push(...validateMarket(r.market, ""));
  issues.push(...validateLifecycle(r, ""));
  issues.push(...validateProvenance(r.provenance, ""));
  return { valid: issues.length === 0, issues };
}

// ─── Offer (structural only · FK validated separately) ──────────────

function validatePrice(p: unknown, prefix: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (p === null || p === undefined) return issues;
  const r = p as Partial<PriceInfo>;
  if (typeof r.amount !== "number" || !Number.isFinite(r.amount) || r.amount < 0) issues.push({ field: `${prefix}.amount`, message: "must be a non-negative number when price is present" });
  if (!r.currency || !["IDR", "USD", "SGD", "MYR", "AUD"].includes(r.currency)) issues.push({ field: `${prefix}.currency`, message: "must be one of IDR|USD|SGD|MYR|AUD" });
  if (!isNonEmptyString(r.unit)) issues.push({ field: `${prefix}.unit`, message: 'required · e.g. "each"' });
  if (!isNonEmptyString(r.observedAt)) issues.push({ field: `${prefix}.observedAt`, message: "required ISO date" });
  if (!isNonEmptyString(r.sourceKey)) issues.push({ field: `${prefix}.sourceKey`, message: "required · provenance for this price observation" });
  return issues;
}

function validateStock(s: unknown, prefix: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (s === null || s === undefined) return issues;
  const r = s as Partial<StockInfo>;
  if (!r.level || !["available", "limited", "out_of_stock", "unknown"].includes(r.level)) issues.push({ field: `${prefix}.level`, message: "must be available|limited|out_of_stock|unknown" });
  if (r.quantity !== undefined && (typeof r.quantity !== "number" || r.quantity < 0)) issues.push({ field: `${prefix}.quantity`, message: "when present, must be a non-negative integer" });
  if (!isNonEmptyString(r.observedAt)) issues.push({ field: `${prefix}.observedAt`, message: "required ISO date" });
  if (!isNonEmptyString(r.sourceKey)) issues.push({ field: `${prefix}.sourceKey`, message: "required · provenance for this stock observation" });
  return issues;
}

export function validateOffer(o: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  const r = (o ?? {}) as Partial<OfferRecord>;
  if (r.kind !== "offer") issues.push({ field: "kind", message: 'must be "offer"' });
  if (!isNonEmptyString(r.id)) issues.push({ field: "id", message: "required" });
  if (!isNonEmptyString(r.sellerId)) issues.push({ field: "sellerId", message: "required · FK to SellerRecord.id" });
  if (!isNonEmptyString(r.productId)) issues.push({ field: "productId", message: "required · FK to ProductRecord.id" });
  issues.push(...validateMarket(r.market, ""));
  issues.push(...validateLifecycle(r, ""));
  issues.push(...validateProvenance(r.provenance, ""));
  if (!r.status || !["active", "paused", "delisted", "unknown"].includes(r.status)) issues.push({ field: "status", message: "required · active|paused|delisted|unknown" });
  issues.push(...validatePrice(r.price, "price"));
  issues.push(...validateStock(r.stock, "stock"));
  return { valid: issues.length === 0, issues };
}

/** FK integrity check · offer must reference existing seller + product. */
export function validateOfferAgainst(
  o: OfferRecord,
  sellers: readonly SellerRecord[],
  products: readonly ProductRecord[],
): ValidationResult {
  const structural = validateOffer(o);
  if (!structural.valid) return structural;
  const issues: ValidationIssue[] = [];
  if (!sellers.some((s) => s.id === o.sellerId)) {
    issues.push({ field: "sellerId", message: `references unknown seller "${o.sellerId}"` });
  }
  if (!products.some((p) => p.id === o.productId)) {
    issues.push({ field: "productId", message: `references unknown product "${o.productId}"` });
  }
  // Market coherence · offer's market should match its seller when the
  // seller has a specific market (not UNIVERSAL/UNKNOWN).
  const seller = sellers.find((s) => s.id === o.sellerId);
  if (seller && seller.market !== "UNIVERSAL" && seller.market !== "UNKNOWN" && seller.market !== o.market) {
    issues.push({ field: "market", message: `offer market "${o.market}" does not match seller market "${seller.market}"` });
  }
  return { valid: issues.length === 0, issues };
}
