// scripts/nex-canonical/source-legacy-transport.ts
//
// NEX Canonical · The transport source adapter · nex.transport_acquisition_record.
//
// Schema reference · the sealed enum nex.transport_provider_kind
// (seven values · individual_driver · driver_operator · fleet_operator ·
// transport_business · courier_operator · logistics_operator · unknown)
// and the live columns of nex.transport_acquisition_record (see migration
// chain seeded through the acquisition pipeline). Driver legal model
// reference · migration 091_nex_transport_legal_model_and_pdp.sql.
//
// What this adapter is
//   · A pure DirectorySource implementation
//   · Issues keyset-paginated SELECT · one small batch at a time
//   · Projects legacy rows into sealed Candidate objects via a pure
//     projection function
//   · Routes each row to `entity_type='transport_driver'` or
//     `transport_operator` based on the sealed provider_kind rule
//     established by `generate-candidates.ts` (Rule 5l alignment)
//   · Refuses to invent data · a row that cannot safely project
//     (quarantined provider_kind, no identifying name, no deterministic
//     key) is dropped from the batch with a projection_failed result
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
// Entity-type routing rule (sealed · mirrors generate-candidates.ts §6)
//   provider_kind = individual_driver | driver_operator
//                 → entity_type = 'transport_driver'   (natural person)
//   provider_kind = fleet_operator | transport_business
//                 | courier_operator | logistics_operator
//                 → entity_type = 'transport_operator' (legal entity)
//   provider_kind = unknown
//                 → QUARANTINED · the adapter cannot distinguish natural
//                   person vs legal entity, so the row is dropped as a
//                   projection failure. Downstream Rule 5l already
//                   excludes these from candidate generation.
//
// PII handling · migration 091 legal model
//   nex.transport_acquisition_record carries two name fields:
//     · business_name          — the operator / fleet trading name
//     · contact_person_name    — a natural person's name
//
//   Migration 091 is the sealed legal boundary for transport. It
//   requires that natural-person driver information be processed only
//   under a stated PDP purpose with a recorded lawful basis. The
//   source_registry anchor for this legacy table (migration 188) does
//   NOT grant `can_display` and does NOT grant `can_redistribute` ·
//   publication is reserved for a downstream lifecycle_state decision
//   under the sealed intelligence layer.
//
//   To avoid emitting a natural-person name into business_canonical as
//   `name_canonical` on a transport_driver candidate (which would set
//   the operational identity before the PDP purpose/basis is recorded),
//   the adapter uses `business_name` as `name_canonical` whenever it
//   is populated. If a transport_driver row has ONLY
//   `contact_person_name`, projection fails (the row cannot be safely
//   seeded without identity signals the PDP boundary permits in the
//   canonical layer). This is the sealed behaviour · it is intentional
//   abstention, not data loss · the raw row stays in
//   nex.transport_acquisition_record, which is governed by migration 091
//   and the authority-request pathway, not by the public directory
//   layer.
//
//   For transport_operator rows (legal entities, not natural persons),
//   the business_name path is also preferred · a `contact_person_name`
//   alone is never promoted to `name_canonical` because that would mix
//   a natural-person signal into the canonical operator identity.
//
// Country handling
//   · nex.transport_acquisition_record carries home_jurisdiction (e.g.
//     'ID/DIY/Yogyakarta'). The adapter derives country as the first
//     path segment (the ISO-3166-1 alpha-2 code) when it parses
//     cleanly; otherwise it falls back to LEGACY_TRANSPORT_COUNTRY.
//   · The current seed data is Indonesia-only, matching the sealed
//     first-wave scope.

import { createHash } from "node:crypto";
import type { Candidate, EntityType } from "./generate-candidates";
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
export const LEGACY_TRANSPORT_SOURCE_ID =
  "nex_transport_acquisition_legacy" as const;

/** Fallback country stamped on rows whose home_jurisdiction cannot be
 *  parsed. Matches the sealed first-wave scope (Indonesia). Change
 *  requires a documented adapter extension. */
export const LEGACY_TRANSPORT_COUNTRY = "ID" as const;

/** Default rows per batch. Keep small so retries are cheap. */
export const LEGACY_TRANSPORT_DEFAULT_BATCH_SIZE = 50;

/** Provider-kind literals exactly as they appear in the sealed enum
 *  nex.transport_provider_kind. Kept here so the routing rule is
 *  statically checkable and does not drift from the enum. */
export const PROVIDER_KINDS_NATURAL_PERSON: readonly string[] = Object.freeze([
  "individual_driver",
  "driver_operator",
]);

export const PROVIDER_KINDS_LEGAL_ENTITY: readonly string[] = Object.freeze([
  "fleet_operator",
  "transport_business",
  "courier_operator",
  "logistics_operator",
]);

export const PROVIDER_KINDS_QUARANTINED: readonly string[] = Object.freeze([
  "unknown",
]);

