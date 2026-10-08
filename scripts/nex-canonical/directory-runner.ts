// scripts/nex-canonical/directory-runner.ts
//
// NEX Directory · Production country-by-country orchestration.
//
// Responsibilities
//   · Discover batches from each configured source for the current
//     country
//   · For every discovered Candidate: run the sealed pipeline
//     (validate → review → approve → resolve → precheck → write →
//     verify)
//   · Record every meaningful event in the append-only checkpoint log
//   · Isolate blocked / ambiguous / failed candidates and KEEP GOING
//   · Treat source failures as source-local, not country-wide
//   · Advance to the next source when a source is exhausted
//   · Mark the country finished only when every source is exhausted
//     or has failed · never on an empty page or a single failure
//   · Expose a resumable state via the checkpoint log; a candidate
//     already written in the log is skipped on resume
//
// Explicit non-responsibilities
//   · NO identity decisions (resolver owns that)
//   · NO validation rules (candidate-validator owns that)
//   · NO review rules (candidate-reviewer owns that)
//   · NO approval decisions (approval-v1 owns that; the runner only
//     plumbs an injected ApprovalProvider that may call out to a UI /
//     queue / human-in-the-loop)
//   · NO canonical write logic (executeWritePlan owns that)
//   · NO migration authoring
//   · NO fabrication of data
//   · The runner is pure orchestration + progress + checkpointing
//
// Credential posture
//   · The runner does NOT read credentials. All DB interaction is
//     via injected session factories.
//   · If a caller passes session factories that fail to open, the
//     runner surfaces the failure through the checkpoint log and
//     continues (source-local failure, not country-wide).

import type { Candidate } from "./generate-candidates";
import { reviewCandidates } from "./candidate-reviewer";
import {
  buildReviewPackage,
  decideCandidate,
  type DecisionRecord,
  type ReviewPackage,
} from "./candidate-approval";
import { validateCandidate, CandidateShapeError } from "./candidate-validator";
import { resolveCanonical } from "./canonical-resolver";
import type { CanonicalResolverInput } from "./canonical-row";
import {
  precheckHandoff,
  type ApprovedCandidateHandoff,
  type HandoffBlockedReason,
  type ResolverVerdict,
  type SourceRegistryRow,
} from "./canonical-handoff";
import { HANDOFF_SCHEMA_VERSION } from "./canonical-handoff";
import {
  executeWritePlan,
  type ExpectedFingerprint,
  type WriteExecutionReport,
  type WriteSessionFactory,
} from "./execute-write-plan";
import {
  verifyFirstWriteReadback,
  type ReadbackSessionFactory,
} from "./canonical-readback";
import {
  isAbstained,
  isAnswered,
  type IntelligenceResult,
} from "./intelligence-result";
import type {
  CandidateOutcome,
  CheckpointEvent,
  RunnerState,
  SourceCursor,
} from "./directory-log";
import { reduceCheckpointLog, summarizeDerivedState, type RunSummary } from "./directory-log";
import type { DirectorySource, DiscoverBatchResult } from "./directory-source";

// ═════════════════════════════════════════════════════════════════════
// §1 · Injected IO + deps
// ═════════════════════════════════════════════════════════════════════

export interface RunnerIO {
  /** Caller-supplied clock. Called at every log-event timestamp. */
  readonly now: () => Date;
  /** Caller-supplied sleep for retry backoff. In tests, a deterministic
   *  no-op; in production, `setTimeout`-backed. */
  readonly sleep: (ms: number) => Promise<void>;
  /** Append one event to the durable checkpoint log. The runner
   *  calls this BEFORE moving on from each state transition so a
   *  crash cannot silently lose progress. */
  readonly checkpointAppend: (event: CheckpointEvent) => Promise<void>;
  /** Load the full existing checkpoint log on startup for resume. */
  readonly checkpointLoad: () => Promise<readonly CheckpointEvent[]>;
}

