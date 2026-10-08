// scripts/nex-canonical/durable-approval-queue.ts
//
// NEX Canonical · File-backed durable approval queue.
//
// Why this exists
//   The sealed `approval-v1` module requires a founder decision to
//   produce a `DecisionRecord`. The directory-runner takes an
//   injected `ApprovalProvider`. In production, the runner cannot
//   stop and wait for a human synchronously · it needs to:
//     1. Record the review package as "pending founder decision"
//        in a durable append-only file
//     2. Return `null` from the provider so the runner marks the
//        candidate as "approval_deferred" and moves on
//     3. On the NEXT run, when the founder has written their
//        decision to the sealed decision log, the provider returns
//        the DecisionRecord and the candidate advances
//
// What this module is
//   · A pure file-backed queue · all I/O is injected via `ApprovalIO`
//   · A thin ApprovalProvider implementation that composes the
//     pending queue with the sealed decision log parser
//   · Nothing more · it does NOT replace approval-v1, it does NOT
//     invent decisions, it does NOT auto-approve
//
// What this module is NOT
//   · Not a UI
//   · Not a second decision model
//   · Not a schema/DB change · the queue is a filesystem artefact
//     parallel to the sealed decision log; it has NO DB persistence
//     and requires NO migration
//   · Not a replacement for `decideCandidate` · the founder's
//     eventual decision still passes through the sealed approval-v1
//     API (the founder writes a DecisionRecord to the decision log
//     using the sealed `decideCandidate` function; the queue just
//     tells them which candidates are waiting)

import type { ReviewPackage } from "./candidate-approval";
import {
  parseDecisionLog,
  type DecisionRecord,
} from "./candidate-approval";
import type { ApprovalProvider } from "./directory-runner";

// ═════════════════════════════════════════════════════════════════════
// §1 · Schema versions
// ═════════════════════════════════════════════════════════════════════

export const PENDING_SCHEMA_VERSION = "pending-review-v1" as const;

// ═════════════════════════════════════════════════════════════════════
// §2 · Pending review entry · the queue line format
// ═════════════════════════════════════════════════════════════════════

/** One line in `pending-review-queue.jsonl`. Append-only. The founder's
 *  review UI reads this file and produces decisions via the sealed
 *  `decideCandidate` API; those decisions land in the sealed
 *  decision log. */
export interface PendingReviewEntry {
  readonly schema_version: typeof PENDING_SCHEMA_VERSION;
  readonly candidate_id: string;
  readonly review_package_id: string;
  readonly review_package: ReviewPackage;
  readonly enqueued_at: string; // ISO-8601 UTC · caller-supplied
}

// ═════════════════════════════════════════════════════════════════════
// §3 · ApprovalIO · injected file operations
// ═════════════════════════════════════════════════════════════════════

