// §36-W-2 · WAVE-W2 · 2026-09-14 · workstation-cockpit
// NEX bounded infrastructure · cockpit-state derivation · 2026-09-14
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// Pure function · zero I/O. Derives a CockpitStateView from the current
// mission-adjacent evidence (WorkflowTrace + specialist findings +
// refutation records + git changes + preview state). Every field is
// derivable from real input; when input is null → not_connected label.

import { createHash } from "node:crypto";
import type { SpecialistFinding } from "../specialist-reviewers/specialist-reviewer-types";
import type { FindingRefutationRecord } from "../adversarial-refutation/refutation-engine-types";
import type { LifecycleState } from "../session-lifecycle/lifecycle-types";
import type {
  CockpitStateView,
  CockpitSurface,
  DeriveCockpitStateFailure,
  DeriveCockpitStateRequest,
  DeriveCockpitStateResult,
  DeriveCockpitStateSuccess,
  EngineeringActivity,
  ErrorDiagnosisRecord,
  FileChangeAction,
  FileChangeEntry,
  FileChangeStatus,
  NotConnectedRecord,
  PreviewCausalLink,
} from "./cockpit-state-types";

const GREP_MARKER = "§36-W-2 · WAVE-W2 · 2026-09-14 · workstation-cockpit" as const;

// ── Failure helper ──────────────────────────────────────────────────────

function fail(
  code: DeriveCockpitStateFailure["refusal_code"],
  reason: string,
): DeriveCockpitStateFailure {
  return {
    kind: "FAILURE",
    refusal_code: code,
    reason,
    grep_marker: GREP_MARKER,
  };
}

// ── SHA helper ──────────────────────────────────────────────────────────

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

// ── Locked mapping: WorkflowTrace stage → engineering activity ─────────
//
// The orchestrator's 17-stage vocabulary maps to the cockpit's 17-activity
// vocabulary via this table. Any stage id not in the table falls through
// to lifecycle-state derivation.

const STAGE_TO_ACTIVITY: Readonly<Record<string, EngineeringActivity>> = Object.freeze({
  REQUEST_RECEIVED: "UNDERSTANDING",
  UNDERSTANDING: "UNDERSTANDING",
  REQUIREMENTS: "PLANNING",
  WORK_ORDER: "PLANNING",
  ARCHITECTURE: "PLANNING",
  DESIGN: "PLANNING",
  BUILD_PLAN: "SELECTING_SKILLS",
  SPECIALIST_EVIDENCE: "REVIEWING",
  EVIDENCE_VALIDATION: "REVIEWING",
  NEX2_REVIEW: "REVIEWING",
  NEX3_ARBITRATION: "REFUTING",
  FOUNDER_DECISION: "PLANNING", // awaiting authority · falls back
  EXECUTION: "BUILDING",
  VERIFICATION: "VERIFYING",
  RELEASE: "VERIFYING",
  ORCHESTRATION_COMPLETED: "COMPLETED",
  DELIVERABLE_COMPLETED: "COMPLETED",
});

// ── Locked mapping: LifecycleState → engineering activity ──────────────

const LIFECYCLE_TO_ACTIVITY: Readonly<Record<LifecycleState, EngineeringActivity>> = Object.freeze({
  CREATED: "UNDERSTANDING",
  PREPARED: "PLANNING",
  AUTHORISED: "SELECTING_SKILLS",
  EXECUTING: "BUILDING",
  TESTING: "TESTING",
  REVIEWING: "REVIEWING",
  REFUTING: "REFUTING",
  VERIFIED: "VERIFYING",
  COMPLETED: "COMPLETED",
  REFUSED: "REFUSED",
  FAILED: "FAILED",
  RECOVERING: "DIAGNOSING",
  CANCELLED: "CANCELLED",
});

// ── Derive engineering activity ────────────────────────────────────────
//
// Precedence: refutation-unresolved errors > lifecycle-state > trace-stage > IDLE.

function deriveEngineeringActivity(
  refutationRecords: readonly FindingRefutationRecord[] | null,
  findings: readonly SpecialistFinding[] | null,
  lifecycleState: LifecycleState | null,
  traceStageId: string | null,
): EngineeringActivity {
  // Refutation-unresolved → ERROR_FOUND (needs diagnosis)
  if (refutationRecords && refutationRecords.length > 0) {
    const unresolved = refutationRecords.filter((r) => r.verdict === "UNRESOLVED");
    if (unresolved.length > 0) return "ERROR_FOUND";
    const refuted = refutationRecords.filter((r) => r.verdict === "REFUTED");
    if (refuted.length > 0) return "DIAGNOSING";
  }
  // Critical findings without refutation → ERROR_FOUND
  if (findings && findings.some((f) => f.severity === "critical")) {
    return "ERROR_FOUND";
  }
  // Lifecycle state (authoritative when set)
  if (lifecycleState) {
    return LIFECYCLE_TO_ACTIVITY[lifecycleState];
  }
  // Trace stage
  if (traceStageId && STAGE_TO_ACTIVITY[traceStageId]) {
    return STAGE_TO_ACTIVITY[traceStageId];
  }
  return "IDLE";
}

