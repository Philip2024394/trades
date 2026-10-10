// src/lib/nex-canonical/directory-processing-ledger.ts
//
// NEX Directory · Processing Ledger service.
//
// The TypeScript writer-side of migration 189
// (`nex.directory_processing_ledger`). Pure functions that take an
// injected `LedgerSession` + a (source_table, source_internal_id)
// identity and advance the row to one of 7 processing states.
//
// Why dependency-injected sessions
//   The sealed canonical pipeline (see
//   `scripts/nex-canonical/execute-write-plan.ts`) consistently uses a
//   small `WriteSession` boundary so unit tests can supply a MockSession
//   that records every SQL + params invocation without opening a real
//   pg connection. This module follows the same pattern · no `pg`
//   import here, no implicit pool, no live-connection side-effects.
//
// What this module is NOT
//   · Not a scheduler. State transitions are called by the ingestion
//     runner and the canonical-handoff path; this module just records
//     them atomically.
//   · Not a DDL file. Table creation lives in migration 189.
//   · Not a producer of candidates / evidence / canonical rows. It
//     only writes the ledger.

// ═════════════════════════════════════════════════════════════════════
// §1 · Sealed enums (mirrors the SQL CHECK constraints in migration 189)
// ═════════════════════════════════════════════════════════════════════

/** The sealed 7-value processing-state vocabulary.
 *  Mirrors ck_dpl_processing_state in migration 189. */
export const PROCESSING_STATES = [
  "PENDING",
  "RESOLVED",
  "EXCLUDED",
  "AWAITING_ENRICHMENT",
  "AWAITING_SOURCE_PERMISSION",
  "AWAITING_OWNER_VERIFICATION",
  "FAILED_RETRYABLE",
] as const;
export type ProcessingState = (typeof PROCESSING_STATES)[number];

/** The sealed 7-value next-action vocabulary.
 *  Mirrors ck_dpl_next_action in migration 189. */
export const NEXT_ACTIONS = [
  "INGEST",
  "RESOLVE",
  "ENRICH",
  "PROMOTE",
  "OWNER_CLAIM",
  "LEGAL_REVIEW",
  "NONE",
] as const;
export type NextAction = (typeof NEXT_ACTIONS)[number];

/** The sealed 5 legacy vertical tables.
 *  Mirrors ck_dpl_source_table in migration 189. */
export const SOURCE_TABLES = [
  "nex.food_business",
  "nex.accommodation_business",
  "nex.service_business",
  "nex.mp_seller",
  "nex.bike_rental_listing",
] as const;
export type SourceTable = (typeof SOURCE_TABLES)[number];

/** The schema-qualified ledger table name. One place to change if the
 *  sealed name ever moves · callers never hard-code this. */
export const LEDGER_TABLE = "nex.directory_processing_ledger" as const;

// ═════════════════════════════════════════════════════════════════════
// §2 · Session boundary (DI · same shape as execute-write-plan.ts)
// ═════════════════════════════════════════════════════════════════════

export interface LedgerSession {
  query<T = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[],
  ): Promise<{ readonly rows: readonly T[]; readonly rowCount: number }>;
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Record shapes
// ═════════════════════════════════════════════════════════════════════

export interface LedgerRowIdentity {
  readonly source_table: SourceTable;
  readonly source_internal_id: string;
}

export interface LedgerRow {
  readonly ledger_id: string;
  readonly source_table: SourceTable;
  readonly source_internal_id: string;
  readonly processing_state: ProcessingState;
  readonly canonical_business_id: string | null;
  readonly evidence_count: number;
  readonly last_processed_at: string | null;
  readonly next_action: NextAction;
  readonly exclusion_reason: string | null;
  readonly retry_count: number;
  readonly created_at: string;
  readonly updated_at: string;
}

/** The matrix returned by `getStateReport()` · one row per
 *  (source_table, processing_state, next_action) tuple with its
 *  count. Shapes exported for the report script. */
