// scripts/nex-canonical/canonical-readback.ts
//
// NEX Canonical · Independent read-back verifier.
//
// Opens its own short-lived READ-ONLY PostgreSQL session, separate
// from the one `executeWritePlan` used, and independently proves that:
//   · the canonical_business_id exists
//   · the canonical row carries the fields the plan intended to write
//   · the evidence row exists
//   · the evidence row's canonical_business_id matches
//   · candidate_id / integrity_hash / decision_record_id / review_package_id
//     match the input plan
//   · resolver_verdict_summary matches
//   · source_id matches
//   · exactly ONE canonical and ONE evidence row were produced by this
//     plan (no accidental duplicates, no stray evidence)
//
// This verifier does NOT trust the return value from `executeWritePlan`.
// It queries the database directly in a session that was never used
// by the write.

import { Client } from "pg";
import type { CanonicalWritePlan, HandoffEvidence } from "./canonical-handoff";
import { abstained, answered, type IntelligenceResult } from "./intelligence-result";

// ═════════════════════════════════════════════════════════════════════
// §1 · Config
// ═════════════════════════════════════════════════════════════════════

export interface CanonicalReadbackConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  readonly ssl: boolean;
  readonly statementTimeoutMs: number;
  readonly connectionTimeoutMillis: number;
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Public result
// ═════════════════════════════════════════════════════════════════════

export interface FieldComparison {
  readonly field: string;
  readonly expected: unknown;
  readonly observed: unknown;
  readonly match: boolean;
}

export interface CanonicalReadbackReport {
  readonly canonical_business_id: string;
  readonly evidence_id: string;
  readonly canonical_row_found: boolean;
  readonly evidence_row_found: boolean;
  readonly canonical_row_count_for_id: number;
  readonly evidence_row_count_for_id: number;
  readonly evidence_row_count_for_decision_record: number;
  readonly comparisons: readonly FieldComparison[];
  readonly all_fields_match: boolean;
  readonly no_duplicates: boolean;
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Readback query interface · injectable for tests
// ═════════════════════════════════════════════════════════════════════

export interface ReadbackSession {
  readonly id: string;
  query<T = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[],
  ): Promise<{ readonly rows: readonly T[]; readonly rowCount: number }>;
}

export interface ReadbackSessionFactory {
  readonly openSession: () => Promise<ReadbackSession>;
  readonly closeSession: (s: ReadbackSession) => Promise<void>;
}

/** Build a production ReadbackSessionFactory. Opens one short-lived
 *  pg.Client, sets session-level read-only + statement_timeout, and
 *  tears it down on close. */
