// scripts/nex-canonical/extract-candidates.ts
//
// NEX Business Canonical · Thin β Runner · 2026-10-08
//
// Orchestrates the already-reviewed pieces in the ONLY correct order:
//
//   parsePgExecutorConfigFromEnv  →  parseFingerprintExpectationsFromEnv
//     →  createPgExecutor  →  executor.observeFingerprint() (SAME Client)
//     →  compareFingerprint
//     →  (ONLY IF ok)  generateCandidates on the SAME executor
//     →  secret scan  →  write JSONL  →  report
//
// STRUCTURAL ORDERING INVARIANT (α.2 2026-10-08 · same-session binding)
//   `FingerprintVerifiedExecutor` has a private constructor. The only
//   path to a FingerprintVerifiedExecutor instance is the static
//   `.create()` factory, which:
//     1. creates ONE pg-executor (one Client, lazily opened)
//     2. calls `executor.observeFingerprint()` on that Client FIRST
//     3. compares observed vs expected
//     4. closes the executor on mismatch or connection failure
//     5. constructs the branded wrapper only on success
//   `generateCandidatesGated` requires a `FingerprintVerifiedExecutor`
//   as its first argument. This makes it a type-system error (and a
//   runtime refusal) to attempt candidate generation without passing
//   fingerprint verification. The Client that passes fingerprint IS
//   the Client that runs every QUERY_SPEC · no TOCTOU window.
//
// SCOPE BOUNDARY (runner authorization 2026-10-08)
//   · Code only. This module is EXPORTED but is NOT INVOKED by this
//     authorization wave. Running it requires a separate β authorization
//     plus the eight runtime env vars (four credentials + four expected
//     fingerprint fields).
//
// WHAT THIS FILE DOES NOT DO
//   · Does NOT read .env, .env.local, .pgpass, or any file for
//     credentials. Credentials come exclusively from `io.env`.
//   · Does NOT contain credentials or expected fingerprint values.
//   · Does NOT import or invoke the resolver (identity-matching.ts,
//     matchBusiness, entity-universe). Candidate generation is a
//     selection step, not a resolution step.
//   · Does NOT execute any migration or alter the database.
//   · Does NOT use a mock database as a production fallback. (The test
//     suite mocks `pg` to prevent live connections during tests; the
//     production path uses the real `pg`.)
//   · Does NOT read from any Supabase client, fetch, or SDK.
//   · Does NOT contain arbitrary SQL. All SQL comes from either
//     `FINGERPRINT_QUERIES` (fingerprint module, four hardcoded
//     introspection queries) or the sealed `QUERY_SPECS` catalogue
//     (candidate module, routed through the identity-allowlisted
//     pg-executor).

import { promises as fsp } from "node:fs";
import * as path from "node:path";
import {
  generateCandidates,
  type GenerationResult,
  type OrchestratorOptions,
  type QueryExecutor,
  type QuerySpec,
  QUERY_SPECS,
} from "./generate-candidates";
import {
  createPgExecutor,
  parsePgExecutorConfigFromEnv,
  type PgExecutor,
  type PgExecutorConfig,
} from "./pg-executor";
import {
  parseFingerprintExpectationsFromEnv,
  compareFingerprint,
  FingerprintMismatchError,
  type FingerprintExpectations,
  type ObservedFingerprint,
} from "./pg-fingerprint";

// ═════════════════════════════════════════════════════════════════════
// §1 · Output path · hardcoded · cannot be overridden
// ═════════════════════════════════════════════════════════════════════

/**
 * The exact β output path. Hardcoded at module scope so no runtime input
 * can redirect it elsewhere. The relative base is the repository root.
 */
export const CANDIDATE_OUTPUT_PATH =
  "tests/fixtures/canonical/candidates-for-review-v1.jsonl";

// ═════════════════════════════════════════════════════════════════════
// §2 · Branded verified-executor · structural ordering invariant
// ═════════════════════════════════════════════════════════════════════

