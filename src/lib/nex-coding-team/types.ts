// NEX Coding Team · shared types
// 15-agent professional pipeline for autonomous coding under Founder governance.
// Every agent output conforms to a strict schema; the Orchestrator enforces this.

export type AgentId =
  | "pm"
  | "architect"
  | "builder"
  | "tester"
  | "debugger"
  | "reviewer"
  | "forensics"
  | "secops"
  | "integrator"
  | "technical-writer"
  | "telemetry"
  | "types-guard"
  | "migration-reviewer"
  | "accessibility-reviewer"
  | "contract-reviewer";

export const ALL_AGENT_IDS: readonly AgentId[] = [
  "pm",
  "architect",
  "builder",
  "tester",
  "debugger",
  "reviewer",
  "forensics",
  "secops",
  "integrator",
  "technical-writer",
  "telemetry",
  "types-guard",
  "migration-reviewer",
  "accessibility-reviewer",
  "contract-reviewer",
];

export type AgentVerdict =
  | "PENDING"
  | "RUNNING"
  | "APPROVE"
  | "APPROVE_WITH_NOTES"
  | "REJECT"
  | "FLAG"
  | "NEEDS_FOUNDER_INPUT"
  | "ERROR"
  | "SKIPPED_NOT_APPLICABLE";

export type PipelineStatus =
  | "created"
  | "pm_running"
  | "architect_running"
  | "build_and_test_running"
  | "gates_running"
  | "integrating"
  | "post_deploy_watching"
  | "completed_merged"
  | "completed_no_merge"
  | "halted_needs_founder"
  | "halted_error"
  | "aborted";

export interface AgentResult {
  readonly agent_id: AgentId;
  readonly verdict: AgentVerdict;
  readonly started_at: string; // ISO 8601 UTC
  readonly finished_at: string | null;
  readonly duration_ms: number | null;
  readonly artifact_path: string | null; // e.g. data/nex-coding-team/runs/<id>/spec.md
  readonly summary: string; // one-paragraph max
  readonly evidence: readonly string[]; // list of file:LINE references or metric IDs
  readonly blockers: readonly string[]; // empty if verdict is APPROVE
  readonly next_action: string | null;
  readonly cycle_index: number; // for Debugger / Reviewer loops
}

export interface CodingRunManifest {
  readonly run_id: string;
  readonly founder_prompt: string;
  readonly created_at: string;
  readonly status: PipelineStatus;
  readonly current_stage: AgentId | null;
  readonly agent_results: Readonly<Record<AgentId, AgentResult | null>>;
  readonly artifacts_dir: string;
  readonly commit_sha: string | null; // set by Integrator on merge
  readonly rollback_command: string | null;
  readonly governance_state: {
    readonly v3_registry_frozen: true;
    readonly historical_receipts_intact: true;
    readonly protected_files_untouched: readonly string[];
  };
}

export const PROTECTED_FILES: readonly string[] = [
  "src/lib/nex-v3/v3-engine-registry.ts",
  ".env.local", // touched only by Integrator after explicit spec authority
  "supabase/migrations/20260915180000_nex_visual_structural_lock_architecture.sql", // M-1 frozen
  "CLAUDE.md", // product constitution — never mutated by agents
];

/** Which downstream gate agents are relevant given the type of change. */
export interface RelevantGates {
  readonly types_guard: boolean; // true if TS/TSX files changed
  readonly migration_reviewer: boolean; // true if supabase/migrations touched
  readonly accessibility_reviewer: boolean; // true if UI (tsx/jsx/html/css) touched
  readonly contract_reviewer: boolean; // true if public exports or API handlers touched
  readonly technical_writer: boolean; // always true after merge
  readonly telemetry: boolean; // true if deployment target reached
}

export interface DispatchRequest {
  readonly founder_prompt: string;
  readonly dry_run?: boolean; // if true, PM + Architect only · no code changes
}

export interface DispatchResponse {
  readonly ok: boolean;
  readonly run_id: string;
  readonly manifest_url: string;
  readonly stream_url: string;
  readonly error?: string;
}
