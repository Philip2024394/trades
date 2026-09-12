// WO-WORKSTATION-07 · real specialist adapters
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Replaces the LIMITED_V0 fixture PASS values ADR-0318 G17 flagged as
// SECURITY-adjacent — a validator that always returns PASS is worse than
// no validator, because it manufactures false confidence.
//
// Adapter contract (ADR-0319 §13): every adapter distinguishes
//   AVAILABLE · EXECUTED · PASSED · FAILED · UNAVAILABLE · TIMED_OUT · DENIED
// and never converts UNAVAILABLE into PASS.

// ── Adapter identity ────────────────────────────────────────────────────

export type SpecialistKind =
  | "node-syntax"        // node --check on JS files -- always available
  | "tsc"                // npx tsc --noEmit -- TypeScript type check
  | "eslint"             // npx eslint --format=json -- lint
  | "vitest";            // npx vitest run --reporter=default -- tests

// ── Adapter status enum (per ADR-0319 §13) ──────────────────────────────

export type SpecialistStatus =
  | "PASSED"          // tool ran and reported success
  | "FAILED"          // tool ran and reported failure (real defect)
  | "UNAVAILABLE"     // tool is not installed / not reachable in this workspace
  | "TIMED_OUT"       // tool exceeded its per-run timeout
  | "DENIED";         // execution was refused before it started (permission / arg / safety)

// ── Adapter input ───────────────────────────────────────────────────────

export interface SpecialistInvocation {
  readonly record_type: "NEX1_SPECIALIST_INVOCATION";
  readonly invocation_id: string;
  readonly trace_id: string;
  readonly work_order_id: string;
  readonly project_id: string;
  readonly kind: SpecialistKind;
  /** Absolute workspace root under data/nex-agent-workspaces (or a test path). */
  readonly workspace_root: string;
  /** Files or globs to validate. Empty = whole workspace where applicable. */
  readonly targets: readonly string[];
  /** Hard wall timeout per invocation. */
  readonly timeout_ms: number;
}

// ── Adapter result ──────────────────────────────────────────────────────

export interface ToolIdentity {
  readonly kind: SpecialistKind;
  readonly display_name: string;      // human-readable ("TypeScript compiler")
  readonly command: string;           // exact command string that was run (or would be)
  readonly resolved_version: string | null;  // e.g. "5.6.3", null when not resolved
}

export interface SpecialistFinding {
  /** Path relative to workspace_root, if the tool reports per-file. */
  readonly path: string | null;
  readonly line: number | null;
  readonly column: number | null;
  readonly severity: "error" | "warning" | "info";
  readonly rule: string | null;       // e.g. eslint rule id, TS diagnostic code
  readonly message: string;
}

export interface SpecialistResult {
  readonly record_type: "NEX1_SPECIALIST_RESULT";
  readonly result_id: string;
  readonly invocation_id: string;
  readonly trace_id: string;
  readonly work_order_id: string;
  readonly project_id: string;

  readonly status: SpecialistStatus;
  readonly tool: ToolIdentity;

  /** exit code from the adapter's underlying command. null when the adapter
   *  never invoked the command (UNAVAILABLE / DENIED). */
  readonly exit_code: number | null;

  /** captured stdout / stderr (truncated to WO-05 caps). Both empty when
   *  UNAVAILABLE / DENIED. */
  readonly stdout: string;
  readonly stderr: string;
  readonly stdout_truncated: boolean;
  readonly stderr_truncated: boolean;

  /** Structured per-target findings when the adapter can parse them.
   *  Empty when the tool has no failures OR the tool doesn't report
   *  structured output (in which case stdout/stderr are the source). */
  readonly findings: readonly SpecialistFinding[];

  readonly duration_ms: number;
  readonly started_at: string;
  readonly completed_at: string;

  /** sha256 of a canonical serialisation of {command, exit_code, stdout,
   *  stderr, findings, status}. Used by WO-08 evidence layer to detect
   *  tamper of a stored specialist result. */
  readonly evidence_hash: string;

  /** When status is one of UNAVAILABLE / TIMED_OUT / DENIED — the reason
   *  the adapter surfaced instead of a normal EXECUTED result. */
  readonly non_execution_reason: string | null;
}

// ── Runner-level failure codes ──────────────────────────────────────────
// These are runner-level, not adapter-level. An adapter always returns a
// SpecialistResult; the runner returns one of these codes only when the
// adapter framework itself refused to run (bad invocation shape).

export type RunSpecialistFailureCode =
  | "UNKNOWN_KIND"
  | "INVOCATION_INVALID"
  | "WORKSPACE_ROOT_UNSAFE";

export type RunSpecialistOutcome =
  | { ok: true; result: SpecialistResult }
  | { ok: false; reason_code: RunSpecialistFailureCode; reason: string };
