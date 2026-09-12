// WO-WORKSTATION-05 · real build execution types
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// A build is the invocation of an authorised executable (node / npm / tsc /
// next) inside a workspace with strict cwd + env + timeout + resource
// enforcement, producing a full evidence bundle (exit code, stdout, stderr,
// duration, artefact hashes) regardless of success or failure.
//
// Every failure has a specific reason_code so audit records the WHY.

// ── Build specification (input) ─────────────────────────────────────────

export interface BuildSpec {
  readonly record_type: "NEX1_BUILD_SPEC";
  readonly build_id: string;
  readonly trace_id: string;
  readonly work_order_id: string;
  readonly project_id: string;

  /** Reference into the allowed-executables registry. Never a raw path.
   *  Callers say `executable_ref: "node"`; the registry resolves it to a
   *  canonicalised absolute path at spawn time. */
  readonly executable_ref: AllowedExecutableRef;

  /** Argv the process is spawned with. Values are passed through
   *  child_process.spawn arg-by-arg — no shell interpretation. */
  readonly args: readonly string[];

  /** Working directory relative to workspace_root (empty string or "."
   *  = workspace root itself). Absolute paths or `..` escapes rejected. */
  readonly working_directory_rel: string;

  /** Hard wall timeout in milliseconds. Process is killed on expiry.
   *  Must be > 0 and <= MAX_TIMEOUT_MS (documented on the executor). */
  readonly timeout_ms: number;

  /** Environment variables to forward. Everything else is stripped.
   *  Empty object = only PATH is forwarded (see executor for defaults). */
  readonly env_forward: Readonly<Record<string, string>>;

  /** Expected exit code. Default 0. Non-matching exit is a build failure. */
  readonly expected_exit_code: number;

  /** Optional pre-run snapshot of the workspace, hashes-only, used to
   *  compute the changed-artefact set after the build completes. If
   *  omitted, artefact detection walks the whole workspace as "created". */
  readonly baseline_hashes?: Readonly<Record<string, string>>;
}

export type AllowedExecutableRef = "node" | "npm" | "npx";

// ── Build report (output) ───────────────────────────────────────────────

export interface ArtefactRecord {
  readonly path: string;              // workspace-relative
  readonly sha256_full: string;       // full 64-char sha256
  readonly bytes: number;
  readonly change: "created" | "modified" | "unchanged";
}

export interface BuildReport {
  readonly record_type: "NEX1_BUILD_REPORT";
  readonly report_id: string;
  readonly build_id: string;
  readonly trace_id: string;
  readonly work_order_id: string;
  readonly project_id: string;

  readonly executable_ref: AllowedExecutableRef;
  readonly executable_absolute_path: string;
  readonly args: readonly string[];
  readonly working_directory_absolute: string;
  readonly workspace_root: string;

  readonly exit_code: number | null;   // null iff the process was killed pre-exit (timeout / spawn error)
  readonly signal: string | null;      // e.g. "SIGKILL" on timeout
  readonly stdout: string;
  readonly stderr: string;
  readonly stdout_bytes: number;
  readonly stderr_bytes: number;
  /** True when captured output was truncated at STDOUT_CAP_BYTES. */
  readonly stdout_truncated: boolean;
  readonly stderr_truncated: boolean;

  readonly duration_ms: number;
  readonly started_at: string;
  readonly completed_at: string;

  /** Files whose hash differs from spec.baseline_hashes (or every file
   *  in the workspace if no baseline was supplied). Deterministic order
   *  by path. */
  readonly artefacts: readonly ArtefactRecord[];
}

// ── Failure codes ───────────────────────────────────────────────────────

export type BuildFailureCode =
  | "EXECUTABLE_NOT_ALLOWED"
  | "EXECUTABLE_NOT_FOUND_ON_DISK"
  | "WORKSPACE_ROOT_UNSAFE"
  | "WORKING_DIRECTORY_ESCAPES_WORKSPACE"
  | "WORKING_DIRECTORY_MISSING"
  | "SPAWN_FAILED"
  | "TIMEOUT_EXPIRED"
  | "EXIT_CODE_NONZERO"
  | "EXIT_CODE_MISMATCH"
  | "STDOUT_CAP_EXCEEDED"
  | "STDERR_CAP_EXCEEDED"
  | "INVALID_TIMEOUT"
  | "ARGS_INVALID";

export type ExecuteBuildResult =
  | { ok: true; report: BuildReport }
  | {
      ok: false;
      reason_code: BuildFailureCode;
      reason: string;
      /** Present when the process actually ran and produced output before
       *  the failure was diagnosed (e.g. TIMEOUT_EXPIRED, EXIT_CODE_NONZERO).
       *  Same schema as a successful BuildReport — full evidence even
       *  when the build failed. */
      report?: BuildReport;
    };
