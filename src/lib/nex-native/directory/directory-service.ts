// src/lib/nex-native/directory/directory-service.ts
//
// NEX Directory · Phase A · Server-side data layer.
//
// What this module is
//   · The one authoritative server-side read path from
//     `nex.business_canonical` into the Phase B view-model.
//   · The composer that calls Phase B's projector and Phase C's
//     resolver to produce (VM, destination) tuples ready for the
//     Phase A UI.
//   · The honest-empty-state source. If the NEX Canonical PostgreSQL
//     is not configured (NEX_POSTGRES_URL unset), unreachable, or
//     the table has 0 rows, this module returns an empty result
//     WITHOUT fabricating anything.
//
// What this module is NOT
//   · Not a writer. All DB access is SELECT. No INSERT / UPDATE /
//     DELETE / CREATE.
//   · Not a canonical pipeline module. The ingestion/approval/write
//     pipeline lives at scripts/nex-canonical/* and is sealed. This
//     module only READS the canonical table.
//   · Not a URL fabricator. Slug + handle values come from
//     OwnerClaim rows produced by the owner-link lookup (currently a
//     stub returning null for every row — see §4 below).
//   · Not a client module. `import "server-only"` guards against
//     accidental client-side imports.
//
// Current reality (Phase A build time, post-AUTH-4 rewire)
//   · `nex.business_canonical` has 0 rows and may not yet exist on
//     the target database. The sealed migrations 166/167/170 under
//     `deploy/postgres/init/` are the authoritative DDL; they are
//     applied via `npm run nex:apply-storage-schema` against the
//     NEX_POSTGRES_URL target (see AUTH-2 / AUTH-3).
//   · When NEX_POSTGRES_URL is unset, the shared `withClient` helper
//     returns `null`; this service surfaces that as
//     `systemReady: false` with an honest diagnostic.
//   · When the pg driver throws (table does not exist, schema not
//     yet applied, connect refused, authentication failed), the
//     service also returns `systemReady: false` with a redacted
//     diagnostic. The UI renders the "being prepared" state.
//   · The owner-link lookup is a stub returning no claims. The real
//     implementation must span two physical databases (Supabase
//     `public.nex_business` + NEX Canonical `nex.business_canonical`)
//     and PostgreSQL has no cross-database FK. Owner-link resolution
//     is deferred to a dedicated ADR.
//
// Future wave hook points (post-authorisation)
//   · When migration 173 lands, swap in a real media resolver that
//     fetches primary images per canonical row.
//   · When the cross-database owner-link ADR lands, swap in a real
//     `fetchOwnerClaimsByCanonicalId` body.
//
// Sealed publication boundary (DP-1 + DP-2 · 2026-10-09)
//   · All visitor-facing reads go through `nex.business_directory_v`
//     (migration 175), not `nex.business_canonical`. The view enforces
//     D-1 (lifecycle L1 = VERIFIED / OWNER_CLAIMED / OWNER_VERIFIED),
//     the supersession guard, and D-2 (permission-OR source_registry.
//     can_display). This file no longer carries a lifecycle filter
//     constant · duplicate predicates between the service and the
//     view are a drift surface and are explicitly forbidden.
//   · DP-3 (GRANT/REVOKE lockdown that removes direct SELECT on
//     nex.business_canonical from the Directory DB role) is a
//     separate authorised wave.

import "server-only";
import { withClient } from "@/lib/nex/db";
import { projectDirectoryListings } from "./project-canonical-row";
import { resolveDirectoryDestinations } from "./resolve-destination";
import type {
  DirectoryCanonicalRow,
  DirectoryClassification,
  DirectoryCoordinates,
  DirectoryListingMedia,
  DirectoryListingVM,
  EntityType,
  LifecycleState,
} from "./types";
import type {
  DirectoryDestination,
  OwnerClaim,
} from "./destination-types";
import {
  BUSINESS_ENTITY_TYPES,
  PERSON_ENTITY_TYPES,
  PLACE_ENTITY_TYPES,
} from "./classify-entity-type";

// ═════════════════════════════════════════════════════════════════════
// §1 · Constants
// ═════════════════════════════════════════════════════════════════════

