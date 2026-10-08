// scripts/nex-canonical/execute-write-plan.ts
//
// NEX Canonical · The ONLY authorised DB-writing surface for Layer B.
//
// This module takes a `CanonicalWritePlan` that has ALREADY been
// decided by the earlier layers (validator → reviewer → approval →
// Layer-B resolver → canonical-handoff.precheckHandoff) and executes
// it against an injected `WriteSession`.
//
// IT DOES NOT
//   · re-run the resolver
//   · re-run founder approval
//   · re-run precheckHandoff
//   · convert AMBIGUOUS into a write
//   · manufacture approval
//   · normalise or repair bad source data
//   · silently alter the plan
//   · touch the filesystem · no durable JSONL log is written here
//     (that is a separate, not-yet-authorised wave)
//   · modify Layer A (identity-matching / entity-universe)
//   · modify Marketing / Crawler / Three Socials
//
// IT DOES
//   · compile the write plan into a deterministic ordered sequence of
//     SQL stages (BEGIN / fingerprint / precheck / write / COMMIT)
//   · open ONE session via the caller-supplied factory
//   · wrap every write in ONE SERIALIZABLE transaction
//   · re-verify the fingerprint on the SAME session before any write
//   · for insert_new · atomically INSERT business_canonical + evidence
//     via a single data-modifying CTE statement
//   · for merge_match · verify the target is still writable in-txn,
//     then INSERT business_evidence under the target's id
//   · rollback the whole transaction on ANY failure · never leave a
//     canonical row without its corresponding evidence · never leave
//     evidence pointing at a rolled-back canonical row
//   · surface a sanitised `IntelligenceResult<WriteExecutionReport>`
//
// LIVE EXECUTION
//   This module is designed to be run against a real PG session, but
//   this wave is CODE + TESTS ONLY. No real connection is opened by
//   tests · tests use a `MockSession` that records every SQL + params
//   invocation and returns configurable rows. The first real canonical
//   write requires a SEPARATE founder authorization.

import type { Candidate } from "./generate-candidates";
import type {
  CanonicalWritePlan,
  HandoffEvidence,
  InsertCanonicalRow,
} from "./canonical-handoff";
import { FINGERPRINT_QUERIES } from "./pg-fingerprint";
import { isLifecycleWritable, type LifecycleState } from "./canonical-row";
import {
  abstained,
  answered,
  type IntelligenceResult,
} from "./intelligence-result";

// ═════════════════════════════════════════════════════════════════════
// §1 · Public types
// ═════════════════════════════════════════════════════════════════════

/** A thin dependency-injection boundary over a PostgreSQL session.
 *  The production implementation would wrap a `pg.Client`. Tests use
 *  an in-memory MockSession. The executor never knows which. */
export interface WriteSession {
  readonly id: string;
  query<T = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[],
  ): Promise<{ readonly rows: readonly T[]; readonly rowCount: number }>;
}

export interface WriteSessionFactory {
  readonly openSession: () => Promise<WriteSession>;
  readonly closeSession: (s: WriteSession) => Promise<void>;
}

/** Expected target fingerprint · same shape as pg-fingerprint. The
 *  executor runs the four hardcoded FINGERPRINT_QUERIES on its own
 *  session and asserts equality · a mismatch rolls back without any
 *  write. */
export interface ExpectedFingerprint {
  readonly database: string;
  readonly user: string;
  readonly serverVersionPrefix: string;
  readonly schemas: readonly string[];
}

export interface WriteExecutorConfig {
  readonly statementTimeoutMs: number;
  readonly idleInTransactionTimeoutMs: number;
}

export const DEFAULT_WRITE_EXECUTOR_CONFIG: WriteExecutorConfig = Object.freeze(
  {
    statementTimeoutMs: 30000,
    idleInTransactionTimeoutMs: 60000,
  },
);