export function createPgReadbackSessionFactory(
  config: CanonicalReadbackConfig,
): ReadbackSessionFactory {
  let counter = 0;
  const clientBySession = new WeakMap<ReadbackSession, Client>();
  return {
    openSession: async () => {
      counter++;
      const client = new Client({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.ssl ? { rejectUnauthorized: false } : false,
        statement_timeout: config.statementTimeoutMs,
        query_timeout: config.statementTimeoutMs,
        connectionTimeoutMillis: config.connectionTimeoutMillis,
      });
      await client.connect();
      // Session-level read-only to guarantee the verifier cannot mutate.
      await client.query("SET default_transaction_read_only = on");
      const sessionId = `pg-readback-${counter}`;
      const session: ReadbackSession = {
        id: sessionId,
        query: async <T = Record<string, unknown>>(
          sql: string,
          params: readonly unknown[],
        ) => {
          const result = await client.query<T>(sql, params as unknown[]);
          return {
            rows: result.rows,
            rowCount: result.rowCount ?? result.rows.length,
          };
        },
      };
      clientBySession.set(session, client);
      return session;
    },
    closeSession: async (s) => {
      const client = clientBySession.get(s);
      if (!client) return;
      clientBySession.delete(s);
      try {
        await client.end();
      } catch {
        /* best-effort close */
      }
    },
  };
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Pure comparison helpers
// ═════════════════════════════════════════════════════════════════════

/** Build the ordered field-by-field comparison between the plan's
 *  INTENDED write and the observed canonical + evidence rows. Pure. */
export function buildFieldComparisons(
  plan: CanonicalWritePlan,
  canonicalRow: Record<string, unknown> | null,
  evidenceRow: Record<string, unknown> | null,
): readonly FieldComparison[] {
  const out: FieldComparison[] = [];
  const evidence = plan.evidence;

  // Evidence binding
  push(out, "evidence.candidate_id", evidence.candidate_id, evidenceRow?.candidate_id);
  push(out, "evidence.candidate_integrity_hash", evidence.candidate_integrity_hash, evidenceRow?.candidate_integrity_hash);
  push(out, "evidence.decision_record_id", evidence.decision_record_id, evidenceRow?.decision_record_id);
  push(out, "evidence.review_package_id", evidence.review_package_id, evidenceRow?.review_package_id);
  push(out, "evidence.schema_version", evidence.schema_version, evidenceRow?.schema_version);
  push(out, "evidence.legacy_source_table", evidence.legacy_source.table, evidenceRow?.legacy_source_table);
  push(out, "evidence.legacy_source_ref", evidence.legacy_source.ref, evidenceRow?.legacy_source_ref);
  push(out, "evidence.legacy_source_internal_id", evidence.legacy_source.internal_id, evidenceRow?.legacy_source_internal_id);
  push(out, "evidence.resolver_verdict_kind", evidence.resolver_verdict_summary.kind, evidenceRow?.resolver_verdict_kind);
  push(out, "evidence.resolver_target_id", evidence.resolver_verdict_summary.target_canonical_business_id, evidenceRow?.resolver_target_id);
  push(out, "evidence.resolver_score", evidence.resolver_verdict_summary.score, evidenceRow?.resolver_score, numericEqual);
  push(out, "evidence.observation_generator", evidence.observation_provenance.generator, evidenceRow?.observation_generator);
  push(out, "evidence.observation_run_id", evidence.observation_provenance.generation_run_id, evidenceRow?.observation_run_id);
  push(out, "evidence.observation_founder_id", evidence.observation_provenance.founder_id, evidenceRow?.observation_founder_id);
  push(out, "evidence.source_id", evidence.source_id, evidenceRow?.source_id);

  if (plan.kind === "insert_new") {
    const row = plan.row;
    push(out, "canonical.entity_type", row.entity_type, canonicalRow?.entity_type);
    push(out, "canonical.country", row.country, canonicalRow?.country);
    push(out, "canonical.lifecycle_state", row.lifecycle_state, canonicalRow?.lifecycle_state);
    push(out, "canonical.name_canonical", row.name_canonical, canonicalRow?.name_canonical);
    push(out, "canonical.aliases", row.aliases, canonicalRow?.aliases, arrayEqual);
    push(out, "canonical.phone_e164", row.phone_e164, canonicalRow?.phone_e164);
    push(out, "canonical.website_apex", row.website_apex, canonicalRow?.website_apex);
    push(out, "canonical.osm_id", row.osm_id, canonicalRow?.osm_id);
    push(out, "canonical.wikidata_qid", row.wikidata_qid, canonicalRow?.wikidata_qid);
    push(out, "canonical.city", row.city, canonicalRow?.city);
    push(out, "canonical.district", row.district, canonicalRow?.district);
  } else {
    // merge_match · evidence.canonical_business_id should equal target
    push(out, "evidence.canonical_business_id", plan.target_canonical_business_id, evidenceRow?.canonical_business_id);
  }

  return out;
}

function push(
  out: FieldComparison[],
  field: string,
  expected: unknown,
  observed: unknown,
  eq: (a: unknown, b: unknown) => boolean = defaultEqual,
): void {
  out.push({ field, expected, observed, match: eq(expected, observed) });
}

function defaultEqual(a: unknown, b: unknown): boolean {
  if (a === null && (b === null || b === undefined)) return true;
  if (b === null && a === undefined) return true;
  return a === b;
}

function numericEqual(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) < 1e-9;
  }
  if (
    typeof a === "number" &&
    typeof b === "string" &&
    Number.isFinite(Number(b))
  ) {
    return Math.abs(a - Number(b)) < 1e-9;
  }
  return defaultEqual(a, b);
}

function arrayEqual(a: unknown, b: unknown): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) return defaultEqual(a, b);
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ═════════════════════════════════════════════════════════════════════
// §5 · verifyFirstWriteReadback · the main function
// ═════════════════════════════════════════════════════════════════════

export interface VerifyFirstWriteReadbackArgs {
  readonly session_factory: ReadbackSessionFactory;
  readonly plan: CanonicalWritePlan;
  readonly canonical_business_id: string;
  readonly evidence_id: string;
}

