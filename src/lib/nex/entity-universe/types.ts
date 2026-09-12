// src/lib/nex/entity-universe/types.ts
//
// NEX Entity Universe · Indonesia-wide business/location/category model
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Agent Runtime Phase B
//
// GOVERNING PRINCIPLE (§1 · §2 · §3)
//   NEX Indonesia is ONE universe. A business has a stable identity
//   independent of its current location. It may move, expand, reopen,
//   or operate in multiple locations without losing that identity.
//
// LAYERS (does NOT touch existing schemas · §39)
//   BusinessIdentity     — the stable "who is this business?"
//   BusinessPlacement    — a physical/operational location of that business
//   CategoryAssignment   — what the business does at each placement
//   EvidenceRef          — WHY NEX believes any of the above is true
//   ChangeRecord         — every mutation appended, never overwritten (§11)
//
// COMPOSITION with existing NEX primitives
//   · BusinessPlacement.world_record_ref = WorldRecord.id (when the
//     placement corresponds to an existing accommodation/food/etc row).
//     This means the entity-universe layer ADDS multi-location grouping
//     on top of the existing single-location WorldRecord — no schema
//     change to accommodation_business.
//   · location.province_code = ISO 3166 code from data/indonesia/geo/provinces.json.
//   · location.city_slug     = canonical slug from accommodation-slots.ts
//     regex normalization (yogyakarta/jogja/jogjakarta → "yogyakarta").
//
// This file is PURE TYPES. No I/O. No fetch. No React. No DOM.

import type { WorldVertical } from "../brain/world-adapters/types";

// ── Identity aliases (permissive at Phase B · Phase C+ may formalise) ──

export type BusinessId = string;           // "biz_ID_<ulid>" · stable across relocations
export type PlacementId = string;          // "pmt_<ulid>" · unique per business+location+effective_from
export type EvidenceId = string;
export type ChangeId = string;
export type WorldRecordRef = string;       // matches WorldRecord.id
export type ProvinceCode = string;         // ISO 3166-2 · e.g. "ID-YO", "ID-JK"
export type CitySlug = string;             // matches accommodation-slots.ts canonical slug

// ── Location · references normalized Indonesian geo primitives ─────

export type Coordinates = {
  latitude: number;
  longitude: number;
  precision_m?: number | null;    // rough=1000, address-precise=10, unknown=null
};

export type LocationRef = {
  /** Canonical slug (from accommodation-slots.ts normalizer). Required
   *  for Indonesian locations. Foreign locations may use a raw string
   *  and skip province_code. */
  city_slug: CitySlug;
  /** ISO 3166-2 province code from data/indonesia/geo/provinces.json.
   *  Null when the city is not yet mapped to a province — never guess. */
  province_code: ProvinceCode | null;
  /** Free-text neighbourhood / district / area (optional). */
  area: string | null;
  /** Street-level address (optional). */
  address: string | null;
  coordinates: Coordinates | null;
};

// ── Category (§6 · first-class) ────────────────────────────────────
// Every discoverable placement has a category. The vocabulary is the
// existing WorldVertical + a broader per-vertical taxonomy (accommodation
// types, food kinds, service kinds, etc.). Phase B ships the shape;
// exhaustive taxonomies belong to per-vertical Phase C+ slices.

export type CategorySpecificity =
  | "VERTICAL_ONLY"          // e.g. just "food"
  | "SUB_CATEGORY_KNOWN"     // e.g. "food" + "restaurant"
  | "UNKNOWN_NEEDS_CLASSIFICATION";  // §6 · never invent a category

export type CategoryAssignment = {
  vertical: WorldVertical;
  /** Sub-category slug when known · e.g. "restaurant", "cafe", "hotel",
   *  "villa", "gym", "barber". Null when only vertical is known. */
  sub_category: string | null;
  /** Additional applicable sub-categories (§7 · CAFE + RESTAURANT). */
  additional_sub_categories: string[];
  specificity: CategorySpecificity;
  /** ISO timestamp when this category became effective. */
  effective_from_iso: string;
  /** Optional supersession — the placement's category evolved. Never
   *  overwritten (§7 §11). */
  superseded_at_iso: string | null;
  /** Evidence chain for this category assignment. */
  evidence_ids: EvidenceId[];
};

// ── Evidence (§10 · §11 · §22) ─────────────────────────────────────
// Every claim in the universe cites its evidence. Missing evidence
// means UNVERIFIED — never treated as FALSE.

export type EvidenceTier =
  | "OWNER_ATTESTED"        // owner claimed via NEX auth
  | "PRIMARY_SOURCE"        // official directory / municipal record
  | "SECONDARY_SOURCE"      // scraped listing (OSM, review site)
  | "OBSERVED"              // NEX worker directly observed
  | "USER_SUPPLIED"         // a customer told us
  | "INFERRED"              // reasoning-derived (weakest);
  | "UNKNOWN";

export type EvidenceRef = {
  evidence_id: EvidenceId;
  source_key: string;
  source_url: string | null;
  tier: EvidenceTier;
  observed_at_iso: string;
  /** Free-text extract of the underlying observation. Not verbatim
   *  quotes — kept for audit. */
  excerpt: string | null;
};

// ── Placement status (§4 · §5 · §13) ───────────────────────────────
// A placement's status describes its relationship to the business
// identity over time. Historical placements must never appear in
// customer-facing "current location" lookups (§4).

