// src/lib/nex/programmer-execution/types.ts
//
// NEX Programmer Agent · Phase G · Bounded Autonomy · type contracts
// Philip 2026-09-06 · AUTHORIZE · PHASE G
//
// DISCIPLINE (§4 §16 §17):
//   The Programmer Agent may autonomously execute BOUNDED engineering
//   tasks. Every boundary is DECLARATIVE — a `TaskContract` states
//   allowed_files, forbidden_files, allowed_tools, forbidden_tools,
//   budgets, and success conditions BEFORE any execution begins.
//
// STRUCTURAL BOUNDARIES:
//   1. Sandbox isolation · every write goes into a TEMP directory ·
//      never into src/ · never into the repo root · never into any
//      protected path.
//   2. File policy · every file operation checks the contract's
//      allowed_files / forbidden_files list · violations short-circuit.
//   3. Tool policy · every tool the executor may invoke is in an
//      explicit whitelist · anything else throws.
//   4. Budget · iterations, wall-clock, files_changed all capped.
//   5. Reviewer independence · Phase C review() invoked AFTER
//      implementation · executor cannot override its verdict.
//   6. Anti-gaming · protected paths (benchmark corpus, reviewer,
//      evaluator, stability module, execution module itself) are
//      immutable regardless of contract.
//
// This module has NO SIDE EFFECTS.

// ─── Execution status (§18 states) ─────────────────────────────

/** Every autonomous run passes through explicit states. Failure states
 *  are FIRST-CLASS · never silently mapped to SUCCESS. */
export type ExecutionStatus =
  | "CREATED"
  | "PLANNING"
  | "IMPLEMENTING"
  | "TESTING"
  | "REVIEWING"
  | "BENCHMARKING"
  | "STABILITY_CHECK"
  | "VERIFIED"
  | "FAILED"
  | "BLOCKED"
  | "ESCALATED"
  | "ROLLED_BACK";

export const EXECUTION_LIFECYCLE_ORDER: readonly ExecutionStatus[] = [
  "CREATED",
  "PLANNING",
  "IMPLEMENTING",
  "TESTING",
  "REVIEWING",
  "BENCHMARKING",
  "STABILITY_CHECK",
  "VERIFIED",
] as const;

export const EXECUTION_TERMINAL_FAILURES: readonly ExecutionStatus[] = [
  "FAILED",
  "BLOCKED",
  "ESCALATED",
  "ROLLED_BACK",
] as const;

// ─── Tool policy (§8) ──────────────────────────────────────────

/** The complete set of tools the Phase-G executor may invoke. Anything
 *  outside this list is FORBIDDEN by construction. */
export type ToolCapability =
  | "read_sandbox_file"       // read a file inside the sandbox worktree
  | "write_sandbox_file"      // write a file inside the sandbox worktree
  | "delete_sandbox_file"     // delete a file inside the sandbox
  | "read_repo_file"          // read a file in the source repo (read-only)
  | "run_test"                // invoke a test command on the sandbox
  | "invoke_reviewer"         // Phase C review()
  | "invoke_benchmark"        // Phase D evaluateCorpus()
  | "invoke_drift"            // Phase E computeDrift()
  | "invoke_learning"         // Phase F createCandidate + runImprovementCycle
  | "append_audit_entry";     // append-only audit log write

/** Explicit union of tools the executor MUST NEVER invoke, at the type
 *  level. A module-surface audit test asserts no export whose name
 *  matches these prefixes exists in the phase-G surface. */
export type PhaseGForbiddenTool =
  // Production authority
  | "commit_to_production"
  | "push_to_remote"
  | "deploy"
  | "modify_production_database"
  | "alter_production_schema"
  | "grant_access"
  | "create_account"
  // Credentials & network escapes
  | "read_production_secret"
  | "unrestricted_network"
  | "external_communication"
  // Governance protection
  | "modify_reviewer"
  | "modify_evaluator"
  | "modify_benchmark_corpus"
  | "modify_stability_module"
  | "modify_execution_module"
  | "modify_audit_log_in_place"
  | "delete_audit_log"
  // Cross-agent boundary (Two-Agent Separation Contract 2026-09-06)
  | "modify_accommodation_data"
  | "call_accommodation_adapter"
  | "activate_accommodation_workforce"
  // Self-modification (§16)
  | "modify_own_authority_model"
  | "modify_own_security_boundary"
  | "modify_own_governance_controls"
  | "modify_own_operational_truth";

// ─── File-policy shapes ────────────────────────────────────────

/** Each rule is compared against the RESOLVED absolute path (never
 *  the raw input). Path-traversal is rejected before the rules see
 *  the string. */
export type FilePolicyRule =
  | { kind: "allow_prefix"; prefix: string }
  | { kind: "forbid_prefix"; prefix: string }
  | { kind: "allow_glob"; pattern: string }
  | { kind: "forbid_glob"; pattern: string };

// ─── Task contract (§6) ────────────────────────────────────────

/** Every autonomous run requires an explicit contract. The agent
 *  MAY NOT expand its own scope · anything outside the contract
 *  short-circuits to ESCALATED or BLOCKED. */
