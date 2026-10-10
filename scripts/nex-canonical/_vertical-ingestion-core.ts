// scripts/nex-canonical/_vertical-ingestion-core.ts
//
// NEX Directory · Verticals agent · shared vertical-ingestion core.
//
// This module is the per-vertical analogue of the sealed FOOD-only
// `directory-ingestion-runner.ts`. It re-uses every sealed primitive
// (pg-read-adapter, fingerprint, directory-runner, approval queue,
// checkpoint log, discovery-only stubs) but accepts the DirectorySource
// as an INJECTED FACTORY so each vertical can plug in its own adapter.
//
// WHY A SEPARATE MODULE
//   The sealed `directory-ingestion-runner.ts` imports
//   `createLegacyFoodBusinessSource` as a HARD-WIRED dependency. The
//   verticals agent must NOT modify that sealed module. Instead, this
//   core replicates the same preflight → fingerprint → run → report
//   shape and takes the source factory as a parameter.
//
// DISCOVERY-ONLY GUARANTEES (same as the sealed food runner)
//   · Downstream write stubs are wired to throw if ever invoked
//   · Approval provider is the file-backed queue (null on first sight)
//   · Read-only session factory with
//     `SET default_transaction_read_only = on`
//   · One-shot fingerprint verification against the expected oracle
//
// WHAT THIS DOES NOT DO
//   · Does NOT invoke executeWritePlan
//   · Does NOT invoke precheckHandoff for a write
//   · Does NOT mutate nex.source_registry
//   · Does NOT set can_display = TRUE or admin-promote
//   · Does NOT auto-approve any candidate
//   · Does NOT invoke decideCandidate on behalf of the founder

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
import type { DirectorySource } from "./directory-source";

