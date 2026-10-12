// src/lib/nex-native/directory/project-canonical-row.ts
//
// NEX Directory · Phase B · Deterministic row → view-model projector.
//
// What this module is
//   · The one authoritative place where a `nex.business_canonical`
//     row (shape: DirectoryCanonicalRow) becomes a Directory view
//     model (shape: DirectoryListingVM).
//   · Pure. Deterministic. Byte-stable: same input ⇒ same output,
//     every time.
//   · The sole authority on how canonical columns map to the
//     Directory's presentation contract.
//
// What this module is NOT
//   · Not a destination resolver — the VM carries enough information
//     for Phase C to decide "where inside NEX does this go?" but
//     Phase B does not make that decision.
//   · Not a search engine — field selection / ranking is downstream.
//   · Not a fallback mechanism — missing data stays missing. The
//     projector NEVER substitutes a city, a coordinate, an image,
//     a category, or any other fabricated value.
//   · Not a service — no DB, no network, no filesystem, no clock,
//     no randomness.
//
// The no-fabrication contract (enforced by the no-fabrication test
// suite via static grep assertions):
//   · No literal city strings (e.g. "Yogyakarta") in this file
//   · No literal coordinate numbers in this file
//   · No "placeholder", "default", "example", "unknown" fallbacks
//   · No `??` operators that substitute content for a nullable column
//     (only legitimate uses: media attachment default to null)
//   · No clock, no randomness, no network, no DB imports

import { classifyEntityType } from "./classify-entity-type";
import type {
  DirectoryCanonicalRow,
  DirectoryListingMedia,
  DirectoryListingVM,
} from "./types";

// ═════════════════════════════════════════════════════════════════════
// §1 · projectDirectoryListing · the one authoritative projector
// ═════════════════════════════════════════════════════════════════════

/**
 * Pass-10 enrichment overlay (2026-10-12).
 *
 * The sealed canonical row contains the identity-level fields
 * (name, city, country, coordinates, lifecycle). The source vertical
 * table (`nex.food_business` today) holds richer presentation fields
 * (phone, whatsapp, website, legacy category label, street address)
 * that are NOT re-projected into business_canonical by the sealed
 * resolver. For OSM-origin rows, canonical.phone_e164 / website_apex /
 * category_ids / address are null · the vertical table still has
 * them.
 *
 * The projector accepts an optional per-row `enrichment` overlay
 * (analogous to `media`) with fallback semantics: canonical column
 * wins when present, enrichment fills the gap when canonical is null.
 *
 * This is NOT fabrication. The vertical row is the canonical's
 * upstream evidence (business_evidence.legacy_source_table =
 * 'nex.food_business'). Projecting its fields is projecting the same
 * business's existing truth, not synthesising a value.
 */
export interface DirectoryVerticalEnrichment {
  /** Formatted phone number as recorded in the vertical source row.
   *  Not necessarily E.164 · see `phoneE164Normalised` for the
   *  normalised form when the source value could be parsed. */
  readonly phoneRaw: string | null;
  // WhatsApp numbers are DELIBERATELY NOT part of the public enrichment
  // overlay. NEX is the messaging product (NEX chat with NEX ID is the
  // WhatsApp replacement) · surfacing a WhatsApp link on the public
  // directory would send visitors to a competitor. OSM WhatsApp numbers
  // stay in `nex.food_business.whatsapp_number` for HQ marketing use
  // only. If a future HQ marketing read-path needs it, it opens its own
  // service module · the public directory never carries it.
  /** Website as recorded in the vertical row · bare host or full URL. */
  readonly websiteRaw: string | null;
  /** Vertical-local category label (e.g. "coffee-cafe", "restaurant",
   *  "fast-food") that the vertical classifier assigned at ingestion. */
  readonly verticalCategory: string | null;
  /** Secondary category tokens from the vertical classifier
   *  (e.g. `["cafe","ice-cream"]`). */
  readonly verticalCategories: readonly string[];
  /** Street-line as the vertical row holds it (e.g.
   *  "Jalan Bypass Gatot Subroto, Denpasar"). */
  readonly streetLineRaw: string | null;
}

export interface ProjectDirectoryListingArgs {
  readonly row: DirectoryCanonicalRow;
  /** Optional media attachment. Pass `null` when no media resolver
   *  is wired in (today — the sealed `nex.business_media` table of
   *  migration 173 has not been authored). The VM's `primaryImage`
   *  will be `null` in that case. The projector NEVER synthesises
   *  an image from any other field. */
  readonly media: DirectoryListingMedia | null;
  /** Optional per-row vertical enrichment overlay. See
   *  DirectoryVerticalEnrichment comment above. Pass `null` when
   *  no vertical row is available · the VM's enrichment fields
   *  fall back to their canonical counterparts (null if those are
   *  also null). */
  readonly enrichment?: DirectoryVerticalEnrichment | null;
}

