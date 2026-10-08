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
//   · When migration 175 lands, consider reading
//     `nex.business_directory_v` instead of the raw canonical table
//     for taxonomy + attribution signals already baked in.

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

/** The sealed canonical table that Phase A reads from. */
export const CANONICAL_TABLE = "business_canonical" as const;
/** The sealed schema name. The service reads
 *  `nex.business_canonical` directly over the pg driver. */
export const CANONICAL_SCHEMA = "nex" as const;

/** Maximum rows returned per call. Phase A UI paginates via `offset`. */
export const DEFAULT_LIMIT = 24;

/** The lifecycle states the Directory surfaces to users. */
export const SURFACED_LIFECYCLE_STATES: readonly LifecycleState[] = [
  "DISCOVERED",
  "ENRICHED",
  "VERIFIED",
  "OWNER_CLAIMED",
  "OWNER_VERIFIED",
  "DORMANT",
] as const;

// `SUPERSEDED` is deliberately excluded — a superseded canonical row's
// content has been absorbed into its successor. The service layer
// filters it at the DB and the UI never sees it.

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
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Row-shape adaptation · pg row → DirectoryCanonicalRow
// ═════════════════════════════════════════════════════════════════════

/** The subset of columns the service SELECTs. Deliberately omits
 *  `coordinates` (PostGIS geography) · the raw pg driver cannot return
 *  a geography column as structured { lat, lng } without an explicit
 *  ST_X / ST_Y SELECT shape. A future wave will add geography-aware
 *  columns; until then, the Directory shows no map pin / no distance
 *  (honest — exactly what the founder authorised). */
export const SELECT_COLUMNS =
  "canonical_business_id, entity_type, country, lifecycle_state, " +
  "name_canonical, name_norm, aliases, phone_e164, website_apex, " +
  "osm_id, wikidata_qid, city, district, category_ids, " +
  "services_products, supersedes_business_id, superseded_by_business_id, " +
  "last_verified_at";

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
  category_ids: string[] | null;
  services_products: unknown;
  supersedes_business_id: string | null;
  superseded_by_business_id: string | null;
  last_verified_at: string | null;
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
    coordinates: null,
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
  const whereClauses: string[] = [
    "country = $1",
    "lifecycle_state = ANY($2::text[])",
  ];
  const params: unknown[] = [
    inputs.country,
    [...SURFACED_LIFECYCLE_STATES],
  ];
  if (inputs.entityTypes !== null && inputs.entityTypes.length > 0) {
    params.push([...inputs.entityTypes]);
    whereClauses.push(`entity_type = ANY($${params.length}::text[])`);
  }
  if (inputs.q !== null && inputs.q.length > 0) {
    // Case-insensitive LIKE against name_norm. Trigram index speeds
    // this; we keep the surface simple (no full-text query DSL in
    // Phase A). Aliases search is deferred to a later wave.
    params.push(`%${inputs.q}%`);
    whereClauses.push(`name_norm ILIKE $${params.length}`);
  }
  params.push(inputs.limit);
  const limitIdx = params.length;
  params.push(inputs.offset);
  const offsetIdx = params.length;
  const sql =
    `SELECT ${SELECT_COLUMNS} ` +
    `FROM nex.business_canonical ` +
    `WHERE ${whereClauses.join(" AND ")} ` +
    `LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
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

  const { sql, params } = buildCanonicalSql({
    country: args.country,
    q: args.q && args.q.length > 0 ? args.q : null,
    entityTypes,
    limit: args.limit ?? DEFAULT_LIMIT,
    offset: args.offset ?? 0,
  });

  let rows: RawCanonicalRow[] = [];
  let systemReady = true;
  let diagnostic: string | null = null;

  try {
    const queryResult = await withClient(async (client) => {
      return client.query(sql, params as unknown[]);
    });
    if (queryResult === null) {
      // withClient returns null when NEX_POSTGRES_URL is unset / empty.
      // This is the honest "not configured" state. The UI renders
      // "being prepared" — no fabrication.
      systemReady = false;
      diagnostic = "directory-service: NEX_POSTGRES_URL not set";
    } else {
      rows = (queryResult.rows ?? []) as unknown as RawCanonicalRow[];
    }
  } catch (err) {
    systemReady = false;
    const message = err instanceof Error ? err.message : String(err);
    diagnostic = `directory-service: pg error · ${sanitiseError(message)}`;
  }

  if (!systemReady) {
    return { results: [], systemReady, diagnostic };
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

  return { results, systemReady: true, diagnostic: null };
}

const EMPTY_MEDIA_MAP: ReadonlyMap<string, DirectoryListingMedia> = new Map();

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