export interface LegacyTransportSourceConfig {
  readonly batchSize?: number;
  readonly generationRunId: string;
  readonly nowIso: () => string;
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Raw row shape · reflects the live columns the adapter reads
// ═════════════════════════════════════════════════════════════════════

interface RawTransportRow {
  readonly provider_id: string;
  readonly provider_kind: string;
  readonly business_name: string | null;
  readonly contact_person_name: string | null;
  readonly canonical_phone_e164: string | null;
  readonly website: string | null;
  readonly home_jurisdiction: string | null;
  readonly city: string | null;
  readonly province: string | null;
  readonly discovery_stage: string | null;
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Pure projection · raw row → sealed Candidate
// ═════════════════════════════════════════════════════════════════════

export interface ProjectionFailure {
  readonly kind: "projection_failed";
  readonly provider_id: string | null;
  readonly reason: string;
}

export type ProjectionResult =
  | { readonly kind: "ok"; readonly candidate: Candidate }
  | ProjectionFailure;

/** Routes a provider_kind string to a sealed entity_type OR null when
 *  the kind is quarantined / unrecognised. Mirrors the sealed rule
 *  encoded in generate-candidates.ts §6 (Rule 5l alignment). */
export function routeProviderKindToEntityType(
  provider_kind: string,
): EntityType | null {
  if (PROVIDER_KINDS_QUARANTINED.includes(provider_kind)) return null;
  if (PROVIDER_KINDS_NATURAL_PERSON.includes(provider_kind)) {
    return "transport_driver";
  }
  if (PROVIDER_KINDS_LEGAL_ENTITY.includes(provider_kind)) {
    return "transport_operator";
  }
  return null;
}

/** Pure · deterministic given identical input. Rows missing required
 *  identity (business_name) or carrying a quarantined provider_kind are
 *  rejected. Natural-person `contact_person_name` is NEVER promoted to
 *  `name_canonical` · see the PII handling note in the file header. */
export function projectTransportRow(
  row: RawTransportRow,
  config: LegacyTransportSourceConfig,
): ProjectionResult {
  if (!row.provider_id || typeof row.provider_id !== "string") {
    return {
      kind: "projection_failed",
      provider_id: null,
      reason: "provider_id missing or not a string",
    };
  }
  if (!row.provider_kind || typeof row.provider_kind !== "string") {
    return {
      kind: "projection_failed",
      provider_id: row.provider_id,
      reason: "provider_kind missing or not a string",
    };
  }

  const entity_type = routeProviderKindToEntityType(row.provider_kind);
  if (entity_type === null) {
    return {
      kind: "projection_failed",
      provider_id: row.provider_id,
      reason: `provider_kind='${row.provider_kind}' is quarantined or unrecognised · cannot route to transport_driver/transport_operator`,
    };
  }

  // PII guard · migration 091 legal boundary.
  // name_canonical MUST come from business_name. A row with only
  // contact_person_name is a natural-person signal that must not be
  // promoted into business_canonical at this stage.
  const bname = row.business_name?.trim() ?? "";
  if (bname.length === 0) {
    return {
      kind: "projection_failed",
      provider_id: row.provider_id,
      reason:
        "business_name missing or blank · PII guard · contact_person_name is NOT promoted to name_canonical (migration 091 legal boundary)",
    };
  }

  // candidate_id is deterministic given (table, provider_id). Using a
  // sha256-prefix of the deterministic key keeps the id compact,
  // reversible to source, and stable across reruns.
  const candidate_id = `cand-nex-transport-${sha256Prefix(
    `nex.transport_acquisition_record|${row.provider_id}`,
    16,
  )}`;

  // Phone: pass through only if already E.164 shaped. The source
  // column is `canonical_phone_e164` which the acquisition pipeline
  // already normalises, but we validate defensively · we DO NOT
  // normalise, we DO NOT invent · non-conforming phones become null.
  const phone_e164 =
    row.canonical_phone_e164 &&
    /^\+[1-9][0-9]{6,14}$/.test(row.canonical_phone_e164)
      ? row.canonical_phone_e164
      : null;

  // Website apex: strip protocol + leading www. Null if parse fails.
  const website_apex = extractWebsiteApex(row.website);

  // Country from home_jurisdiction · first path segment (ISO-3166-1
  // alpha-2). Fallback to LEGACY_TRANSPORT_COUNTRY on parse failure.
  const country = parseCountryFromJurisdiction(row.home_jurisdiction);

  const candidate: Candidate = {
    candidate_id,
    status: "pending_founder_review",
    entity_type,
    country,
    identity: {
      name_canonical: bname,
      aliases: [],
      phone_e164,
      website_apex,
      osm_id: null,
      wikidata_qid: null,
      city: row.city?.trim() || null,
      // nex.transport_acquisition_record has no `district` column ·
      // honest absence.
      district: null,
      // No structured street_line · the table has no street column.
      street_line: null,
      // No neighbourhood column either.
      neighbourhood: null,
      // No free-text address column · honest null.
      address: null,
      // No coordinates column on this table.
      coordinates: null,
    },
    legacy_source: {
      table: "nex.transport_acquisition_record",
      ref: row.provider_id,
      internal_id: row.provider_id,
    },
    risk_categories: ["R1"],
    selection_score: 0.5,
    selection_rationale: [
      {
        risk_category: "R1",
        contribution: 0.5,
        note: "legacy transport_acquisition_record ingestion · acquisition pipeline hint",
      },
    ],
    generation_source: {
      generator: "scripts/nex-canonical/generate-candidates.ts",
      generated_at: config.nowIso(),
      generation_run_id: config.generationRunId,
    },
    caveats: [
      `legacy-adapter projection · provider_kind="${row.provider_kind}" · discovery_stage="${row.discovery_stage ?? "unknown"}" · PII-guarded (migration 091)`,
    ],
  };
  return { kind: "ok", candidate };
}

function parseCountryFromJurisdiction(j: string | null): string {
  if (!j) return LEGACY_TRANSPORT_COUNTRY;
  const first = j.split("/")[0]?.trim() ?? "";
  // Accept a two-letter uppercase ISO-3166-1 alpha-2. Anything else
  // falls back to the sealed first-wave default.
  if (/^[A-Z]{2}$/.test(first)) return first;
  return LEGACY_TRANSPORT_COUNTRY;
}

function extractWebsiteApex(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return url.host.replace(/^www\./, "").toLowerCase() || null;
  } catch {
    return null;
  }
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
interface TransportCursor
  extends Record<string, string | number | boolean | null> {
  readonly last_provider_id: string;
}

function isTransportCursor(c: SourceCursor | null): c is TransportCursor {
  return c !== null && typeof c.last_provider_id === "string";
}

// ═════════════════════════════════════════════════════════════════════
// §5 · The adapter
// ═════════════════════════════════════════════════════════════════════

export interface CreateLegacyTransportSourceArgs {
  readonly session_factory: ReadSessionFactory;
  readonly config: LegacyTransportSourceConfig;
  /** Country stamped on the DirectorySource · defaults to
   *  LEGACY_TRANSPORT_COUNTRY. The per-row country is still derived
   *  from home_jurisdiction (see parseCountryFromJurisdiction). */
  readonly country?: string;
}

/** Build the real DirectorySource that reads
 *  nex.transport_acquisition_record. */
export function createLegacyTransportSource(
  args: CreateLegacyTransportSourceArgs,
): DirectorySource {
  const batchSize = Math.max(
    1,
    args.config.batchSize ?? LEGACY_TRANSPORT_DEFAULT_BATCH_SIZE,
  );
  return {
    source_id: LEGACY_TRANSPORT_SOURCE_ID,
    country: args.country ?? LEGACY_TRANSPORT_COUNTRY,
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
        // than the cursor's last_provider_id, ordered by provider_id.
        // We fetch +1 to detect "another batch exists" without a
        // separate count.
        const whereClause = isTransportCursor(cursor)
          ? "WHERE provider_id > $1 ORDER BY provider_id ASC LIMIT $2"
          : "ORDER BY provider_id ASC LIMIT $1";
        const sql = `SELECT provider_id, provider_kind::text AS provider_kind,
                            business_name, contact_person_name,
                            canonical_phone_e164, website,
                            home_jurisdiction, city, province,
                            discovery_stage::text AS discovery_stage
                     FROM nex.transport_acquisition_record
                     ${whereClause}`;
        const params = isTransportCursor(cursor)
          ? [cursor.last_provider_id, batchSize + 1]
          : [batchSize + 1];
        const result = await session.query<RawTransportRow>(sql, params);
        if (result.rows.length === 0) {
          return { kind: "exhausted" };
        }
        const hasMore = result.rows.length > batchSize;
        const rows = hasMore ? result.rows.slice(0, batchSize) : result.rows;
        const candidates: Candidate[] = [];
        for (const row of rows) {
          const projection = projectTransportRow(row, args.config);
          if (projection.kind === "ok") {
            candidates.push(projection.candidate);
          }
          // Projection failures (missing business_name, quarantined
          // provider_kind) are silently dropped at the batch level ·
          // the sealed candidate-validator would catch them anyway.
          // The raw row remains in nex.transport_acquisition_record,
          // governed by migration 091.
        }
        const nextCursor: SourceCursor | null = hasMore
          ? ({
              last_provider_id: rows[rows.length - 1].provider_id,
            } satisfies TransportCursor)
          : null;
        return { kind: "more", candidates, next_cursor: nextCursor };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
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
//   · routes rows to entity_type ∈ {transport_driver, transport_operator}
//     ONLY via the sealed provider_kind rule (Rule 5l alignment) ·
//     quarantined kinds are dropped
//   · NEVER promotes `contact_person_name` to `name_canonical` ·
//     migration 091 PII boundary is honoured by refusing projection
//     when `business_name` is absent
//   · does NOT invoke the resolver, approval, precheck, or write
//     paths · it only produces Candidates for the runner
//   · does NOT bypass the sealed candidate-validator · projections
//     are shaped to pass validation only when the row carries the
//     required signals
//   · does NOT read credentials · the ReadSessionFactory is injected
//   · does NOT write to any DB · all SQL is SELECT only, and the
//     adapter session is read-only at the pg level
//   · issues keyset-paginated SELECTs that advance deterministically
//     via `provider_id` (uuid PK · stable per row)