export interface StateReportRow {
  readonly source_table: SourceTable;
  readonly processing_state: ProcessingState;
  readonly next_action: NextAction;
  readonly count: number;
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Allowed state transitions
// ═════════════════════════════════════════════════════════════════════

// Transition validity map · a row in `processing_state = X` may advance
// to `processing_state = Y` only if Y is in TRANSITIONS[X]. The service
// enforces this before issuing the UPDATE; call sites that attempt
// an invalid transition fail loudly.
//
// Rules in plain words:
//   · PENDING                  → any of the 6 non-PENDING states
//   · AWAITING_ENRICHMENT      → RESOLVED, EXCLUDED, FAILED_RETRYABLE
//   · AWAITING_SOURCE_PERMISSION → PENDING (permission granted),
//                                   EXCLUDED (permanently denied),
//                                   FAILED_RETRYABLE
//   · AWAITING_OWNER_VERIFICATION → RESOLVED, EXCLUDED, FAILED_RETRYABLE
//   · FAILED_RETRYABLE         → PENDING (retry queued), EXCLUDED
//                                   (gave up), RESOLVED (next retry
//                                   succeeded via a different code
//                                   path)
//   · RESOLVED / EXCLUDED      → terminal (no outgoing transitions)
export const TRANSITIONS: Readonly<Record<ProcessingState, readonly ProcessingState[]>> =
  Object.freeze({
    PENDING: Object.freeze([
      "RESOLVED",
      "EXCLUDED",
      "AWAITING_ENRICHMENT",
      "AWAITING_SOURCE_PERMISSION",
      "AWAITING_OWNER_VERIFICATION",
      "FAILED_RETRYABLE",
    ] as const),
    AWAITING_ENRICHMENT: Object.freeze([
      "RESOLVED",
      "EXCLUDED",
      "FAILED_RETRYABLE",
    ] as const),
    AWAITING_SOURCE_PERMISSION: Object.freeze([
      "PENDING",
      "EXCLUDED",
      "FAILED_RETRYABLE",
    ] as const),
    AWAITING_OWNER_VERIFICATION: Object.freeze([
      "RESOLVED",
      "EXCLUDED",
      "FAILED_RETRYABLE",
    ] as const),
    FAILED_RETRYABLE: Object.freeze([
      "PENDING",
      "EXCLUDED",
      "RESOLVED",
    ] as const),
    RESOLVED: Object.freeze([] as const),
    EXCLUDED: Object.freeze([] as const),
  });

export function isTransitionAllowed(
  from: ProcessingState,
  to: ProcessingState,
): boolean {
  return TRANSITIONS[from].includes(to);
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Writers
// ═════════════════════════════════════════════════════════════════════

function assertSourceTable(table: string): asserts table is SourceTable {
  if (!(SOURCE_TABLES as readonly string[]).includes(table)) {
    throw new Error(
      `directory-processing-ledger: invalid source_table '${table}'. Allowed: ${SOURCE_TABLES.join(", ")}`,
    );
  }
}

function assertNonBlank(label: string, value: string): void {
  if (value == null || typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`directory-processing-ledger: ${label} must be non-blank`);
  }
}

/** Insert a ledger row in PENDING / INGEST state. Idempotent via
 *  ON CONFLICT (source_table, source_internal_id) DO NOTHING. Returns
 *  `{ inserted: true }` on first insert, `{ inserted: false }` on
 *  conflict (row already present · the populate script relies on this
 *  to re-run safely across all 59k+ legacy rows). */
export async function recordInitial(
  session: LedgerSession,
  id: LedgerRowIdentity,
): Promise<{ readonly inserted: boolean }> {
  assertSourceTable(id.source_table);
  assertNonBlank("source_internal_id", id.source_internal_id);
  const sql = `
    INSERT INTO ${LEDGER_TABLE} (
      source_table,
      source_internal_id,
      processing_state,
      next_action
    )
    VALUES ($1, $2, 'PENDING', 'INGEST')
    ON CONFLICT (source_table, source_internal_id) DO NOTHING
    RETURNING ledger_id
  `;
  const r = await session.query(sql, [id.source_table, id.source_internal_id]);
  return { inserted: r.rowCount > 0 };
}

/** Advance a row to RESOLVED · requires a non-null canonical id + the
 *  current evidence_count supplied by the caller (the sealed canonical-
 *  handoff path knows exactly how many evidence rows it wrote). */
export async function markResolved(
  session: LedgerSession,
  id: LedgerRowIdentity,
  canonicalBusinessId: string,
  evidenceCount: number,
): Promise<void> {
  assertSourceTable(id.source_table);
  assertNonBlank("source_internal_id", id.source_internal_id);
  assertNonBlank("canonicalBusinessId", canonicalBusinessId);
  if (!Number.isFinite(evidenceCount) || evidenceCount < 0 || !Number.isInteger(evidenceCount)) {
    throw new Error(
      `directory-processing-ledger: evidenceCount must be a non-negative integer, got ${String(evidenceCount)}`,
    );
  }
  const sql = `
    UPDATE ${LEDGER_TABLE}
       SET processing_state    = 'RESOLVED',
           canonical_business_id = $3,
           evidence_count      = $4,
           next_action         = 'NONE',
           exclusion_reason    = NULL,
           retry_count         = 0,
           last_processed_at   = now(),
           updated_at          = now()
     WHERE source_table        = $1
       AND source_internal_id  = $2
  `;
  await session.query(sql, [
    id.source_table,
    id.source_internal_id,
    canonicalBusinessId,
    evidenceCount,
  ]);
}

/** Advance a row to EXCLUDED · requires a non-blank reason text. */
export async function markExcluded(
  session: LedgerSession,
  id: LedgerRowIdentity,
  reason: string,
): Promise<void> {
  assertSourceTable(id.source_table);
  assertNonBlank("source_internal_id", id.source_internal_id);
  assertNonBlank("reason", reason);
  const sql = `
    UPDATE ${LEDGER_TABLE}
       SET processing_state    = 'EXCLUDED',
           canonical_business_id = NULL,
           next_action         = 'NONE',
           exclusion_reason    = $3,
           last_processed_at   = now(),
           updated_at          = now()
     WHERE source_table        = $1
       AND source_internal_id  = $2
  `;
  await session.query(sql, [id.source_table, id.source_internal_id, reason]);
}

/** Advance a row to AWAITING_ENRICHMENT · ingested but needs more
 *  evidence before it can be resolved. */
export async function markAwaitingEnrichment(
  session: LedgerSession,
  id: LedgerRowIdentity,
): Promise<void> {
  assertSourceTable(id.source_table);
  assertNonBlank("source_internal_id", id.source_internal_id);
  const sql = `
    UPDATE ${LEDGER_TABLE}
       SET processing_state    = 'AWAITING_ENRICHMENT',
           canonical_business_id = NULL,
           next_action         = 'ENRICH',
           exclusion_reason    = NULL,
           last_processed_at   = now(),
           updated_at          = now()
     WHERE source_table        = $1
       AND source_internal_id  = $2
  `;
  await session.query(sql, [id.source_table, id.source_internal_id]);
}

/** Advance a row to AWAITING_SOURCE_PERMISSION · the source registry
 *  carries can_derive = false and legal review is required before this
 *  row can be ingested. */
export async function markAwaitingSourcePermission(
  session: LedgerSession,
  id: LedgerRowIdentity,
): Promise<void> {
  assertSourceTable(id.source_table);
  assertNonBlank("source_internal_id", id.source_internal_id);
  const sql = `
    UPDATE ${LEDGER_TABLE}
       SET processing_state    = 'AWAITING_SOURCE_PERMISSION',
           canonical_business_id = NULL,
           next_action         = 'LEGAL_REVIEW',
           exclusion_reason    = NULL,
           last_processed_at   = now(),
           updated_at          = now()
     WHERE source_table        = $1
       AND source_internal_id  = $2
  `;
  await session.query(sql, [id.source_table, id.source_internal_id]);
}

/** Advance a row to AWAITING_OWNER_VERIFICATION · a claim action is
 *  pending adjudication. */
export async function markAwaitingOwnerVerification(
  session: LedgerSession,
  id: LedgerRowIdentity,
): Promise<void> {
  assertSourceTable(id.source_table);
  assertNonBlank("source_internal_id", id.source_internal_id);
  const sql = `
    UPDATE ${LEDGER_TABLE}
       SET processing_state    = 'AWAITING_OWNER_VERIFICATION',
           canonical_business_id = NULL,
           next_action         = 'OWNER_CLAIM',
           exclusion_reason    = NULL,
           last_processed_at   = now(),
           updated_at          = now()
     WHERE source_table        = $1
       AND source_internal_id  = $2
  `;
  await session.query(sql, [id.source_table, id.source_internal_id]);
}

/** Advance a row to FAILED_RETRYABLE · increments retry_count. The
 *  runner may later move this back to PENDING via `recordInitial`
 *  semantics (a dedicated retry path is a separate module). */
export async function markFailedRetryable(
  session: LedgerSession,
  id: LedgerRowIdentity,
): Promise<void> {
  assertSourceTable(id.source_table);
  assertNonBlank("source_internal_id", id.source_internal_id);
  const sql = `
    UPDATE ${LEDGER_TABLE}
       SET processing_state    = 'FAILED_RETRYABLE',
           canonical_business_id = NULL,
           next_action         = 'INGEST',
           exclusion_reason    = NULL,
           retry_count         = retry_count + 1,
           last_processed_at   = now(),
           updated_at          = now()
     WHERE source_table        = $1
       AND source_internal_id  = $2
  `;
  await session.query(sql, [id.source_table, id.source_internal_id]);
}

// ═════════════════════════════════════════════════════════════════════
// §6 · Readers
// ═════════════════════════════════════════════════════════════════════

/** Fetch the next window of PENDING rows for the ingestion runner.
 *  Ordered by created_at ASC · oldest first · deterministic. */
export async function getPending(
  session: LedgerSession,
  limit: number,
  offset: number,
): Promise<readonly LedgerRow[]> {
  if (!Number.isFinite(limit) || limit <= 0 || !Number.isInteger(limit)) {
    throw new Error(`directory-processing-ledger: limit must be a positive integer, got ${String(limit)}`);
  }
  if (!Number.isFinite(offset) || offset < 0 || !Number.isInteger(offset)) {
    throw new Error(`directory-processing-ledger: offset must be a non-negative integer, got ${String(offset)}`);
  }
  const sql = `
    SELECT ledger_id,
           source_table,
           source_internal_id,
           processing_state,
           canonical_business_id,
           evidence_count,
           last_processed_at,
           next_action,
           exclusion_reason,
           retry_count,
           created_at,
           updated_at
      FROM ${LEDGER_TABLE}
     WHERE processing_state = 'PENDING'
     ORDER BY created_at ASC, ledger_id ASC
     LIMIT $1
    OFFSET $2
  `;
  const r = await session.query<LedgerRow>(sql, [limit, offset]);
  return r.rows;
}

/** Fetch the per-vertical × per-state × per-next-action matrix as an
 *  unordered list of count rows. The report script orders + reshapes. */
export async function getStateReport(
  session: LedgerSession,
): Promise<readonly StateReportRow[]> {
  const sql = `
    SELECT source_table,
           processing_state,
           next_action,
           COUNT(*)::bigint AS count
      FROM ${LEDGER_TABLE}
     GROUP BY source_table, processing_state, next_action
     ORDER BY source_table, processing_state, next_action
  `;
  const r = await session.query<{
    readonly source_table: SourceTable;
    readonly processing_state: ProcessingState;
    readonly next_action: NextAction;
    readonly count: string | number;
  }>(sql, []);
  return r.rows.map((row) => ({
    source_table: row.source_table,
    processing_state: row.processing_state,
    next_action: row.next_action,
    // PG returns bigint as string via node-pg · normalise to number
    // here (safe: counts are well under Number.MAX_SAFE_INTEGER).
    count: typeof row.count === "string" ? Number(row.count) : row.count,
  }));
}

// ═════════════════════════════════════════════════════════════════════
// §7 · Fetch a single row by identity (helper for state-transition
//      checks; not exported as a required API but useful to tests)
// ═════════════════════════════════════════════════════════════════════

export async function fetchByIdentity(
  session: LedgerSession,
  id: LedgerRowIdentity,
): Promise<LedgerRow | null> {
  assertSourceTable(id.source_table);
  assertNonBlank("source_internal_id", id.source_internal_id);
  const sql = `
    SELECT ledger_id,
           source_table,
           source_internal_id,
           processing_state,
           canonical_business_id,
           evidence_count,
           last_processed_at,
           next_action,
           exclusion_reason,
           retry_count,
           created_at,
           updated_at
      FROM ${LEDGER_TABLE}
     WHERE source_table       = $1
       AND source_internal_id = $2
     LIMIT 1
  `;
  const r = await session.query<LedgerRow>(sql, [
    id.source_table,
    id.source_internal_id,
  ]);
  return r.rows.length > 0 ? r.rows[0] : null;
}
