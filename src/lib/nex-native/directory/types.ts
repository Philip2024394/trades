// src/lib/nex-native/directory/types.ts
//
// NEX Directory · Phase B · Canonical Read Contract · types.
//
// What this module is
//   · The typed Directory view-model contract (DirectoryListingVM) that
//     the eventual Directory UI (Phase A) will consume.
//   · The typed input row (DirectoryCanonicalRow) that reflects the
//     SELECT shape against nex.business_canonical (migration 167).
//   · The optional media attachment contract (DirectoryListingMedia)
//     that a future media resolver (post-migration 173) will provide.
//   · Enum re-exports from the sealed scripts/nex-canonical/* modules
//     so the Directory and the canonical pipeline share one definition.
//
// What this module is NOT
//   · Not a database model — the canonical row IS the Directory
//     listing. This module only reflects columns that already exist in
//     migration 167 and adds view-model fields that are explicit
//     projections of those columns.
//   · Not a resolver — classification is a pure derivation of the
//     sealed 9-value entity_type enum; it is not an identity match.
//   · Not a destination resolver — Phase C answers "where does this
//     canonical entity go inside NEX?" This module provides the
//     information Phase C needs; it does not route.
//   · Not a service — no DB access, no network, no filesystem.
//
// Architectural invariants
//   · Missing data stays missing. Nullable columns in migration 167
//     project to nullable fields in DirectoryListingVM. The projector
//     NEVER substitutes a fabricated default.
//   · Readonly fields on the VM — the Directory layer is read-only.
//   · Enum types imported from the sealed canonical-pipeline source
//     so Directory and ingestion share one truth.
//
// Reflection discipline
//   · If migration 167 ever adds a column that the Directory needs,
//     this file may add it as a reflection ONLY (same discipline as
//     scripts/nex-canonical/canonical-row.ts).
//   · If migration 167 ever renames or removes a column, the Directory
//     types + projector must be updated in the same wave.

import type { EntityType } from "../../../../scripts/nex-canonical/generate-candidates";
import type { LifecycleState } from "../../../../scripts/nex-canonical/canonical-row";

export type { EntityType, LifecycleState };

// ═════════════════════════════════════════════════════════════════════
// §1 · Classification · derived from entity_type
// ═════════════════════════════════════════════════════════════════════

/**
 * How the Directory treats a canonical entity's real-world kind.
 *
 *   business — place- or legal-entity-oriented commercial listing
 *              (owner-claimable; destination = NEX Business / face-cover)
 *   person   — natural-person-oriented listing with the offering being
 *              that person's expertise or service (destination = NEX
 *              user profile; owner-claim creates the account)
 *   place    — public or semi-public location of cultural / natural /
 *              civic significance, not primarily a claimable business
 *              (destination = read-only Directory detail only; no claim)
 *
 * This is a Directory-presentation concern — not a canonical identity
 * concern. The canonical identity-class is entity_type (sealed 9 values).
 */
export type DirectoryClassification = "business" | "person" | "place";

// ═════════════════════════════════════════════════════════════════════
// §2 · Coordinates · WGS84 lat/lng · never fabricated
// ═════════════════════════════════════════════════════════════════════

/**
 * WGS84 coordinates in the shape the rest of NEX uses (same lat/lng
 * decomposition as nex_business.location_lat / location_lng · see
 * src/lib/nex-native/types.ts). The canonical table stores
 * `coordinates geography(Point, 4326)` and the sealed TS reflection
 * at scripts/nex-canonical/canonical-row.ts already decomposes it
 * into { lat, lng } · the Directory consumes the same shape.
 *
 * NULL coordinates mean the canonical row has no known location. The
 * Directory must not substitute city-centre coordinates, country-level
 * coordinates, or any other proxy. "No coordinates" is a truthful
 * state and the Directory UI must render that honestly (omit distance,
 * omit map pin, omit "near me" eligibility).
 */