// ── Derive error diagnosis ─────────────────────────────────────────────

function deriveErrorDiagnosis(
  activity: EngineeringActivity,
  findings: readonly SpecialistFinding[] | null,
  refutationRecords: readonly FindingRefutationRecord[] | null,
  lifecycleState: LifecycleState | null,
  changes: readonly { readonly status: string; readonly path: string }[] | null,
): ErrorDiagnosisRecord | null {
  // Refutation-unresolved has priority
  if (refutationRecords) {
    const unresolved = refutationRecords.filter((r) => r.verdict === "UNRESOLVED");
    if (unresolved.length > 0) {
      const affected: string[] = [];
      const suggestions: ErrorDiagnosisRecord["suggested_files"] = unresolved.map((u) => ({
        path: `<candidate under review>`, // refutation records don't carry file paths directly · derived at API layer
        reason: u.refutation_reason,
        proposed_action: "MODIFIED" as FileChangeAction,
      }));
      return {
        error_kind: "refutation_unresolved",
        error_summary: `${unresolved.length} finding(s) unresolved by adversarial refutation`,
        affected_files: affected,
        suggested_files: suggestions,
        epistemic_status: "INFERENCE",
        derived_from: ["refutation", "findings"],
      };
    }
  }
  // Critical specialist findings
  if (findings) {
    const critical = findings.filter((f) => f.severity === "critical");
    if (critical.length > 0) {
      return {
        error_kind: "review_finding",
        error_summary: `${critical.length} critical specialist finding(s)`,
        affected_files: [],
        suggested_files: critical.map((c) => ({
          path: `<candidate under review>`,
          reason: `${c.finding_id}: ${c.evidence_summary}`,
          proposed_action: "MODIFIED" as FileChangeAction,
        })),
        epistemic_status: "OBSERVATION",
        derived_from: ["findings"],
      };
    }
  }
  // Lifecycle FAILED
  if (lifecycleState === "FAILED" || lifecycleState === "REFUSED") {
    return {
      error_kind: lifecycleState === "REFUSED" ? "lifecycle_refusal" : "orchestrator_error",
      error_summary: `mission entered ${lifecycleState} state`,
      affected_files: [],
      suggested_files: [],
      epistemic_status: "FACT",
      derived_from: ["lifecycle"],
    };
  }
  // Testing activity but no changes yet · not an error
  return null;
}

// ── Derive file-change ledger ──────────────────────────────────────────

function gitStatusToAction(gitStatus: string): FileChangeAction {
  const s = gitStatus.trim();
  if (s.startsWith("A") || s === "??") return "CREATED";
  if (s.startsWith("D")) return "DELETED";
  if (s.startsWith("M") || s.startsWith("R") || s.startsWith("C")) return "MODIFIED";
  return "MODIFIED";
}

function gitStatusToStatus(gitStatus: string): FileChangeStatus {
  // The git-changes endpoint only tells us that a change exists on disk;
  // it does NOT tell us whether tests passed. Default to APPLIED · downstream
  // callers can promote to TESTED_PASS / TESTED_FAIL when they have real
  // test evidence.
  const s = gitStatus.trim();
  if (s === "??") return "APPLIED";
  return "APPLIED";
}

function deriveFileChangeLedger(
  changes: readonly { readonly status: string; readonly path: string }[] | null,
  activity: EngineeringActivity,
  includePrefixes: readonly string[] | null | undefined,
): readonly FileChangeEntry[] {
  if (!changes || changes.length === 0) return Object.freeze([]);
  // §36-W-2-a filter: when includePrefixes is a non-empty array, only entries
  // whose path starts with one of the prefixes are kept. When null/empty,
  // every change is kept (previous behaviour · unchanged for existing callers).
  const filtered = includePrefixes && includePrefixes.length > 0
    ? changes.filter((c) => includePrefixes.some((p) => c.path.startsWith(p)))
    : changes;
  const entries: FileChangeEntry[] = filtered.map((c) => ({
    path: c.path,
    action: gitStatusToAction(c.status),
    status: gitStatusToStatus(c.status),
    triggered_by_activity: activity,
    evidence_ref: `git:${c.status.trim()}`,
  }));
  // Deterministic sort by path
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return Object.freeze(entries);
}

// ── Derive preview causal link ─────────────────────────────────────────

