// src/lib/nex/brain/business-context.ts
//
// NEX Business International Market Intelligence v1
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE · §1 §7 §11 §20 §22
//
// PURPOSE
//   Persistent business identity + product + market objective triad
//   that survives conversation turns. Storage: append-only JSONL
//   (same pattern as programmer-learning). No new DB migrations.
//
// BOUNDARY (§20)
//   Business data has explicit ownership. Only the owning business_id
//   may mutate its own records. NEX-generated market intelligence
//   NEVER auto-mutates business facts (§20 · §22).
//
// EVIDENCE DISCIPLINE (§21)
//   Every field carries a state: KNOWN_YES · UNKNOWN · UNVERIFIED ·
//   CONFLICTING · STALE. Absence of evidence NEVER becomes false.

import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// ─── Types ──────────────────────────────────────────────────────

/** Common attribute state (mirrors entity-attribute-contract 6-value). */
export type BusinessAttributeState =
  | "KNOWN_YES"
  | "UNKNOWN"
  | "UNVERIFIED"
  | "CONFLICTING"
  | "STALE";

/** Every stored field carries source + tier + timestamp + confidence. */
export type BusinessProvenance = {
  source: string;
  source_type: "owner_stated" | "authorised_document" | "public_source" | "internal_artifact" | "unknown";
  source_url?: string | null;
  retrieved_at: string;
  authority_tier: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4" | "TIER_5";
  confidence: number;
  ownership: "business_authorised" | "external_evidence" | "nex_analysis";
};

/** Business identity — the owning entity. */
export type BusinessIdentity = {
  business_id: string;
  legal_name: string;
  display_name: string;
  country: string;
  registered_address?: string | null;
  website?: string | null;
  business_type?: string | null;
  industry?: string | null;
  description?: string | null;
  logo_ref?: string | null;
  contact_channels: BusinessContactChannel[];
  provenance: BusinessProvenance;
  created_at: string;
  updated_at: string;
};

/** A single business contact channel · authorised by the business. */
export type BusinessContactChannel = {
  channel_type: "email" | "phone" | "whatsapp" | "website" | "other";
  channel_value: string;
  is_public: boolean;
  provenance: BusinessProvenance;
};

/** A product / service owned by the business. Never fabricated. */
export type BusinessProduct = {
  product_id: string;
  business_id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  target_markets?: string[];
  attributes: Record<string, {
    value: string | number | boolean | null;
    state: BusinessAttributeState;
    provenance: BusinessProvenance;
  }>;
  provenance: BusinessProvenance;
  created_at: string;
};

/** A commercial market objective — WHAT the business is looking for. */
export type MarketObjective = {
  objective_id: string;
  business_id: string;
  objective_kind: "FIND_BUYERS" | "FIND_IMPORTERS" | "FIND_DISTRIBUTORS"
                  | "FIND_RETAILERS" | "FIND_WHOLESALERS" | "FIND_SUPPLIERS"
                  | "FIND_MANUFACTURERS" | "FIND_PARTNERS" | "FIND_MARKET_OPPORTUNITIES"
                  | "FIND_POTENTIAL_CUSTOMERS";
  target_market: string;                  // country / region
  target_industry?: string | null;
  product_ids: string[];                  // which products the objective applies to
  notes?: string | null;
  provenance: BusinessProvenance;
  created_at: string;
};

/** Composite context passed to the conversation layer. */
export type BusinessContext = {
  identity: BusinessIdentity;
  products: BusinessProduct[];
  active_objective: MarketObjective | null;
  objectives: MarketObjective[];
};

// ─── Storage layout ────────────────────────────────────────────

export function nexBusinessDir(): string {
  const override = process.env.NEX_BUSINESS_DIR;
  if (override && override.trim().length > 0) return override;
  return path.resolve(process.cwd(), "data", "nex-business");
}

class ForbiddenBusinessWrite extends Error {
  constructor(target: string) { super(`nex-business forbidden write: ${target}`); }
}

function pathFor(filename: string): string {
  const root = nexBusinessDir();
  const p = path.resolve(root, filename);
  if (!p.startsWith(root + path.sep) && p !== root) {
    throw new ForbiddenBusinessWrite(p);
  }
  return p;
}

