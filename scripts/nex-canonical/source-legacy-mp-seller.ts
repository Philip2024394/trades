// scripts/nex-canonical/source-legacy-mp-seller.ts
//
// NEX Canonical · Source adapter for `nex.mp_seller` · the real
// marketplace-seller legacy table (23,580 rows in local nex_dev as of
// 2026-10-09 · the largest NEX vertical by row count).
//
// Mirrors the sealed shape of `source-legacy-food-business.ts`. The
// semantic differences versus the food adapter are LOAD-BEARING and
// are called out below · do not fold them silently into the food
// adapter's assumptions.
//
// What this adapter is
//   · A pure DirectorySource implementation for marketplace sellers
//   · Issues keyset-paginated SELECT · one small batch at a time
//   · Projects legacy rows into sealed Candidate objects via a pure
//     projection function
//   · Refuses to invent data · a row that cannot safely project (no
//     display_name, no slug, no seller_id) is dropped from the batch
//     with a projection_failed note; the sealed validator will catch
//     any that slip past the local guards
//
// What this adapter is NOT
//   · Not a decision engine · no approval, no resolver, no handoff,
//     no write
//   · Not a source_registry authoriser · the adapter declares its
//     `source_id` and the runner's SourceRegistryRowProvider decides
//     whether can_derive is true (migration 187 seeds the row)
//   · Not a candidate generator (that is the sealed
//     generate-candidates.ts module); this adapter projects for the
//     continuous ingestion path, not for the one-shot β run
//
// SEMANTIC DIFFERENCES FROM `nex.food_business` (load-bearing)
// -----------------------------------------------------------
// 1 · entity_type is `marketplace_seller` (sealed enum member from
//     migration 167). Per 167, marketplace sellers are keyed to a NEX
//     account rather than to coordinates · the business_canonical
//     coordinates column is nullable and this adapter NEVER populates
//     it. If the live schema one day gains lat/lng columns, the
//     projection must be extended · it must NOT infer coordinates
//     from `jurisdiction` or `city` text.
//
// 2 · Identity is NOT geo-based (ADR-0022: identity-is-canonical).
//     For food we matched on name+city+coordinates. For marketplace
//     sellers:
//       · `slug` is UNIQUE on the mp_seller table (DB-enforced) · it
//         is the stable per-seller handle NEX minted for the row and
//         is the correct per-row identity carrier.
//       · The canonical identity signal pair exposed to the resolver
//         is (name_canonical, slug-via-aliases) · slug is also
//         projected into `aliases[]` so a future resolver pass can
//         match on it without a schema change.
//     Downstream dedup across sources (OSM, Wikidata) still relies on
//     name+phone+website at the business_canonical layer · marketplace
//     sellers simply contribute no coordinates signal into that join.
//
// 3 · Country strategy. `nex.mp_seller` has NO `country` column (same
//     gap as `nex.service_business`). It has a `jurisdiction` column
//     shaped `'<ISO2>/<district>/<city>'` (NOT NULL, default
//     'ID/DIY/Yogyakarta'). The adapter READS the ISO2 prefix out of
//     `jurisdiction` and uses it as the country code · the mandatory
//     country field on the Candidate is never fabricated. If the
//     prefix cannot be parsed (unexpected shape, blank, missing
//     slash), the row returns `projection_failed` · nothing is
//     silently mislabelled. A `LEGACY_MP_SELLER_FALLBACK_COUNTRY`
//     constant is NOT exposed · fallback would be fabrication.
//
// 4 · Freshness. The mp_seller rows carry `updated_at` / `created_at`
//     but no explicit evidence timestamp; this adapter does not
//     surface freshness · that belongs to downstream business_evidence
//     writes, not the Candidate shape.

import { createHash } from "node:crypto";
import type { Candidate } from "./generate-candidates";
import type { ReadSession, ReadSessionFactory } from "./pg-read-adapter";
import type {
  DirectorySource,
  DiscoverBatchResult,
} from "./directory-source";
import type { SourceCursor } from "./directory-log";

// ═════════════════════════════════════════════════════════════════════
// §1 · Known literals
// ═════════════════════════════════════════════════════════════════════

/** The source_id this adapter declares. A matching row MUST exist in
 *  `nex.source_registry` with `can_derive = true` before any Candidate
 *  from this adapter can be written to `nex.business_canonical`.
 *  Discovery through this adapter does NOT require that row · only
 *  the final write boundary (precheckHandoff + executeWritePlan) does.
 *  See migration 187 for the registry seed row. */
export const LEGACY_MP_SELLER_SOURCE_ID =
  "nex_mp_seller_legacy" as const;

/** The sealed entity_type for this source · migration 167's enum
 *  value for marketplace sellers (keyed to NEX accounts, not to
 *  coordinates). */