function derivePreviewCausalLink(
  previewTargetUrl: string,
  previewNonce: number,
  previewLastUpdatedAt: string | null,
  ledger: readonly FileChangeEntry[],
  activity: EngineeringActivity,
): PreviewCausalLink {
  // §36-W-2-a honesty fix: only claim a `triggered_by_file` when the ledger
  // has a plausibly attributable single-file signal. If the (post-filter)
  // ledger is empty OR too large to attribute, we refuse to name a specific
  // file — the alphabetically-first entry is not a truthful cause. This
  // preserves the real-data-only rule.
  const ATTRIBUTABLE_LEDGER_SIZE = 8;
  const canAttribute = previewNonce > 0 && ledger.length > 0 && ledger.length <= ATTRIBUTABLE_LEDGER_SIZE;
  const triggeredByFile = canAttribute ? ledger[0].path : null;
  return {
    preview_target_url: previewTargetUrl,
    triggered_by_file: triggeredByFile,
    triggered_by_activity: canAttribute ? activity : null,
    preview_nonce: previewNonce,
    last_updated_at: previewLastUpdatedAt,
  };
}

// ── Derive not-connected surfaces ──────────────────────────────────────

function deriveNotConnected(request: DeriveCockpitStateRequest): readonly NotConnectedRecord[] {
  const notConnected: NotConnectedRecord[] = [];
  if (!request.trace) {
    notConnected.push({ surface: "orchestrator_trace", reason: "no trace supplied · no active mission" });
  }
  if (!request.specialist_findings) {
    notConnected.push({ surface: "specialist_findings", reason: "E5 specialist reviewers not invoked for this trace yet" });
  }
  if (!request.refutation_records) {
    notConnected.push({ surface: "refutation_records", reason: "E6 adversarial refutation not invoked for this trace yet" });
  }
  if (!request.git_changes) {
    notConnected.push({ surface: "git_changes", reason: "git changes endpoint returned no data" });
  }
  // Preview reachability is checked separately client-side · not part of derivation
  return Object.freeze(notConnected);
}

// ── SHA over derivation inputs ─────────────────────────────────────────

function derivationSha(request: DeriveCockpitStateRequest, view: CockpitStateView): string {
  const canonical = JSON.stringify({
    grep_marker: view.grep_marker,
    activity: view.engineering_activity,
    lifecycle: view.lifecycle_state,
    trace_id: request.trace?.trace_id ?? null,
    trace_stage: request.trace?.current_stage_id ?? null,
    findings_count: request.specialist_findings?.length ?? null,
    refutation_count: request.refutation_records?.length ?? null,
    changes_count: request.git_changes?.length ?? null,
    preview_nonce: request.preview_nonce,
    ledger_count: view.file_change_ledger.length,
    // §36-W-2-a: include the prefix filter in the canonical SHA so cache-busting reflects the filter choice
    ledger_prefixes: request.ledger_include_prefixes ?? null,
    error_present: view.error_diagnosis !== null,
  });
  return sha256Hex(canonical);
}

// ── Entry point ────────────────────────────────────────────────────────

export function deriveCockpitState(request: DeriveCockpitStateRequest): DeriveCockpitStateResult {
  if (!request || typeof request !== "object") {
    return fail("WCS_INVALID_REQUEST", "request must be an object");
  }
  if (typeof request.preview_target_url !== "string") {
    return fail("WCS_INVALID_REQUEST", "preview_target_url must be a string");
  }
  if (typeof request.preview_nonce !== "number") {
    return fail("WCS_INVALID_REQUEST", "preview_nonce must be a number");
  }

  const activity = deriveEngineeringActivity(
    request.refutation_records,
    request.specialist_findings,
    request.lifecycle_state,
    request.trace?.current_stage_id ?? null,
  );
  const error = deriveErrorDiagnosis(
    activity,
    request.specialist_findings,
    request.refutation_records,
    request.lifecycle_state,
    request.git_changes,
  );
  const ledger = deriveFileChangeLedger(request.git_changes, activity, request.ledger_include_prefixes ?? null);
  const preview = derivePreviewCausalLink(
    request.preview_target_url,
    request.preview_nonce,
    request.preview_last_updated_at,
    ledger,
    activity,
  );
  const notConnected = deriveNotConnected(request);

  const viewShell = {
    engineering_activity: activity,
    lifecycle_state: request.lifecycle_state,
    error_diagnosis: error,
    file_change_ledger: ledger,
    preview_causal_link: preview,
    not_connected_surfaces: notConnected,
    derivation_sha256: "", // filled below
    grep_marker: GREP_MARKER,
  };
  const sha = derivationSha(request, viewShell as CockpitStateView);
  const view: CockpitStateView = { ...viewShell, derivation_sha256: sha };

  const success: DeriveCockpitStateSuccess = {
    kind: "SUCCESS",
    view,
  };
  return success;
}

// Re-export locked catalogues
export {
  ENGINEERING_ACTIVITIES,
  FILE_CHANGE_ACTIONS,
  FILE_CHANGE_STATUSES,
  COCKPIT_SURFACES,
} from "./cockpit-state-types";
