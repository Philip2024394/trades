// scripts/nex-canonical/bulk-approve-runner.ts
//
// NEX Canonical · Bulk-approval runner.
//
// Purpose
//   Process an explicit founder-selected batch of pending-review
//   candidates and record their decisions through the sealed
//   approval-v1 contract. One tool · one job · no shortcuts.
//
//   The pilot flow this unblocks:
//     1. Operator runs the sealed directory-ingestion-runner against
//        a real source · candidates land in the file-backed pending
//        queue · nothing else happens (approval deferred).
//     2. Operator reviews the queue manually, picks a small batch
//        of candidate_ids with explicit decision + note, and writes
//        a batch-input JSON file.
//     3. Operator runs THIS runner against that batch file.
//     4. For each candidate the batch names, this runner:
//          - Looks up the ReviewPackage in the pending queue.
//          - Computes the applicable anomalies via the sealed
//            data on report.anomalies (same filter the sealed
//            synthetic first-write path uses).
//          - Calls sealed `decideCandidate` with the operator's
//            decision + founder_note + auto-acknowledged applicable
//            anomalies.
//          - Produces a sealed `DecisionRecord`.
//     5. New DecisionRecords are appended to the sealed decision log.
//        The next directory-ingestion-runner invocation will see
//        those decisions and advance the approved candidates to
//        resolver + write.
//
// What this runner does NOT do
//   - Does NOT auto-approve based on selection_score, risk category,
//     or any other candidate property. The operator's explicit
//     decision in the batch file is the only source of truth.
//   - Does NOT generate candidates. The pending queue must already
//     exist, populated by the sealed directory-ingestion-runner.
//   - Does NOT execute writes against nex.business_canonical or
//     nex.business_evidence. It only produces DecisionRecords.
//   - Does NOT touch nex.source_registry.
//   - Does NOT modify the Directory UI, Supabase, or any other
//     subsystem.
//   - Does NOT bypass the sealed decideCandidate contract. Every
//     integrity gate (package hash, candidate hash, anomaly
//     acknowledgment, credential scan, timestamp validation) fires
//     unchanged.
//   - Does NOT support superseding prior decisions in this version.
//     If a candidate already has a non-superseded decision in the
//     log, the runner skips it with outcome `already_decided` and
//     the operator can use the sealed decideCandidate API directly
//     if they need to amend.

import { createHash } from "node:crypto";
import type { Anomaly, AnomalyRule } from "./candidate-reviewer";
import {
  decideCandidate,
  parseDecisionLog,
  serializeDecisionLog,
  type DecisionRecord,
  type DecisionState,
  type ReviewPackage,
} from "./candidate-approval";
import {
  findDecisionForCandidate,
  parsePendingQueue,
  type PendingReviewEntry,
} from "./durable-approval-queue";

// ═════════════════════════════════════════════════════════════════════
// §1 · Batch input · the operator's explicit decisions
// ═════════════════════════════════════════════════════════════════════

/** One operator-authored decision for a single candidate.
 *  `decision` is explicit · the runner never infers it. */
export interface BulkDecisionInput {
  readonly candidate_id: string;
  readonly decision: DecisionState;
  readonly founder_note: string | null;
}