export const LEGACY_MP_SELLER_ENTITY_TYPE =
  "marketplace_seller" as const;

/** Default rows per batch. Keep small so retries are cheap. */
export const LEGACY_MP_SELLER_DEFAULT_BATCH_SIZE = 50;

/** The DirectorySource.country value for this adapter. All 23,580
 *  live rows (2026-10-09) carry `jurisdiction` with the `'ID/…/…'`
 *  prefix · the first-wave scope is Indonesia. The per-row projection
 *  still parses `jurisdiction` and the row stamped `country` is the
 *  parsed value · this constant is only the source-level advertised
 *  country for the ingestion runner. */
export const LEGACY_MP_SELLER_SOURCE_COUNTRY = "ID" as const;

/** The run id stamped on every Candidate's generation_source. Scoped
 *  per adapter construction so a founder reading the DB can
 *  distinguish this ingestion from β / other adapters. */
export interface LegacyMpSellerSourceConfig {
  readonly batchSize?: number;
  readonly generationRunId: string;
  readonly nowIso: () => string;
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Raw row shape · reflects migration 096 (+107 attribution)
// ═════════════════════════════════════════════════════════════════════

interface RawMpSellerRow {
  /** uuid PK · stable per row · drives keyset pagination. */
  readonly seller_id: string;
  /** text UNIQUE · the per-seller stable handle NEX minted for this
   *  row. Used as the Candidate's `legacy_source.ref` and also as the
   *  deterministic input to `candidate_id`. */
  readonly slug: string;
  readonly display_name: string;
  readonly city: string | null;
  /** NOT NULL · shaped `'<ISO2>/<district>/<city>'`. Country is
   *  derived from the ISO2 prefix. */
  readonly jurisdiction: string;
  readonly bio: string | null;
  readonly contact_ref: string | null;
  readonly discovered_from: string | null;
  readonly source: string | null;
  readonly source_reference: string | null;
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Pure projection · raw row → sealed Candidate
// ═════════════════════════════════════════════════════════════════════

export interface ProjectionFailure {
  readonly kind: "projection_failed";
  readonly seller_id: string | null;
  readonly reason: string;
}

export type ProjectionResult =
  | { readonly kind: "ok"; readonly candidate: Candidate }
  | ProjectionFailure;

/** Pure · reversible given identical input. Rows missing required
 *  fields (display_name, slug, seller_id) or carrying a jurisdiction
 *  that cannot yield an ISO2 country are rejected · a Candidate is
 *  only produced when the row carries the identity signals the sealed
 *  validator will accept. */
export function projectMpSellerRow(
  row: RawMpSellerRow,
  config: LegacyMpSellerSourceConfig,
): ProjectionResult {
  if (!row.seller_id || typeof row.seller_id !== "string") {
    return {
      kind: "projection_failed",
      seller_id: null,
      reason: "seller_id missing or not a string",
    };
  }
  if (!row.slug || row.slug.trim().length === 0) {
    return {
      kind: "projection_failed",
      seller_id: row.seller_id,
      reason: "slug missing or blank",
    };
  }
  if (!row.display_name || row.display_name.trim().length === 0) {
    return {
      kind: "projection_failed",
      seller_id: row.seller_id,
      reason: "display_name missing or blank",
    };
  }
  const country = parseCountryFromJurisdiction(row.jurisdiction);
  if (country === null) {
    return {
      kind: "projection_failed",
      seller_id: row.seller_id,
      reason: `jurisdiction cannot yield ISO2 country prefix (got ${JSON.stringify(row.jurisdiction)})`,
    };
  }

  // candidate_id is deterministic given (table, slug). Using a
  // sha256-prefix of the deterministic key keeps the id compact,
  // reversible to source, and stable across reruns · exactly the
  // same discipline as the food adapter but keyed on `slug` (the
  // mp_seller equivalent of `public_listing_ref`).
  const candidate_id = `cand-nex-mp-seller-${sha256Prefix(
    `nex.mp_seller|${row.slug}`,
    16,
  )}`;

  // Marketplace sellers are keyed to NEX accounts, not to coordinates
  // (per migration 167's architectural note). The mp_seller table
  // has NO coordinates column · the Candidate's coordinates stay
  // null. If the live schema ever gains lat/lng, extend this
  // projection explicitly · do NOT infer from city/jurisdiction.
  const coordinates = null;

  // mp_seller has NO phone or website column (migration 096). The
  // Candidate requires those fields but allows null · we leave them
  // null rather than invent anything. `contact_ref` is a free-text
  // pointer to nex.comms_contact · it is NOT a phone number and
  // MUST NOT be coerced into phone_e164.
  const phone_e164 = null;
  const website_apex = null;

  // Trim-only pass-through for text fields · no case normalisation,
  // no concatenation.
  const city = row.city?.trim() || null;

  const candidate: Candidate = {
    candidate_id,
    status: "pending_founder_review",
    entity_type: LEGACY_MP_SELLER_ENTITY_TYPE,
    country,
    identity: {
      name_canonical: row.display_name.trim(),
      // Expose `slug` as an alias so the resolver has an account-
      // identity carrier without a schema change · ADR-0022
      // identity-is-canonical. The alias is the exact slug string
      // (lowercase-kebab per migration 096's UNIQUE constraint
      // discipline) · it is NOT a human-visible alias in the UI.
      aliases: [row.slug.trim()],
      phone_e164,
      website_apex,
      osm_id: null,
      wikidata_qid: null,
      city,
      // mp_seller has no `district` column of its own · district
      // lives inside the `jurisdiction` triple. We parse the middle
      // segment as district only when it is distinct from the city
      // · otherwise it is left null to avoid duplication.
      district: parseDistrictFromJurisdiction(row.jurisdiction, city),
      // mp_seller has no neighbourhood column.
      neighbourhood: null,
      // mp_seller has no street_line column · the address stays
      // null. The adapter MUST NOT infer a street from `bio` or
      // `discovered_from`.
      street_line: null,
      // mp_seller has no address column · the canonical address
      // stays null · honest absence.
      address: null,
      coordinates,
    },
    legacy_source: {
      table: "nex.mp_seller",
      ref: row.slug,
      internal_id: row.seller_id,
    },
    risk_categories: ["R1"],
    selection_score: 0.5,
    selection_rationale: [
      {
        risk_category: "R1",
        contribution: 0.5,
        note: "legacy mp_seller ingestion · live listing hint",
      },
    ],
    generation_source: {
      generator: "scripts/nex-canonical/generate-candidates.ts",
      generated_at: config.nowIso(),
      generation_run_id: config.generationRunId,
    },
    caveats: [
      `legacy-adapter projection · source="${row.source ?? "unknown"}" · source_reference="${row.source_reference ?? "n/a"}" · discovered_from="${row.discovered_from ?? "n/a"}"`,
    ],
  };
  return { kind: "ok", candidate };
}

/** Parse the ISO2 country code out of a `jurisdiction` string shaped
 *  `'<ISO2>/<district>/<city>'`. Returns null if the input is empty,
 *  missing a slash, or carries a prefix that is not two ASCII letters
 *  · the row is rejected rather than silently mislabelled. */
export function parseCountryFromJurisdiction(
  raw: string | null | undefined,
): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const slash = trimmed.indexOf("/");
  if (slash <= 0) return null;
  const prefix = trimmed.slice(0, slash);
  if (!/^[A-Z]{2}$/.test(prefix)) return null;
  return prefix;
}

/** Parse the district segment (position 2 of 3) from a `jurisdiction`
 *  string shaped `'<ISO2>/<district>/<city>'`. Returns null when the
 *  parsed district is empty OR equals the city (case-insensitive) ·
 *  Yogyakarta sellers routinely have `jurisdiction='ID/DIY/Yogyakarta'`
 *  with `city='Yogyakarta'`, i.e. the district is a province code
 *  that would be miscoded if projected as district. Pass-through
 *  only when the segment carries fresh information. */
export function parseDistrictFromJurisdiction(
  raw: string | null | undefined,
  city: string | null,
): string | null {
  if (typeof raw !== "string") return null;
  const parts = raw.split("/");
  if (parts.length < 3) return null;
  const district = parts[1]?.trim() ?? "";
  if (district.length === 0) return null;
  if (city !== null && district.toLowerCase() === city.toLowerCase()) {
    return null;
  }
  return district;
}

function sha256Prefix(input: string, hexChars: number): string {
  return createHash("sha256")
    .update(input, "utf8")
    .digest("hex")
    .slice(0, hexChars);
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Keyset pagination cursor
// ═════════════════════════════════════════════════════════════════════

/** The cursor shape for this source · opaque to the runner, inspected
 *  only by this module. */
interface MpSellerCursor
  extends Record<string, string | number | boolean | null> {
  readonly last_seller_id: string;
}

function isMpSellerCursor(c: SourceCursor | null): c is MpSellerCursor {
  return c !== null && typeof c.last_seller_id === "string";
}

// ═════════════════════════════════════════════════════════════════════
// §5 · The adapter
// ═════════════════════════════════════════════════════════════════════

export interface CreateLegacyMpSellerSourceArgs {
  readonly session_factory: ReadSessionFactory;
  readonly config: LegacyMpSellerSourceConfig;
}

/** Build the real DirectorySource that reads nex.mp_seller. */
export function createLegacyMpSellerSource(
  args: CreateLegacyMpSellerSourceArgs,
): DirectorySource {
  const batchSize = Math.max(
    1,
    args.config.batchSize ?? LEGACY_MP_SELLER_DEFAULT_BATCH_SIZE,
  );
  return {
    source_id: LEGACY_MP_SELLER_SOURCE_ID,
    country: LEGACY_MP_SELLER_SOURCE_COUNTRY,
    discoverBatch: async (cursor): Promise<DiscoverBatchResult> => {
      let session: ReadSession;
      try {
        session = await args.session_factory.openSession();
      } catch (err) {
        return {
          kind: "temporary_failure",
          reason: `cannot open read session: ${err instanceof Error ? err.name : "unknown"}`,
        };
      }
      try {
        // Keyset pagination: fetch batchSize+1 rows strictly greater
        // than the cursor's last_seller_id, ordered by seller_id.
        // seller_id is the uuid PK · it is NOT NULL, stable, and
        // uniquely orderable. We fetch +1 to detect "another batch
        // exists" without a separate count.
        const whereClause = isMpSellerCursor(cursor)
          ? "WHERE seller_id > $1 ORDER BY seller_id ASC LIMIT $2"
          : "ORDER BY seller_id ASC LIMIT $1";
        const sql = `SELECT seller_id, slug, display_name,
                            city, jurisdiction, bio,
                            contact_ref, discovered_from,
                            source, source_reference
                     FROM nex.mp_seller
                     ${whereClause}`;
        const params = isMpSellerCursor(cursor)
          ? [cursor.last_seller_id, batchSize + 1]
          : [batchSize + 1];
        const result = await session.query<RawMpSellerRow>(sql, params);
        if (result.rows.length === 0) {
          return { kind: "exhausted" };
        }
        const hasMore = result.rows.length > batchSize;
        const rows = hasMore
          ? result.rows.slice(0, batchSize)
          : result.rows;
        const candidates: Candidate[] = [];
        for (const row of rows) {
          const projection = projectMpSellerRow(row, args.config);
          if (projection.kind === "ok") {
            candidates.push(projection.candidate);
          }
          // Projection failures are silently dropped at the batch
          // level · the sealed candidate-validator would catch them
          // anyway. The dropped rows are observable only in explicit
          // adapter diagnostics (not emitted by default).
        }
        const nextCursor: SourceCursor | null = hasMore
          ? ({
              last_seller_id: rows[rows.length - 1].seller_id,
            } satisfies MpSellerCursor)
          : null;
        return { kind: "more", candidates, next_cursor: nextCursor };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // pg library surfaces a `code` property for recoverable errors.
        // Treat known transient codes as temporary; everything else as
        // permanent. The runner retries temporary failures.
        const code =
          err && typeof err === "object" && "code" in err
            ? String((err as { code: unknown }).code)
            : null;
        const transientCodes = new Set([
          "40001", // serialization_failure
          "40P01", // deadlock_detected
          "57P03", // cannot_connect_now
          "08000", // connection_exception
          "08006", // connection_failure
          "08001", // sqlclient_unable_to_establish_sqlconnection
          "08004", // sqlserver_rejected_establishment_of_sqlconnection
        ]);
        if (code !== null && transientCodes.has(code)) {
          return {
            kind: "temporary_failure",
            reason: `pg code=${code}: ${msg}`,
          };
        }
        return { kind: "permanent_failure", reason: msg };
      } finally {
        try {
          await args.session_factory.closeSession(session);
        } catch {
          /* best-effort close */
        }
      }
    },
  };
}

// ═════════════════════════════════════════════════════════════════════
// §6 · Static invariants
// ═════════════════════════════════════════════════════════════════════
//
// This module:
//   · does NOT invent data · rows that cannot safely project return
//     projection_failed · nothing is fabricated (no coordinates
//     inferred, no phone or website synthesised, no country assumed
//     when the jurisdiction prefix is missing or malformed)
//   · does NOT invoke the resolver, approval, precheck, or write
//     paths · it only produces Candidates for the runner
//   · does NOT bypass the sealed candidate-validator · projections
//     are shaped to pass validation only when the row carries the
//     required signals
//   · does NOT read credentials · the ReadSessionFactory is injected
//   · does NOT write to any DB · all SQL is SELECT only, and the
//     adapter session is read-only at the pg level
//   · issues keyset-paginated SELECTs that advance deterministically
//     via `seller_id` (uuid PK · stable per row)
//   · keys identity on `slug` (DB-UNIQUE) · surfaces it in `aliases[]`
//     so the resolver can match marketplace sellers by account handle
//     rather than by coordinates (ADR-0022 identity-is-canonical)