function ensureDir(): void {
  const dir = nexBusinessDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const IDENTITY_FILE   = "business_identities.jsonl";
const PRODUCT_FILE    = "business_products.jsonl";
const OBJECTIVE_FILE  = "business_objectives.jsonl";

// ─── Persistence · append-only JSONL ───────────────────────────

function readLines<T>(filename: string): T[] {
  const p = pathFor(filename);
  if (!existsSync(p)) return [];
  const raw = readFileSync(p, "utf8");
  const out: T[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try { out.push(JSON.parse(trimmed) as T); }
    catch { /* skip malformed */ }
  }
  return out;
}

function appendLine(filename: string, record: unknown): void {
  ensureDir();
  appendFileSync(pathFor(filename), JSON.stringify(record) + "\n", "utf8");
}

// ─── Public API ────────────────────────────────────────────────

/** Generate a stable business_id from legal_name + country. Deterministic
 *  so the same input yields the same id on repeat submissions. */
export function computeBusinessId(input: { legal_name: string; country: string }): string {
  const canonical = `${input.legal_name.trim().toUpperCase()}|${input.country.trim().toUpperCase()}`;
  return "biz_" + createHash("sha256").update(canonical).digest("hex").slice(0, 20);
}

/** Persist a business identity. Duplicate `business_id` throws · use
 *  updateBusinessIdentity for edits (which itself just appends a new
 *  record — history preserved). */
export function persistBusinessIdentity(identity: BusinessIdentity): void {
  const priors = listBusinessIdentities();
  if (priors.some((p) => p.business_id === identity.business_id && p.updated_at === identity.updated_at)) {
    throw new Error(`business_identity_duplicate:${identity.business_id}:${identity.updated_at}`);
  }
  appendLine(IDENTITY_FILE, identity);
}

/** Return the LATEST identity record per business_id. Older records
 *  remain in the store as history. */
export function listBusinessIdentities(): BusinessIdentity[] {
  const raw = readLines<BusinessIdentity>(IDENTITY_FILE);
  const latest = new Map<string, BusinessIdentity>();
  for (const r of raw) {
    const prev = latest.get(r.business_id);
    if (!prev || r.updated_at > prev.updated_at) latest.set(r.business_id, r);
  }
  return [...latest.values()];
}

export function getBusinessIdentity(business_id: string): BusinessIdentity | null {
  return listBusinessIdentities().find((b) => b.business_id === business_id) ?? null;
}

/** Persist a product. Owner-only enforcement: caller must supply the
 *  authorised business_id · the product's business_id must match. */
export function persistBusinessProduct(product: BusinessProduct, authorised_business_id: string): void {
  if (product.business_id !== authorised_business_id) {
    throw new Error(`unauthorised_product_write:${product.business_id}:by:${authorised_business_id}`);
  }
  appendLine(PRODUCT_FILE, product);
}

export function listBusinessProducts(business_id: string): BusinessProduct[] {
  const raw = readLines<BusinessProduct>(PRODUCT_FILE);
  // Latest per product_id, filtered by business_id
  const latest = new Map<string, BusinessProduct>();
  for (const r of raw) {
    if (r.business_id !== business_id) continue;
    const prev = latest.get(r.product_id);
    if (!prev || r.created_at > prev.created_at) latest.set(r.product_id, r);
  }
  return [...latest.values()];
}

/** Persist a market objective. Owner-only. */
export function persistMarketObjective(objective: MarketObjective, authorised_business_id: string): void {
  if (objective.business_id !== authorised_business_id) {
    throw new Error(`unauthorised_objective_write:${objective.business_id}:by:${authorised_business_id}`);
  }
  appendLine(OBJECTIVE_FILE, objective);
}

export function listMarketObjectives(business_id: string): MarketObjective[] {
  const raw = readLines<MarketObjective>(OBJECTIVE_FILE);
  return raw.filter((o) => o.business_id === business_id);
}

/** Compose the full BusinessContext for a given business_id. Returns
 *  null when the business does not exist. */
export function loadBusinessContext(business_id: string, active_objective_id?: string): BusinessContext | null {
  const identity = getBusinessIdentity(business_id);
  if (!identity) return null;
  const products = listBusinessProducts(business_id);
  const objectives = listMarketObjectives(business_id);
  const active_objective = active_objective_id
    ? objectives.find((o) => o.objective_id === active_objective_id) ?? null
    : (objectives[objectives.length - 1] ?? null);
  return { identity, products, active_objective, objectives };
}

// ─── Convenience: seed helper for fixture-time onboarding ──────

export function createIdentityFromInput(input: {
  legal_name: string;
  display_name?: string;
  country: string;
  registered_address?: string;
  website?: string;
  business_type?: string;
  industry?: string;
  description?: string;
  contact_channels?: BusinessContactChannel[];
  source: string;
  source_type?: BusinessProvenance["source_type"];
  source_url?: string;
  now?: () => string;
}): BusinessIdentity {
  const now = input.now ?? (() => new Date().toISOString());
  const ts = now();
  const business_id = computeBusinessId({ legal_name: input.legal_name, country: input.country });
  return {
    business_id,
    legal_name: input.legal_name,
    display_name: input.display_name ?? input.legal_name,
    country: input.country,
    registered_address: input.registered_address ?? null,
    website: input.website ?? null,
    business_type: input.business_type ?? null,
    industry: input.industry ?? null,
    description: input.description ?? null,
    logo_ref: null,
    contact_channels: input.contact_channels ?? [],
    provenance: {
      source: input.source,
      source_type: input.source_type ?? "authorised_document",
      source_url: input.source_url ?? null,
      retrieved_at: ts,
      authority_tier: "TIER_1",
      confidence: 0.95,
      ownership: "business_authorised",
    },
    created_at: ts,
    updated_at: ts,
  };
}

// ─── Test-only reset ──────────────────────────────────────────

export function _resetBusinessStoreForTests(): void {
  ensureDir();
  for (const f of [IDENTITY_FILE, PRODUCT_FILE, OBJECTIVE_FILE]) {
    writeFileSync(pathFor(f), "", "utf8");
  }
}

export { ForbiddenBusinessWrite };