export const REQUIRED_VERTICAL_ENV_VARS: readonly string[] = Object.freeze([
  "NEX_CANONICAL_PG_HOST",
  "NEX_CANONICAL_PG_DATABASE",
  "NEX_CANONICAL_PG_USER",
  "NEX_CANONICAL_PG_PASSWORD",
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

export function preflightVertical(env: NodeJS.ProcessEnv): PreflightResult {
  const missing: string[] = [];
  const present: string[] = [];
  for (const name of REQUIRED_VERTICAL_ENV_VARS) {
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

export class DownstreamNotPermittedError extends Error {
  readonly dependency: string;
  constructor(dependency: string) {
    super(
      `DownstreamNotPermittedError: dependency "${dependency}" was invoked during discovery-only ingestion.`,
    );
    this.name = "DownstreamNotPermittedError";
    this.dependency = dependency;
  }
}

function buildDiscoveryOnlyDownstreamStubs(): {
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
    sourceRegistryRowProvider: async () => refuse("sourceRegistryRowProvider"),
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
    expectedFingerprint: {
      database: "",
      user: "",
      serverVersionPrefix: "",
      schemas: [],
    },
  };
}

export interface VerticalIngestionIO extends ApprovalIO {
  readonly sleep: (ms: number) => Promise<void>;
  readonly print: (message: string) => void;
}

function buildCheckpointIO(
  path: string,
  io: VerticalIngestionIO,
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
          /* skip malformed line */
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

export interface VerticalIngestionConfig {
  readonly country: "ID";
  readonly pendingQueuePath: string;
  readonly decisionLogPath: string;
  readonly checkpointLogPath: string;
  readonly generationRunId: string;
  readonly batchSize?: number;
  readonly maxBatchesPerSource?: number;
  readonly maxCandidatesPerSource?: number;
  readonly verticalLabel: string;
}

export type VerticalStopReason =
  | "preflight_env_missing"
  | "preflight_fingerprint_mismatch"
  | "runner_completed"
  | "runner_cap_reached"
  | "unexpected_downstream_called";

export interface VerticalIngestionReport {
  readonly vertical: string;
  readonly stage: "complete" | "stopped";
  readonly stop_reason: VerticalStopReason;
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
  readonly pending_queue_lines_before: number;
  readonly pending_queue_lines_after: number;
}

export type VerticalSourceFactory = (deps: {
  readonly session_factory: ReadSessionFactory;
  readonly generationRunId: string;
  readonly batchSize?: number;
  readonly nowIso: () => string;
}) => DirectorySource;

export interface RunVerticalIngestionArgs {
  readonly config: VerticalIngestionConfig;
  readonly io: VerticalIngestionIO;
  readonly sourceFactory: VerticalSourceFactory;
  readonly dryRun: boolean;
}

async function verifyFingerprintOnce(
  factory: ReadSessionFactory,
  expected: FingerprintExpectations,
): Promise<{ ok: true; observed: FingerprintExpectations } | { ok: false; reason: string }> {
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
    const dbRes = await session.query<{ db: string }>(FINGERPRINT_QUERIES.database, []);
    const userRes = await session.query<{ usr: string }>(FINGERPRINT_QUERIES.user, []);
    const svRes = await session.query<{ srv_version: string }>(FINGERPRINT_QUERIES.serverVersion, []);
    const schemasRes = await session.query<{ schema_name: string }>(FINGERPRINT_QUERIES.schemas, []);
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
    return { ok: false, reason: `fingerprint mismatch · ${comparison.mismatches.join(" | ")}` };
  } finally {
    try { await factory.closeSession(session); } catch { /* best effort */ }
  }
}

export async function runVerticalIngestion(
  args: RunVerticalIngestionArgs,
): Promise<VerticalIngestionReport> {
  const notes: string[] = [];
  const vertical = args.config.verticalLabel;

  // 1. Env preflight
  const pre = preflightVertical(args.io.env);
  args.io.print(`[${vertical}] env present: ${pre.present.length}/${REQUIRED_VERTICAL_ENV_VARS.length}`);
  if (!pre.ok) {
    args.io.print(`[${vertical}] STOP · missing env vars: ${pre.missing.join(", ")}`);
    return baseReport(vertical, "stopped", "preflight_env_missing", pre, false, null, notes, 0, 0);
  }

  // 2. Build read session factory
  let pgConfig;
  try {
    pgConfig = parsePgReadAdapterConfigFromEnv(args.io.env);
  } catch (err) {
    const detail = err instanceof PgReadAdapterConfigError ? err.message : String(err);
    notes.push(`parsePgReadAdapterConfigFromEnv failed: ${detail}`);
    args.io.print(`[${vertical}] STOP · ${detail}`);
    return baseReport(vertical, "stopped", "preflight_env_missing", pre, false, null, notes, 0, 0);
  }
  const expected = parseExpectedFingerprintFromEnv(args.io.env);
  const readFactory = createPgReadSessionFactory(pgConfig);

  // 3. Fingerprint check
  const fp = await verifyFingerprintOnce(readFactory, expected);
  if (!fp.ok) {
    args.io.print(`[${vertical}] STOP · ${fp.reason}`);
    return baseReport(vertical, "stopped", "preflight_fingerprint_mismatch", pre, false, fp.reason, notes, 0, 0);
  }
  args.io.print(
    `[${vertical}] fingerprint OK · database="${fp.observed.database}" user="${fp.observed.user}" server-prefix="${fp.observed.serverVersionPrefix}"`,
  );

  // 4. Build the vertical source adapter
  const source = args.sourceFactory({
    session_factory: readFactory,
    generationRunId: args.config.generationRunId,
    batchSize: args.config.batchSize,
    nowIso: () => args.io.nowIso(),
  });
  args.io.print(`[${vertical}] source_id="${source.source_id}" country="${source.country}" (adapter healthy)`);

  // DRY-RUN · stop here, do not open approval queue, do not emit candidates
  if (args.dryRun) {
    args.io.print(`[${vertical}] DRY-RUN · source adapter instantiated · no candidates generated · exit`);
    // Attempt a tiny probe: open the session factory one more time (closed by fingerprint)
    // and ask the source for a single batch of 1 to prove discoverability.
    const probeSource = args.sourceFactory({
      session_factory: readFactory,
      generationRunId: `dryrun-${args.config.generationRunId}`,
      batchSize: 1,
      nowIso: () => args.io.nowIso(),
    });
    try {
      const probe = await probeSource.discoverBatch(null);
      if (probe.kind === "more") {
        args.io.print(
          `[${vertical}] DRY-RUN probe · one batch discovered · candidates=${probe.candidates.length} · next_cursor=${probe.next_cursor === null ? "null" : "set"}`,
        );
      } else if (probe.kind === "exhausted") {
        args.io.print(`[${vertical}] DRY-RUN probe · source is exhausted`);
      } else {
        args.io.print(`[${vertical}] DRY-RUN probe · kind=${probe.kind} · reason=${(probe as { reason?: string }).reason ?? "(none)"}`);
      }
    } catch (err) {
      args.io.print(`[${vertical}] DRY-RUN probe FAILED · ${err instanceof Error ? err.message : String(err)}`);
    }
    return {
      vertical,
      stage: "complete",
      stop_reason: "runner_completed",
      preflight: pre,
      fingerprint_ok: true,
      fingerprint_detail: null,
      source_id: source.source_id,
      country: args.config.country,
      summary: null,
      discovered_count: 0,
      enqueued_count: 0,
      already_pending_count: 0,
      downstream_violation: null,
      runtime_notes: ["dry-run"],
      pending_queue_lines_before: 0,
      pending_queue_lines_after: 0,
    };
  }

  // 5. Approval queue (file-backed, null-on-first-sight · never auto-approves)
  const approvalProvider = createFileBackedApprovalProvider({
    pendingQueuePath: args.config.pendingQueuePath,
    decisionLogPath: args.config.decisionLogPath,
    io: {
      readTextOrEmpty: args.io.readTextOrEmpty,
      appendLine: args.io.appendLine,
      nowIso: args.io.nowIso,
    },
  });

  const checkpointIO = buildCheckpointIO(args.config.checkpointLogPath, args.io);
  const stubs = buildDiscoveryOnlyDownstreamStubs();

  const pendingBefore = (await args.io.readTextOrEmpty(args.config.pendingQueuePath))
    .split("\n")
    .filter((l) => l.length > 0).length;

  let runnerThrew: Error | null = null;
  try {
    await runDirectoryCountry({
      country: args.config.country,
      config: {
        maxBatchesPerSource: args.config.maxBatchesPerSource ?? 100,
        maxCandidatesPerSource: args.config.maxCandidatesPerSource ?? 10_000,
        maxTemporaryRetries: 3,
        retryBaseDelayMs: 1000,
        runner_identity: `nex-vertical-ingestion-${vertical}`,
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

  const finalLog = await checkpointIO.checkpointLoad();
  const derived = reduceCheckpointLog(finalLog);
  const summary = summarizeDerivedState(derived);
  const pendingAfter = (await args.io.readTextOrEmpty(args.config.pendingQueuePath))
    .split("\n")
    .filter((l) => l.length > 0).length;
  const enqueued = Math.max(0, pendingAfter - pendingBefore);

  if (runnerThrew !== null) {
    if (runnerThrew instanceof DownstreamNotPermittedError) {
      args.io.print(`[${vertical}] FATAL · ${runnerThrew.message}`);
      return {
        vertical,
        stage: "stopped",
        stop_reason: "unexpected_downstream_called",
        preflight: pre,
        fingerprint_ok: true,
        fingerprint_detail: null,
        source_id: source.source_id,
        country: args.config.country,
        summary,
        discovered_count: summary.candidate_count_total,
        enqueued_count: enqueued,
        already_pending_count: pendingBefore,
        downstream_violation: runnerThrew.message,
        runtime_notes: notes,
        pending_queue_lines_before: pendingBefore,
        pending_queue_lines_after: pendingAfter,
      };
    }
    notes.push(`runDirectoryCountry threw: ${runnerThrew.message}`);
  }

  args.io.print(
    `[${vertical}] run complete · discovered=${summary.candidate_count_total} enqueued=${enqueued} already_pending=${pendingBefore}`,
  );

  return {
    vertical,
    stage: "complete",
    stop_reason: "runner_completed",
    preflight: pre,
    fingerprint_ok: true,
    fingerprint_detail: null,
    source_id: source.source_id,
    country: args.config.country,
    summary,
    discovered_count: summary.candidate_count_total,
    enqueued_count: enqueued,
    already_pending_count: pendingBefore,
    downstream_violation: null,
    runtime_notes: notes,
    pending_queue_lines_before: pendingBefore,
    pending_queue_lines_after: pendingAfter,
  };
}

function baseReport(
  vertical: string,
  stage: "complete" | "stopped",
  stop_reason: VerticalStopReason,
  preflight: PreflightResult,
  fingerprint_ok: boolean,
  fingerprint_detail: string | null,
  runtime_notes: string[],
  pendingBefore: number,
  pendingAfter: number,
): VerticalIngestionReport {
  return {
    vertical,
    stage,
    stop_reason,
    preflight,
    fingerprint_ok,
    fingerprint_detail,
    source_id: null,
    country: null,
    summary: null,
    discovered_count: 0,
    enqueued_count: 0,
    already_pending_count: 0,
    downstream_violation: null,
    runtime_notes,
    pending_queue_lines_before: pendingBefore,
    pending_queue_lines_after: pendingAfter,
  };
}
