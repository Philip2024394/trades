// §36-W-2 · WAVE-W2 · 2026-09-14 · workstation-cockpit
// NEX bounded infrastructure · cockpit-state types · 2026-09-14
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.

import type { SpecialistFinding } from "../specialist-reviewers/specialist-reviewer-types";
import type { FindingRefutationRecord } from "../adversarial-refutation/refutation-engine-types";
import type { LifecycleState } from "../session-lifecycle/lifecycle-types";

// ── Locked engineering-activity vocabulary (17) ────────────────────────
//
// Every activity state is a derivable projection of underlying evidence
// (WorkflowTrace stage + specialist findings + refutation verdicts +
// lifecycle state). No activity is emitted without evidence.

export type EngineeringActivity =
  | "IDLE"
  | "UNDERSTANDING"
  | "PLANNING"
  | "SELECTING_SKILLS"
  | "BUILDING"
  | "TESTING"
  | "ERROR_FOUND"
  | "DIAGNOSING"
  | "FIXING"
  | "RETESTING"
  | "REVIEWING"
  | "REFUTING"
  | "VERIFYING"
  | "COMPLETED"
  | "REFUSED"
  | "FAILED"
  | "CANCELLED";

export const ENGINEERING_ACTIVITIES: readonly EngineeringActivity[] = Object.freeze([
  "IDLE",
  "UNDERSTANDING",
  "PLANNING",
  "SELECTING_SKILLS",
  "BUILDING",
  "TESTING",
  "ERROR_FOUND",
  "DIAGNOSING",
  "FIXING",
  "RETESTING",
  "REVIEWING",
  "REFUTING",
  "VERIFYING",
  "COMPLETED",
  "REFUSED",
  "FAILED",
  "CANCELLED",
]);

// ── File-change action + status (locked) ────────────────────────────────

export type FileChangeAction = "CREATED" | "MODIFIED" | "DELETED" | "PROPOSED";
export type FileChangeStatus = "PROPOSED" | "APPLIED" | "TESTED_PASS" | "TESTED_FAIL" | "NOT_APPLIED";

export const FILE_CHANGE_ACTIONS: readonly FileChangeAction[] = Object.freeze([
  "CREATED", "MODIFIED", "DELETED", "PROPOSED",
]);

export const FILE_CHANGE_STATUSES: readonly FileChangeStatus[] = Object.freeze([
  "PROPOSED", "APPLIED", "TESTED_PASS", "TESTED_FAIL", "NOT_APPLIED",
]);

export interface FileChangeEntry {
  readonly path: string;
  readonly action: FileChangeAction;
  readonly status: FileChangeStatus;
  readonly triggered_by_activity: EngineeringActivity | null;
  readonly evidence_ref: string | null;
}

// ── Error diagnosis record (locked) ─────────────────────────────────────

export interface DiagnosisSuggestion {
  readonly path: string;
  readonly reason: string;
  readonly proposed_action: FileChangeAction;
}

export interface ErrorDiagnosisRecord {
  readonly error_kind: "test_failure" | "review_finding" | "refutation_unresolved" | "lifecycle_refusal" | "orchestrator_error" | "not_connected";
  readonly error_summary: string;
  readonly affected_files: readonly string[];
  readonly suggested_files: readonly DiagnosisSuggestion[];
  readonly epistemic_status: "FACT" | "OBSERVATION" | "INFERENCE" | "HYPOTHESIS";
  readonly derived_from: readonly ("trace" | "findings" | "refutation" | "changes" | "lifecycle")[];
}

// ── Preview-engineering causal link ─────────────────────────────────────

export interface PreviewCausalLink {
  readonly preview_target_url: string;
  readonly triggered_by_file: string | null;
  readonly triggered_by_activity: EngineeringActivity | null;
  readonly preview_nonce: number;
  readonly last_updated_at: string | null;
}

// ── Governance "not connected" surfaces ─────────────────────────────────
//
// Every surface that COULD be connected but currently is not carries an
// explicit not_connected record. This is the anti-fabrication guarantee.

export type CockpitSurface =
  | "orchestrator_trace"
  | "specialist_findings"
  | "refutation_records"
  | "git_changes"
  | "test_runner"
  | "preview_reachability"
  | "engineering_memory";

export const COCKPIT_SURFACES: readonly CockpitSurface[] = Object.freeze([
  "orchestrator_trace",
  "specialist_findings",
  "refutation_records",
  "git_changes",
  "test_runner",
  "preview_reachability",
  "engineering_memory",
]);

export interface NotConnectedRecord {
  readonly surface: CockpitSurface;
  readonly reason: string;
}

// ── Derived cockpit view model (locked shape) ───────────────────────────

export interface CockpitStateView {
  readonly engineering_activity: EngineeringActivity;
  readonly lifecycle_state: LifecycleState | null;
  readonly error_diagnosis: ErrorDiagnosisRecord | null;
  readonly file_change_ledger: readonly FileChangeEntry[];
  readonly preview_causal_link: PreviewCausalLink | null;
  readonly not_connected_surfaces: readonly NotConnectedRecord[];
  readonly derivation_sha256: string;
  readonly grep_marker: "§36-W-2 · WAVE-W2 · 2026-09-14 · workstation-cockpit";
}

// ── Derivation request shape ────────────────────────────────────────────

export interface DeriveCockpitStateRequest {
  readonly trace: {
    readonly trace_id: string;
    readonly current_stage_id: string;
    readonly stages: readonly { readonly stage_id: string; readonly status: string }[];
  } | null;
  readonly lifecycle_state: LifecycleState | null;
  readonly specialist_findings: readonly SpecialistFinding[] | null;
  readonly refutation_records: readonly FindingRefutationRecord[] | null;
  readonly git_changes: readonly { readonly status: string; readonly path: string }[] | null;
  readonly preview_target_url: string;
  readonly preview_nonce: number;
  readonly preview_last_updated_at: string | null;
  // §36-W-2-a UX fix · 2026-09-15
  //   ledger_include_prefixes: when set to a non-empty array, the file-change
  //   ledger only includes entries whose path starts with one of the prefixes.
  //   When null OR empty array, the ledger includes every git change (previous
  //   behaviour). This lets the cockpit hide runtime data-noise (e.g. huge
  //   dumps under data/nex-storage/) while remaining fully derivable and pure.
  readonly ledger_include_prefixes?: readonly string[] | null;
}

export interface DeriveCockpitStateSuccess {
  readonly kind: "SUCCESS";
  readonly view: CockpitStateView;
}

export type WorkstationCockpitRefusalCode =
  | "WCS_INVALID_REQUEST"
  | "WCS_INTERNAL";

export const WORKSTATION_COCKPIT_REFUSAL_CODES: readonly WorkstationCockpitRefusalCode[] = Object.freeze([
  "WCS_INVALID_REQUEST",
  "WCS_INTERNAL",
]);

export interface DeriveCockpitStateFailure {
  readonly kind: "FAILURE";
  readonly refusal_code: WorkstationCockpitRefusalCode;
  readonly reason: string;
  readonly grep_marker: "§36-W-2 · WAVE-W2 · 2026-09-14 · workstation-cockpit";
}

export type DeriveCockpitStateResult = DeriveCockpitStateSuccess | DeriveCockpitStateFailure;