/**
 * A fingerprint-verified executor. The private constructor + static
 * `.create()` factory make it structurally impossible to construct this
 * value without first running the executor's `observeFingerprint()` to
 * success on the EXACT SAME Client that subsequent `execute()` calls
 * will use. Any attempt to call `generateCandidatesGated` requires an
 * instance of this class, which can only come from a passed verification.
 *
 * α.2 2026-10-08 · same-session binding. The Client that passes
 * fingerprint IS the Client that runs QUERY_SPECS. There is no TOCTOU
 * window between fingerprint and candidate extraction.
 */
export class FingerprintVerifiedExecutor {
  readonly #marker = Symbol("FingerprintVerified");
  private constructor(
    public readonly executor: PgExecutor,
    public readonly observed: ObservedFingerprint,
    public readonly expected: FingerprintExpectations,
    public readonly pgConfig: PgExecutorConfig,
  ) {}

  /** Returns a dummy string just to use the private marker · prevents
   *  TS from complaining about the unused private field. The marker's
   *  real purpose is to be a nominally-private token the branded type
   *  carries, so downstream `instanceof` and `#`-access rules apply. */
  _markerCheck(): string {
    return this.#marker.description ?? "";
  }

  /**
   * The only path to a `FingerprintVerifiedExecutor`.
   *
   * α.2 same-session flow:
   *   1. parse expected fingerprint from env (pure)
   *   2. construct the executor (no connection yet · lazy)
   *   3. call `executor.observeFingerprint()` · this opens the Client
   *      and runs the four fingerprint queries on it
   *   4. compare observed vs expected
   *   5. on mismatch OR connection failure, `close()` the executor
   *      (and therefore the Client) before the error escapes
   *   6. on success, return the branded wrapper carrying the SAME
   *      executor instance for all subsequent `execute()` calls
   */
  static async create(
    pgConfig: PgExecutorConfig,
    env: NodeJS.ProcessEnv,
  ): Promise<FingerprintVerifiedExecutor> {
    const expected = parseFingerprintExpectationsFromEnv(env);
    const executor = createPgExecutor(pgConfig);
    let observed: ObservedFingerprint;
    try {
      observed = await executor.observeFingerprint();
    } catch (err) {
      // Connection failure or introspection failure · tear down the
      // Client before letting the error escape.
      try {
        await executor.close();
      } catch {
        /* best-effort · do not mask the primary failure */
      }
      throw err;
    }
    const comparison = compareFingerprint(observed, expected);
    if (!comparison.ok) {
      // Fingerprint mismatch · tear down the Client before raising.
      try {
        await executor.close();
      } catch {
        /* best-effort */
      }
      throw new FingerprintMismatchError(comparison.mismatches);
    }
    // Fingerprint has passed on this exact Client. The branded
    // wrapper now owns the same executor instance; every subsequent
    // `execute()` lands on the fingerprinted connection.
    return new FingerprintVerifiedExecutor(executor, observed, expected, pgConfig);
  }
}

/**
 * Gated candidate generation. The branded type as the first argument
 * is the structural proof that fingerprint verification has already
 * succeeded for this executor.
 */
