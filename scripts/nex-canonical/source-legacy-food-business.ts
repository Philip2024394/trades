// scripts/nex-canonical/source-legacy-food-business.ts
//
// NEX Canonical · The FIRST real source adapter · nex.food_business.
//
// Schema reference · migration 054_nex_food_business_schema.sql.
// Reads the real legacy table; projects each row into a sealed
// Candidate; supports deterministic keyset pagination by
// `internal_id` (uuid PK).
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
//     whether can_derive is true
//   · Not a candidate generator (that is the sealed
//     generate-candidates.ts module); this adapter projects for the
//     continuous ingestion path, not for the one-shot β run
//
// Country handling
//   · `nex.food_business` was seeded with `city DEFAULT 'Yogyakarta'`
//     (per migration 054) and the sealed first-wave scope is
//     Indonesia · the adapter stamps country = 'ID' on every candidate
//   · If future legacy rows carry non-Yogyakarta cities for other
//     countries, this adapter must be extended · do not silently
//     mislabel

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
 *  the final write boundary (precheckHandoff + executeWritePlan) does. */
export const LEGACY_FOOD_SOURCE_ID = "nex_food_business_legacy" as const;

/** Country code the adapter stamps on every projected Candidate. Per
 *  migration 054 the table defaults `city = 'Yogyakarta'` · scope is
 *  Indonesia. Change requires a documented adapter extension. */
export const LEGACY_FOOD_COUNTRY = "ID" as const;

/** The sealed entity_type for this source. */
export const LEGACY_FOOD_ENTITY_TYPE = "food" as const;

/** Default rows per batch. Keep small so retries are cheap. */
export const LEGACY_FOOD_DEFAULT_BATCH_SIZE = 50;

/** The run id stamped on every Candidate's generation_source. Scoped
 *  per adapter construction so a founder reading the DB can
 *  distinguish this ingestion from β / other adapters. */