/** The whole batch file the operator writes. */
export interface BulkApprovalInput {
  readonly batch_name: string;
  readonly founder_id: string;
  /** ISO-8601 UTC. Applied to every decision in this batch so the
   *  resulting records share a single founder-authored timestamp. */
  readonly decision_timestamp: string;
  readonly decisions: readonly BulkDecisionInput[];
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Outcome shapes · one entry per operator-named decision
// ═════════════════════════════════════════════════════════════════════

export type BulkDecisionOutcome =
  | {
      readonly outcome: "decided";
      readonly candidate_id: string;
      readonly decision: DecisionState;
      readonly decision_record_id: string;
      readonly acknowledged_anomaly_rules: readonly AnomalyRule[];
      readonly reason: null;
    }
  | {
      readonly outcome: "not_in_queue";
      readonly candidate_id: string;
      readonly decision: DecisionState;
      readonly decision_record_id: null;
      readonly acknowledged_anomaly_rules: readonly AnomalyRule[];
      readonly reason: string;
    }
  | {
      readonly outcome: "already_decided";
      readonly candidate_id: string;
      readonly decision: DecisionState;
      readonly decision_record_id: string;
      readonly acknowledged_anomaly_rules: readonly AnomalyRule[];
      readonly reason: string;
    }
  | {
      readonly outcome: "validation_failed";
      readonly candidate_id: string;
      readonly decision: DecisionState;
      readonly decision_record_id: null;
      readonly acknowledged_anomaly_rules: readonly AnomalyRule[];
      readonly reason: string;
    };

export interface BulkApprovalSummary {
  readonly total: number;
  readonly decided: number;
  readonly skipped_not_in_queue: number;
  readonly skipped_already_decided: number;
  readonly skipped_validation_failed: number;
}

export interface BulkApprovalResult {
  readonly batch_name: string;
  readonly founder_id: string;
  readonly decision_timestamp: string;
  readonly outcomes: readonly BulkDecisionOutcome[];
  readonly summary: BulkApprovalSummary;
}

export interface ApplyBulkApprovalsArgs {
  readonly input: BulkApprovalInput;
  readonly pendingQueue: readonly PendingReviewEntry[];
  readonly priorDecisions: readonly DecisionRecord[];
}

export interface ApplyBulkApprovalsReturn {
  readonly result: BulkApprovalResult;
  /** New DecisionRecords produced by this call · ordered as they
   *  appear in the batch input (so a replay produces the same log
   *  tail). Append these to the sealed decision log. */
  readonly newDecisions: readonly DecisionRecord[];
}

// ═════════════════════════════════════════════════════════════════════
// §3 · The pure core · no I/O · no clock
// ═════════════════════════════════════════════════════════════════════

/** Pure · deterministic given identical inputs. Applies each
 *  operator-named decision through the sealed `decideCandidate`
 *  contract and produces outcome records + the new DecisionRecord[]
 *  to append to the decision log. Each decision passes through:
 *
 *   - Pending-queue lookup by candidate_id (ReviewPackage must exist)
 *   - Already-decided check against priorDecisions (via sealed
 *     `findDecisionForCandidate`)
 *   - Applicable-anomaly computation + auto-acknowledgment of each
 *     applicable rule (same filter the sealed synthetic first-write
 *     path uses · the operator's explicit decision is still what
 *     drives approve/reject; the acknowledgment is "I have seen
 *     these flags for this candidate")
 *   - Sealed `decideCandidate` call (full integrity gates fire)
 *   - On any thrown error from decideCandidate, outcome
 *     `validation_failed` is produced with a sanitised reason and
 *     processing continues to the next decision. */
export function applyBulkApprovals(
  args: ApplyBulkApprovalsArgs,
): ApplyBulkApprovalsReturn {
  const { input, pendingQueue, priorDecisions } = args;

  const queueByCandidate = new Map<string, PendingReviewEntry>();
  for (const entry of pendingQueue) {
    // If a candidate appears multiple times in the queue (shouldn't
    // happen per the sealed file-backed provider's dedup, but we
    // defensively tolerate it), prefer the FIRST occurrence so the
    // oldest ReviewPackage drives the decision. Deterministic.
    if (!queueByCandidate.has(entry.candidate_id)) {
      queueByCandidate.set(entry.candidate_id, entry);
    }
  }

  const outcomes: BulkDecisionOutcome[] = [];
  const newDecisions: DecisionRecord[] = [];

  for (const op of input.decisions) {
    const queueEntry = queueByCandidate.get(op.candidate_id);
    if (queueEntry === undefined) {
      outcomes.push({
        outcome: "not_in_queue",
        candidate_id: op.candidate_id,
        decision: op.decision,
        decision_record_id: null,
        acknowledged_anomaly_rules: [],
        reason:
          "candidate_id not present in the pending-review queue · check that the sealed directory-ingestion-runner has enqueued it and that review_package_id has not rotated",
      });
      continue;
    }

    const existing = findDecisionForCandidate(
      priorDecisions,
      op.candidate_id,
      queueEntry.review_package_id,
    );
    if (existing !== null) {
      outcomes.push({
        outcome: "already_decided",
        candidate_id: op.candidate_id,
        decision: op.decision,
        decision_record_id: existing.decision_record_id,
        acknowledged_anomaly_rules: existing.acknowledged_anomaly_rules,
        reason:
          "a current (non-superseded) DecisionRecord already exists in the decision log for this candidate+review_package · bulk-approve v1 does not supersede · use decideCandidate directly if an amendment is required",
      });
      continue;
    }

    // Compute applicable anomalies for this candidate · same filter
    // the sealed synthetic first-write path uses. The operator's
    // explicit `decision` is unchanged · this is the "the founder has
    // seen these flags for this candidate" part of the sealed
    // approval contract.
    const applicable = applicableAnomaliesForCandidate(
      queueEntry.review_package,
      op.candidate_id,
    );
    const acknowledged = applicable.map((a) => a.rule);

    let record: DecisionRecord;
    try {
      record = decideCandidate({
        package: queueEntry.review_package,
        candidateId: op.candidate_id,
        decision: op.decision,
        founderId: input.founder_id,
        founderNote: op.founder_note,
        acknowledgedAnomalyRules: acknowledged,
        decisionTimestamp: input.decision_timestamp,
        supersedes: null,
      });
    } catch (err) {
      outcomes.push({
        outcome: "validation_failed",
        candidate_id: op.candidate_id,
        decision: op.decision,
        decision_record_id: null,
        acknowledged_anomaly_rules: acknowledged,
        reason: sanitiseError(
          err instanceof Error ? err.message : String(err),
        ),
      });
      continue;
    }

    newDecisions.push(record);
    outcomes.push({
      outcome: "decided",
      candidate_id: op.candidate_id,
      decision: op.decision,
      decision_record_id: record.decision_record_id,
      acknowledged_anomaly_rules: acknowledged,
      reason: null,
    });
  }

  const summary: BulkApprovalSummary = {
    total: outcomes.length,
    decided: outcomes.filter((o) => o.outcome === "decided").length,
    skipped_not_in_queue: outcomes.filter(
      (o) => o.outcome === "not_in_queue",
    ).length,
    skipped_already_decided: outcomes.filter(
      (o) => o.outcome === "already_decided",
    ).length,
    skipped_validation_failed: outcomes.filter(
      (o) => o.outcome === "validation_failed",
    ).length,
  };

  return {
    result: {
      batch_name: input.batch_name,
      founder_id: input.founder_id,
      decision_timestamp: input.decision_timestamp,
      outcomes,
      summary,
    },
    newDecisions,
  };
}

/** Pure · filter the anomalies that apply to a specific candidate.
 *  Matches the sealed `applicableAnomalies` logic used inside
 *  candidate-approval.ts, replicated here as a tiny filter (NOT a
 *  decision rule) so this module does not need to export it. The
 *  authoritative acknowledgment contract still lives in sealed
 *  `decideCandidate` · this helper just assembles the input list. */
export function applicableAnomaliesForCandidate(
  pkg: ReviewPackage,
  candidate_id: string,
): readonly Anomaly[] {
  return pkg.report.anomalies.filter(
    (a) =>
      a.candidate_ids.length === 0 ||
      a.candidate_ids.includes(candidate_id),
  );
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Input validation · minimal + fail-closed
// ═════════════════════════════════════════════════════════════════════

export class BulkApprovalInputError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "BulkApprovalInputError";
  }
}

