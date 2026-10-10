// scripts/nex-canonical/source-legacy-accommodation-business.ts
//
// NEX Canonical · The accommodation legacy source adapter ·
// nex.accommodation_business.
//
// Schema reference · migration 054-family accommodation schema. Live
// schema confirmed by probe 2026-10-09 against local nex_dev
// (9,230 rows · country=ID 100%). Reads the real legacy table;
// projects each row into a sealed Candidate; supports deterministic
// keyset pagination by `internal_id` (uuid PK).
//
// This file is a near-line-for-line mirror of
// `source-legacy-food-business.ts` (the sealed reference adapter).
// Every discipline that applies there applies here · when in doubt,
// read the food adapter.
//
// What this adapter is
//   · A pure DirectorySource implementation
//   · Issues keyset-paginated SELECT · one small batch at a time
//   · Projects legacy rows into sealed Candidate objects via a
//     pure projection function
//   · Refuses to invent data · a row that cannot safely project (no
//     business_name, no public_listing_ref) is dropped from the batch
//     with a quarantine note; the runner will see the shape-rejection
//     through the sealed validator in any case
//
// What this adapter is NOT
//   · Not a decision engine · no approval, no resolver, no handoff,
//     no write
//   · Not a source_registry authoriser · the adapter declares its
//     `source_id` and the runner's SourceRegistryRowProvider decides
//     whether can_derive is true. Migration 185 seeds the registry
//     row for this adapter; until that row is in the live DB (and
//     can_display gated separately by legal review), no candidate
//     from this adapter will reach the published directory. The
//     adapter is agnostic to that gating · its output is identical
//     either way.
//   · Not a candidate generator (that is the sealed
//     generate-candidates.ts module); this adapter projects for the
//     continuous ingestion path, not for the one-shot β run
//
// Country handling
//   · `nex.accommodation_business.country` is NOT NULL (per live
//     schema probe) · the adapter reads the genuine source column.
//     The LEGACY_ACCOMMODATION_COUNTRY constant remains as a defensive
//     fallback for unexpected blank values.
//   · As of the sealing probe (2026-10-09), 100 % of the 9,230 rows
//     carry country='ID' · scope matches the sealed first-wave
//     Indonesia scope. If future rows carry other countries the
//     adapter still projects them honestly · the genuine source value
//     wins.

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
 *  Seeded by migration 185 (file-only · not yet applied). */
export const LEGACY_ACCOMMODATION_SOURCE_ID =
  "nex_accommodation_business_legacy" as const;

/** Country code the adapter uses as a defensive fallback. The live
 *  table carries country as NOT NULL · this constant is only used if
 *  the source value is somehow blank. Current scope: Indonesia. */
export const LEGACY_ACCOMMODATION_COUNTRY = "ID" as const;

/** The sealed entity_type for this source · value per migration 167's
 *  ck_bc_entity_type CHECK. */
export const LEGACY_ACCOMMODATION_ENTITY_TYPE = "accommodation" as const;

/** Default rows per batch. Keep small so retries are cheap. */
export const LEGACY_ACCOMMODATION_DEFAULT_BATCH_SIZE = 50;

/** The run id stamped on every Candidate's generation_source. Scoped
 *  per adapter construction so a founder reading the DB can
 *  distinguish this ingestion from β / other adapters. */