export interface DirectoryCoordinates {
  readonly lat: number;
  readonly lng: number;
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Primary image · nullable · never fabricated
// ═════════════════════════════════════════════════════════════════════

/**
 * A real image reference carried on a Directory listing.
 *
 *   url      — the actual URL that will render as the listing's
 *              primary image. Never a placeholder, never a stock
 *              image, never a default.
 *   altText  — accessibility text. The projector falls back to the
 *              listing's canonical name when alt text is not
 *              separately provided; this is a visual-accessibility
 *              decision, not a fabrication of unknown content.
 *   sourceId — which `nex.source_registry` row provided the image,
 *              so the Directory can honour that source's attribution
 *              requirement. NULL means the attribution requirement
 *              is "none" or source-of-record is not applicable
 *              (e.g. an owner upload where attribution is implicit).
 *
 * ARCHITECTURAL GAP (reported in Phase B completion report):
 *   The sealed `nex.business_media` table (migration 173) has not
 *   been authored yet. No canonical row can currently carry a
 *   primary image. The projector therefore returns `primaryImage:
 *   null` for every row today. The media-attachment shape is defined
 *   here so Phase A / future media work can slot in without a
 *   contract break.
 */
export interface DirectoryImage {
  readonly url: string;
  readonly altText: string;
  readonly sourceId: string | null;
}

/**
 * Optional media attachment the projector consumes when a media
 * resolver is wired in (post-migration 173). Today the service layer
 * always passes `null` and the VM's primaryImage is null.
 */
export interface DirectoryListingMedia {
  readonly primaryImage: DirectoryImage | null;
}

// ═════════════════════════════════════════════════════════════════════
// §4 · DirectoryCanonicalRow · the projector's input shape
// ═════════════════════════════════════════════════════════════════════

/**
 * The SELECT shape over `nex.business_canonical` that the Directory
 * read path consumes. Mirrors every column migration 167 defines that
 * Phase B projects into the VM.
 *
 * This is a SUPERSET of `scripts/nex-canonical/canonical-row.ts`'s
 * `CanonicalRow` — the sealed canonical module omits
 * `category_ids` / `services_products` / `address` by design (they
 * are not identity signals for the resolver / handoff precheck).
 * The Directory read path NEEDS those columns because they are
 * presentation signals. This module declares them explicitly.
 *
 * Nullability mirrors migration 167 (ck_bc_* checks).
 */
export interface DirectoryCanonicalRow {
  readonly canonical_business_id: string;        // uuid · PK
  readonly entity_type: EntityType;              // sealed 9-value enum
  readonly country: string;                      // ISO 3166-1 alpha-2
  readonly lifecycle_state: LifecycleState;      // sealed 7-value enum
  readonly name_canonical: string;               // NOT NULL · trim > 0
  readonly aliases: readonly string[];           // default '{}' · never NULL
  readonly phone_e164: string | null;            // E.164 enforced by CHECK
  readonly website_apex: string | null;
  readonly osm_id: string | null;                // e.g. "node/12345"
  readonly wikidata_qid: string | null;          // Q[0-9]+ enforced by CHECK
  readonly city: string | null;
  readonly district: string | null;
  readonly coordinates: DirectoryCoordinates | null;
  readonly category_ids: readonly string[];     // default '{}' · public taxonomy slot
  readonly services_products: unknown | null;   // jsonb · per entity_type · null today
  readonly supersedes_business_id: string | null;      // self-FK
  readonly superseded_by_business_id: string | null;   // self-FK
  readonly last_verified_at: string | null;            // ISO-8601
}

// ═════════════════════════════════════════════════════════════════════
// §5 · DirectoryListingVM · the Directory UI's read contract
// ═════════════════════════════════════════════════════════════════════

/**
 * The typed view-model one Directory listing renders from. Every field
 * is a pure projection of a canonical column (or a pure derivation of
 * one, like `classification`). Nothing is fabricated.
 *
 * Phase C destination resolution reads:
 *   · entityType          · to decide business / person / place routing
 *   · classification      · the pre-computed routing hint
 *   · lifecycleState      · OWNER_CLAIMED → owner's existing cover;
 *                           SUPERSEDED → redirect via supersededByBusinessId;
 *                           DISCOVERED / ENRICHED / VERIFIED → claim-this-listing
 *   · supersededByBusinessId · redirect target for SUPERSEDED rows
 *   · osmId / wikidataQid · optional deep-link anchors
 *   · phoneE164 / websiteApex · owner-claim verification inputs
 *
 * Phase A directory UI reads:
 *   · name / aliases / city / district / country
 *   · categoryIds · public taxonomy chips
 *   · coordinates · map pin + distance calculation when user has
 *                   genuine geolocation (never Yogyakarta default)
 *   · primaryImage · null today · will populate when migration 173 lands
 *   · verticalPayload · per-entity-type presentation payload · null
 *                        today for every row (jsonb unseeded)
 *   · lastVerifiedAt · freshness chip
 */
export interface DirectoryListingVM {
  readonly canonicalBusinessId: string;
  readonly entityType: EntityType;
  readonly classification: DirectoryClassification;
  readonly lifecycleState: LifecycleState;

  readonly name: string;
  readonly aliases: readonly string[];

  readonly country: string;
  readonly city: string | null;
  readonly district: string | null;
  readonly coordinates: DirectoryCoordinates | null;

  readonly phoneE164: string | null;
  readonly websiteApex: string | null;

  readonly osmId: string | null;
  readonly wikidataQid: string | null;

  readonly categoryIds: readonly string[];
  readonly verticalPayload: unknown | null;

  readonly primaryImage: DirectoryImage | null;

  readonly lastVerifiedAt: string | null;

  readonly supersedesBusinessId: string | null;
  readonly supersededByBusinessId: string | null;
}

// ═════════════════════════════════════════════════════════════════════
// §6 · Static invariants · module-level
// ═════════════════════════════════════════════════════════════════════
//
// This module is PURE types. It:
//   · does NOT read the DB
//   · does NOT contain any runtime value
//   · imports only type-level symbols from the sealed canonical
//     pipeline (EntityType, LifecycleState)
//   · does NOT re-define the sealed enums
//
// If a future wave needs to add a column reflection, the discipline is:
//   1. The column exists in migration 167 (or a successor migration)
//   2. The DB CHECK semantics are mirrored in the TS nullability
//   3. The VM field is a pure projection — never a fabricated default
//   4. The projector test suite gains a permutation case for the new field