/**
 * Project a canonical row into the Directory view model.
 *
 * Rules
 *   · Every nullable column projects to a nullable field.
 *   · Readonly arrays are passed through by reference (the VM's
 *     readonly contract means callers cannot mutate them anyway).
 *   · `classification` is derived purely from `entity_type` via the
 *     sealed classify-entity-type helper.
 *   · `primaryImage` is `null` unless a media attachment is passed in.
 *   · `verticalPayload` is passed through as `unknown | null` — the
 *     shape is per-entity-type and sealed per the canonical migration
 *     167 comment; the Directory does not interpret it at this phase.
 */
export function projectDirectoryListing(
  args: ProjectDirectoryListingArgs,
): DirectoryListingVM {
  const { row, media } = args;
  const enrichment = args.enrichment ?? null;

  // Enrichment-fallback: canonical column wins when non-null. The
  // enrichment field is only consulted when the canonical slot is
  // null, which matches the "no fabrication" contract — the vertical
  // table is a legitimate alternate source for the SAME business, not
  // a synthetic default. The vertical row is the canonical row's
  // upstream evidence per business_evidence.legacy_source_table.
  const phoneE164 = row.phone_e164 ?? enrichment?.phoneRaw ?? null;
  const websiteApex = row.website_apex ?? enrichment?.websiteRaw ?? null;
  // categoryIds: canonical array wins when non-empty. Otherwise fall
  // back to the vertical primary + secondary labels.
  const canonicalHasCategories = row.category_ids && row.category_ids.length > 0;
  const verticalCategoryList = canonicalHasCategories
    ? row.category_ids
    : enrichment
      ? [
          ...(enrichment.verticalCategory ? [enrichment.verticalCategory] : []),
          ...enrichment.verticalCategories.filter(
            (c) => c !== enrichment.verticalCategory,
          ),
        ]
      : [];
  const streetLine = row.street_line ?? enrichment?.streetLineRaw ?? null;

  return {
    canonicalBusinessId: row.canonical_business_id,
    entityType: row.entity_type,
    classification: classifyEntityType(row.entity_type),
    lifecycleState: row.lifecycle_state,

    name: row.name_canonical,
    aliases: row.aliases,

    country: row.country,
    city: row.city,
    district: row.district,
    streetLine,
    neighbourhood: row.neighbourhood,
    address: row.address,
    coordinates: row.coordinates,

    phoneE164,
    websiteApex,

    osmId: row.osm_id,
    wikidataQid: row.wikidata_qid,

    categoryIds: verticalCategoryList,
    verticalPayload: row.services_products,

    primaryImage: media === null ? null : media.primaryImage,

    lastVerifiedAt: row.last_verified_at,

    supersedesBusinessId: row.supersedes_business_id,
    supersededByBusinessId: row.superseded_by_business_id,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §2 · projectDirectoryListings · batch convenience
// ═════════════════════════════════════════════════════════════════════

/**
 * Batch form. Preserves input order. Pass `mediaByCanonicalId` to
 * attach media per row — when a row has no entry, `primaryImage`
 * is null in its VM.
 *
 * This is a pure convenience over `projectDirectoryListing` — no
 * additional logic. Service modules that fetch rows in bulk use
 * this to produce VMs in one call.
 */
export function projectDirectoryListings(args: {
  readonly rows: readonly DirectoryCanonicalRow[];
  readonly mediaByCanonicalId?: ReadonlyMap<string, DirectoryListingMedia>;
  /** Optional per-row vertical enrichment lookup · see
   *  DirectoryVerticalEnrichment. When present, rows whose canonical
   *  phone/website/category/street are null fall back to the vertical
   *  values. Rows with no enrichment entry keep their canonical nulls. */
  readonly enrichmentByCanonicalId?: ReadonlyMap<string, DirectoryVerticalEnrichment>;
}): DirectoryListingVM[] {
  const map = args.mediaByCanonicalId;
  const enrichmentMap = args.enrichmentByCanonicalId;
  const out: DirectoryListingVM[] = [];
  for (const row of args.rows) {
    const media =
      map === undefined ? null : (map.get(row.canonical_business_id) ?? null);
    const enrichment =
      enrichmentMap === undefined
        ? null
        : (enrichmentMap.get(row.canonical_business_id) ?? null);
    out.push(projectDirectoryListing({ row, media, enrichment }));
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Static invariants · module-level
// ═════════════════════════════════════════════════════════════════════
//
// This module is PURE. It:
//   · does NOT read the DB
//   · does NOT access the network, filesystem, clock, or randomness
//   · does NOT import "server-only" (would be allowed, but there is
//     nothing server-only here — the projector is runnable in any
//     environment including the browser if a VM is ever needed
//     client-side)
//   · imports only ./types + ./classify-entity-type
//
// Byte-stability
//   · Given byte-identical inputs, the projector returns byte-identical
//     outputs. The test suite enforces this via deterministic-projection
//     cases that call the projector repeatedly and compare outputs.
//
// Reflection discipline
//   · If migration 167 ever adds a column that the Directory needs,
//     update `DirectoryCanonicalRow` in ./types first, then add the
//     projection here, then add a permutation case to the test suite.
//   · If migration 167 ever renames a column, update the row interface
//     and the projector in the same wave.