export type TaskContract = {
  task_id: string;
  objective: string;
  /** File policy · order matters · rules are evaluated top-to-bottom
   *  with the first matching rule winning. Absolute paths are used. */
  file_policy: readonly FilePolicyRule[];
  /** Tool whitelist. Anything not present throws immediately. */
  allowed_tools: readonly ToolCapability[];
  /** Iteration budget · executor stops after this many implement+test
   *  cycles regardless of success. */
  max_iterations: number;
  /** Wall-clock budget in ms · executor stops when exceeded. */
  max_runtime_ms: number;
  /** Maximum distinct files the agent may modify in the sandbox. */
  max_files_changed: number;
  /** Success conditions expressed as declarative predicates the
   *  executor checks at the end. */
  success_conditions: readonly SuccessCondition[];
  /** Explicit failure conditions the executor treats as terminal. */
  failure_conditions: readonly FailureCondition[];
  /** Rollback boundary · when true, the executor MUST discard the
   *  sandbox on any failed verification. Default true. */
  rollback_on_failure: boolean;
  /** Sandbox parent dir · the executor creates a fresh worktree under
   *  this. Must be a tmp directory. */
  sandbox_parent_dir: string;
  /** Optional pre-built repair plan · when present, the executor
   *  applies these operations exactly. When absent, the executor
   *  selects a RepairSkill from the whitelist (see below). */
  provided_plan?: RepairPlan;
  /** Whitelist of RepairSkill IDs the executor may consult when no
   *  provided_plan is supplied. Empty by default. */
  allowed_repair_skills?: readonly string[];
  /** Human-readable explanation used in audit and escalation. */
  created_by: string;
  created_at: string;
};

export type SuccessCondition =
  | { kind: "test_command_passes"; command: string; args: readonly string[] }
  | { kind: "file_contains"; sandbox_relpath: string; needle: string }
  | { kind: "file_absent"; sandbox_relpath: string };

export type FailureCondition =
  | { kind: "test_command_fails"; command: string; args: readonly string[] }
  | { kind: "file_contains"; sandbox_relpath: string; needle: string }
  | { kind: "any_tool_denied" }
  | { kind: "any_file_denied" };

// ─── Repair plan (concrete write operations) ───────────────────

export type RepairFileOp =
  | { op: "write"; sandbox_relpath: string; content: string }
  | { op: "delete"; sandbox_relpath: string };

export type RepairPlan = {
  plan_id: string;
  description: string;
  operations: readonly RepairFileOp[];
};

// ─── Repair skill (§11 recovery + §25 learning-integration) ────

/** A RepairSkill is a DECLARATIVE, PRE-REGISTERED capability the
 *  executor may consult when no provided_plan is supplied. Each skill
 *  reads sandbox state via read_sandbox_file and returns a RepairPlan.
 *  No LLM invocation. No arbitrary code generation. */
export type RepairSkill = {
  skill_id: string;
  description: string;
  /** Diagnostic predicate — true when this skill's plan applies. */
  applies: (ctx: RepairContext) => boolean;
  /** Plan generator — deterministic given the context. */
  build_plan: (ctx: RepairContext) => RepairPlan;
};

export type RepairContext = {
  readFile: (relpath: string) => string | null;
  listFiles: () => readonly string[];
  iteration: number;
};

// ─── Execution run record (§19 audit trail) ────────────────────

export type IterationRecord = {
  iteration: number;
  started_at: string;
  finished_at: string | null;
  status_transitions: readonly {
    from: ExecutionStatus;
    to: ExecutionStatus;
    at: string;
    note?: string;
  }[];
  plan_id: string | null;
  file_ops_applied: number;
  test_command: string | null;
  test_result: TestResult | null;
  review_verdict: string | null;
  notes: string;
};

export type TestResult = {
  passed: boolean;
  exit_code: number | null;
  stdout_tail: string;
  stderr_tail: string;
  duration_ms: number;
};

export type ExecutionRun = {
  run_id: string;
  task_id: string;
  environment_identifier: string;      // node:version + platform
  started_at: string;
  finished_at: string | null;
  triggered_by: "manual" | "runner" | "test";
  sandbox_root: string;                 // absolute path (temp)
  contract: TaskContract;
  iterations: readonly IterationRecord[];
  files_modified: readonly string[];    // absolute paths inside sandbox
  final_status: ExecutionStatus;
  /** Op-Truth §OP.5 · null in persisted record. External verifier
   *  derives PROVEN / DEGRADED / FAILED from evidence. */
  final_status_narrative: null;
  denied_operations: readonly {
    kind: "file_denied" | "tool_denied" | "budget_exhausted" | "protected_path" | "path_traversal";
    detail: string;
    at: string;
  }[];
  /** Fresh-process fingerprint over: sandbox file list, denial log,
   *  final_status, contract hash. Reproducible determinism check. */
  execution_fingerprint: string;
};

// ─── Execution audit entry (append-only) ───────────────────────

export type AuditEntry = Pick<
  ExecutionRun,
  | "run_id"
  | "task_id"
  | "started_at"
  | "finished_at"
  | "final_status"
  | "sandbox_root"
  | "execution_fingerprint"
  | "final_status_narrative"
> & {
  files_modified_count: number;
  denied_operations_count: number;
  iterations_count: number;
};

// ─── Protected-path registry (§14 test integrity) ──────────────
//
// These paths are ALWAYS forbidden regardless of the contract. The
// file guard checks them BEFORE any contract rule. Even a permissive
// contract cannot authorize touching these.
//
// Absolute prefix strings (repo-root-relative). Enforced by resolving
// against the repo root before comparison.

export const ALWAYS_PROTECTED_REPO_PATHS: readonly string[] = [
  "src/lib/nex/programmer-review",     // reviewer independence
  "src/lib/nex/programmer-benchmark",  // benchmark integrity
  "src/lib/nex/programmer-stability",  // stability authority
  "src/lib/nex/programmer-execution",  // self-modification guard
  "src/lib/nex/programmer-learning",   // knowledge integrity
  "src/lib/nex/programmer-improvement",// promotion authority
  "tests/fixtures/programmer-benchmark-proof",       // corpus immutability
  "tests/fixtures/programmer-stability-proof",       // stability history
  "tests/fixtures/programmer-improvement-proof",     // improvement history
  "tests/fixtures/programmer-execution-proof",       // execution history
] as const;