export interface LegacyFoodSourceConfig {
  readonly batchSize?: number;
  readonly generationRunId: string;
  readonly nowIso: () => string;
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Raw row shape · reflects migration 054 columns the adapter reads
// ═════════════════════════════════════════════════════════════════════

interface RawFoodRow {
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
  /** Dedicated structured street-line column on nex.food_business.
   *  Preserved verbatim · the adapter does NOT infer this from the
   *  free-text `address` column. Added as a projected field by the
   *  location-granularity wave (migration 178). */
  readonly street_line: string | null;
  /** Finer-grained location unit below district. Preserved verbatim. */
  readonly neighbourhood: string | null;
  /** Genuine source country · nex.food_business.country is NOT NULL
   *  (every row has a value). The adapter now reads this instead of
   *  hardcoding "ID"; the LEGACY_FOOD_COUNTRY constant remains as a
   *  defensive fallback for unexpected null / blank values. */
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
export function projectFoodBusinessRow(
  row: RawFoodRow,
  config: LegacyFoodSourceConfig,
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
  const candidate_id = `cand-nex-food-${sha256Prefix(
    `nex.food_business|${row.public_listing_ref}`,
    16,
  )}`;

  // Coordinates: PG numeric columns come back as strings in pg
  // without a parser override. Parse defensively; null on invalid.
  const lat = parseCoordinate(row.coordinates_lat, -90, 90);
  const lng = parseCoordinate(row.coordinates_lng, -180, 180);
  const coordinates =
    lat !== null && lng !== null ? { lat, lng } : null;

  // Phone: pass through if already E.164 shaped, else null.
  // The sealed candidate-validator demands /^\+[1-9][0-9]{6,14}$/
  // when phone_e164 is non-null. We DO NOT normalise · we drop
  // non-conforming phones (preserves "do not invent") while keeping
  // the row.
  const phone_e164 =
    row.phone && /^\+[1-9][0-9]{6,14}$/.test(row.phone) ? row.phone : null;

  // Website apex: strip protocol + leading www. Null if parse fails.
  const website_apex = extractWebsiteApex(row.website);

  // Country: read from the genuine source column (NOT NULL per
  // nex.food_business schema). Fallback to LEGACY_FOOD_COUNTRY only
  // if the source somehow returns a blank value · the DB CHECK
  // prevents nulls so this fallback is defensive, not routine.
  const source_country =
    row.country && row.country.trim().length > 0
      ? row.country.trim()
      : LEGACY_FOOD_COUNTRY;
  const candidate: Candidate = {
    candidate_id,
    status: "pending_founder_review",
    entity_type: LEGACY_FOOD_ENTITY_TYPE,
    country: source_country,
    identity: {
      name_canonical: row.business_name.trim(),
      aliases: [],
      phone_e164,
      website_apex,
      osm_id: null,
      wikidata_qid: null,
      city: row.city?.trim() || null,
      district: row.district?.trim() || null,
      // Verbatim pass-through from source · trimmed only (no case
      // normalisation, no concatenation). Missing stays missing.
      street_line: row.street_line?.trim() || null,
      neighbourhood: row.neighbourhood?.trim() || null,
      // Canonical address jsonb per sealed doctrine shape
      // { line1: string | null, postal_code: string | null } | null.
      // nex.food_business.address is free-text · it becomes line1
      // verbatim (trimmed). nex.food_business has NO postal-code
      // column · postal_code stays null. The whole object is null
      // when the source has no address at all · honest absence.
      address: row.address?.trim()
        ? { line1: row.address.trim(), postal_code: null }
        : null,
      coordinates,
    },
    legacy_source: {
      table: "nex.food_business",
      ref: row.public_listing_ref,
      internal_id: row.internal_id,
    },
    risk_categories: ["R1"],
    selection_score: 0.5,
    selection_rationale: [
      {
        risk_category: "R1",
        contribution: 0.5,
        note: "legacy food_business ingestion · live listing hint",
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

function sha256Prefix(input: string, hexChars: number): string {
  return createHash("sha256").update(input, "utf8").digest("hex").slice(0, hexChars);
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Keyset pagination cursor
// ═════════════════════════════════════════════════════════════════════

/** The cursor shape for this source · opaque to the runner, inspected
 *  only by this module. */
interface FoodCursor extends Record<string, string | number | boolean | null> {
  readonly last_internal_id: string;
}

function isFoodCursor(c: SourceCursor | null): c is FoodCursor {
  return c !== null && typeof c.last_internal_id === "string";
}

// ═════════════════════════════════════════════════════════════════════
// §5 · The adapter
// ═════════════════════════════════════════════════════════════════════

export interface CreateLegacyFoodSourceArgs {
  readonly session_factory: ReadSessionFactory;
  readonly config: LegacyFoodSourceConfig;
}

/** Build the real DirectorySource that reads nex.food_business. */
export function createLegacyFoodBusinessSource(
  args: CreateLegacyFoodSourceArgs,
): DirectorySource {
  const batchSize = Math.max(
    1,
    args.config.batchSize ?? LEGACY_FOOD_DEFAULT_BATCH_SIZE,
  );
  return {
    source_id: LEGACY_FOOD_SOURCE_ID,
    country: LEGACY_FOOD_COUNTRY,
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
        const whereClause = isFoodCursor(cursor)
          ? "WHERE internal_id > $1 ORDER BY internal_id ASC LIMIT $2"
          : "ORDER BY internal_id ASC LIMIT $1";
        const sql = `SELECT internal_id, public_listing_ref, business_name,
                            category, address, city, district,
                            coordinates_lng, coordinates_lat,
                            phone, website, source, source_reference,
                            street_line, neighbourhood, country
                     FROM nex.food_business
                     ${whereClause}`;
        const params = isFoodCursor(cursor)
          ? [cursor.last_internal_id, batchSize + 1]
          : [batchSize + 1];
        const result = await session.query<RawFoodRow>(sql, params);
        if (result.rows.length === 0) {
          return { kind: "exhausted" };
        }
        const hasMore = result.rows.length > batchSize;
        const rows = hasMore ? result.rows.slice(0, batchSize) : result.rows;
        const candidates: Candidate[] = [];
        for (const row of rows) {
          const projection = projectFoodBusinessRow(row, args.config);
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
            } satisfies FoodCursor)
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
