// §36-E-5 · WAVE-E5 · 2026-09-14 · specialist-reviewers
// NEX bounded infrastructure · specialist-reviewer types + locked finding-id catalogue · 2026-09-14
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.

import type { SkillCandidate } from "../skills/skill-schema-types";

// ── Locked refusal codes (4) ────────────────────────────────────────────

export type SpecialistReviewerRefusalCode =
  | "SREV_INVALID_REQUEST"
  | "SREV_INVALID_CANDIDATE"
  | "SREV_UNKNOWN_SPECIALIST"
  | "SREV_INTERNAL";

export const SPECIALIST_REVIEWER_REFUSAL_CODES: readonly SpecialistReviewerRefusalCode[] = Object.freeze([
  "SREV_INVALID_REQUEST",
  "SREV_INVALID_CANDIDATE",
  "SREV_UNKNOWN_SPECIALIST",
  "SREV_INTERNAL",
]);

// ── Locked specialist ids (5) ───────────────────────────────────────────

export type SpecialistId =
  | "typescript-architecture-reviewer"
  | "typescript-type-safety-reviewer"
  | "react-component-reviewer"
  | "sql-migration-reviewer"
  | "nex-agent-runtime-boundary-reviewer";

export const SPECIALIST_IDS: readonly SpecialistId[] = Object.freeze([
  "typescript-architecture-reviewer",
  "typescript-type-safety-reviewer",
  "react-component-reviewer",
  "sql-migration-reviewer",
  "nex-agent-runtime-boundary-reviewer",
]);

// ── Locked severity taxonomy (3) ────────────────────────────────────────

export type SpecialistFindingSeverity = "advisory" | "warning" | "critical";

export const SPECIALIST_FINDING_SEVERITIES: readonly SpecialistFindingSeverity[] = Object.freeze([
  "advisory",
  "warning",
  "critical",
]);

// ── Locked finding-id union (exhaustive · 25) ──────────────────────────

export type SpecialistFindingId =
  // typescript-architecture-reviewer (4)
  | "TSA_DEEP_RELATIVE_IMPORT"
  | "TSA_TYPE_FILE_HAS_RUNTIME_IMPORT"
  | "TSA_INTERNAL_IMPORT_BYPASS"
  | "TSA_CIRCULAR_SIBLING_IMPORT"
  // typescript-type-safety-reviewer (5)
  | "TTS_EXPLICIT_ANY"
  | "TTS_UNCHECKED_CAST"
  | "TTS_UNCONTROLLED_THROW"
  | "TTS_NON_EXHAUSTIVE_SWITCH"
  | "TTS_MISSING_RESULT_TYPE"
  // react-component-reviewer (5)
  | "RCR_HOOK_INSIDE_CONDITIONAL"
  | "RCR_STATE_IN_SERVER_COMPONENT"
  | "RCR_MISSING_EFFECT_DEPS"
  | "RCR_DIRECT_DOM_ACCESS"
  | "RCR_ASYNC_CLIENT_COMPONENT"
  // sql-migration-reviewer (5)
  | "SMR_DROP_WITHOUT_IF_EXISTS"
  | "SMR_ADD_COLUMN_NOT_NULL_WITHOUT_DEFAULT"
  | "SMR_UNSCOPED_DELETE"
  | "SMR_INDEX_NOT_CONCURRENT"
  | "SMR_MISSING_DOWN_MIGRATION"
  // nex-agent-runtime-boundary-reviewer (6)
  | "NRB_MISSING_GREP_MARKER"
  | "NRB_FS_WRITE_IN_RUNTIME"
  | "NRB_SUBPROCESS_IN_RUNTIME"
  | "NRB_NETWORK_IN_RUNTIME"
  | "NRB_MISSING_REFUSAL_UNION"
  | "NRB_MISSING_NEX_AUTHORSHIP_HEADER";

// Locked mapping: every finding_id → its severity. Compile-time exhaustiveness verified in test.
export const FINDING_ID_SEVERITY_MAP: Readonly<Record<SpecialistFindingId, SpecialistFindingSeverity>> = Object.freeze({
  TSA_DEEP_RELATIVE_IMPORT: "warning",
  TSA_TYPE_FILE_HAS_RUNTIME_IMPORT: "warning",
  TSA_INTERNAL_IMPORT_BYPASS: "warning",
  TSA_CIRCULAR_SIBLING_IMPORT: "advisory",
  TTS_EXPLICIT_ANY: "warning",
  TTS_UNCHECKED_CAST: "warning",
  TTS_UNCONTROLLED_THROW: "warning",
  TTS_NON_EXHAUSTIVE_SWITCH: "advisory",
  TTS_MISSING_RESULT_TYPE: "advisory",
  RCR_HOOK_INSIDE_CONDITIONAL: "critical",
  RCR_STATE_IN_SERVER_COMPONENT: "critical",
  RCR_MISSING_EFFECT_DEPS: "warning",
  RCR_DIRECT_DOM_ACCESS: "warning",
  RCR_ASYNC_CLIENT_COMPONENT: "critical",
  SMR_DROP_WITHOUT_IF_EXISTS: "critical",
  SMR_ADD_COLUMN_NOT_NULL_WITHOUT_DEFAULT: "critical",
  SMR_UNSCOPED_DELETE: "critical",
  SMR_INDEX_NOT_CONCURRENT: "warning",
  SMR_MISSING_DOWN_MIGRATION: "advisory",
  NRB_MISSING_GREP_MARKER: "critical",
  NRB_FS_WRITE_IN_RUNTIME: "critical",
  NRB_SUBPROCESS_IN_RUNTIME: "critical",
  NRB_NETWORK_IN_RUNTIME: "critical",
  NRB_MISSING_REFUSAL_UNION: "warning",
  NRB_MISSING_NEX_AUTHORSHIP_HEADER: "advisory",
});

// ── Finding shape (locked) ──────────────────────────────────────────────

export interface SpecialistFinding {
  readonly specialist_id: SpecialistId;
  readonly finding_id: SpecialistFindingId;
  readonly severity: SpecialistFindingSeverity;
  readonly evidence_summary: string;
}

// ── Overall specialist verdict (locked · 3) ─────────────────────────────

export type SpecialistOverallVerdict = "no_findings" | "advisory_only" | "action_required";

// ── Request / response shapes ───────────────────────────────────────────

export interface RunSpecialistsRequest {
  readonly candidate: SkillCandidate;
  readonly specialists_to_run: readonly SpecialistId[] | "all";
}

export interface SpecialistPerFindingsResult {
  readonly specialist_id: SpecialistId;
  readonly findings: readonly SpecialistFinding[];
}

export interface RunSpecialistsSuccess {
  readonly kind: "SUCCESS";
  readonly per_specialist: readonly SpecialistPerFindingsResult[];
  readonly total_findings: number;
  readonly critical_count: number;
  readonly warning_count: number;
  readonly advisory_count: number;
  readonly overall_verdict: SpecialistOverallVerdict;
  readonly grep_marker: "§36-E-5 · WAVE-E5 · 2026-09-14 · specialist-reviewers";
}

export interface RunSpecialistsFailure {
  readonly kind: "FAILURE";
  readonly refusal_code: SpecialistReviewerRefusalCode;
  readonly reason: string;
  readonly offending_specialist: SpecialistId | null;
  readonly grep_marker: "§36-E-5 · WAVE-E5 · 2026-09-14 · specialist-reviewers";
}

export type RunSpecialistsResult = RunSpecialistsSuccess | RunSpecialistsFailure;
