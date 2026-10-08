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

export interface ProjectDirectoryListingArgs {
  readonly row: DirectoryCanonicalRow;
  /** Optional media attachment. Pass `null` when no media resolver
   *  is wired in (today — the sealed `nex.business_media` table of
   *  migration 173 has not been authored). The VM's `primaryImage`
   *  will be `null` in that case. The projector NEVER synthesises
   *  an image from any other field. */
  readonly media: DirectoryListingMedia | null;
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
    coordinates: row.coordinates,

    phoneE164: row.phone_e164,
    websiteApex: row.website_apex,

    osmId: row.osm_id,
    wikidataQid: row.wikidata_qid,

    categoryIds: row.category_ids,
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
}): DirectoryListingVM[] {
  const map = args.mediaByCanonicalId;
  const out: DirectoryListingVM[] = [];
  for (const row of args.rows) {
    const media =
      map === undefined ? null : (map.get(row.canonical_business_id) ?? null);
    out.push(projectDirectoryListing({ row, media }));
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