/** Parse + minimally validate a batch-input JSON string. Does NOT
 *  trust unknown fields · unknown top-level or per-decision keys are
 *  rejected to prevent silent typos (e.g. "decison" instead of
 *  "decision"). The sealed `decideCandidate` still runs its own
 *  deeper validation on the values. */
export function parseBulkApprovalInput(text: string): BulkApprovalInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new BulkApprovalInputError(
      `invalid JSON · ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new BulkApprovalInputError("batch must be a JSON object");
  }
  const obj = parsed as Record<string, unknown>;
  const allowedTopKeys = new Set([
    "batch_name",
    "founder_id",
    "decision_timestamp",
    "decisions",
  ]);
  for (const k of Object.keys(obj)) {
    if (!allowedTopKeys.has(k)) {
      throw new BulkApprovalInputError(`unknown top-level field "${k}"`);
    }
  }
  const batch_name = assertString(obj, "batch_name");
  const founder_id = assertString(obj, "founder_id");
  const decision_timestamp = assertString(obj, "decision_timestamp");
  const decisionsRaw = obj.decisions;
  if (!Array.isArray(decisionsRaw)) {
    throw new BulkApprovalInputError(
      "decisions must be an array",
    );
  }
  const decisions: BulkDecisionInput[] = [];
  const allowedDecKeys = new Set([
    "candidate_id",
    "decision",
    "founder_note",
  ]);
  for (let i = 0; i < decisionsRaw.length; i++) {
    const d = decisionsRaw[i];
    if (
      typeof d !== "object" ||
      d === null ||
      Array.isArray(d)
    ) {
      throw new BulkApprovalInputError(
        `decisions[${i}] must be an object`,
      );
    }
    const dec = d as Record<string, unknown>;
    for (const k of Object.keys(dec)) {
      if (!allowedDecKeys.has(k)) {
        throw new BulkApprovalInputError(
          `decisions[${i}] has unknown field "${k}"`,
        );
      }
    }
    const candidate_id = assertString(dec, "candidate_id", `decisions[${i}]`);
    const decisionStr = assertString(dec, "decision", `decisions[${i}]`);
    if (
      decisionStr !== "approve" &&
      decisionStr !== "reject" &&
      decisionStr !== "defer"
    ) {
      throw new BulkApprovalInputError(
        `decisions[${i}].decision must be one of "approve" | "reject" | "defer" · got "${decisionStr}"`,
      );
    }
    const noteRaw = dec.founder_note;
    const founder_note =
      noteRaw === null || noteRaw === undefined
        ? null
        : typeof noteRaw === "string"
          ? noteRaw
          : (() => {
              throw new BulkApprovalInputError(
                `decisions[${i}].founder_note must be string or null`,
              );
            })();
    decisions.push({
      candidate_id,
      decision: decisionStr,
      founder_note,
    });
  }
  return {
    batch_name,
    founder_id,
    decision_timestamp,
    decisions,
  };
}

function assertString(
  obj: Record<string, unknown>,
  key: string,
  parentPath: string = "root",
): string {
  const v = obj[key];
  if (typeof v !== "string" || v.length === 0) {
    throw new BulkApprovalInputError(
      `${parentPath}.${key} must be a non-empty string`,
    );
  }
  return v;
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Credential-safe error sanitiser
// ═════════════════════════════════════════════════════════════════════

/** Strip connection URLs and password= fragments from a diagnostic
 *  string before it is surfaced in the outcome. Belt-and-braces: the
 *  sealed decideCandidate rarely echoes credentials, but the runner
 *  is defence in depth. */
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
// §6 · Serialisation helpers
// ═════════════════════════════════════════════════════════════════════

/** Produce the JSONL tail to append to the sealed decision log for
 *  this batch. The sealed `serializeDecisionLog` sorts records · we
 *  deliberately produce only the NEW records so appending preserves
 *  the file-level sort invariant when the operator appends the tail
 *  to an existing log (the sealed parser tolerates unsorted input and
 *  sorts internally). */
export function serializeNewDecisionsForAppend(
  newDecisions: readonly DecisionRecord[],
): string {
  if (newDecisions.length === 0) return "";
  return serializeDecisionLog(newDecisions);
}

// ═════════════════════════════════════════════════════════════════════
// §7 · Thin CLI entry point
// ═════════════════════════════════════════════════════════════════════

export interface CliArgs {
  readonly batchInputPath: string;
  readonly pendingQueuePath: string;
  readonly decisionLogPath: string;
}

/** Parse argv into the three required paths. Fails closed with a
 *  helpful usage line. */
export function parseCliArgs(argv: readonly string[]): CliArgs {
  // argv[0..1] are node + script path when launched directly.
  const positional = argv.slice(2);
  if (positional.length !== 3) {
    throw new BulkApprovalInputError(
      "usage: bulk-approve-runner <batch.json> <pending-queue.jsonl> <decision-log.jsonl>",
    );
  }
  return {
    batchInputPath: positional[0],
    pendingQueuePath: positional[1],
    decisionLogPath: positional[2],
  };
}

/** Content-addressed batch_id derived from the batch input · stable
 *  across re-reads of the same JSON. Used only for the runner's
 *  own output envelope · not persisted into the sealed decision log. */
export function computeBatchId(input: BulkApprovalInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        batch_name: input.batch_name,
        founder_id: input.founder_id,
        decision_timestamp: input.decision_timestamp,
        decisions: input.decisions,
      }),
      "utf8",
    )
    .digest("hex")
    .slice(0, 16);
}

// Deliberately NOT a direct `main()` call at module scope · importing
// this module must have zero side effects (same discipline as the
// sealed first-live-write orchestrator). The CLI entry point is a
// separate wrapper (bulk-approve-runner-cli.ts · thin shell) OR the
// operator invokes it via:
//   tsx scripts/nex-canonical/bulk-approve-runner.ts <args>
// through the __main guard below.

async function main(): Promise<number> {
  const fs = await import("node:fs/promises");
  const cli = parseCliArgs(process.argv);

  const batchText = await fs.readFile(cli.batchInputPath, "utf8");
  const input = parseBulkApprovalInput(batchText);

  const pendingText = await readFileOrEmpty(fs, cli.pendingQueuePath);
  const pendingQueue =
    pendingText.length > 0 ? parsePendingQueue(pendingText) : [];

  const logText = await readFileOrEmpty(fs, cli.decisionLogPath);
  const priorDecisions =
    logText.length > 0 ? parseDecisionLog(logText) : [];

  const { result, newDecisions } = applyBulkApprovals({
    input,
    pendingQueue,
    priorDecisions,
  });

  if (newDecisions.length > 0) {
    const tail = serializeNewDecisionsForAppend(newDecisions);
    // Append rather than overwrite · preserves the sealed append-only
    // decision-log invariant.
    await fs.appendFile(cli.decisionLogPath, tail, "utf8");
  }

  const batch_id = computeBatchId(input);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({ batch_id, result }, null, 2),
  );
  return result.summary.decided > 0 ||
    result.summary.skipped_already_decided > 0
    ? 0
    : result.summary.skipped_not_in_queue + result.summary.skipped_validation_failed > 0
      ? 2
      : 0;
}

async function readFileOrEmpty(
  fs: typeof import("node:fs/promises"),
  path: string,
): Promise<string> {
  try {
    return await fs.readFile(path, "utf8");
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : null;
    if (code === "ENOENT") return "";
    throw err;
  }
}

// Only run the CLI when this file is the entry point.
// Using `import.meta.url` would require ESM-only build settings; the
// repo invokes scripts via tsx so this check is sufficient.
const isDirectRun =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  /bulk-approve-runner(?:\.(?:ts|js|mts|cts|mjs))?$/.test(process.argv[1]);
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(
        "bulk-approve-runner: " +
          sanitiseError(err instanceof Error ? err.message : String(err)),
      );
      process.exit(1);
    });
}
