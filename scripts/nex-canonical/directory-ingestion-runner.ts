// scripts/nex-canonical/directory-ingestion-runner.ts
//
// NEX Directory · Thin production runner for the REAL ingestion path.
//
// Objective
//   Execute the sealed Directory Engine against the real
//   nex.food_business table in Indonesia, with the final outcome
//   being candidates in the durable approval queue · nothing further.
//
// Discovery-only · how this is enforced structurally
//   1. The injected ApprovalProvider is the sealed
//      `createFileBackedApprovalProvider` from
//      `durable-approval-queue.ts`. It returns `null` the first time
//      it sees a candidate · the sealed runner then emits
//      `candidate_quarantined` with outcome `approval_deferred` and
//      returns from `processCandidate` BEFORE touching any downstream
//      dependency.
//   2. All post-approval dependencies (resolver pool, source-registry
//      row, canonical row, OSM collision, write session, readback
//      session) are wired to THROW `DownstreamNotPermittedError` if
//      they are ever called. In correct operation they never are.
//      The thrown error becomes a loud failure, not a silent write.
//   3. The read side uses the sealed `createPgReadSessionFactory`
//      with session-level `SET default_transaction_read_only = on` ·
//      a stray INSERT at any layer would be refused by the DB.
//   4. Before any discovery query, this runner verifies the
//      fingerprint against the four sealed FINGERPRINT_QUERIES ·
//      a mismatch stops the run cold, no candidates emitted.
//
// What this runner does NOT do
//   · Does NOT call `executeWritePlan`
//   · Does NOT call `precheckHandoff` for a write
//   · Does NOT mutate `nex.source_registry`
//   · Does NOT set `can_derive = true`
//   · Does NOT auto-approve any candidate
//   · Does NOT invoke `decideCandidate` on behalf of the founder
//   · Does NOT author migrations
//   · Does NOT fabricate businesses, images, phones, coordinates
//   · Does NOT silently expand to another country · scope = "ID"

import {
  compareFingerprint,
  FINGERPRINT_QUERIES,
  type FingerprintExpectations,
} from "./pg-fingerprint";
import type { ReadSession, ReadSessionFactory } from "./pg-read-adapter";
import {
  createPgReadSessionFactory,
  parsePgReadAdapterConfigFromEnv,
  PgReadAdapterConfigError,
} from "./pg-read-adapter";
import {
  LEGACY_FOOD_SOURCE_ID,
  createLegacyFoodBusinessSource,
} from "./source-legacy-food-business";
import {
  createFileBackedApprovalProvider,
  type ApprovalIO,
} from "./durable-approval-queue";
import {
  reduceCheckpointLog,
  summarizeDerivedState,
  type CheckpointEvent,
  type RunSummary,
} from "./directory-log";
import {
  runDirectoryCountry,
  type CurrentCanonicalRowProvider,
  type ExpectedFingerprint,
  type OsmCollisionProvider,
  type ReadbackSessionFactory,
  type ResolverPoolProvider,
  type SourceRegistryRowProvider,
  type WriteSessionFactory,
} from "./directory-runner";

// ═════════════════════════════════════════════════════════════════════
// §1 · Preflight · env var presence (names only; never values)
// ═════════════════════════════════════════════════════════════════════

export const REQUIRED_INGESTION_ENV_VARS: readonly string[] = Object.freeze([
  // Base PostgreSQL credentials
  "NEX_CANONICAL_PG_HOST",
  "NEX_CANONICAL_PG_DATABASE",
  "NEX_CANONICAL_PG_USER",
  "NEX_CANONICAL_PG_PASSWORD",
  // Fingerprint oracle · required even for discovery-only · a wrong
  // target DB must NOT silently produce "the Directory discovered
  // nothing" if we are talking to the wrong instance.
  "NEX_CANONICAL_PG_EXPECTED_DATABASE",
  "NEX_CANONICAL_PG_EXPECTED_USER",
  "NEX_CANONICAL_PG_EXPECTED_SERVER_VERSION_PREFIX",
  "NEX_CANONICAL_PG_EXPECTED_SCHEMAS",
]);

export interface PreflightResult {
  readonly ok: boolean;
  readonly missing: readonly string[];
  readonly present: readonly string[];
}

export function preflight(env: NodeJS.ProcessEnv): PreflightResult {
  const missing: string[] = [];
  const present: string[] = [];
  for (const name of REQUIRED_INGESTION_ENV_VARS) {
    const raw = env[name];
    if (typeof raw === "string" && raw.length > 0) present.push(name);
    else missing.push(name);
  }
  return { ok: missing.length === 0, missing, present };
}