/** The sealed canonical table · referenced only for identity. The
 *  service no longer reads it directly for visitor rendering · all
 *  visitor reads go through `DIRECTORY_PUBLICATION_VIEW`. Kept as a
 *  constant for operational tooling that needs the canonical name. */
export const CANONICAL_TABLE = "business_canonical" as const;
/** The sealed schema name. */
export const CANONICAL_SCHEMA = "nex" as const;
/** The sealed publication view (migration 175 · DP-1). This is the
 *  one object the service is architecturally permitted to read for
 *  visitor rendering. All publication predicates (L1 lifecycle set,
 *  supersession guard, permission-OR source_registry.can_display) are
 *  enforced inside the view · the service NEVER decides what is
 *  publishable. */
export const DIRECTORY_PUBLICATION_VIEW = "business_directory_v" as const;

/** Maximum rows returned per call. Phase A UI paginates via `offset`. */
export const DEFAULT_LIMIT = 24;

// Lifecycle filtering previously lived here as a TypeScript constant
// (SURFACED_LIFECYCLE_STATES). After the publication-gate audit of
// 2026-10-09 (D-1 · L1), lifecycle filtering is enforced inside the
// sealed `nex.business_directory_v` view. The service no longer
// decides which lifecycle states are visitor-publishable · attempting
// to re-introduce a TypeScript lifecycle filter would duplicate (and
// potentially contradict) the view's predicate.

// ═════════════════════════════════════════════════════════════════════
// §2 · Input + result shapes
// ═════════════════════════════════════════════════════════════════════

export interface ListDirectoryArgs {
  /** ISO 3166-1 alpha-2 country filter. */
  readonly country: string;
  /** Optional free-text query matched against `name_norm` (trigram) +
   *  `aliases` (array containment). Falsy / empty → no text filter. */
  readonly q?: string;
  /** Optional classification filter · "all" means "no filter". */
  readonly classification?: DirectoryClassification | "all";
  /** Max rows returned (default 24). */
  readonly limit?: number;
  /** Rows to skip for pagination (default 0). */
  readonly offset?: number;
}

export interface DirectoryListingResult {
  readonly listing: DirectoryListingVM;
  readonly destination: DirectoryDestination;
}

export interface ListDirectoryOutcome {
  readonly results: readonly DirectoryListingResult[];
  /** True iff the service reached the DB and read ≥0 rows. False means
   *  the DB was unreachable, the schema is not exposed, the table does
   *  not exist, or any other failure that forced the service to return
   *  an empty result. The UI uses this signal to differentiate "no
   *  listings yet" from "Directory system is being prepared." */
  readonly systemReady: boolean;
  /** Optional diagnostic string the UI can surface in a non-fabricated
   *  way (e.g. a dev-only badge). Never a user-facing error. */
  readonly diagnostic: string | null;
  /** Total matching rows across the ENTIRE result set (not just this
   *  page). Driven by a COUNT(*) query against the same WHERE
   *  predicate the SELECT uses, minus LIMIT/OFFSET. Zero when
   *  systemReady is false. Used by the UI to render page counts and
   *  Prev/Next controls. */
  readonly total: number;
}

/**
 * The outcome of a single-row Directory lookup by canonical_business_id.
 * Three discriminable states:
 *   · systemReady false            → DB unreachable (preparing state)
 *   · systemReady true, result null → row not found / invalid id
 *                                      (page should 404)
 *   · systemReady true, result set  → listing + destination + evidence
 *                                      presence flag ready to render
 */
export interface DirectoryDetailResult {
  readonly listing: DirectoryListingVM;
  readonly destination: DirectoryDestination;
  /** True iff at least one row exists in nex.business_evidence linked
   *  to this canonical_business_id. The UI uses this to render a small
   *  "Verified listing" indicator. Evidence row internals are NOT
   *  exposed to the visitor — the detail page shows only that
   *  provenance exists, not what the provenance says. */
  readonly hasEvidence: boolean;
}

