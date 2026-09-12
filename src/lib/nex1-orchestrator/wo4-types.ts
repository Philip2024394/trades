// WO-WORKSTATION-04 · Controlled Hands · real filesystem execution
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Types shared across the WO-04 executor + observer-check + manifest bridge.
// Every failure has a specific reason_code so audit records the WHY.

import type { CandidateFile, Diff, DiffEntry, AuthorisedDiffBundle } from "./wo3-types";

// ── Executor input ──────────────────────────────────────────────────────

export interface ExecuteBundleInput {
  readonly bundle: AuthorisedDiffBundle;
  /** Absolute workspace root — must match bundle.diff.workspace_root. */
  readonly workspace_root: string;
  /** Repo root used by the Broker to resolve default protected paths. */
  readonly repo_root: string;
  /** Founder authorization surface. Re-verified before any write. */
  readonly authorization: import("./wo2-authorization").FounderAuthorization;
  readonly founder_key_manifest: import("./wo2-founder-keys").FounderKeyManifest;
  /** NEX1 execution instance id (opaque; audit only). */
  readonly nex1_execution_instance_id: string;
  /** Test hook. Defaults to now(). */
  readonly atTime?: Date;
  /** Test hook — force a mid-write failure to exercise rollback.
   *  Must be undefined in production callers; only tests set this. */
  readonly _test_fail_after_write_index?: number;
}

// ── Executor output ─────────────────────────────────────────────────────

export type ExecuteFailureCode =
  | "AUTHORIZATION_INVALID"
  | "AUTHORIZATION_MISSING_ACTION"
  | "BUNDLE_TAMPERED"
  | "WORKSPACE_ROOT_MISMATCH"
  | "WORKSPACE_ROOT_UNSAFE"
  | "DELETE_NOT_SUPPORTED"
  | "BROKER_DENIED"
  | "WRITE_FAILED"
  | "OBSERVER_MISMATCH"
  | "ROLLBACK_TRIGGERED";

export interface WrittenFileRecord {
  readonly path: string;                    // workspace-relative
  readonly expected_hash_full: string;      // wo3 full sha256
  readonly broker_post_hash_short: string;  // broker's 16-char truncated sha256
  readonly bytes_written: number;
  readonly handle_id: string;
  readonly wrote_at: string;
}

export interface ExecutionReport {
  readonly record_type: "NEX1_EXECUTION_REPORT";
  readonly report_id: string;
  readonly bundle_id: string;
  readonly trace_id: string;
  readonly work_order_id: string;
  readonly workspace_root: string;
  readonly written_files: readonly WrittenFileRecord[];
  readonly broker_session_id: string;
  readonly broker_manifest_hash: string;
  readonly observer: ObserverVerdict;
  readonly started_at: string;
  readonly completed_at: string;
}

export type ExecuteResult =
  | { ok: true; report: ExecutionReport }
  | {
      ok: false;
      reason_code: ExecuteFailureCode;
      reason: string;
      /** If a partial write happened before failure, what was written before
       *  rollback. Kept for audit even after rollback restores prior state. */
      partial_writes?: readonly WrittenFileRecord[];
      /** Report of the rollback attempt itself. */
      rollback?: RollbackReport;
    };

// ── Observer verdict (from independent filesystem walk) ─────────────────

export type ObserverVerdictKind =
  | "MATCH"
  | "MISSING_EXPECTED_FILE"
  | "UNEXPECTED_FILE_STATE";

export interface ObserverFileFinding {
  readonly path: string;
  readonly expected_hash_short: string | null;   // null when we expected absence
  readonly observed_hash_short: string | null;   // null when the file wasn't found
  readonly detail: string;
}

export interface ObserverVerdict {
  readonly record_type: "NEX1_OBSERVER_VERDICT";
  readonly verdict_kind: ObserverVerdictKind;
  readonly observer_key_id: string;
  readonly walk_started_at: string;
  readonly walk_completed_at: string;
  readonly files_observed: number;
  readonly findings: readonly ObserverFileFinding[];
}

// ── Rollback report ─────────────────────────────────────────────────────

export type RollbackOutcome = "RESTORED" | "PARTIAL" | "FAILED" | "NOT_ATTEMPTED";

export interface RollbackReport {
  readonly record_type: "NEX1_ROLLBACK_REPORT";
  readonly outcome: RollbackOutcome;
  readonly restored_paths: readonly string[];
  readonly failed_paths: readonly string[];
  readonly detail: string;
}

// Helpers re-exported so consumers of wo4-* don't need to reach into wo3 for
// the types they'll frequently touch.
export type { AuthorisedDiffBundle, CandidateFile, Diff, DiffEntry } from "./wo3-types";