function parseExpectedFingerprintFromEnv(
  env: NodeJS.ProcessEnv,
): FingerprintExpectations {
  const database = env.NEX_CANONICAL_PG_EXPECTED_DATABASE ?? "";
  const user = env.NEX_CANONICAL_PG_EXPECTED_USER ?? "";
  const serverVersionPrefix =
    env.NEX_CANONICAL_PG_EXPECTED_SERVER_VERSION_PREFIX ?? "";
  const schemasRaw = env.NEX_CANONICAL_PG_EXPECTED_SCHEMAS ?? "";
  const schemas = schemasRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return { database, user, serverVersionPrefix, schemas };
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Fingerprint verification (one-shot, before any discovery)
// ═════════════════════════════════════════════════════════════════════

export type FingerprintCheckResult =
  | { readonly ok: true; readonly observed: FingerprintExpectations }
  | { readonly ok: false; readonly reason: string };

export async function verifyFingerprintOnce(
  factory: ReadSessionFactory,
  expected: FingerprintExpectations,
): Promise<FingerprintCheckResult> {
  let session: ReadSession;
  try {
    session = await factory.openSession();
  } catch (err) {
    return {
      ok: false,
      reason: `cannot open read session for fingerprint: ${err instanceof Error ? err.name : "unknown"}`,
    };
  }
  try {
    const dbRes = await session.query<{ db: string }>(
      FINGERPRINT_QUERIES.database,
      [],
    );
    const userRes = await session.query<{ usr: string }>(
      FINGERPRINT_QUERIES.user,
      [],
    );
    const svRes = await session.query<{ srv_version: string }>(
      FINGERPRINT_QUERIES.serverVersion,
      [],
    );
    const schemasRes = await session.query<{ schema_name: string }>(
      FINGERPRINT_QUERIES.schemas,
      [],
    );
    const observed = {
      database: dbRes.rows[0]?.db ?? "",
      user: userRes.rows[0]?.usr ?? "",
      serverVersion: svRes.rows[0]?.srv_version ?? "",
      schemasPresent: schemasRes.rows.map((r) => r.schema_name),
    };
    const comparison = compareFingerprint(observed, expected);
    if (comparison.ok) {
      return {
        ok: true,
        observed: {
          database: observed.database,
          user: observed.user,
          serverVersionPrefix: observed.serverVersion,
          schemas: observed.schemasPresent,
        },
      };
    }
    return {
      ok: false,
      reason: `fingerprint mismatch · ${comparison.mismatches.join(" | ")}`,
    };
  } catch (err) {
    const sanitised =
      err instanceof Error ? sanitiseErrorText(err.message) : String(err);
    return {
      ok: false,
      reason: `fingerprint query failed: ${sanitised}`,
    };
  } finally {
    try {
      await factory.closeSession(session);
    } catch {
      /* best-effort close */
    }
  }
}

function sanitiseErrorText(input: string): string {
  let out = input;
  out = out.replace(
    /postgres(?:ql)?:\/\/[^:\s]*:[^@\s]*@[^\s"']+/gi,
    "postgres://[redacted]",
  );
  out = out.replace(/\bpassword\s*=\s*\S+/gi, "password=[redacted]");
  return out;
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Throw-on-call downstream stubs · discovery-only guarantee
// ═════════════════════════════════════════════════════════════════════

export class DownstreamNotPermittedError extends Error {
  readonly dependency: string;
  constructor(dependency: string) {
    super(
      `DownstreamNotPermittedError: dependency "${dependency}" was invoked during discovery-only ingestion. ` +
        `The thin runner refuses to proceed past the approval queue. ` +
        `This indicates a logic error: a candidate reached post-approval code without a founder decision.`,
    );
    this.name = "DownstreamNotPermittedError";
    this.dependency = dependency;
  }
}

/** Build a set of downstream dependencies that ALL refuse to execute.
 *  They are wired into the sealed `runDirectoryCountry` interface so
 *  TypeScript can type-check the shape; at runtime any call becomes a
 *  loud failure. The ApprovalProvider is the only "live" dependency
 *  past validation/review · it returns null for every candidate (via
 *  the file-backed queue), which means none of these stubs ever fire
 *  under correct operation. */
export function buildDiscoveryOnlyDownstreamStubs(): {
  readonly resolverPoolProvider: ResolverPoolProvider;
  readonly sourceRegistryRowProvider: SourceRegistryRowProvider;
  readonly currentCanonicalRowProvider: CurrentCanonicalRowProvider;
  readonly osmCollisionProvider: OsmCollisionProvider;
  readonly writeSessionFactory: WriteSessionFactory;
  readonly readbackSessionFactory: ReadbackSessionFactory;
  readonly expectedFingerprint: ExpectedFingerprint;
} {
  const refuse = (dep: string): never => {
    throw new DownstreamNotPermittedError(dep);
  };
  return {
    resolverPoolProvider: async () => refuse("resolverPoolProvider"),
    sourceRegistryRowProvider: async () =>
      refuse("sourceRegistryRowProvider"),
    currentCanonicalRowProvider: async () =>
      refuse("currentCanonicalRowProvider"),
    osmCollisionProvider: async () => refuse("osmCollisionProvider"),
    writeSessionFactory: {
      openSession: async () => refuse("writeSessionFactory.openSession"),
      closeSession: async () => refuse("writeSessionFactory.closeSession"),
    },
    readbackSessionFactory: {
      openSession: async () => refuse("readbackSessionFactory.openSession"),
      closeSession: async () =>
        refuse("readbackSessionFactory.closeSession"),
    },
    // Pass the expected fingerprint through for shape · it is only
    // consumed by executeWritePlan, which never runs in discovery mode.
    expectedFingerprint: {
      database: "",
      user: "",
      serverVersionPrefix: "",
      schemas: [],
    },
  };
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Checkpoint IO adapter (file-backed append-only JSONL)
// ═════════════════════════════════════════════════════════════════════

export interface IngestionIO extends ApprovalIO {
  readonly sleep: (ms: number) => Promise<void>;
  readonly print: (message: string) => void;
}

function buildCheckpointIO(
  path: string,
  io: IngestionIO,
): {
  readonly checkpointLoad: () => Promise<readonly CheckpointEvent[]>;
  readonly checkpointAppend: (event: CheckpointEvent) => Promise<void>;
} {
  return {
    checkpointLoad: async () => {
      const text = await io.readTextOrEmpty(path);
      if (text.length === 0) return [];
      const lines = text.split("\n").filter((l) => l.length > 0);
      const out: CheckpointEvent[] = [];
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as CheckpointEvent;
          if (
            typeof parsed === "object" &&
            parsed !== null &&
            typeof (parsed as { kind: unknown }).kind === "string"
          ) {
            out.push(parsed);
          }
        } catch {
          // Malformed line · skip. The log is append-only; a crash
          // mid-write might leave a trailing partial line.
        }
      }
      return out;
    },
    checkpointAppend: async (event: CheckpointEvent) => {
      await io.appendLine(path, stableStringify(event));
    },
  };
}

function stableStringify(obj: unknown): string {
  if (obj === null) return "null";
  if (typeof obj === "number") {
    if (!Number.isFinite(obj)) throw new Error("non-finite number");
    return JSON.stringify(obj);
  }
  if (typeof obj === "boolean" || typeof obj === "string")
    return JSON.stringify(obj);
  if (Array.isArray(obj))
    return "[" + obj.map(stableStringify).join(",") + "]";
  if (typeof obj === "object") {
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    return (
      "{" +
      keys
        .map(
          (k) =>
            JSON.stringify(k) +
            ":" +
            stableStringify((obj as Record<string, unknown>)[k]),
        )
        .join(",") +
      "}"
    );
  }
  throw new Error("unsupported stableStringify input");
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Public config + result
// ═════════════════════════════════════════════════════════════════════

export interface RealIngestionConfig {
  /** Scoped to Indonesia for this milestone · literal. */
  readonly country: "ID";
  readonly pendingQueuePath: string;
  readonly decisionLogPath: string;
  readonly checkpointLogPath: string;
  readonly generationRunId: string;
  readonly batchSize?: number;
  readonly maxBatchesPerSource?: number;
  readonly maxCandidatesPerSource?: number;
}

export type IngestionStopReason =
  | "preflight_env_missing"
  | "preflight_fingerprint_mismatch"
  | "runner_completed"
  | "runner_cap_reached"
  | "unexpected_downstream_called";

export interface RealIngestionReport {
  readonly stage: "complete" | "stopped";
  readonly stop_reason: IngestionStopReason;
  readonly preflight: PreflightResult;
  readonly fingerprint_ok: boolean;
  readonly fingerprint_detail: string | null;
  readonly source_id: string | null;
  readonly country: "ID" | null;
  readonly summary: RunSummary | null;
  readonly discovered_count: number;
  readonly enqueued_count: number;
  readonly already_pending_count: number;
  readonly downstream_violation: string | null;
  readonly runtime_notes: readonly string[];
}

// ═════════════════════════════════════════════════════════════════════
// §6 · The runner
// ═════════════════════════════════════════════════════════════════════

export interface RunRealIngestionArgs {
  readonly config: RealIngestionConfig;
  readonly io: IngestionIO;
}

export async function runRealDirectoryIngestionID(
  args: RunRealIngestionArgs,
): Promise<RealIngestionReport> {
  const notes: string[] = [];

  // 6.1 Preflight: env var presence (names only).
  const pre = preflight(args.io.env);
  args.io.print(`[nex-directory-ingestion] env present: ${pre.present.length}/${REQUIRED_INGESTION_ENV_VARS.length}`);
  if (!pre.ok) {
    args.io.print(
      `[nex-directory-ingestion] STOP · missing env vars: ${pre.missing.join(", ")}`,
    );
    return emptyReport({
      stage: "stopped",
      stop_reason: "preflight_env_missing",
      preflight: pre,
      runtime_notes: notes,
    });
  }

  // 6.2 Parse pg-read config (fail-closed on malformed vars).
  let pgConfig;
  try {
    pgConfig = parsePgReadAdapterConfigFromEnv(args.io.env);
  } catch (err) {
    const detail =
      err instanceof PgReadAdapterConfigError
        ? err.message
        : String(err);
    notes.push(`parsePgReadAdapterConfigFromEnv failed: ${detail}`);
    args.io.print(`[nex-directory-ingestion] STOP · ${detail}`);
    return emptyReport({
      stage: "stopped",
      stop_reason: "preflight_env_missing",
      preflight: pre,
      runtime_notes: notes,
    });
  }

  const expected = parseExpectedFingerprintFromEnv(args.io.env);

  // 6.3 Build read-only session factory.
  const readFactory = createPgReadSessionFactory(pgConfig);

  // 6.4 One-shot fingerprint verification.
  const fp = await verifyFingerprintOnce(readFactory, expected);
  if (!fp.ok) {
    args.io.print(`[nex-directory-ingestion] STOP · ${fp.reason}`);
    return emptyReport({
      stage: "stopped",
      stop_reason: "preflight_fingerprint_mismatch",
      preflight: pre,
      fingerprint_ok: false,
      fingerprint_detail: fp.reason,
      runtime_notes: notes,
    });
  }
  args.io.print(
    `[nex-directory-ingestion] fingerprint OK · database="${fp.observed.database}" user="${fp.observed.user}" server-prefix="${fp.observed.serverVersionPrefix}"`,
  );

  // 6.5 Build the real source adapter.
  const source = createLegacyFoodBusinessSource({
    session_factory: readFactory,
    config: {
      generationRunId: args.config.generationRunId,
      nowIso: () => args.io.nowIso(),
      batchSize: args.config.batchSize,
    },
  });

  // 6.6 Build the file-backed approval provider.
  const approvalProvider = createFileBackedApprovalProvider({
    pendingQueuePath: args.config.pendingQueuePath,
    decisionLogPath: args.config.decisionLogPath,
    io: {
      readTextOrEmpty: args.io.readTextOrEmpty,
      appendLine: args.io.appendLine,
      nowIso: args.io.nowIso,
    },
  });

  // 6.7 Build checkpoint IO.
  const checkpointIO = buildCheckpointIO(args.config.checkpointLogPath, args.io);

  // 6.8 Downstream throw-on-call stubs · discovery-only guarantee.
  const stubs = buildDiscoveryOnlyDownstreamStubs();

  // 6.9 Pre-run accounting · count what is already pending so we can
  // report the delta.
  const pendingBefore = (await args.io.readTextOrEmpty(args.config.pendingQueuePath))
    .split("\n")
    .filter((l) => l.length > 0).length;

  // 6.10 Run the sealed Directory Engine against the real source.
  let runnerThrew: Error | null = null;
  try {
    await runDirectoryCountry({
      country: args.config.country,
      config: {
        maxBatchesPerSource: args.config.maxBatchesPerSource ?? 100,
        maxCandidatesPerSource: args.config.maxCandidatesPerSource ?? 10_000,
        maxTemporaryRetries: 3,
        retryBaseDelayMs: 1000,
        runner_identity: "nex-directory-ingestion",
      },
      io: {
        now: () => new Date(args.io.nowIso()),
        sleep: args.io.sleep,
        checkpointAppend: checkpointIO.checkpointAppend,
        checkpointLoad: checkpointIO.checkpointLoad,
      },
      deps: {
        source,
        approvalProvider,
        resolverPoolProvider: stubs.resolverPoolProvider,
        sourceRegistryRowProvider: stubs.sourceRegistryRowProvider,
        currentCanonicalRowProvider: stubs.currentCanonicalRowProvider,
        osmCollisionProvider: stubs.osmCollisionProvider,
        writeSessionFactory: stubs.writeSessionFactory,
        readbackSessionFactory: stubs.readbackSessionFactory,
        expectedFingerprint: stubs.expectedFingerprint,
      },
    });
  } catch (err) {
    runnerThrew = err instanceof Error ? err : new Error(String(err));
  }

  // 6.11 Load the final checkpoint log and summarise.
  const finalLog = await checkpointIO.checkpointLoad();
  const derived = reduceCheckpointLog(finalLog);
  const summary = summarizeDerivedState(derived);

  // 6.12 Count the enqueue delta.
  const pendingAfter = (await args.io.readTextOrEmpty(args.config.pendingQueuePath))
    .split("\n")
    .filter((l) => l.length > 0).length;
  const enqueued = Math.max(0, pendingAfter - pendingBefore);

  // 6.13 Determine stop reason.
  if (runnerThrew !== null) {
    if (runnerThrew instanceof DownstreamNotPermittedError) {
      args.io.print(
        `[nex-directory-ingestion] FATAL · ${runnerThrew.message}`,
      );
      return {
        stage: "stopped",
        stop_reason: "unexpected_downstream_called",
        preflight: pre,
        fingerprint_ok: true,
        fingerprint_detail: null,
        source_id: LEGACY_FOOD_SOURCE_ID,
        country: args.config.country,
        summary,
        discovered_count: summary.candidate_count_total,
        enqueued_count: enqueued,
        already_pending_count: pendingBefore,
        downstream_violation: runnerThrew.message,
        runtime_notes: notes,
      };
    }
    notes.push(
      `runDirectoryCountry threw: ${sanitiseErrorText(runnerThrew.message)}`,
    );
  }

  const stop_reason: IngestionStopReason = "runner_completed";

  args.io.print(
    `[nex-directory-ingestion] run complete · discovered=${summary.candidate_count_total} ` +
      `enqueued=${enqueued} already_pending=${pendingBefore} ` +
      `country_finished=${summary.country_finished}`,
  );

  return {
    stage: "complete",
    stop_reason,
    preflight: pre,
    fingerprint_ok: true,
    fingerprint_detail: null,
    source_id: LEGACY_FOOD_SOURCE_ID,
    country: args.config.country,
    summary,
    discovered_count: summary.candidate_count_total,
    enqueued_count: enqueued,
    already_pending_count: pendingBefore,
    downstream_violation: null,
    runtime_notes: notes,
  };
}

function emptyReport(partial: {
  readonly stage: "complete" | "stopped";
  readonly stop_reason: IngestionStopReason;
  readonly preflight: PreflightResult;
  readonly fingerprint_ok?: boolean;
  readonly fingerprint_detail?: string | null;
  readonly runtime_notes: readonly string[];
}): RealIngestionReport {
  return {
    stage: partial.stage,
    stop_reason: partial.stop_reason,
    preflight: partial.preflight,
    fingerprint_ok: partial.fingerprint_ok ?? false,
    fingerprint_detail: partial.fingerprint_detail ?? null,
    source_id: null,
    country: null,
    summary: null,
    discovered_count: 0,
    enqueued_count: 0,
    already_pending_count: 0,
    downstream_violation: null,
    runtime_notes: partial.runtime_notes,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §7 · Static invariants (grep-asserted in tests)
// ═════════════════════════════════════════════════════════════════════
//
// This module:
//   · issues NO INSERT / UPDATE / DELETE / CREATE / ALTER / DROP
//     statements
//   · does NOT invoke executeWritePlan
//   · does NOT invoke precheckHandoff
//   · does NOT invoke decideCandidate
//   · does NOT invoke resolveCanonical
//   · does NOT read credentials from the filesystem
//   · does NOT print credential VALUES · only names + non-secret
//     fingerprint oracle
//   · wires throw-on-call stubs for every post-approval dependency
//   · never fabricates a listing · the source adapter is responsible
//     for honest projections
//   · scope is literally the "ID" country · no silent expansion