export type PlacementStatus =
  | "ACTIVE"           // current, verified operational
  | "STARTING"         // announced, not yet open
  | "HISTORICAL"       // was operational, business has moved
  | "CLOSED"           // permanently closed at this location
  | "PROVISIONAL"      // seen but not yet confirmed
  | "AMBIGUOUS"        // identity uncertain (§25 · never merge)
  | "CONFLICTING";     // two sources disagree

export type BusinessPlacement = {
  placement_id: PlacementId;
  business_id: BusinessId;

  /** Optional link to an existing WorldRecord (accommodation/food/etc.).
   *  Null when the placement is universe-native (no WorldRecord counterpart
   *  yet). */
  world_record_ref: WorldRecordRef | null;

  location: LocationRef;
  category: CategoryAssignment;

  /** Placement-level contact channels (§5 · each location may differ). */
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  email: string | null;
  opening_hours: string | null;

  status: PlacementStatus;

  /** Temporal · when this placement became active. */
  effective_from_iso: string;
  /** When it stopped being active (null = still active). */
  effective_to_iso: string | null;

  evidence_ids: EvidenceId[];
  registered_at_iso: string;
};

// ── Business identity (§2 · §3 · §13) ──────────────────────────────
// The stable "who is this business?" — survives movement/expansion.

export type BusinessIdentityConfidence =
  | "HIGH"       // strong evidence (owner-claimed / verified)
  | "MEDIUM"     // multiple secondary sources agree
  | "LOW"        // single weak source
  | "AMBIGUOUS"; // §10 · matching insufficient

export type BusinessIdentity = {
  business_id: BusinessId;

  /** Human-readable primary name. */
  name: string;
  /** Alternate names / trade names observed for the same identity.
   *  Never fabricated — only added when evidence is observed. */
  alternate_names: string[];

  identity_confidence: BusinessIdentityConfidence;

  /** Owner NEX identity when known · null otherwise. Never guess. */
  owner_nex_id: string | null;

  registered_at_iso: string;
  last_evidence_at_iso: string;
};

// ── Change record (§11 · §33 · no blind overwrite) ─────────────────
// Append-only audit trail. Any mutation to a business's attributes
// (name change, phone change, category change, location move) writes a
// ChangeRecord. Current value = latest change for that attribute.

export type ChangeSubject =
  | { kind: "business"; business_id: BusinessId }
  | { kind: "placement"; placement_id: PlacementId; business_id: BusinessId };

export type ChangeKind =
  | "ADDRESS_CHANGED"
  | "CATEGORY_CHANGED"
  | "PHONE_CHANGED"
  | "WHATSAPP_CHANGED"
  | "WEBSITE_CHANGED"
  | "EMAIL_CHANGED"
  | "OPENING_HOURS_CHANGED"
  | "STATUS_CHANGED"
  | "LOCATION_MOVED"
  | "NEW_LOCATION"
  | "LOCATION_CLOSED"
  | "NAME_CHANGED"
  | "ALTERNATE_NAME_ADDED";

export type ChangeRecord = {
  change_id: ChangeId;
  subject: ChangeSubject;
  kind: ChangeKind;
  /** Previous value — free-text stringified. Null when the attribute
   *  had no prior value (new attribute). */
  previous_value: string | null;
  new_value: string | null;
  /** Why did we make this change? Machine-readable reason. */
  change_reason: string;
  evidence_ids: EvidenceId[];
  /** Confidence in the new value overriding the old. When AMBIGUOUS,
   *  the change is recorded but the current value stays CONFLICTING. */
  confidence: "HIGH" | "MEDIUM" | "LOW" | "AMBIGUOUS";
  observed_at_iso: string;
};

// ── Freshness (§12 · attribute-specific windows) ───────────────────
// The system distinguishes CURRENT / STALE / UNKNOWN / CONFLICTING /
// UNVERIFIED / VERIFIED. Attribute-specific TTLs are defined here so
// downstream code has a single truth source.

export type AttributeFreshnessClass =
  | "STABLE_IDENTITY"    // business name, historical address · weeks-months
  | "STABLE_LOCATION"    // current address · days-weeks
  | "DYNAMIC_CAPABILITY" // opening status, phone · hours-days
  | "LIVE_STATUS";       // availability, promotions, current Live · minutes-hours

export type FreshnessRating =
  | "CURRENT"
  | "STALE"
  | "UNVERIFIED"
  | "CONFLICTING"
  | "UNKNOWN";

/** Default TTLs in milliseconds per class. Callers may override for
 *  domain-specific reasons but must never SILENTLY shorten them (§12
 *  no fabricated freshness). */
export const DEFAULT_FRESHNESS_TTL_MS: Record<AttributeFreshnessClass, number> = {
  STABLE_IDENTITY:    90  * 24 * 60 * 60 * 1000,   // 90 days
  STABLE_LOCATION:    30  * 24 * 60 * 60 * 1000,   // 30 days
  DYNAMIC_CAPABILITY:  7  * 24 * 60 * 60 * 1000,   //  7 days
  LIVE_STATUS:              15 * 60 * 1000,        // 15 minutes
};

export function rateFreshness(input: {
  klass: AttributeFreshnessClass;
  last_observed_iso: string | null;
  is_conflicting?: boolean;
  now_iso: string;
}): FreshnessRating {
  if (input.is_conflicting) return "CONFLICTING";
  if (!input.last_observed_iso) return "UNKNOWN";
  const observed = Date.parse(input.last_observed_iso);
  const now = Date.parse(input.now_iso);
  if (Number.isNaN(observed) || Number.isNaN(now)) return "UNKNOWN";
  const age = now - observed;
  const ttl = DEFAULT_FRESHNESS_TTL_MS[input.klass];
  return age <= ttl ? "CURRENT" : "STALE";
}