export async function verifyFirstWriteReadback(
  args: VerifyFirstWriteReadbackArgs,
): Promise<IntelligenceResult<CanonicalReadbackReport>> {
  let session: ReadbackSession;
  try {
    session = await args.session_factory.openSession();
  } catch (err) {
    return abstained({
      code: "readback_session_open_failed",
      message: `cannot open readback session: ${err instanceof Error ? err.name : "unknown"}`,
    });
  }

  try {
    // 1 · canonical row by id
    const canonicalRes = await session.query<Record<string, unknown>>(
      `SELECT canonical_business_id, entity_type, country, lifecycle_state,
              name_canonical, name_norm, aliases, phone_e164, website_apex,
              osm_id, wikidata_qid, city, district, supersedes_business_id,
              superseded_by_business_id
       FROM nex.business_canonical
       WHERE canonical_business_id = $1`,
      [args.canonical_business_id],
    );
    const canonicalRow = canonicalRes.rows[0] ?? null;

    // 2 · evidence row by id (and verify it points at the canonical id)
    const evidenceRes = await session.query<Record<string, unknown>>(
      `SELECT evidence_id, canonical_business_id, schema_version,
              candidate_id, candidate_integrity_hash, decision_record_id,
              review_package_id,
              legacy_source_table, legacy_source_ref, legacy_source_internal_id,
              resolver_verdict_kind, resolver_target_id, resolver_score,
              observation_generator, observation_run_id,
              observation_generated_at, observation_decision_timestamp,
              observation_founder_id, source_id
       FROM nex.business_evidence
       WHERE evidence_id = $1`,
      [args.evidence_id],
    );
    const evidenceRow = evidenceRes.rows[0] ?? null;

    // 3 · count by canonical_business_id (both tables)
    const canonicalCountRes = await session.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM nex.business_canonical WHERE canonical_business_id = $1",
      [args.canonical_business_id],
    );
    const canonicalCount = parseInt(
      String(canonicalCountRes.rows[0]?.count ?? "0"),
      10,
    );
    const evidenceByCanonicalRes = await session.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM nex.business_evidence WHERE canonical_business_id = $1",
      [args.canonical_business_id],
    );
    const evidenceByCanonical = parseInt(
      String(evidenceByCanonicalRes.rows[0]?.count ?? "0"),
      10,
    );

    // 4 · count evidence by decision_record_id
    const evidenceByDecisionRes = await session.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM nex.business_evidence WHERE decision_record_id = $1",
      [args.plan.evidence.decision_record_id],
    );
    const evidenceByDecision = parseInt(
      String(evidenceByDecisionRes.rows[0]?.count ?? "0"),
      10,
    );

    // 5 · build field comparisons (pure)
    const comparisons = buildFieldComparisons(
      args.plan,
      canonicalRow,
      evidenceRow,
    );
    const allMatch = comparisons.every((c) => c.match);
    const noDuplicates =
      canonicalCount === (args.plan.kind === "insert_new" ? 1 : 1) &&
      evidenceByCanonical === 1 &&
      evidenceByDecision === 1;

    const report: CanonicalReadbackReport = {
      canonical_business_id: args.canonical_business_id,
      evidence_id: args.evidence_id,
      canonical_row_found: canonicalRow !== null,
      evidence_row_found: evidenceRow !== null,
      canonical_row_count_for_id: canonicalCount,
      evidence_row_count_for_id: evidenceByCanonical,
      evidence_row_count_for_decision_record: evidenceByDecision,
      comparisons,
      all_fields_match: allMatch,
      no_duplicates: noDuplicates,
    };
    return answered(report);
  } catch (err) {
    const sanitised =
      err instanceof Error ? sanitiseErrorMessage(err.message) : String(err);
    return abstained({
      code: "readback_query_failed",
      message: `readback query failed: ${sanitised}`,
    });
  } finally {
    try {
      await args.session_factory.closeSession(session);
    } catch {
      /* best-effort close */
    }
  }
}

function sanitiseErrorMessage(input: string): string {
  let out = input;
  out = out.replace(
    /postgres(?:ql)?:\/\/[^:\s]*:[^@\s]*@[^\s"']+/gi,
    "postgres://[redacted]",
  );
  out = out.replace(/\bpassword\s*=\s*\S+/gi, "password=[redacted]");
  return out;
}