export interface ApprovalIO {
  /** Read the full contents of a file as a UTF-8 string. Returns
   *  empty string if the file does not exist. */
  readonly readTextOrEmpty: (path: string) => Promise<string>;
  /** Append one line to a file. Must flush before returning so the
   *  queue is durable even on crash. */
  readonly appendLine: (path: string, line: string) => Promise<void>;
  /** ISO-8601 UTC timestamp provider. Separate from the runner's
   *  clock so tests can inject a frozen time. */
  readonly nowIso: () => string;
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Deterministic JSONL
// ═════════════════════════════════════════════════════════════════════

/** Stable JSON stringification used by this module. Mirrors the
 *  pattern in candidate-approval.ts for byte-stable serialisation. */
function stableStringify(obj: unknown): string {
  if (obj === null) return "null";
  if (typeof obj === "number") {
    if (!Number.isFinite(obj)) {
      throw new Error("stableStringify: non-finite number is not JSON-safe");
    }
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
  throw new Error(
    `stableStringify: value of type "${typeof obj}" is not JSON-safe`,
  );
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Pending queue · parse + enqueue
// ═════════════════════════════════════════════════════════════════════

export class PendingQueueParseError extends Error {
  readonly path: string;
  constructor(path: string, detail: string) {
    super(`PendingQueueParseError at ${path}: ${detail}`);
    this.name = "PendingQueueParseError";
    this.path = path;
  }
}

export function parsePendingQueue(text: string): readonly PendingReviewEntry[] {
  const lines = text.split("\n");
  const out: PendingReviewEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.length === 0) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new PendingQueueParseError(
        `line ${i + 1}`,
        `invalid JSON · ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed) ||
      (parsed as { schema_version?: unknown }).schema_version !==
        PENDING_SCHEMA_VERSION ||
      typeof (parsed as { candidate_id?: unknown }).candidate_id !== "string"
    ) {
      throw new PendingQueueParseError(
        `line ${i + 1}`,
        "entry must be an object with the correct schema_version and candidate_id",
      );
    }
    out.push(parsed as PendingReviewEntry);
  }
  return out;
}

export function serializePendingReviewEntry(entry: PendingReviewEntry): string {
  return stableStringify(entry);
}

// ═════════════════════════════════════════════════════════════════════
// §6 · File-backed ApprovalProvider
// ═════════════════════════════════════════════════════════════════════

export interface CreateFileBackedApprovalProviderArgs {
  readonly pendingQueuePath: string;
  readonly decisionLogPath: string;
  readonly io: ApprovalIO;
}

/** Build a durable file-backed ApprovalProvider.
 *
 *  Semantics on each invocation:
 *   1. Load the sealed decision log · if a DecisionRecord exists for
 *      this candidate_id (and the record matches the supplied
 *      review_package_id to be safe), return it. The founder has
 *      spoken.
 *   2. Load the pending queue · if an entry already exists for this
 *      candidate_id, do NOT enqueue a duplicate. Return null.
 *   3. Otherwise append a new PendingReviewEntry to the pending
 *      queue · the founder's review UI will pick it up. Return null. */
export function createFileBackedApprovalProvider(
  args: CreateFileBackedApprovalProviderArgs,
): ApprovalProvider {
  return async ({ package: pkg, candidate_id }) => {
    // 1 · Check for an existing founder decision.
    const decisionText = await args.io.readTextOrEmpty(args.decisionLogPath);
    if (decisionText.length > 0) {
      const log = parseDecisionLog(decisionText);
      const match = findDecisionForCandidate(
        log,
        candidate_id,
        pkg.package_id,
      );
      if (match !== null) return match;
    }

    // 2 · Already pending? Avoid duplicate enqueue.
    const pendingText = await args.io.readTextOrEmpty(args.pendingQueuePath);
    if (pendingText.length > 0) {
      const pending = parsePendingQueue(pendingText);
      const alreadyPending = pending.some(
        (p) =>
          p.candidate_id === candidate_id &&
          p.review_package_id === pkg.package_id,
      );
      if (alreadyPending) return null;
    }

    // 3 · Append a new pending entry.
    const entry: PendingReviewEntry = {
      schema_version: PENDING_SCHEMA_VERSION,
      candidate_id,
      review_package_id: pkg.package_id,
      review_package: pkg,
      enqueued_at: args.io.nowIso(),
    };
    await args.io.appendLine(
      args.pendingQueuePath,
      serializePendingReviewEntry(entry),
    );
    return null;
  };
}

/** Find the current (latest, non-superseded) decision for this
 *  candidate in the sealed decision log. */
export function findDecisionForCandidate(
  log: readonly DecisionRecord[],
  candidate_id: string,
  review_package_id: string,
): DecisionRecord | null {
  const supersededIds = new Set<string>();
  for (const r of log) {
    if (r.supersedes !== null) supersededIds.add(r.supersedes);
  }
  let current: DecisionRecord | null = null;
  for (const r of log) {
    if (r.candidate_id !== candidate_id) continue;
    if (r.review_package_id !== review_package_id) continue;
    if (supersededIds.has(r.decision_record_id)) continue;
    if (
      current === null ||
      current.decision_timestamp < r.decision_timestamp ||
      (current.decision_timestamp === r.decision_timestamp &&
        current.decision_record_id < r.decision_record_id)
    ) {
      current = r;
    }
  }
  return current;
}

// ═════════════════════════════════════════════════════════════════════
// §7 · Static invariants
// ═════════════════════════════════════════════════════════════════════
//
// This module:
//   · does NOT auto-approve, auto-reject, or auto-defer · the
//     founder's decision is the only authoritative source
//   · does NOT bypass approval-v1 · it uses the sealed decision log
//     via `parseDecisionLog` and returns real `DecisionRecord`s
//   · does NOT invent decisions · if no decision is in the log, it
//     returns null and the runner moves on
//   · does NOT write to any DB · persistence is append-only JSONL
//   · does NOT read credentials, env, or network
//   · uses a caller-supplied clock (`io.nowIso`) so tests are
//     deterministic
//   · requires NO new migration · the pending queue is a filesystem
//     artefact, not a DB table