export interface WriteExecutionReport {
  readonly kind: "insert_new" | "merge_match";
  readonly canonical_business_id: string;
  readonly evidence_id: string;
  readonly stages_executed: number;
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Compiled plan · data representation of the write
// ═════════════════════════════════════════════════════════════════════

/** The ordered sequence of stages produced by `compileWritePlan`.
 *  Running them against a `WriteSession` IS the write. The compile
 *  function is pure · it can be tested without opening any DB. */
export interface CompiledWritePlan {
  readonly kind: "insert_new" | "merge_match";
  readonly stages: readonly CompiledStage[];
}

export interface CompiledStage {
  readonly label: StageLabel;
  readonly sql: string;
  readonly params: readonly unknown[];
  readonly expects: "none" | "exactly_one" | "any";
}

export type StageLabel =
  | "begin"
  | "set_statement_timeout"
  | "set_idle_timeout"
  | "fingerprint_database"
  | "fingerprint_user"
  | "fingerprint_server_version"
  | "fingerprint_schemas"
  | "precheck_osm_uniqueness"
  | "precheck_target_writable"
  | "write"
  | "commit";

// ═════════════════════════════════════════════════════════════════════
// §3 · compileWritePlan · pure deterministic SQL emission
// ═════════════════════════════════════════════════════════════════════

/** Compile a `CanonicalWritePlan` into the ordered list of SQL stages.
 *  Pure · deterministic · same input → identical output. */
export function compileWritePlan(
  plan: CanonicalWritePlan,
  config: WriteExecutorConfig = DEFAULT_WRITE_EXECUTOR_CONFIG,
): CompiledWritePlan {
  const stages: CompiledStage[] = [];

  // BEGIN SERIALIZABLE transaction.
  stages.push({
    label: "begin",
    sql: "BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE",
    params: [],
    expects: "none",
  });

  // Session-local safety timeouts. SET LOCAL scopes to this txn.
  stages.push({
    label: "set_statement_timeout",
    sql: `SET LOCAL statement_timeout = ${Number(config.statementTimeoutMs).toFixed(0)}`,
    params: [],
    expects: "none",
  });
  stages.push({
    label: "set_idle_timeout",
    sql: `SET LOCAL idle_in_transaction_session_timeout = ${Number(config.idleInTransactionTimeoutMs).toFixed(0)}`,
    params: [],
    expects: "none",
  });

  // Fingerprint re-verify · uses the SAME hardcoded queries as pg-fingerprint
  // so the DB oracle in the write path matches the α.2 oracle used before
  // candidate extraction.
  stages.push({
    label: "fingerprint_database",
    sql: FINGERPRINT_QUERIES.database,
    params: [],
    expects: "exactly_one",
  });
  stages.push({
    label: "fingerprint_user",
    sql: FINGERPRINT_QUERIES.user,
    params: [],
    expects: "exactly_one",
  });
  stages.push({
    label: "fingerprint_server_version",
    sql: FINGERPRINT_QUERIES.serverVersion,
    params: [],
    expects: "exactly_one",
  });
  stages.push({
    label: "fingerprint_schemas",
    sql: FINGERPRINT_QUERIES.schemas,
    params: [],
    expects: "any",
  });

  if (plan.kind === "insert_new") {
    // Pre-check (country, osm_id) uniqueness INSIDE the transaction.
    // Only runs when the Candidate carries a non-null osm_id, matching
    // migration 167's partial unique index.
    if (plan.row.osm_id !== null) {
      stages.push({
        label: "precheck_osm_uniqueness",
        sql: `SELECT canonical_business_id FROM nex.business_canonical
WHERE country = $1 AND osm_id = $2
FOR UPDATE`,
        params: [plan.row.country, plan.row.osm_id],
        expects: "any",
      });
    }

    // Compound write · one SQL statement so canonical+evidence are
    // atomically consistent. The CTE's INSERT returns the new
    // canonical_business_id, which flows directly into the evidence
    // INSERT. The outer INSERT RETURNING yields both IDs for the
    // executor to capture.
    const coords = plan.row.coordinates;
    const insertSql = buildCompoundInsertSql();
    const insertParams = buildCompoundInsertParams(plan.row, plan.evidence);
    stages.push({
      label: "write",
      sql: insertSql,
      params: insertParams,
      expects: "exactly_one",
    });
    // Silence unused-local warnings for pedantic linters.
    void coords;
  } else {
    // merge_match
    // Verify the target canonical row is still writable INSIDE the txn.
    stages.push({
      label: "precheck_target_writable",
      sql: `SELECT canonical_business_id, lifecycle_state, superseded_by_business_id
FROM nex.business_canonical
WHERE canonical_business_id = $1
FOR UPDATE`,
      params: [plan.target_canonical_business_id],
      expects: "any",
    });

    stages.push({
      label: "write",
      sql: buildEvidenceOnlyInsertSql(),
      params: buildEvidenceOnlyInsertParams(
        plan.target_canonical_business_id,
        plan.evidence,
      ),
      expects: "exactly_one",
    });
  }

  stages.push({
    label: "commit",
    sql: "COMMIT",
    params: [],
    expects: "none",
  });

  return { kind: plan.kind, stages };
}

// ═════════════════════════════════════════════════════════════════════
// §4 · SQL builders (pure helpers)
// ═════════════════════════════════════════════════════════════════════

/** SQL for insert_new · one compound statement.
 *  Parameter layout:
 *    $1  entity_type
 *    $2  country
 *    $3  name_canonical
 *    $4  aliases (text[])
 *    $5  phone_e164
 *    $6  website_apex
 *    $7  osm_id
 *    $8  wikidata_qid
 *    $9  city
 *    $10 district
 *    $11 street_line (added by migration 178)
 *    $12 neighbourhood (added by migration 178)
 *    $13 address (jsonb · pre-existing column from migration 167 ·
 *                 shape per sealed doctrine: { line1, postal_code } | null)
 *    $14 coord_lat (double precision · may be NULL)
 *    $15 coord_lng (double precision · may be NULL)
 *    $16 schema_version (evidence)
 *    $17 candidate_id
 *    $18 candidate_integrity_hash
 *    $19 decision_record_id
 *    $20 review_package_id
 *    $21 legacy_source_table
 *    $22 legacy_source_ref
 *    $23 legacy_source_internal_id
 *    $24 resolver_verdict_kind (always 'NO_MATCH' for insert_new)
 *    $25 resolver_target_id (always NULL for insert_new)
 *    $26 resolver_score
 *    $27 observation_generator
 *    $28 observation_run_id
 *    $29 observation_generated_at
 *    $30 observation_decision_timestamp
 *    $31 observation_founder_id
 *    $32 source_id
 */
function buildCompoundInsertSql(): string {
  return `WITH ic AS (
  INSERT INTO nex.business_canonical (
    entity_type, country, lifecycle_state, name_canonical, aliases,
    phone_e164, website_apex, osm_id, wikidata_qid, city, district,
    street_line, neighbourhood, address,
    coordinates
  ) VALUES (
    $1, $2, 'DISCOVERED', $3, $4,
    $5, $6, $7, $8, $9, $10,
    $11, $12, $13::jsonb,
    CASE WHEN $14::double precision IS NULL OR $15::double precision IS NULL
         THEN NULL
         ELSE ST_SetSRID(ST_MakePoint($15, $14), 4326)::geography END
  )
  RETURNING canonical_business_id
)
INSERT INTO nex.business_evidence (
  canonical_business_id, schema_version, candidate_id,
  candidate_integrity_hash, decision_record_id, review_package_id,
  legacy_source_table, legacy_source_ref, legacy_source_internal_id,
  resolver_verdict_kind, resolver_target_id, resolver_score,
  observation_generator, observation_run_id, observation_generated_at,
  observation_decision_timestamp, observation_founder_id, source_id
)
SELECT
  ic.canonical_business_id, $16, $17,
  $18, $19, $20,
  $21, $22, $23,
  $24, $25, $26,
  $27, $28, $29,
  $30, $31, $32
FROM ic
RETURNING evidence_id, canonical_business_id`;
}

function buildCompoundInsertParams(
  row: InsertCanonicalRow,
  evidence: HandoffEvidence,
): readonly unknown[] {
  return [
    row.entity_type,                          // $1
    row.country,                              // $2
    row.name_canonical,                       // $3
    row.aliases,                              // $4 (text[])
    row.phone_e164,                           // $5
    row.website_apex,                         // $6
    row.osm_id,                               // $7
    row.wikidata_qid,                         // $8
    row.city,                                 // $9
    row.district,                             // $10
    row.street_line,                          // $11 (migration 178)
    row.neighbourhood,                        // $12 (migration 178)
    // $13 address jsonb · stringify the sealed-shape object or send
    // NULL. SQL cast `$13::jsonb` parses the text. Null stays SQL NULL.
    row.address === null ? null : JSON.stringify(row.address),
    row.coordinates ? row.coordinates.lat : null, // $14
    row.coordinates ? row.coordinates.lng : null, // $15
    evidence.schema_version,                  // $16
    evidence.candidate_id,                    // $17
    evidence.candidate_integrity_hash,        // $18
    evidence.decision_record_id,              // $19
    evidence.review_package_id,               // $20
    evidence.legacy_source.table,             // $21
    evidence.legacy_source.ref,               // $22
    evidence.legacy_source.internal_id,       // $23
    evidence.resolver_verdict_summary.kind,   // $24 'NO_MATCH'
    evidence.resolver_verdict_summary.target_canonical_business_id, // $25 null
    evidence.resolver_verdict_summary.score,  // $26
    evidence.observation_provenance.generator, // $27
    evidence.observation_provenance.generation_run_id, // $28
    evidence.observation_provenance.generated_at, // $29
    evidence.observation_provenance.decision_timestamp, // $30
    evidence.observation_provenance.founder_id, // $31
    evidence.source_id,                       // $32
  ];
}

/** SQL for merge_match · evidence-only INSERT referencing the target.
 *  Parameter layout:
 *    $1  canonical_business_id (= target)
 *    $2  schema_version
 *    $3  candidate_id
 *    $4  candidate_integrity_hash
 *    $5  decision_record_id
 *    $6  review_package_id
 *    $7  legacy_source_table
 *    $8  legacy_source_ref
 *    $9  legacy_source_internal_id
 *    $10 resolver_verdict_kind (always 'MATCH')
 *    $11 resolver_target_id (= target · CHECK enforces equality)
 *    $12 resolver_score
 *    $13 observation_generator
 *    $14 observation_run_id
 *    $15 observation_generated_at
 *    $16 observation_decision_timestamp
 *    $17 observation_founder_id
 *    $18 source_id
 */
function buildEvidenceOnlyInsertSql(): string {
  return `INSERT INTO nex.business_evidence (
  canonical_business_id, schema_version, candidate_id,
  candidate_integrity_hash, decision_record_id, review_package_id,
  legacy_source_table, legacy_source_ref, legacy_source_internal_id,
  resolver_verdict_kind, resolver_target_id, resolver_score,
  observation_generator, observation_run_id, observation_generated_at,
  observation_decision_timestamp, observation_founder_id, source_id
) VALUES (
  $1, $2, $3,
  $4, $5, $6,
  $7, $8, $9,
  $10, $11, $12,
  $13, $14, $15,
  $16, $17, $18
)
RETURNING evidence_id, canonical_business_id`;
}

function buildEvidenceOnlyInsertParams(
  targetId: string,
  evidence: HandoffEvidence,
): readonly unknown[] {
  return [
    targetId,                                 // $1
    evidence.schema_version,                  // $2
    evidence.candidate_id,                    // $3
    evidence.candidate_integrity_hash,        // $4
    evidence.decision_record_id,              // $5
    evidence.review_package_id,               // $6
    evidence.legacy_source.table,             // $7
    evidence.legacy_source.ref,               // $8
    evidence.legacy_source.internal_id,       // $9
    evidence.resolver_verdict_summary.kind,   // $10
    evidence.resolver_verdict_summary.target_canonical_business_id, // $11
    evidence.resolver_verdict_summary.score,  // $12
    evidence.observation_provenance.generator, // $13
    evidence.observation_provenance.generation_run_id, // $14
    evidence.observation_provenance.generated_at, // $15
    evidence.observation_provenance.decision_timestamp, // $16
    evidence.observation_provenance.founder_id, // $17
    evidence.source_id,                       // $18
  ];
}

// ═════════════════════════════════════════════════════════════════════
// §5 · executeWritePlan · the top-level executor
// ═════════════════════════════════════════════════════════════════════

export interface ExecuteWritePlanArgs {
  readonly plan: CanonicalWritePlan;
  readonly session_factory: WriteSessionFactory;
  readonly expected_fingerprint: ExpectedFingerprint;
  readonly config?: WriteExecutorConfig;
}

export async function executeWritePlan(
  args: ExecuteWritePlanArgs,
): Promise<IntelligenceResult<WriteExecutionReport>> {
  const compiled = compileWritePlan(
    args.plan,
    args.config ?? DEFAULT_WRITE_EXECUTOR_CONFIG,
  );

  let session: WriteSession;
  try {
    session = await args.session_factory.openSession();
  } catch (err) {
    return abstained({
      code: "session_open_failed",
      message: `cannot open write session: ${err instanceof Error ? err.name : "unknown"}`,
    });
  }

  let rolledBack = false;
  let stagesExecuted = 0;
  let capturedCanonicalId: string | null = null;
  let capturedEvidenceId: string | null = null;

  try {
    for (const stage of compiled.stages) {
      const result = await session.query<Record<string, unknown>>(
        stage.sql,
        stage.params,
      );
      stagesExecuted++;

      switch (stage.label) {
        case "fingerprint_database": {
          const observed = String(result.rows[0]?.db ?? "");
          if (observed !== args.expected_fingerprint.database) {
            await safeRollback(session);
            rolledBack = true;
            return abstained({
              code: "fingerprint_mismatch",
              message: `database observed=${observed} expected=${args.expected_fingerprint.database}`,
              details: { field: "database" },
            });
          }
          break;
        }
        case "fingerprint_user": {
          const observed = String(result.rows[0]?.usr ?? "");
          if (observed !== args.expected_fingerprint.user) {
            await safeRollback(session);
            rolledBack = true;
            return abstained({
              code: "fingerprint_mismatch",
              message: `user observed=${observed} expected=${args.expected_fingerprint.user}`,
              details: { field: "user" },
            });
          }
          break;
        }
        case "fingerprint_server_version": {
          const observed = String(result.rows[0]?.srv_version ?? "");
          if (!observed.startsWith(args.expected_fingerprint.serverVersionPrefix)) {
            await safeRollback(session);
            rolledBack = true;
            return abstained({
              code: "fingerprint_mismatch",
              message: `server_version observed=${observed} expected-prefix=${args.expected_fingerprint.serverVersionPrefix}`,
              details: { field: "server_version" },
            });
          }
          break;
        }
        case "fingerprint_schemas": {
          const observed = result.rows.map((r) => String(r.schema_name ?? ""));
          const missing = args.expected_fingerprint.schemas.filter(
            (s) => !observed.includes(s),
          );
          if (missing.length > 0) {
            await safeRollback(session);
            rolledBack = true;
            return abstained({
              code: "fingerprint_mismatch",
              message: `missing schemas: ${missing.join(", ")}`,
              details: { field: "schemas", missing },
            });
          }
          break;
        }
        case "precheck_osm_uniqueness": {
          if (result.rows.length > 0) {
            const existingId = String(
              result.rows[0]?.canonical_business_id ?? "",
            );
            await safeRollback(session);
            rolledBack = true;
            return abstained({
              code: "osm_uniqueness_collision",
              message: `(country, osm_id) is already occupied by canonical_business_id=${existingId}`,
              details: { existing_canonical_business_id: existingId },
            });
          }
          break;
        }
        case "precheck_target_writable": {
          const row = result.rows[0];
          if (!row) {
            await safeRollback(session);
            rolledBack = true;
            return abstained({
              code: "target_missing",
              message: "merge_match target canonical row was not found inside the transaction",
            });
          }
          const state = String(row.lifecycle_state ?? "") as LifecycleState;
          const supersededBy = row.superseded_by_business_id;
          if (supersededBy !== null && supersededBy !== undefined) {
            await safeRollback(session);
            rolledBack = true;
            return abstained({
              code: "target_already_superseded",
              message: `merge_match target has been superseded by ${String(supersededBy)}`,
              details: { superseded_by_business_id: String(supersededBy) },
            });
          }
          if (!isLifecycleWritable(state)) {
            await safeRollback(session);
            rolledBack = true;
            return abstained({
              code: "target_not_writable",
              message: `merge_match target has non-writable lifecycle_state=${state}`,
              details: { current_state: state },
            });
          }
          break;
        }
        case "write": {
          const row = result.rows[0];
          if (!row) {
            await safeRollback(session);
            rolledBack = true;
            return abstained({
              code: "write_returned_no_row",
              message: "write stage did not return the expected row",
            });
          }
          capturedCanonicalId = String(row.canonical_business_id ?? "");
          capturedEvidenceId = String(row.evidence_id ?? "");
          if (capturedCanonicalId === "" || capturedEvidenceId === "") {
            await safeRollback(session);
            rolledBack = true;
            return abstained({
              code: "write_returned_invalid_ids",
              message: "write stage returned empty ids",
            });
          }
          break;
        }
        case "begin":
        case "set_statement_timeout":
        case "set_idle_timeout":
        case "commit":
          // No post-stage validation.
          break;
      }
    }

    if (capturedCanonicalId === null || capturedEvidenceId === null) {
      await safeRollback(session);
      rolledBack = true;
      return abstained({
        code: "write_never_executed",
        message: "write stage did not run · plan may be malformed",
      });
    }

    return answered<WriteExecutionReport>({
      kind: args.plan.kind,
      canonical_business_id: capturedCanonicalId,
      evidence_id: capturedEvidenceId,
      stages_executed: stagesExecuted,
    });
  } catch (err) {
    if (!rolledBack) {
      await safeRollback(session);
    }
    const message = err instanceof Error ? err.message : String(err);
    return abstained({
      code: "session_error",
      message: sanitiseErrorMessage(message),
      details: { stages_executed_before_error: stagesExecuted },
    });
  } finally {
    try {
      await args.session_factory.closeSession(session);
    } catch {
      /* best-effort · never mask the primary result */
    }
  }
}

async function safeRollback(session: WriteSession): Promise<void> {
  try {
    await session.query("ROLLBACK", []);
  } catch {
    /* intentional · session may already be in a failed state */
  }
}

/** Strip likely-credential tokens from an error message. Mirrors the
 *  pattern set used by the pg-executor sanitiser · duplicated here as
 *  a small local function to keep this module self-contained. */
function sanitiseErrorMessage(input: string): string {
  let out = input;
  out = out.replace(
    /postgres(?:ql)?:\/\/[^:\s]*:[^@\s]*@[^\s"']+/gi,
    "postgres://[redacted]",
  );
  out = out.replace(/\bpassword\s*=\s*\S+/gi, "password=[redacted]");
  out = out.replace(
    /\bapi[_-]?key\s*[:=]\s*['"]?[A-Za-z0-9+/._-]{16,}['"]?/gi,
    "api_key=[redacted]",
  );
  return out;
}

// ═════════════════════════════════════════════════════════════════════
// §6 · Static invariants · module-level
// ═════════════════════════════════════════════════════════════════════
//
// This module:
//   · does NOT read the filesystem (no durable JSONL write in this wave)
//   · does NOT read environment variables
//   · does NOT read credentials
//   · does NOT use a clock (no Date.now, no new Date)
//   · does NOT use randomness
//   · does NOT import pg · the DB session is injected via WriteSession
//   · does NOT import pg-executor / pg-fingerprint runtime surfaces ·
//     the FINGERPRINT_QUERIES constants from pg-fingerprint are value
//     imports (the four hardcoded introspection strings · frozen at
//     module load)
//   · does NOT import extract-candidates
//   · does NOT import identity-matching / entity-universe / matchBusiness
//   · does NOT reference Supabase, dotenv, process.env
//   · does NOT execute a resolver
//   · does NOT execute founder approval
//   · does NOT execute precheckHandoff
//   · does NOT invent additional merge behaviour
//   · does NOT write durable per-write JSONL (deferred)
//   · does NOT read/write the real DB during tests
//
// All DB interaction goes through the injected WriteSession. The first
// real production invocation requires a SEPARATE founder authorization.
