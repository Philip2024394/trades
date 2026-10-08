// scripts/nex-canonical/canonical-row.ts
//
// NEX Canonical · TypeScript reflection of `nex.business_canonical`
// (migration 167) + resolver-input projection.
//
// IMPORTANT · what this module IS and IS NOT
//   · IS a TypeScript reflection of columns that already exist in
//     migration 167. Field names and nullability mirror the SQL.
//   · IS a projection function `projectCanonicalRowForResolver` that
//     exposes only identity signals a future Layer-B resolver would
//     consume.
//   · IS a pure utility · no DB, no network, no filesystem, no clock,
//     no randomness.
//   · IS NOT a new canonical schema. The source of truth is migration
//     167; this file reflects it in TypeScript, nothing more.
//   · IS NOT a replacement for `nex.business_canonical`.
//   · IS NOT the pre-existing `src/lib/nex/entity-universe/*` layer.
//     That layer uses its own `BusinessIdentity`/`BusinessPlacement`
//     model and remains out of scope.
//   · IS NOT a resolver. Scoring, matching, verdicts live elsewhere.
//
// Reflection discipline
//   · If migration 167 ever adds a column, this file may add the field
//     as a reflection ONLY. It must not add fields the DB does not have.
//   · If migration 167 ever renames a column, this file must rename to
//     match.
//   · This file does not introduce lifecycle semantics beyond the 7
//     sealed states that already live in the migration 167 CHECK.

import type { EntityType } from "./generate-candidates";

// ═════════════════════════════════════════════════════════════════════
// §1 · Lifecycle enum (reflecting migration 167 ck_bc_lifecycle_state)
// ═════════════════════════════════════════════════════════════════════

export type LifecycleState =
  | "DISCOVERED"
  | "ENRICHED"
  | "VERIFIED"
  | "OWNER_CLAIMED"
  | "OWNER_VERIFIED"
  | "DORMANT"
  | "SUPERSEDED";

/** All 7 lifecycle states, in sealed order. Must stay byte-for-byte
 *  consistent with the CHECK constraint `ck_bc_lifecycle_state` in
 *  migration 167. */
export const SEALED_LIFECYCLE_STATES: readonly LifecycleState[] = [
  "DISCOVERED",
  "ENRICHED",
  "VERIFIED",
  "OWNER_CLAIMED",
  "OWNER_VERIFIED",
  "DORMANT",
  "SUPERSEDED",
] as const;

/** The subset of lifecycle states that permit a canonical row to
 *  accept additional evidence (be a MATCH-merge target). `DORMANT` and
 *  `SUPERSEDED` are explicitly excluded · a superseded row has already
 *  handed its truth to another row, and a dormant row is signalling
 *  "do not enrich." */
export const WRITABLE_LIFECYCLE_STATES: readonly LifecycleState[] = [
  "DISCOVERED",
  "ENRICHED",
  "VERIFIED",
  "OWNER_CLAIMED",
  "OWNER_VERIFIED",
] as const;

/** Pure guard · returns true iff a canonical row in this state may
 *  receive additional evidence. */
export function isLifecycleWritable(state: LifecycleState): boolean {
  return WRITABLE_LIFECYCLE_STATES.includes(state);
}

// ═════════════════════════════════════════════════════════════════════
// §2 · CanonicalRow · minimal reflection of migration 167 columns
// ═════════════════════════════════════════════════════════════════════

/**
 * Minimal TypeScript reflection of a `nex.business_canonical` row.
 *
 * This is NOT a new schema. It mirrors columns from migration 167.
 * Columns not needed by the handoff precheck (`services_products` jsonb,
 * `address` jsonb, `category_ids` text[], `created_at`, `updated_at`)
 * are deliberately omitted · callers that need them must query the DB
 * directly or add them to a different reflection module.
 */
export interface CanonicalRow {
  readonly canonical_business_id: string;        // uuid · PK
  readonly entity_type: EntityType;              // sealed 9-value enum
  readonly country: string;                      // ISO 3166-1 alpha-2
  readonly lifecycle_state: LifecycleState;      // sealed 7-value enum
  readonly name_canonical: string;
  readonly name_norm: string;                    // GENERATED STORED in DB
  readonly aliases: readonly string[];
  readonly phone_e164: string | null;            // E.164 enforced by DB CHECK
  readonly website_apex: string | null;
  readonly osm_id: string | null;                // e.g. "node/12345"
  readonly wikidata_qid: string | null;          // Q[0-9]+ enforced by DB CHECK
  readonly city: string | null;
  readonly district: string | null;
  readonly coordinates: {
    readonly lat: number;
    readonly lng: number;
  } | null;
  readonly supersedes_business_id: string | null;      // self-FK
  readonly superseded_by_business_id: string | null;   // self-FK
  readonly last_verified_at: string | null;            // ISO-8601
}

// ═════════════════════════════════════════════════════════════════════
// §3 · CanonicalResolverInput · the projection a resolver would see
// ═════════════════════════════════════════════════════════════════════

/**
 * The subset of a canonical row that a future Layer-B resolver would
 * consume as its candidate-pool input. Deliberately smaller than
 * CanonicalRow · lifecycle state, supersession graph, and
 * last_verified_at are NOT identity signals and are excluded from the
 * resolver surface.
 */
export interface CanonicalResolverInput {
  readonly canonical_business_id: string;
  readonly entity_type: EntityType;
  readonly country: string;
  readonly name_canonical: string;
  readonly name_norm: string;
  readonly aliases: readonly string[];
  readonly phone_e164: string | null;
  readonly website_apex: string | null;
  readonly osm_id: string | null;
  readonly wikidata_qid: string | null;
  readonly city: string | null;
  readonly coordinates: {
    readonly lat: number;
    readonly lng: number;
  } | null;
}

/**
 * Pure projection · returns the resolver-input view of a canonical row.
 * Deterministic. Does not mutate its input. Does not read the DB. Does
 * not perform matching, scoring, or any form of resolution.
 */
export function projectCanonicalRowForResolver(
  row: CanonicalRow,
): CanonicalResolverInput {
  return {
    canonical_business_id: row.canonical_business_id,
    entity_type: row.entity_type,
    country: row.country,
    name_canonical: row.name_canonical,
    name_norm: row.name_norm,
    aliases: row.aliases,
    phone_e164: row.phone_e164,
    website_apex: row.website_apex,
    osm_id: row.osm_id,
    wikidata_qid: row.wikidata_qid,
    city: row.city,
    coordinates: row.coordinates,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Static invariants · module-level
// ═════════════════════════════════════════════════════════════════════
//
// This module is PURE. It:
//   · does NOT read the DB
//   · does NOT perform matching, scoring, or resolution
//   · does NOT write anything
//   · does NOT modify `src/lib/nex/entity-universe/*`
//   · imports only `type EntityType` from `./generate-candidates`
//     (TYPE-only · no runtime value)
//
// If migration 167's lifecycle CHECK ever changes, `SEALED_LIFECYCLE_STATES`
// must be updated in lock-step. The project convention is that this
// file is the only authorized TypeScript reflection of the migration
// 167 enums (apart from `generate-candidates.ts`'s SEALED_ENTITY_TYPES).