/** Decide an approval for a candidate's ReviewPackage. The runner
 *  passes the exact package the candidate was placed in. The provider
 *  returns a DecisionRecord · typically the result of
 *  `decideCandidate(...)` with founder-supplied inputs · or `null`
 *  to indicate "cannot approve now · leave pending and move on."
 *  In production, this is backed by a durable approval queue. */
export type ApprovalProvider = (args: {
  readonly package: ReviewPackage;
  readonly candidate_id: string;
}) => Promise<DecisionRecord | null>;

/** Return the current resolver pool for a (country, entity_type)
 *  pair. In production: a read-only SELECT against nex.business_canonical.
 *  In tests: a controlled array. */
export type ResolverPoolProvider = (args: {
  readonly country: string;
  readonly entity_type: string;
}) => Promise<readonly CanonicalResolverInput[]>;

/** Return the source_registry row for a given source_id. In
 *  production: a read-only SELECT against nex.source_registry. In
 *  tests: a controlled object. If `null` is returned, the source is
 *  treated as unknown and candidates from it are quarantined. */
export type SourceRegistryRowProvider = (
  source_id: string,
) => Promise<SourceRegistryRow | null>;

/** For MATCH verdicts, return the full canonical row of the target.
 *  In production: a read-only SELECT by canonical_business_id. In
 *  tests: controlled. */
export type CurrentCanonicalRowProvider = (
  canonical_business_id: string,
) => Promise<import("./canonical-row").CanonicalRow | null>;

/** For NO_MATCH verdicts with a non-null osm_id, return whether an
 *  existing canonical row holds the same (country, osm_id). Null
 *  means no collision. */
export type OsmCollisionProvider = (args: {
  readonly country: string;
  readonly osm_id: string;
}) => Promise<{ readonly canonical_business_id: string; readonly osm_id: string } | null>;