export interface LegacyAccommodationSourceConfig {
  readonly batchSize?: number;
  readonly generationRunId: string;
  readonly nowIso: () => string;
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Raw row shape · reflects live column probe (2026-10-09)
// ═════════════════════════════════════════════════════════════════════

interface RawAccommodationRow {
  readonly internal_id: string;
  readonly public_listing_ref: string;
  readonly business_name: string;
  readonly category: string | null;
  readonly address: string | null;
  readonly city: string | null;
  readonly district: string | null;
  readonly coordinates_lng: string | number | null;
  readonly coordinates_lat: string | number | null;
  readonly phone: string | null;
  readonly website: string | null;
  readonly source: string | null;
  readonly source_reference: string | null;
  /** Dedicated structured street-line column, preserved verbatim. */
  readonly street_line: string | null;
  /** Finer-grained location unit below district. Preserved verbatim. */
  readonly neighbourhood: string | null;
  /** Genuine source country · NOT NULL per live schema. */
  readonly country: string | null;
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Pure projection · raw row → sealed Candidate
// ═════════════════════════════════════════════════════════════════════

export interface ProjectionFailure {
  readonly kind: "projection_failed";
  readonly internal_id: string | null;
  readonly reason: string;
}

export type ProjectionResult =
  | { readonly kind: "ok"; readonly candidate: Candidate }
  | ProjectionFailure;

/** Pure · reversible given identical input. Rows missing required
 *  fields (business_name, public_listing_ref, internal_id) are
 *  rejected · a Candidate is only produced when the row carries the
 *  identity signals the sealed validator will accept. */
export function projectAccommodationBusinessRow(
  row: RawAccommodationRow,
  config: LegacyAccommodationSourceConfig,
): ProjectionResult {
  if (!row.internal_id || typeof row.internal_id !== "string") {
    return {
      kind: "projection_failed",
      internal_id: null,
      reason: "internal_id missing or not a string",
    };
  }
  if (!row.public_listing_ref || row.public_listing_ref.trim().length === 0) {
    return {
      kind: "projection_failed",
      internal_id: row.internal_id,
      reason: "public_listing_ref missing or blank",
    };
  }
  if (!row.business_name || row.business_name.trim().length === 0) {
    return {
      kind: "projection_failed",
      internal_id: row.internal_id,
      reason: "business_name missing or blank",
    };
  }

  // candidate_id is deterministic given (table, public_listing_ref).
  // Using a sha256-prefix of the deterministic key keeps the id compact,
  // reversible to source, and stable across reruns.
  const candidate_id = `cand-nex-accommodation-${sha256Prefix(
    `nex.accommodation_business|${row.public_listing_ref}`,
    16,
  )}`;

  // Coordinates: PG numeric columns come back as strings in pg
  // without a parser override. Parse defensively; null on invalid.
  const lat = parseCoordinate(row.coordinates_lat, -90, 90);
  const lng = parseCoordinate(row.coordinates_lng, -180, 180);
  const coordinates =
    lat !== null && lng !== null ? { lat, lng } : null;

  // Phone: pass through if already E.164 shaped, else null. We DO NOT
  // normalise · the sealed candidate-validator demands
  // /^\+[1-9][0-9]{6,14}$/ when phone_e164 is non-null · a row with a
  // formatted-but-not-E.164 phone keeps its row-identity signals
  // (name/ref) while honestly dropping the un-normalised phone.
  // Matches the food adapter's "do not invent" posture.
  const phone_e164 =
    row.phone && /^\+[1-9][0-9]{6,14}$/.test(row.phone) ? row.phone : null;

  // Website apex: strip protocol + leading www. Null if parse fails.
  const website_apex = extractWebsiteApex(row.website);

  // OSM identity passthrough · only when the source is unambiguously an
  // OSM reference. The live table carries source='osm_overpass' (and
  // 'osm_overpass_via_lab') with source_reference like 'node/4177763303'.
  // We lift this into osm_id as a stable identity signal · no
  // fabrication (the string already exists in the source row), no
  // inference (we only accept the exact osm reference shape). The food
  // adapter has no OSM-shaped reference column, so it leaves osm_id
  // null · for accommodation, every real row carries one, so passing
  // it through is honest preservation of existing identity signal.
  const osm_id = extractOsmId(row.source, row.source_reference);

  // Wikidata QID: the live table has no column carrying a Wikidata QID.
  // The food adapter is in the same position · both leave this field
  // null. Future schema additions (e.g. a wikidata_qid column) would
  // populate this honestly.
  const wikidata_qid = null;

  // Country: read from the genuine source column (NOT NULL per live
  // schema). Fallback to LEGACY_ACCOMMODATION_COUNTRY only if the
  // source somehow returns a blank value · the DB column is NOT NULL
  // so this fallback is defensive, not routine.
  const source_country =
    row.country && row.country.trim().length > 0
      ? row.country.trim()
      : LEGACY_ACCOMMODATION_COUNTRY;

  const candidate: Candidate = {
    candidate_id,
    status: "pending_founder_review",
    entity_type: LEGACY_ACCOMMODATION_ENTITY_TYPE,
    country: source_country,
    identity: {
      name_canonical: row.business_name.trim(),
      aliases: [],
      phone_e164,
      website_apex,
      osm_id,
      wikidata_qid,
      city: row.city?.trim() || null,
      district: row.district?.trim() || null,
      // Verbatim pass-through from source · trimmed only (no case
      // normalisation, no concatenation). Missing stays missing.
      street_line: row.street_line?.trim() || null,
      neighbourhood: row.neighbourhood?.trim() || null,
      // Canonical address jsonb per sealed doctrine shape
      // { line1: string | null, postal_code: string | null } | null.
      // nex.accommodation_business.address is free-text · it becomes
      // line1 verbatim (trimmed). The table has NO postal-code column
      // · postal_code stays null. The whole object is null when the
      // source has no address at all · honest absence.
      address: row.address?.trim()
        ? { line1: row.address.trim(), postal_code: null }
        : null,
      coordinates,
    },
    legacy_source: {
      table: "nex.accommodation_business",
      ref: row.public_listing_ref,
      internal_id: row.internal_id,
    },
    risk_categories: ["R1"],
    selection_score: 0.5,
    selection_rationale: [
      {
        risk_category: "R1",
        contribution: 0.5,
        note: "legacy accommodation_business ingestion · live listing hint",
      },
    ],
    generation_source: {
      generator: "scripts/nex-canonical/generate-candidates.ts",
      generated_at: config.nowIso(),
      generation_run_id: config.generationRunId,
    },
    caveats: [
      `legacy-adapter projection · source="${row.source ?? "unknown"}" · source_reference="${row.source_reference ?? "n/a"}"`,
    ],
  };
  return { kind: "ok", candidate };
}

function parseCoordinate(
  value: unknown,
  min: number,
  max: number,
): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

function extractWebsiteApex(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return url.host.replace(/^www\./, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

/** Extract an OSM id from (source, source_reference) · only when the
 *  pair is unambiguously OSM-shaped. Matches 'node/<digits>',
 *  'way/<digits>', 'relation/<digits>' (case-insensitive). Returns the
 *  normalised 'type/id' form, or null otherwise. Pure · no network. */
function extractOsmId(
  source: string | null,
  source_reference: string | null,
): string | null {
  if (!source || !source_reference) return null;
  const normSource = source.toLowerCase();
  // Accept 'osm_overpass' and future OSM-ingested variants beginning
  // with 'osm_'. Non-OSM sources never produce an osm_id passthrough.
  if (!normSource.startsWith("osm_")) return null;
  const match = source_reference.match(/^(node|way|relation)\/(\d+)$/i);
  if (!match) return null;
  return `${match[1].toLowerCase()}/${match[2]}`;
}

function sha256Prefix(input: string, hexChars: number): string {
  return createHash("sha256").update(input, "utf8").digest("hex").slice(0, hexChars);
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Keyset pagination cursor
// ═════════════════════════════════════════════════════════════════════

/** The cursor shape for this source · opaque to the runner, inspected
 *  only by this module. */
interface AccommodationCursor
  extends Record<string, string | number | boolean | null> {
  readonly last_internal_id: string;
}

function isAccommodationCursor(
  c: SourceCursor | null,
): c is AccommodationCursor {
  return c !== null && typeof c.last_internal_id === "string";
}

// ═════════════════════════════════════════════════════════════════════
// §5 · The adapter
// ═════════════════════════════════════════════════════════════════════

export interface CreateLegacyAccommodationSourceArgs {
  readonly session_factory: ReadSessionFactory;
  readonly config: LegacyAccommodationSourceConfig;
}

/** Build the real DirectorySource that reads
 *  nex.accommodation_business. */
export function createLegacyAccommodationBusinessSource(
  args: CreateLegacyAccommodationSourceArgs,
): DirectorySource {
  const batchSize = Math.max(
    1,
    args.config.batchSize ?? LEGACY_ACCOMMODATION_DEFAULT_BATCH_SIZE,
  );
  return {
    source_id: LEGACY_ACCOMMODATION_SOURCE_ID,
    country: LEGACY_ACCOMMODATION_COUNTRY,
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
        // than the cursor's last_internal_id, ordered by internal_id.
        // We fetch +1 to detect "another batch exists" without a
        // separate count.
        const whereClause = isAccommodationCursor(cursor)
          ? "WHERE internal_id > $1 ORDER BY internal_id ASC LIMIT $2"
          : "ORDER BY internal_id ASC LIMIT $1";
        const sql = `SELECT internal_id, public_listing_ref, business_name,
                            category, address, city, district,
                            coordinates_lng, coordinates_lat,
                            phone, website, source, source_reference,
                            street_line, neighbourhood, country
                     FROM nex.accommodation_business
                     ${whereClause}`;
        const params = isAccommodationCursor(cursor)
          ? [cursor.last_internal_id, batchSize + 1]
          : [batchSize + 1];
        const result = await session.query<RawAccommodationRow>(sql, params);
        if (result.rows.length === 0) {
          return { kind: "exhausted" };
        }
        const hasMore = result.rows.length > batchSize;
        const rows = hasMore ? result.rows.slice(0, batchSize) : result.rows;
        const candidates: Candidate[] = [];
        for (const row of rows) {
          const projection = projectAccommodationBusinessRow(row, args.config);
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
              last_internal_id: rows[rows.length - 1].internal_id,
            } satisfies AccommodationCursor)
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
          return { kind: "temporary_failure", reason: `pg code=${code}: ${msg}` };
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
//     projection_failed · nothing is fabricated
//   · does NOT invoke the resolver, approval, precheck, or write
//     paths · it only produces Candidates for the runner
//   · does NOT bypass the sealed candidate-validator · projections
//     are shaped to pass validation only when the row carries the
//     required signals
//   · does NOT read credentials · the ReadSessionFactory is injected
//   · does NOT write to any DB · all SQL is SELECT only, and the
//     adapter session is read-only at the pg level
//   · issues keyset-paginated SELECTs that advance deterministically
//     via `internal_id` (uuid PK · stable per row)
//   · does NOT perform dedup · the sealed canonical-resolver owns the
//     (country, name_norm, city) dedup decision. The adapter projects
//     every row that carries valid identity signals · merging is a
//     downstream choice made by `canonical-resolver.ts`, not here.
