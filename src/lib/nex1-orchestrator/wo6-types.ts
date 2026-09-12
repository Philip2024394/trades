// WO-WORKSTATION-06 · real runtime types
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// A runtime run is the lifecycle:
//   spawn authorised executable → wait for HTTP health → verify response
//   → terminate cleanly → verify dead → produce evidence.
//
// Every failure has a specific reason_code so audit records the WHY.
// No fake health checks — the response is a real HTTP round-trip.

import type { AllowedExecutableRef } from "./wo5-types";

// ── Runtime specification (input) ───────────────────────────────────────

export interface RuntimeSpec {
  readonly record_type: "NEX1_RUNTIME_SPEC";
  readonly run_id: string;
  readonly trace_id: string;
  readonly work_order_id: string;
  readonly project_id: string;

  /** Which executable to spawn. Reuses the WO-05 allowlist so the same
   *  process-safety story applies. */
  readonly executable_ref: AllowedExecutableRef;

  /** Argv the runtime is spawned with. No shell interpretation. */
  readonly args: readonly string[];

  /** Working directory relative to workspace_root. Enforced identically
   *  to WO-05: no absolute, no `..`, must exist. */
  readonly working_directory_rel: string;

  /** TCP port the application will listen on. The health check dials
   *  http://127.0.0.1:{port}. Must be in [1024, 65535]; NEX1 workstation
   *  never runs anything as a privileged port owner. */
  readonly port: number;

  /** HTTP path to hit for health. Must start with "/". */
  readonly health_path: string;

  /** How many ms to keep polling the health endpoint after spawn before
   *  giving up. Connection-refused during this window is normal — the
   *  app is starting. Must be in (0, MAX_STARTUP_MS]. */
  readonly startup_timeout_ms: number;

  /** Interval between health polls in ms. Must be > 0 and < startup_timeout_ms. */
  readonly startup_poll_interval_ms: number;

  /** Expected HTTP status code from the health endpoint once it responds.
   *  200 is the typical value. Non-matching status = HEALTH_UNEXPECTED_STATUS. */
  readonly expected_status: number;

  /** Optional exact-substring check against the response body. Rejects
   *  with HEALTH_UNEXPECTED_BODY when set and the body does not include
   *  the substring. Undefined = no body check. */
  readonly expected_body_substring?: string;

  /** How many ms to wait for a graceful termination after health verified
   *  before escalating to SIGKILL. Must be in (0, MAX_TERM_GRACE_MS]. */
  readonly termination_grace_ms: number;

  /** Environment variables to forward. Everything else is stripped
   *  (same rule as WO-05). */
  readonly env_forward: Readonly<Record<string, string>>;
}

// ── Runtime report (output) ─────────────────────────────────────────────

export interface HealthCheckOutcome {
  readonly attempted_at: string;
  readonly attempts: number;
  readonly succeeded_at: string | null;   // ISO if health OK, null if never
  readonly response_status: number | null;
  readonly response_body_first_1kb: string | null;
  readonly response_headers: Readonly<Record<string, string>>;
  readonly total_wait_ms: number;
}

export interface TerminationOutcome {
  readonly attempted_at: string;
  readonly graceful_signal_sent: string | null;  // "SIGTERM" on POSIX, "SIGTERM" alias on Windows
  readonly required_hard_kill: boolean;
  readonly hard_kill_signal_sent: string | null; // "SIGKILL"
  readonly exit_code_after_termination: number | null;
  readonly signal_after_termination: string | null;
  readonly total_termination_ms: number;
}

export interface RuntimeReport {
  readonly record_type: "NEX1_RUNTIME_REPORT";
  readonly report_id: string;
  readonly run_id: string;
  readonly trace_id: string;
  readonly work_order_id: string;
  readonly project_id: string;

  readonly executable_ref: AllowedExecutableRef;
  readonly executable_absolute_path: string;
  readonly args: readonly string[];
  readonly working_directory_absolute: string;
  readonly workspace_root: string;
  readonly port: number;
  readonly health_url: string;

  /** Spawn-time PID. null if spawn failed before assignment. */
  readonly child_pid: number | null;

  readonly stdout: string;
  readonly stderr: string;
  readonly stdout_bytes: number;
  readonly stderr_bytes: number;
  readonly stdout_truncated: boolean;
  readonly stderr_truncated: boolean;

  readonly health: HealthCheckOutcome | null;
  readonly termination: TerminationOutcome | null;

  readonly started_at: string;
  readonly completed_at: string;
  readonly total_lifetime_ms: number;
}

// ── Failure codes ───────────────────────────────────────────────────────

export type RuntimeFailureCode =
  // Reused from WO-05 (identical enforcement, distinct enum for audit clarity)
  | "EXECUTABLE_NOT_ALLOWED"
  | "EXECUTABLE_NOT_FOUND_ON_DISK"
  | "WORKSPACE_ROOT_UNSAFE"
  | "WORKING_DIRECTORY_ESCAPES_WORKSPACE"
  | "WORKING_DIRECTORY_MISSING"
  | "ARGS_INVALID"
  | "SPAWN_FAILED"
  // Runtime-specific
  | "PORT_INVALID"
  | "HEALTH_PATH_INVALID"
  | "INVALID_STARTUP_TIMEOUT"
  | "INVALID_POLL_INTERVAL"
  | "INVALID_TERMINATION_GRACE"
  | "PROCESS_EXITED_EARLY"
  | "HEALTH_CHECK_TIMEOUT"
  | "HEALTH_CHECK_FAILED"
  | "HEALTH_UNEXPECTED_STATUS"
  | "HEALTH_UNEXPECTED_BODY"
  | "TERMINATION_FAILED";

export type ExecuteRuntimeResult =
  | { ok: true; report: RuntimeReport }
  | {
      ok: false;
      reason_code: RuntimeFailureCode;
      reason: string;
      report?: RuntimeReport;
    };