export interface RunnerDeps {
  readonly source: DirectorySource;
  readonly approvalProvider: ApprovalProvider;
  readonly resolverPoolProvider: ResolverPoolProvider;
  readonly sourceRegistryRowProvider: SourceRegistryRowProvider;
  readonly currentCanonicalRowProvider: CurrentCanonicalRowProvider;
  readonly osmCollisionProvider: OsmCollisionProvider;
  readonly writeSessionFactory: WriteSessionFactory;
  readonly readbackSessionFactory: ReadbackSessionFactory;
  readonly expectedFingerprint: ExpectedFingerprint;
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Config
// ═════════════════════════════════════════════════════════════════════

export interface RunnerConfig {
  /** Hard cap on batches per source · prevents runaway loops. */
  readonly maxBatchesPerSource: number;
  /** Hard cap on candidates processed per source · defence in depth. */
  readonly maxCandidatesPerSource: number;
  /** How many retries to tolerate for `temporary_failure` before
   *  marking a source failed. */
  readonly maxTemporaryRetries: number;
  /** Base backoff for retries (ms). Linear backoff: attempt N →
   *  base * N. Tests inject sleep=noop so this is observable without
   *  real timing. */
  readonly retryBaseDelayMs: number;
  /** The founder_id to record when the approval provider returns a
   *  DecisionRecord. Used for logging only · the DecisionRecord
   *  itself carries its own founder_id. */
  readonly runner_identity: string;
}

export const DEFAULT_RUNNER_CONFIG: RunnerConfig = Object.freeze({
  maxBatchesPerSource: 10_000,
  maxCandidatesPerSource: 1_000_000,
  maxTemporaryRetries: 3,
  retryBaseDelayMs: 1_000,
  runner_identity: "nex-directory-runner",
});

// ═════════════════════════════════════════════════════════════════════
// §3 · Run report
// ═════════════════════════════════════════════════════════════════════

export interface DirectoryRunReport {
  readonly country: string;
  readonly runner_state: RunnerState;
  readonly summary: RunSummary;
  readonly events_emitted: number;
  readonly batches_processed: number;
  readonly stopped_reason:
    | "country_finished"
    | "operator_stop"
    | "cap_reached"
    | "unexpected_error";
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Main orchestrator
// ═════════════════════════════════════════════════════════════════════

export async function runDirectoryCountry(args: {
  readonly country: string;
  readonly config?: RunnerConfig;
  readonly io: RunnerIO;
  readonly deps: RunnerDeps;
}): Promise<DirectoryRunReport> {
  const config = args.config ?? DEFAULT_RUNNER_CONFIG;

  // ── Resume · load the existing log and compute dedup set
  const existingLog = await args.io.checkpointLoad();
  const derivedPre = reduceCheckpointLog(existingLog);
  const writtenCandidateIds = new Set<string>();
  for (const [id, state] of derivedPre.candidates.entries()) {
    if (state.outcome === "written" || state.outcome === "duplicate_skipped") {
      writtenCandidateIds.add(id);
    }
  }

  // ── Log run-started · idempotent for resume
  await args.io.checkpointAppend({
    kind: "run_started",
    ts: args.io.now().toISOString(),
    country: args.country,
    sources: [args.deps.source.source_id],
  });

  let batchesProcessed = 0;
  let stopReason: DirectoryRunReport["stopped_reason"] = "country_finished";
  const source = args.deps.source;

  // ── Fetch & process batches from this source
  await args.io.checkpointAppend({
    kind: "source_started",
    ts: args.io.now().toISOString(),
    country: args.country,
    source_id: source.source_id,
    cursor: null,
  });

  let cursor: SourceCursor | null = null;
  let candidatesProcessed = 0;
  let attempt = 0;

  for (
    let batch = 0;
    batch < config.maxBatchesPerSource;
    batch++, batchesProcessed++
  ) {
    const batchResult: DiscoverBatchResult = await source.discoverBatch(cursor);

    if (batchResult.kind === "exhausted") {
      await args.io.checkpointAppend({
        kind: "source_exhausted",
        ts: args.io.now().toISOString(),
        country: args.country,
        source_id: source.source_id,
      });
      break;
    }

    if (batchResult.kind === "temporary_failure") {
      attempt++;
      if (attempt > config.maxTemporaryRetries) {
        await args.io.checkpointAppend({
          kind: "source_failed",
          ts: args.io.now().toISOString(),
          country: args.country,
          source_id: source.source_id,
          reason: `temporary_failure retries exhausted: ${batchResult.reason}`,
        });
        break;
      }
      const delay = Math.max(
        batchResult.retry_after_ms ?? 0,
        config.retryBaseDelayMs * attempt,
      );
      await args.io.checkpointAppend({
        kind: "source_retrying",
        ts: args.io.now().toISOString(),
        country: args.country,
        source_id: source.source_id,
        attempt,
        reason: batchResult.reason,
        next_delay_ms: delay,
      });
      await args.io.sleep(delay);
      // Do NOT advance cursor · retry fetches the same page.
      batchesProcessed--; // retry doesn't count against the cap
      continue;
    }

    if (batchResult.kind === "permanent_failure") {
      await args.io.checkpointAppend({
        kind: "source_failed",
        ts: args.io.now().toISOString(),
        country: args.country,
        source_id: source.source_id,
        reason: batchResult.reason,
      });
      break;
    }

    // batchResult.kind === "more"
    attempt = 0; // reset retry counter on success
    await args.io.checkpointAppend({
      kind: "source_batch_fetched",
      ts: args.io.now().toISOString(),
      country: args.country,
      source_id: source.source_id,
      candidate_count: batchResult.candidates.length,
      next_cursor: batchResult.next_cursor,
    });

    for (const rawCandidate of batchResult.candidates) {
      if (candidatesProcessed >= config.maxCandidatesPerSource) {
        stopReason = "cap_reached";
        break;
      }
      candidatesProcessed++;
      // Dedup on resume: already-written candidates do not re-process.
      if (writtenCandidateIds.has(rawCandidate.candidate_id)) {
        await args.io.checkpointAppend({
          kind: "candidate_duplicate_skipped",
          ts: args.io.now().toISOString(),
          candidate_id: rawCandidate.candidate_id,
          original_event_ts: "resume_dedup",
        });
        continue;
      }
      await processCandidate(
        rawCandidate,
        source,
        args.country,
        args.config ?? DEFAULT_RUNNER_CONFIG,
        args.io,
        args.deps,
      );
      // Record the write so later batches dedup.
      writtenCandidateIds.add(rawCandidate.candidate_id);
    }

    cursor = batchResult.next_cursor;
    if (candidatesProcessed >= config.maxCandidatesPerSource) {
      stopReason = "cap_reached";
      break;
    }
    if (cursor === null && batchResult.candidates.length === 0) {
      // Empty page with no next cursor is NOT automatic exhaustion ·
      // but a source that returns `more` with zero candidates and no
      // next_cursor is semantically done. We still require the source
      // to explicitly return `exhausted` to mark done, so we proceed
      // to the next batch which will return exhausted or more.
      // To avoid an infinite empty-page loop, we treat this as a
      // soft stop · one more batch call to confirm.
      // (No action here · the next iteration will call the source
      // again with the same (null) cursor; if the source still
      // doesn't explicitly exhaust, the batch cap will stop us.)
    }
  }

  if (batchesProcessed >= (args.config?.maxBatchesPerSource ?? DEFAULT_RUNNER_CONFIG.maxBatchesPerSource)) {
    stopReason = "cap_reached";
  }

  // ── Determine if the country has finished
  // Load the up-to-date log · the appends during this run are now visible.
  const finalLog = await args.io.checkpointLoad();
  const finalDerived = reduceCheckpointLog(finalLog);
  const allSourcesTerminal = Array.from(finalDerived.sources.values()).every(
    (s) => s.state === "exhausted" || s.state === "failed",
  );
  if (allSourcesTerminal && finalDerived.sources.size > 0) {
    const allFailed = Array.from(finalDerived.sources.values()).every(
      (s) => s.state === "failed",
    );
    await args.io.checkpointAppend({
      kind: "country_finished",
      ts: args.io.now().toISOString(),
      country: args.country,
      reason: allFailed ? "all_sources_failed" : "all_sources_exhausted",
    });
  }

  const concluded = await args.io.checkpointLoad();
  const concludedDerived = reduceCheckpointLog(concluded);
  const summary = summarizeDerivedState(concludedDerived);
  const runnerState: RunnerState = concludedDerived.country_finished
    ? "FINISHED_COUNTRY"
    : stopReason === "cap_reached"
      ? "WAITING"
      : "PROCESSING";

  return {
    country: args.country,
    runner_state: runnerState,
    summary,
    events_emitted: concluded.length - existingLog.length,
    batches_processed: batchesProcessed,
    stopped_reason: stopReason,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Per-candidate orchestration · isolated · never country-stopping
// ═════════════════════════════════════════════════════════════════════

async function processCandidate(
  rawCandidate: Candidate,
  source: DirectorySource,
  country: string,
  _config: RunnerConfig,
  io: RunnerIO,
  deps: RunnerDeps,
): Promise<void> {
  // Discovery event.
  await io.checkpointAppend({
    kind: "candidate_discovered",
    ts: io.now().toISOString(),
    country,
    source_id: source.source_id,
    candidate_id: rawCandidate.candidate_id,
  });

  // Validate shape · defence in depth even though the source should
  // produce well-formed Candidates.
  let candidate: Candidate;
  try {
    candidate = validateCandidate(rawCandidate);
  } catch (err) {
    const detail =
      err instanceof CandidateShapeError
        ? `${err.path}: ${err.message}`
        : String(err);
    await io.checkpointAppend({
      kind: "candidate_shape_rejected",
      ts: io.now().toISOString(),
      candidate_id: rawCandidate.candidate_id,
      detail,
    });
    return;
  }

  // Review.
  const report = reviewCandidates([candidate]);
  const applicable = report.anomalies.filter(
    (a) =>
      a.candidate_ids.length === 0 ||
      a.candidate_ids.includes(candidate.candidate_id),
  );
  await io.checkpointAppend({
    kind: "candidate_reviewed",
    ts: io.now().toISOString(),
    candidate_id: candidate.candidate_id,
    anomaly_rules: applicable.map((a) => a.rule),
  });

  // Build the ReviewPackage so the approval provider sees exactly
  // what the founder would see.
  const pkg = buildReviewPackage({
    candidates: [candidate],
    report,
    packagedAt: io.now().toISOString(),
  });

  // Approve · if provider returns null the runner leaves the candidate
  // pending (no written outcome; it may be approved in a future run).
  let decisionRecord: DecisionRecord | null = null;
  try {
    decisionRecord = await deps.approvalProvider({
      package: pkg,
      candidate_id: candidate.candidate_id,
    });
  } catch (err) {
    await io.checkpointAppend({
      kind: "candidate_quarantined",
      ts: io.now().toISOString(),
      candidate_id: candidate.candidate_id,
      outcome: "approval_deferred",
      reason: `approvalProvider threw: ${err instanceof Error ? err.message : String(err)}`,
    });
    return;
  }

  if (decisionRecord === null) {
    await io.checkpointAppend({
      kind: "candidate_quarantined",
      ts: io.now().toISOString(),
      candidate_id: candidate.candidate_id,
      outcome: "approval_deferred",
      reason: "approvalProvider returned null · leave pending",
    });
    return;
  }

  await io.checkpointAppend({
    kind: "candidate_decided",
    ts: io.now().toISOString(),
    candidate_id: candidate.candidate_id,
    decision: decisionRecord.decision,
    decision_record_id: decisionRecord.decision_record_id,
  });

  if (decisionRecord.decision === "reject") {
    await io.checkpointAppend({
      kind: "candidate_quarantined",
      ts: io.now().toISOString(),
      candidate_id: candidate.candidate_id,
      outcome: "approval_rejected",
      reason: "decision = reject",
    });
    return;
  }
  if (decisionRecord.decision === "defer") {
    await io.checkpointAppend({
      kind: "candidate_quarantined",
      ts: io.now().toISOString(),
      candidate_id: candidate.candidate_id,
      outcome: "approval_deferred",
      reason: "decision = defer",
    });
    return;
  }

  // Resolve.
  let pool: readonly CanonicalResolverInput[];
  try {
    pool = await deps.resolverPoolProvider({
      country: candidate.country,
      entity_type: candidate.entity_type,
    });
  } catch (err) {
    await io.checkpointAppend({
      kind: "candidate_quarantined",
      ts: io.now().toISOString(),
      candidate_id: candidate.candidate_id,
      outcome: "resolver_abstained",
      reason: `resolverPoolProvider threw: ${err instanceof Error ? err.message : String(err)}`,
    });
    return;
  }

  const resolverResult = resolveCanonical({ candidate, pool });
  if (isAbstained(resolverResult)) {
    await io.checkpointAppend({
      kind: "candidate_resolver_abstained",
      ts: io.now().toISOString(),
      candidate_id: candidate.candidate_id,
      reason_code: resolverResult.reason.code,
    });
    await io.checkpointAppend({
      kind: "candidate_quarantined",
      ts: io.now().toISOString(),
      candidate_id: candidate.candidate_id,
      outcome: "resolver_abstained",
      reason: resolverResult.reason.message,
    });
    return;
  }

  const verdict: ResolverVerdict = resolverResult.value;

  if (verdict.kind === "AMBIGUOUS") {
    await io.checkpointAppend({
      kind: "candidate_resolved",
      ts: io.now().toISOString(),
      candidate_id: candidate.candidate_id,
      verdict: "AMBIGUOUS",
      target_id: null,
      score: verdict.best_score,
    });
    await io.checkpointAppend({
      kind: "candidate_quarantined",
      ts: io.now().toISOString(),
      candidate_id: candidate.candidate_id,
      outcome: "resolver_ambiguous",
      reason: `competing=${verdict.competing.map((c) => c.canonical_business_id).join(",")}`,
    });
    return;
  }

  await io.checkpointAppend({
    kind: "candidate_resolved",
    ts: io.now().toISOString(),
    candidate_id: candidate.candidate_id,
    verdict: verdict.kind,
    target_id:
      verdict.kind === "MATCH" ? verdict.target_canonical_business_id : null,
    score: verdict.kind === "MATCH" ? verdict.score : verdict.best_score,
  });

  // Pull inputs for the precheck.
  let sourceRow: SourceRegistryRow | null;
  try {
    sourceRow = await deps.sourceRegistryRowProvider(source.source_id);
  } catch (err) {
    await io.checkpointAppend({
      kind: "candidate_quarantined",
      ts: io.now().toISOString(),
      candidate_id: candidate.candidate_id,
      outcome: "precheck_blocked",
      reason: `sourceRegistryRowProvider threw: ${err instanceof Error ? err.message : String(err)}`,
    });
    return;
  }
  if (sourceRow === null) {
    await io.checkpointAppend({
      kind: "candidate_quarantined",
      ts: io.now().toISOString(),
      candidate_id: candidate.candidate_id,
      outcome: "precheck_blocked",
      reason: `source_registry row not found for source_id=${source.source_id}`,
    });
    return;
  }

  let currentRow: import("./canonical-row").CanonicalRow | null = null;
  if (verdict.kind === "MATCH") {
    try {
      currentRow = await deps.currentCanonicalRowProvider(
        verdict.target_canonical_business_id,
      );
    } catch (err) {
      await io.checkpointAppend({
        kind: "candidate_quarantined",
        ts: io.now().toISOString(),
        candidate_id: candidate.candidate_id,
        outcome: "precheck_blocked",
        reason: `currentCanonicalRowProvider threw: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }
  }

  let osmCollision: { canonical_business_id: string; osm_id: string } | null = null;
  if (verdict.kind === "NO_MATCH" && candidate.identity.osm_id !== null) {
    try {
      osmCollision = await deps.osmCollisionProvider({
        country: candidate.country,
        osm_id: candidate.identity.osm_id,
      });
    } catch (err) {
      await io.checkpointAppend({
        kind: "candidate_quarantined",
        ts: io.now().toISOString(),
        candidate_id: candidate.candidate_id,
        outcome: "precheck_blocked",
        reason: `osmCollisionProvider threw: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }
  }

  const handoff: ApprovedCandidateHandoff = {
    schema_version: HANDOFF_SCHEMA_VERSION,
    decision_record: decisionRecord,
    candidate,
    review_package: pkg,
  };

  const precheck = precheckHandoff({
    handoff,
    resolver_verdict: verdict,
    source_registry_row: sourceRow,
    current_canonical_row_if_match: currentRow,
    existing_osm_collision_if_any: osmCollision,
  });
  if (!precheck.ok) {
    await io.checkpointAppend({
      kind: "candidate_precheck_blocked",
      ts: io.now().toISOString(),
      candidate_id: candidate.candidate_id,
      reason_kind: precheck.reason.kind,
      detail: summariseBlockedReason(precheck.reason),
    });
    await io.checkpointAppend({
      kind: "candidate_quarantined",
      ts: io.now().toISOString(),
      candidate_id: candidate.candidate_id,
      outcome: "precheck_blocked",
      reason: precheck.reason.kind,
    });
    return;
  }

  await io.checkpointAppend({
    kind: "candidate_precheck_passed",
    ts: io.now().toISOString(),
    candidate_id: candidate.candidate_id,
    plan_kind: precheck.plan.kind,
  });

  // Write.
  const writeResult = await executeWritePlan({
    plan: precheck.plan,
    session_factory: deps.writeSessionFactory,
    expected_fingerprint: deps.expectedFingerprint,
  });

  if (isAbstained(writeResult)) {
    await io.checkpointAppend({
      kind: "candidate_write_abstained",
      ts: io.now().toISOString(),
      candidate_id: candidate.candidate_id,
      reason_code: writeResult.reason.code,
      reason: writeResult.reason.message,
    });
    await io.checkpointAppend({
      kind: "candidate_quarantined",
      ts: io.now().toISOString(),
      candidate_id: candidate.candidate_id,
      outcome: "write_abstained",
      reason: writeResult.reason.code,
    });
    return;
  }
  const writeReport: WriteExecutionReport = writeResult.value;
  await io.checkpointAppend({
    kind: "candidate_written",
    ts: io.now().toISOString(),
    candidate_id: candidate.candidate_id,
    canonical_business_id: writeReport.canonical_business_id,
    evidence_id: writeReport.evidence_id,
    plan_kind: writeReport.kind,
  });

  // Independent read-back.
  const readback = await verifyFirstWriteReadback({
    session_factory: deps.readbackSessionFactory,
    plan: precheck.plan,
    canonical_business_id: writeReport.canonical_business_id,
    evidence_id: writeReport.evidence_id,
  });
  if (isAbstained(readback)) {
    await io.checkpointAppend({
      kind: "candidate_verification_failed",
      ts: io.now().toISOString(),
      candidate_id: candidate.candidate_id,
      reason: `${readback.reason.code}: ${readback.reason.message}`,
    });
    return;
  }
  const rb = readback.value;
  if (!rb.canonical_row_found || !rb.evidence_row_found || !rb.all_fields_match || !rb.no_duplicates) {
    await io.checkpointAppend({
      kind: "candidate_verification_failed",
      ts: io.now().toISOString(),
      candidate_id: candidate.candidate_id,
      reason: `canonical_found=${rb.canonical_row_found} evidence_found=${rb.evidence_row_found} fields_match=${rb.all_fields_match} no_duplicates=${rb.no_duplicates}`,
    });
    return;
  }
  await io.checkpointAppend({
    kind: "candidate_verified",
    ts: io.now().toISOString(),
    candidate_id: candidate.candidate_id,
    canonical_business_id: rb.canonical_business_id,
    all_fields_match: rb.all_fields_match,
    no_duplicates: rb.no_duplicates,
  });
}

function summariseBlockedReason(r: HandoffBlockedReason): string {
  switch (r.kind) {
    case "resolver_ambiguous":
      return `competing=${r.competing.join(",")} best_score=${r.best_score}`;
    case "candidate_integrity_mismatch":
    case "review_package_integrity_mismatch":
      return `expected=${r.expected} actual=${r.actual}`;
    case "source_permission_denied":
      return `source=${r.source_id} flag=${r.flag}`;
    case "lifecycle_blocked":
      return `current_state=${r.current_state} target=${r.target_canonical_business_id}`;
    case "osm_collision":
      return `existing=${r.existing_canonical_business_id} osm_id=${r.osm_id}`;
    case "rule_5_violation":
      return r.detail;
    default:
      return JSON.stringify(r);
  }
}

// ═════════════════════════════════════════════════════════════════════
// §6 · Static invariants
// ═════════════════════════════════════════════════════════════════════
//
// This module:
//   · is an orchestrator · not a decision engine
//   · does NOT import pg · DB access is through the already-sealed
//     write/readback factories, which are injected
//   · does NOT import extract-candidates, pg-executor, pg-fingerprint
//     at the runtime value level · all DB-touching modules are
//     dependency-injected
//   · does NOT import identity-matching · entity-universe · matchBusiness
//   · does NOT fabricate candidates · it only receives them from the
//     injected source
//   · does NOT write directly to any table · it delegates to
//     executeWritePlan
//   · does NOT invent approval decisions · it delegates to
//     ApprovalProvider
//   · does NOT invent resolver verdicts · it delegates to
//     resolveCanonical
//   · does NOT treat an empty response as completion · a source must
//     explicitly return `exhausted` to mark done, or all retry attempts
//     must be used up
//   · writes every meaningful state transition to the checkpoint log
//     so observability is durable rather than depending on process
//     memory