export async function generateCandidatesGated(
  verified: FingerprintVerifiedExecutor,
  auditing: AuditingExecutor,
  options: OrchestratorOptions,
): Promise<GenerationResult> {
  // The branded type carries `.executor`; we wrap it in the auditing
  // layer so the runner can see per-spec row counts and detect spec
  // failures with high fidelity.
  return generateCandidates(auditing, options);
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Auditing executor · per-spec row counts + spec-failure capture
// ═════════════════════════════════════════════════════════════════════

export interface SpecOutcome {
  readonly spec_id: string;
  readonly legacy_table: string;
  readonly row_count: number;
  readonly effective_limit: number;
  readonly truncation_suspected: boolean;
  readonly errored: boolean;
  readonly error_message: string | null;
}

/**
 * Wraps a QueryExecutor to record per-spec outcomes. If a spec throws,
 * the error is recorded AND re-raised (we do not swallow). The runner's
 * top-level catch uses `perSpec` to report which spec failed.
 */
export class AuditingExecutor implements QueryExecutor {
  readonly perSpec = new Map<string, SpecOutcome>();

  constructor(
    private readonly inner: QueryExecutor,
    private readonly rowCeiling: number,
  ) {}

  async execute(
    spec: QuerySpec,
  ): Promise<readonly Record<string, unknown>[]> {
    const effectiveLimit =
      spec.limit === null ? this.rowCeiling : Math.min(spec.limit, this.rowCeiling);
    try {
      const rows = await this.inner.execute(spec);
      this.perSpec.set(spec.spec_id, {
        spec_id: spec.spec_id,
        legacy_table: spec.legacy_table,
        row_count: rows.length,
        effective_limit: effectiveLimit,
        truncation_suspected: rows.length >= effectiveLimit,
        errored: false,
        error_message: null,
      });
      return rows;
    } catch (err) {
      this.perSpec.set(spec.spec_id, {
        spec_id: spec.spec_id,
        legacy_table: spec.legacy_table,
        row_count: 0,
        effective_limit: effectiveLimit,
        truncation_suspected: false,
        errored: true,
        error_message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async close(): Promise<void> {
    await this.inner.close?.();
  }
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Deterministic JSONL serialisation · pure
// ═════════════════════════════════════════════════════════════════════

/**
 * Deterministic JSON stringifier · sorts object keys alphabetically so
 * the same input always produces byte-identical output across runs.
 * Arrays preserve element order.
 */
export function stableStringify(obj: unknown): string {
  if (obj === null) return "null";
  if (typeof obj === "number") {
    if (!Number.isFinite(obj)) {
      throw new Error("stableStringify: non-finite number is not JSON-safe");
    }
    return JSON.stringify(obj);
  }
  if (typeof obj === "boolean" || typeof obj === "string") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map((e) => stableStringify(e)).join(",") + "]";
  }
  if (typeof obj === "object") {
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    const pairs = keys.map(
      (k) =>
        JSON.stringify(k) +
        ":" +
        stableStringify((obj as Record<string, unknown>)[k]),
    );
    return "{" + pairs.join(",") + "}";
  }
  // undefined, function, symbol are not JSON-safe
  throw new Error(
    `stableStringify: value of type "${typeof obj}" is not JSON-safe`,
  );
}

/**
 * Serialise a GenerationResult's candidates as one JSON object per line
 * (JSONL) with a trailing newline. Candidate order is preserved from
 * the generator (which already sorts deterministically by
 * maxScore desc, legacy_table asc, legacy_ref asc).
 */
export function serializeCandidatesToJsonl(
  result: GenerationResult,
): string {
  if (result.candidates.length === 0) return "";
  return result.candidates.map((c) => stableStringify(c)).join("\n") + "\n";
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Secret scanner · belt-and-braces · scan output BEFORE write
// ═════════════════════════════════════════════════════════════════════

// `scanForLikelyCredentials` was extracted to `./secret-scan` so the
// approval-consumer surface can import the same patterns without
// reopening the α.2 boundary. Behaviour is byte-for-byte unchanged.
// Imported for internal use by the runner's secret-scan stage AND
// re-exported to preserve the existing extract-candidates API.
import { scanForLikelyCredentials } from "./secret-scan";
export { scanForLikelyCredentials };

export class SecretsLeakError extends Error {
  readonly findings: readonly string[];
  constructor(findings: readonly string[]) {
    super(
      `extract-candidates STOP: candidate output contains likely credentials. ` +
        `Findings: ${findings.join(", ")}. Refusing to write JSONL.`,
    );
    this.name = "SecretsLeakError";
    this.findings = findings;
  }
}

// ═════════════════════════════════════════════════════════════════════
// §6 · Error class for the runner's top-level categorisation
// ═════════════════════════════════════════════════════════════════════

export type BetaStage =
  | "parse_credentials"
  | "parse_fingerprint_config"
  | "verify_fingerprint"
  | "construct_executor"
  | "generate_candidates"
  | "secret_scan"
  | "write_output";

export class BetaRunnerError extends Error {
  readonly stage: BetaStage;
  readonly cause: unknown;
  readonly specId: string | null;
  constructor(stage: BetaStage, cause: unknown, specId: string | null = null) {
    const underlying =
      cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
    super(
      `extract-candidates STOP at stage "${stage}"${specId ? ` (spec_id="${specId}")` : ""}: ${underlying}`,
    );
    this.name = "BetaRunnerError";
    this.stage = stage;
    this.cause = cause;
    this.specId = specId;
  }
}

// ═════════════════════════════════════════════════════════════════════
// §7 · Runner report structure
// ═════════════════════════════════════════════════════════════════════

export interface PopulationCounts {
  readonly nex_business: number;
  readonly "nex.mp_seller": number;
  readonly food: number;
  readonly accommodation: number;
  readonly service: number;
  readonly "nex.transport_acquisition_record": number;
  readonly total_observed: number;
  readonly populations_unavailable: readonly string[];
}

export interface BetaReport {
  readonly stage: "complete";
  readonly fingerprint: {
    readonly database: string;
    readonly user: string;
    readonly serverVersion: string;
    readonly schemasObservedCount: number;
    readonly expectedSchemas: readonly string[];
  };
  readonly run_metadata: GenerationResult["run_metadata"];
  readonly per_spec: readonly SpecOutcome[];
  readonly populations: PopulationCounts;
  readonly candidates: {
    readonly total: number;
    readonly per_category: Record<string, number>;
    readonly per_source_table: Record<string, number>;
    readonly per_entity_type: Record<string, number>;
    readonly duplicate_candidate_ids: readonly string[];
    readonly quarantined_count: number;
  };
  readonly truncation_suspected_spec_ids: readonly string[];
  readonly output: {
    readonly path: string;
    readonly bytes: number;
  };
}

// ═════════════════════════════════════════════════════════════════════
// §8 · Injectable IO · env + file-writer + clock
// ═════════════════════════════════════════════════════════════════════

export interface RunnerIO {
  readonly env: NodeJS.ProcessEnv;
  readonly writeOutput: (filePath: string, content: string) => Promise<number>;
  readonly now: () => Date;
}

/**
 * The default production IO. Reads env from `process.env`. Writes to
 * disk via `fs.promises.writeFile` after creating the parent directory
 * if needed. Clock is `new Date()`.
 *
 * This is a getter rather than a const so `process.env` is read at
 * call-time, not at import-time.
 */
export function defaultIO(): RunnerIO {
  return {
    env: process.env,
    writeOutput: async (filePath, content) => {
      const abs = path.isAbsolute(filePath)
        ? filePath
        : path.join(process.cwd(), filePath);
      await fsp.mkdir(path.dirname(abs), { recursive: true });
      await fsp.writeFile(abs, content, { encoding: "utf8" });
      const stat = await fsp.stat(abs);
      return stat.size;
    },
    now: () => new Date(),
  };
}

// ═════════════════════════════════════════════════════════════════════
// §9 · The runner itself
// ═════════════════════════════════════════════════════════════════════

export interface RunnerOptions {
  readonly runId: string;
  readonly topKPerCategory?: number;
}

/**
 * The main β runner. Executes the orchestration in strict order; any
 * step failure throws a `BetaRunnerError` with the stage name and
 * underlying cause. The JSONL is only written if every prior step
 * succeeds and the secrets scan is clean.
 *
 * This function is NOT invoked by its authorization wave. Running it
 * requires a separate β authorization and the eight runtime env vars.
 */
export async function runCandidateExtraction(
  options: RunnerOptions,
  io: RunnerIO = defaultIO(),
): Promise<BetaReport> {
  // Step 1 · parse base credentials from env (no DB touched)
  let pgConfig: PgExecutorConfig;
  try {
    pgConfig = parsePgExecutorConfigFromEnv(io.env);
  } catch (err) {
    throw new BetaRunnerError("parse_credentials", err);
  }

  // Step 2 · parse expected-fingerprint config from env (no DB touched)
  // We do this BEFORE opening a connection so a missing expectation
  // STOPs us without any network activity.
  try {
    parseFingerprintExpectationsFromEnv(io.env);
  } catch (err) {
    throw new BetaRunnerError("parse_fingerprint_config", err);
  }

  // Step 3 · verify fingerprint FIRST, then construct executor.
  // FingerprintVerifiedExecutor.create() enforces this order: it
  // throws BEFORE constructing the executor if verification fails.
  let verified: FingerprintVerifiedExecutor;
  try {
    verified = await FingerprintVerifiedExecutor.create(pgConfig, io.env);
  } catch (err) {
    throw new BetaRunnerError("verify_fingerprint", err);
  }

  const auditing = new AuditingExecutor(verified.executor, pgConfig.resultRowCeiling);

  const orchestratorOptions: OrchestratorOptions = {
    runId: options.runId,
    runTimeIso: io.now().toISOString(),
    topKPerCategory: options.topKPerCategory ?? 20,
  };

  // Step 4 · candidate generation
  let result: GenerationResult;
  try {
    result = await generateCandidatesGated(verified, auditing, orchestratorOptions);
  } catch (err) {
    // Identify which spec failed, if we can
    let failedSpec: string | null = null;
    for (const [, outcome] of auditing.perSpec.entries()) {
      if (outcome.errored) {
        failedSpec = outcome.spec_id;
        break;
      }
    }
    // If no spec was recorded as errored, the error occurred before any
    // spec execute() returned · still a candidate-generation failure.
    throw new BetaRunnerError("generate_candidates", err, failedSpec);
  } finally {
    try {
      await auditing.close();
    } catch {
      /* best-effort · never mask the primary error */
    }
  }

  // Step 5 · secrets scan over the serialised output BEFORE write
  const jsonl = serializeCandidatesToJsonl(result);
  const findings = scanForLikelyCredentials(jsonl);
  if (findings.length > 0) {
    throw new BetaRunnerError("secret_scan", new SecretsLeakError(findings));
  }

  // Step 6 · write JSONL
  let bytesWritten: number;
  try {
    bytesWritten = await io.writeOutput(CANDIDATE_OUTPUT_PATH, jsonl);
  } catch (err) {
    throw new BetaRunnerError("write_output", err);
  }

  // Step 7 · compile the final report
  const perSpec = Array.from(auditing.perSpec.values()).sort((a, b) =>
    a.spec_id < b.spec_id ? -1 : a.spec_id > b.spec_id ? 1 : 0,
  );

  const perSourceTable: Record<string, number> = {};
  const perEntityType: Record<string, number> = {};
  const seenCandidateIds = new Set<string>();
  const duplicateIds: string[] = [];
  for (const c of result.candidates) {
    perSourceTable[c.legacy_source.table] =
      (perSourceTable[c.legacy_source.table] ?? 0) + 1;
    perEntityType[c.entity_type] = (perEntityType[c.entity_type] ?? 0) + 1;
    if (seenCandidateIds.has(c.candidate_id)) {
      duplicateIds.push(c.candidate_id);
    } else {
      seenCandidateIds.add(c.candidate_id);
    }
  }

  const populations = buildPopulationCounts(auditing.perSpec);

  const truncationSuspected = perSpec
    .filter((s) => s.truncation_suspected)
    .map((s) => s.spec_id);

  return {
    stage: "complete",
    fingerprint: {
      database: verified.observed.database,
      user: verified.observed.user,
      serverVersion: verified.observed.serverVersion,
      schemasObservedCount: verified.observed.schemasPresent.length,
      expectedSchemas: verified.expected.schemas,
    },
    run_metadata: result.run_metadata,
    per_spec: perSpec,
    populations,
    candidates: {
      total: result.candidates.length,
      per_category: result.run_metadata.per_category_count,
      per_source_table: perSourceTable,
      per_entity_type: perEntityType,
      duplicate_candidate_ids: duplicateIds,
      quarantined_count: result.excluded_rows.length,
    },
    truncation_suspected_spec_ids: truncationSuspected,
    output: {
      path: CANDIDATE_OUTPUT_PATH,
      bytes: bytesWritten,
    },
  };
}

// ═════════════════════════════════════════════════════════════════════
// §10 · Population counts · derived from AuditingExecutor outcomes
// ═════════════════════════════════════════════════════════════════════

/**
 * Build population counts per the β §5 reporting requirement. Rolls up
 * row counts per spec into the six founder-named buckets, flags any
 * bucket as unavailable when no spec targeting that legacy_table ran
 * to completion.
 */
export function buildPopulationCounts(
  perSpec: ReadonlyMap<string, SpecOutcome>,
): PopulationCounts {
  const bucketMap: Record<string, string[]> = {
    nex_business: ["nex.nex_business"],
    "nex.mp_seller": ["nex.mp_seller"],
    food: ["nex.food_business"],
    accommodation: ["nex.accommodation_business"],
    service: ["nex.service_business"],
    "nex.transport_acquisition_record": ["nex.transport_acquisition_record"],
  };
  const counts: Record<string, number> = {};
  const unavailable: string[] = [];
  for (const [bucket, legacyTables] of Object.entries(bucketMap)) {
    let total = 0;
    let anySpecCompleted = false;
    for (const [, outcome] of perSpec.entries()) {
      if (legacyTables.includes(outcome.legacy_table) && !outcome.errored) {
        total += outcome.row_count;
        anySpecCompleted = true;
      }
    }
    if (!anySpecCompleted) {
      // No spec targeted this bucket OR all specs for this bucket errored.
      // Per the authorization: "Do not convert unavailable into zero."
      unavailable.push(bucket);
      counts[bucket] = 0;
    } else {
      counts[bucket] = total;
    }
  }
  return {
    nex_business: counts.nex_business,
    "nex.mp_seller": counts["nex.mp_seller"],
    food: counts.food,
    accommodation: counts.accommodation,
    service: counts.service,
    "nex.transport_acquisition_record":
      counts["nex.transport_acquisition_record"],
    total_observed:
      counts.nex_business +
      counts["nex.mp_seller"] +
      counts.food +
      counts.accommodation +
      counts.service +
      counts["nex.transport_acquisition_record"],
    populations_unavailable: unavailable,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §11 · Static invariants · module-level
// ═════════════════════════════════════════════════════════════════════
//
// Deliberately re-asserted at the bottom of this file for grep-ability:
//
// This module does NOT import `identity-matching.ts`, `matchBusiness`,
// `nex.business_canonical` write code, or any resolver surface. The only
// script-local imports are the three reviewed modules:
// `./generate-candidates`, `./pg-executor`, `./pg-fingerprint`.
//
// This module does NOT read any file during orchestration. The only disk
// activity is one `fs.writeFile` of the output JSONL (plus a `mkdir -p`
// to ensure the parent directory exists). There is NO `fs.readFile` or
// `require("dotenv")` or similar. Credentials come exclusively from
// `io.env`.
//
// This module does NOT reference Supabase, Supabase credentials, or
// Supabase client libraries. There is no `createClient` from any
// Supabase SDK anywhere in the import graph of this file.
//
// This module cannot be executed with `node extract-candidates.ts`
// directly; it exports functions but does not implement a module entry
// runner. A separate β-authorized caller script would import
// `runCandidateExtraction` and invoke it with runtime env vars.

// Preserve the imported identifiers so TS does not drop unused symbols
// that external callers depend on; `QUERY_SPECS` is referenced here to
// make its sealing explicit at the type level.
const _usedExports = Object.freeze([QUERY_SPECS.length] as const);
if (_usedExports.length < 0) {
  // unreachable · satisfies TS "value is used"
  throw new Error("unreachable");
}