export interface GetCanonicalBusinessOutcome {
  readonly result: DirectoryDetailResult | null;
  readonly systemReady: boolean;
  readonly diagnostic: string | null;
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Row-shape adaptation · pg row → DirectoryCanonicalRow
// ═════════════════════════════════════════════════════════════════════

/** The subset of columns the service SELECTs.
 *
 *  Coordinates are projected via `ST_Y(coordinates::geometry)` /
 *  `ST_X(coordinates::geometry)` because the raw pg driver cannot
 *  return a PostGIS `geography(POINT, 4326)` column directly as
 *  structured { lat, lng }. PostGIS's ST_X / ST_Y are defined over
 *  geometry (not geography); the `::geometry` cast is a cheap
 *  coordinate-space conversion that preserves the stored lat/lng.
 *  ST_X returns longitude (geometry X axis), ST_Y returns latitude
 *  (geometry Y axis). The adapter below converts the pair into
 *  `DirectoryCoordinates | null`. When the underlying column is NULL,
 *  both ST calls return NULL and the adapter yields `coordinates: null`
 *  — honest, no fabricated location. */
export const SELECT_COLUMNS =
  "canonical_business_id, entity_type, country, lifecycle_state, " +
  "name_canonical, name_norm, aliases, phone_e164, website_apex, " +
  "osm_id, wikidata_qid, city, district, street_line, neighbourhood, " +
  "address, " +
  "category_ids, services_products, " +
  "supersedes_business_id, superseded_by_business_id, " +
  "last_verified_at, " +
  "ST_Y(coordinates::geometry) AS coordinates_lat, " +
  "ST_X(coordinates::geometry) AS coordinates_lng";

interface RawCanonicalRow {
  canonical_business_id: string;
  entity_type: string;
  country: string;
  lifecycle_state: string;
  name_canonical: string;
  name_norm: string;
  aliases: string[] | null;
  phone_e164: string | null;
  website_apex: string | null;
  osm_id: string | null;
  wikidata_qid: string | null;
  city: string | null;
  district: string | null;
  /** Migration 178 · dedicated street-line text column. */
  street_line: string | null;
  /** Migration 178 · neighbourhood text column. */
  neighbourhood: string | null;
  /** address jsonb (migration 167) · pg driver returns jsonb as a
   *  parsed object or null · the sealed shape is enforced upstream by
   *  validateCanonicalAddress in the ingestion harness. Defensive
   *  nullish-with-unknown here to tolerate any legacy pre-sealed
   *  rows (none should exist today). */
  address: {
    line1: string | null;
    postal_code: string | null;
  } | null;
  category_ids: string[] | null;
  services_products: unknown;
  supersedes_business_id: string | null;
  superseded_by_business_id: string | null;
  last_verified_at: string | null;
  /** The pg driver returns PostgreSQL numeric columns as strings by
   *  default. ST_Y / ST_X results come back as string or number
   *  depending on pg driver type-parser configuration · the adapter
   *  parses defensively via `parseCoord`. */
  coordinates_lat: string | number | null;
  coordinates_lng: string | number | null;
}

/** Parse one half of a coordinate pair from a raw pg value into a
 *  bounded number, or null when the value is missing / malformed /
 *  out of range. Pure. Returns null on any uncertainty — the
 *  Directory's no-fabrication contract demands that missing or
 *  suspect location data stay missing. */
function parseCoord(
  value: string | number | null,
  min: number,
  max: number,
): number | null {
  if (value === null || value === undefined) return null;
  // Empty string is an absence, not the valid coordinate 0.
  // `Number("")` is `0`, which would silently pass the finiteness and
  // range checks below and place a listing at (0,0) · the equator /
  // prime meridian ("Null Island"). The no-fabrication contract
  // demands we reject it as missing data.
  if (typeof value === "string" && value.trim().length === 0) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

/** Adapt one pg row into the Phase B input shape. Pure. Deterministic.
 *  Preserves nullability honestly · DB CHECKs guarantee the string
 *  values conform to their respective enums, but we defensively drop
 *  any row whose enum values are outside the sealed sets (returns
 *  null · the caller filters nulls). */
export function adaptRawCanonicalRow(
  raw: RawCanonicalRow,
): DirectoryCanonicalRow | null {
  if (!isSealedEntityType(raw.entity_type)) return null;
  if (!isSealedLifecycleState(raw.lifecycle_state)) return null;
  // Coordinates: both halves must be present and in-range for the pair
  // to produce a non-null DirectoryCoordinates. Either side being null
  // or out-of-bounds yields `coordinates: null` honestly · no partial
  // coordinate, no city-centre fallback, no fabricated location.
  const lat = parseCoord(raw.coordinates_lat, -90, 90);
  const lng = parseCoord(raw.coordinates_lng, -180, 180);
  const coordinates = lat !== null && lng !== null ? { lat, lng } : null;
  return {
    canonical_business_id: raw.canonical_business_id,
    entity_type: raw.entity_type,
    country: raw.country,
    lifecycle_state: raw.lifecycle_state,
    name_canonical: raw.name_canonical,
    aliases: raw.aliases ?? [],
    phone_e164: raw.phone_e164,
    website_apex: raw.website_apex,
    osm_id: raw.osm_id,
    wikidata_qid: raw.wikidata_qid,
    city: raw.city,
    district: raw.district,
    street_line: raw.street_line,
    neighbourhood: raw.neighbourhood,
    address: raw.address,
    coordinates,
    category_ids: raw.category_ids ?? [],
    services_products: raw.services_products ?? null,
    supersedes_business_id: raw.supersedes_business_id,
    superseded_by_business_id: raw.superseded_by_business_id,
    last_verified_at: raw.last_verified_at,
  };
}

function isSealedEntityType(v: string): v is EntityType {
  return (
    BUSINESS_ENTITY_TYPES.includes(v as EntityType) ||
    PERSON_ENTITY_TYPES.includes(v as EntityType) ||
    PLACE_ENTITY_TYPES.includes(v as EntityType)
  );
}

const SEALED_LIFECYCLE_STATES: readonly LifecycleState[] = [
  "DISCOVERED",
  "ENRICHED",
  "VERIFIED",
  "OWNER_CLAIMED",
  "OWNER_VERIFIED",
  "DORMANT",
  "SUPERSEDED",
];

function isSealedLifecycleState(v: string): v is LifecycleState {
  return SEALED_LIFECYCLE_STATES.includes(v as LifecycleState);
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Owner-link lookup stub
// ═════════════════════════════════════════════════════════════════════

/**
 * Fetch the owner claim (business slug or user profile handle) for a
 * batch of canonical rows.
 *
 * STUB. Returns an empty map; every row resolves with no claim.
 *
 * The real implementation must span two physical databases:
 *
 *   nex_business            → Supabase ijvqdvsvwtwxzcqmoqit (public.*)
 *   nex.business_canonical  → NEX Canonical PostgreSQL (nex.*)
 *
 * PostgreSQL has no cross-database FK. The owner-link resolution
 * strategy therefore needs its own ADR before this stub becomes real.
 * The service's return shape stays the same; only this function body
 * changes when that ADR lands.
 */
export async function fetchOwnerClaimsByCanonicalId(
  _canonicalIds: readonly string[],
): Promise<ReadonlyMap<string, OwnerClaim>> {
  // Stub · the architectural shape is in place; no fabrication.
  return new Map();
}

// ═════════════════════════════════════════════════════════════════════
// §5 · The sealed query builder
// ═════════════════════════════════════════════════════════════════════

interface CanonicalQueryInputs {
  readonly country: string;
  readonly q: string | null;
  readonly entityTypes: readonly EntityType[] | null;
  readonly limit: number;
  readonly offset: number;
}

export interface BuiltCanonicalSql {
  readonly sql: string;
  readonly params: readonly unknown[];
}

/** Build the parameterised SELECT against nex.business_canonical.
 *  Pure · deterministic · no network, no clock, no randomness.
 *
 *  User-controlled values (country, q, entityTypes elements, limit,
 *  offset) are NEVER string-interpolated into the SQL text. They are
 *  bound as positional parameters, left-to-right as the WHERE clauses
 *  are appended. The LIMIT and OFFSET parameters are always appended
 *  last so their positions shift with the optional filters.
 *
 *  Column identifiers come from the sealed `SELECT_COLUMNS` constant.
 *  The table reference `nex.business_canonical` is a hard-coded
 *  schema-qualified identifier · parameters cannot be identifiers. */
export function buildCanonicalSql(
  inputs: CanonicalQueryInputs,
): BuiltCanonicalSql {
  // The lifecycle predicate (D-1 · L1) and source-permission predicate
  // (D-2 · can_display OR aggregation) live inside the sealed
  // `nex.business_directory_v` view. The service only applies the
  // visitor-chosen filters (country, entity_type, q) + pagination.
  const whereClauses: string[] = ["country = $1"];
  const params: unknown[] = [inputs.country];
  if (inputs.entityTypes !== null && inputs.entityTypes.length > 0) {
    params.push([...inputs.entityTypes]);
    whereClauses.push(`entity_type = ANY($${params.length}::text[])`);
  }
  if (inputs.q !== null && inputs.q.length > 0) {
    // Case-insensitive LIKE against name_norm. Trigram index on the
    // base table (idx_bc_name_norm_trgm) speeds this; the view
    // transparently exposes `name_norm`.
    params.push(`%${inputs.q}%`);
    whereClauses.push(`name_norm ILIKE $${params.length}`);
  }
  params.push(inputs.limit);
  const limitIdx = params.length;
  params.push(inputs.offset);
  const offsetIdx = params.length;
  const sql =
    `SELECT ${SELECT_COLUMNS} ` +
    `FROM nex.${DIRECTORY_PUBLICATION_VIEW} ` +
    `WHERE ${whereClauses.join(" AND ")} ` +
    `LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
  return { sql, params };
}

/** Build the COUNT(*) companion to `buildCanonicalSql`. Same WHERE
 *  predicate · no LIMIT · no OFFSET · no ORDER BY. Used by `listDirectory`
 *  to populate `ListDirectoryOutcome.total` so the UI can render page
 *  counts and Prev/Next controls accurately.
 *
 *  Pure · deterministic · zero fabrication: the count is produced by
 *  the DB, not by the service. */
export function buildCanonicalCountSql(
  inputs: Omit<CanonicalQueryInputs, "limit" | "offset">,
): BuiltCanonicalSql {
  const whereClauses: string[] = ["country = $1"];
  const params: unknown[] = [inputs.country];
  if (inputs.entityTypes !== null && inputs.entityTypes.length > 0) {
    params.push([...inputs.entityTypes]);
    whereClauses.push(`entity_type = ANY($${params.length}::text[])`);
  }
  if (inputs.q !== null && inputs.q.length > 0) {
    params.push(`%${inputs.q}%`);
    whereClauses.push(`name_norm ILIKE $${params.length}`);
  }
  const sql =
    `SELECT COUNT(*)::int AS n ` +
    `FROM nex.${DIRECTORY_PUBLICATION_VIEW} ` +
    `WHERE ${whereClauses.join(" AND ")}`;
  return { sql, params };
}

/** Minimal credential-safe redactor for diagnostic strings. Strips
 *  connection URLs and password=... fragments before a pg error
 *  surfaces through the service's diagnostic field. Belt-and-braces ·
 *  the pg driver rarely echoes credentials in error text, but errors
 *  in the wild sometimes do. */
function sanitiseError(message: string): string {
  let out = message;
  out = out.replace(
    /postgres(?:ql)?:\/\/[^:]*:[^@]*@[^\s'"]+/gi,
    "postgres://[redacted]",
  );
  out = out.replace(/password\s*=\s*['"][^'"]*['"]/gi, "password=[redacted]");
  out = out.replace(/password\s*=\s*\S+/gi, "password=[redacted]");
  return out;
}

// ═════════════════════════════════════════════════════════════════════
// §6 · listDirectory · the one authoritative read entry point
// ═════════════════════════════════════════════════════════════════════

/**
 * List Directory listings + their destinations for a given country.
 *
 * Reads nex.business_canonical via the shared NEX Postgres pool
 * (`withClient` from `@/lib/nex/db`). Projects via Phase B. Resolves
 * via Phase C. Never fabricates.
 *
 * Returns an "outcome" that discriminates:
 *   · `systemReady: true`  → the DB was reached. `results` is the
 *                            honest answer (possibly empty).
 *   · `systemReady: false` → the DB could not be reached (URL unset,
 *                            schema or table missing, auth failure,
 *                            network error). `results` is [].
 *                            The UI renders a "being prepared" state.
 */
export async function listDirectory(
  args: ListDirectoryArgs,
): Promise<ListDirectoryOutcome> {
  const classification = args.classification ?? "all";
  const entityTypes =
    classification === "business"
      ? BUSINESS_ENTITY_TYPES
      : classification === "person"
        ? PERSON_ENTITY_TYPES
        : classification === "place"
          ? PLACE_ENTITY_TYPES
          : null;

  const sharedWhere = {
    country: args.country,
    q: args.q && args.q.length > 0 ? args.q : null,
    entityTypes,
  };
  const { sql, params } = buildCanonicalSql({
    ...sharedWhere,
    limit: args.limit ?? DEFAULT_LIMIT,
    offset: args.offset ?? 0,
  });
  const countBuilt = buildCanonicalCountSql(sharedWhere);

  let rows: RawCanonicalRow[] = [];
  let total = 0;
  let systemReady = true;
  let diagnostic: string | null = null;

  try {
    // Run the SELECT and the COUNT(*) in parallel against the same
    // pool · one connection acquisition per client call via withClient.
    const [pageResult, countResult] = await Promise.all([
      withClient(async (client) => client.query(sql, params as unknown[])),
      withClient(async (client) =>
        client.query(countBuilt.sql, countBuilt.params as unknown[]),
      ),
    ]);
    if (pageResult === null || countResult === null) {
      systemReady = false;
      diagnostic = "directory-service: NEX_POSTGRES_URL not set";
    } else {
      rows = (pageResult.rows ?? []) as unknown as RawCanonicalRow[];
      const countRow = (countResult.rows?.[0] ?? null) as { n?: number } | null;
      total = typeof countRow?.n === "number" ? countRow.n : 0;
    }
  } catch (err) {
    systemReady = false;
    const message = err instanceof Error ? err.message : String(err);
    diagnostic = `directory-service: pg error · ${sanitiseError(message)}`;
  }

  if (!systemReady) {
    return { results: [], systemReady, diagnostic, total: 0 };
  }

  // Adapt raw rows → DirectoryCanonicalRow[]. Rows that fail the
  // sealed-enum checks are dropped (defensive · DB CHECKs should
  // make this impossible but we never fabricate a value to recover).
  const adapted: DirectoryCanonicalRow[] = [];
  for (const r of rows) {
    const a = adaptRawCanonicalRow(r);
    if (a !== null) adapted.push(a);
  }

  // Project → VMs. Media is null today (migration 173 deferred).
  const listings = projectDirectoryListings({
    rows: adapted,
    mediaByCanonicalId: EMPTY_MEDIA_MAP,
  });

  // Resolve destinations. Owner claims are empty today (stub).
  const claims = await fetchOwnerClaimsByCanonicalId(
    adapted.map((a) => a.canonical_business_id),
  );
  const destinations = resolveDirectoryDestinations({
    listings,
    claimsByCanonicalId: claims,
  });

  const results: DirectoryListingResult[] = [];
  for (let i = 0; i < listings.length; i++) {
    results.push({ listing: listings[i], destination: destinations[i] });
  }

  return { results, systemReady: true, diagnostic: null, total };
}

const EMPTY_MEDIA_MAP: ReadonlyMap<string, DirectoryListingMedia> = new Map();

// ═════════════════════════════════════════════════════════════════════
// §6b · getCanonicalBusinessById · single-row read for the detail page
// ═════════════════════════════════════════════════════════════════════

/** Defensive UUID shape guard. The Postgres driver would reject a
 *  malformed uuid parameter with an error, but failing fast here
 *  returns a clean 404 for obvious junk ids (bots probing routes,
 *  typos in URLs) without opening a connection. The regex intentionally
 *  accepts any valid UUID shape · it does NOT enforce the v4 variant
 *  nibble because older canonical rows may have been generated with
 *  a different v. Pure. */
export function isUuidShape(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    v,
  );
}

/**
 * Fetch one canonical row by id, project via Phase B, resolve via
 * Phase C, and check whether a corresponding evidence row exists.
 *
 * Three outcomes:
 *   · systemReady false              → DB unreachable (preparing)
 *   · systemReady true, result null  → not found / invalid id (404)
 *   · systemReady true, result set   → ready to render on the detail page
 *
 * Evidence is read as a presence check only (`SELECT 1 ... LIMIT 1`).
 * Evidence internals are NOT exposed to the visitor; the detail page
 * surfaces only a "Verified listing" indicator derived from
 * `hasEvidence === true`. Evidence provenance is operational state.
 *
 * The SELECT reuses `SELECT_COLUMNS` byte-identically with
 * `listDirectory` so the row adaptation stays consistent.
 */
export async function getCanonicalBusinessById(
  canonicalBusinessId: string,
): Promise<GetCanonicalBusinessOutcome> {
  // Fail fast on obvious junk ids. Returns "not found" (404), not an error.
  if (!isUuidShape(canonicalBusinessId)) {
    return { result: null, systemReady: true, diagnostic: null };
  }

  // The detail-page query reads from the sealed publication view, not
  // the raw canonical table. A visitor who guesses a canonical_
  // business_id must only be able to resolve to a row the view
  // permits · the gate applies uniformly to list AND detail paths.
  const canonicalSql =
    `SELECT ${SELECT_COLUMNS} ` +
    `FROM nex.${DIRECTORY_PUBLICATION_VIEW} ` +
    `WHERE canonical_business_id = $1 ` +
    `LIMIT 1`;
  // The hasEvidence presence check reads directly from the sealed
  // evidence table · the Boolean it returns is operational metadata
  // ("provenance exists"), not a publication predicate.
  const evidenceSql =
    `SELECT 1 AS present ` +
    `FROM nex.business_evidence ` +
    `WHERE canonical_business_id = $1 ` +
    `LIMIT 1`;

  let rawRow: RawCanonicalRow | null = null;
  let hasEvidence = false;
  let systemReady = true;
  let diagnostic: string | null = null;

  try {
    const outcome = await withClient(async (client) => {
      const canonicalRes = await client.query(canonicalSql, [
        canonicalBusinessId,
      ]);
      if (canonicalRes.rows.length === 0) {
        return { row: null, hasEvidence: false };
      }
      const evidenceRes = await client.query(evidenceSql, [
        canonicalBusinessId,
      ]);
      return {
        row: canonicalRes.rows[0] as unknown as RawCanonicalRow,
        hasEvidence: evidenceRes.rows.length > 0,
      };
    });
    if (outcome === null) {
      systemReady = false;
      diagnostic = "directory-service: NEX_POSTGRES_URL not set";
    } else {
      rawRow = outcome.row;
      hasEvidence = outcome.hasEvidence;
    }
  } catch (err) {
    systemReady = false;
    const message = err instanceof Error ? err.message : String(err);
    diagnostic = `directory-service: pg error · ${sanitiseError(message)}`;
  }

  if (!systemReady) {
    return { result: null, systemReady, diagnostic };
  }
  if (rawRow === null) {
    // Row not found. The caller renders a 404 ("Listing not found")
    // state without fabricating a placeholder listing.
    return { result: null, systemReady: true, diagnostic: null };
  }

  const adapted = adaptRawCanonicalRow(rawRow);
  if (adapted === null) {
    // Row exists but its enum values are outside the sealed sets.
    // Treat as not-found rather than render a defective listing.
    return { result: null, systemReady: true, diagnostic: null };
  }

  const listings = projectDirectoryListings({
    rows: [adapted],
    mediaByCanonicalId: EMPTY_MEDIA_MAP,
  });
  const claims = await fetchOwnerClaimsByCanonicalId([
    adapted.canonical_business_id,
  ]);
  const destinations = resolveDirectoryDestinations({
    listings,
    claimsByCanonicalId: claims,
  });

  return {
    result: {
      listing: listings[0],
      destination: destinations[0],
      hasEvidence,
    },
    systemReady: true,
    diagnostic: null,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §7 · Pure helpers exported for tests
// ═════════════════════════════════════════════════════════════════════

/**
 * Expose the row adapter, sealed-set guards, and the pure SQL builder
 * for unit tests. The service's live query is covered by integration
 * tests that run against a mocked `withClient`; the pure helpers are
 * covered here.
 */
export const _internal = {
  adaptRawCanonicalRow,
  isSealedEntityType,
  isSealedLifecycleState,
  SEALED_LIFECYCLE_STATES,
  buildCanonicalSql,
  sanitiseError,
  isUuidShape,
  parseCoord,
};

// ═════════════════════════════════════════════════════════════════════
// §8 · Re-exports for Phase A UI
// ═════════════════════════════════════════════════════════════════════

export type {
  DirectoryClassification,
  DirectoryCoordinates,
  DirectoryListingVM,
  EntityType,
  LifecycleState,
  DirectoryDestination,
  OwnerClaim,
};
