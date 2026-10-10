// §36-WAVE-B · WAVE-B · 2026-09-15 · wave-b-cross-cutting
// NEX bounded infrastructure · Wave B cross-cutting specialist types · 2026-09-15
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// Locked catalogue for the four Wave B specialists:
//   nex-debugging-specialist
//   nex-git-change-impact-specialist
//   nex-security-specialist
//   nex-playwright-engineering

import type { SkillCandidate } from "../skills/skill-schema-types";

export const WAVE_B_GREP_MARKER = "§36-WAVE-B · WAVE-B · 2026-09-15 · wave-b-cross-cutting" as const;
export type WaveBGrepMarker = typeof WAVE_B_GREP_MARKER;

export type WaveBSpecialistRefusalCode =
  | "WB_INVALID_REQUEST"
  | "WB_INVALID_CANDIDATE"
  | "WB_UNKNOWN_SPECIALIST"
  | "WB_INTERNAL";

export const WAVE_B_REFUSAL_CODES: readonly WaveBSpecialistRefusalCode[] = Object.freeze([
  "WB_INVALID_REQUEST",
  "WB_INVALID_CANDIDATE",
  "WB_UNKNOWN_SPECIALIST",
  "WB_INTERNAL",
]);

export type WaveBSpecialistId =
  | "nex-debugging-specialist"
  | "nex-git-change-impact-specialist"
  | "nex-security-specialist"
  | "nex-playwright-engineering";

export const WAVE_B_SPECIALIST_IDS: readonly WaveBSpecialistId[] = Object.freeze([
  "nex-debugging-specialist",
  "nex-git-change-impact-specialist",
  "nex-security-specialist",
  "nex-playwright-engineering",
]);

export type WaveBSpecialistFindingSeverity = "advisory" | "warning" | "critical";

export const WAVE_B_FINDING_SEVERITIES: readonly WaveBSpecialistFindingSeverity[] = Object.freeze([
  "advisory",
  "warning",
  "critical",
]);

// ── Locked finding-id union (exhaustive · 28) ──────────────────────────

export type WaveBSpecialistFindingId =
  // nex-debugging-specialist (NDG · 7)
  | "NDG_CONSOLE_LOG_IN_PRODUCTION"
  | "NDG_DEBUGGER_STATEMENT"
  | "NDG_UNSILENCED_CATCH"
  | "NDG_BROAD_CATCH_ANY"
  | "NDG_SWALLOWED_PROMISE"
  | "NDG_SHORT_ERROR_MESSAGE"
  | "NDG_UNCONDITIONAL_PROCESS_EXIT"
  // nex-git-change-impact-specialist (NGI · 7)
  | "NGI_LARGE_FILE_NEW_1000LINES"
  | "NGI_FILE_DELETE_OP"
  | "NGI_TOUCHES_PROTECTED_MODULE"
  | "NGI_TEST_FILE_WITHOUT_KNOWN_SOURCE"
  | "NGI_SOURCE_WITHOUT_TEST_HINT"
  | "NGI_CROSS_MODULE_FANOUT"
  | "NGI_MIGRATION_MODIFIED_IN_PLACE"
  // nex-security-specialist (NSE · 7)
  | "NSE_HARDCODED_SECRET_LOOKALIKE"
  | "NSE_EVAL_LIKE_EXECUTION"
  | "NSE_UNSAFE_HTML_INSERTION"
  | "NSE_UNVALIDATED_REDIRECT"
  | "NSE_SQL_STRING_CONCATENATION"
  | "NSE_PATH_TRAVERSAL_LITERAL"
  | "NSE_DISABLED_TLS"
  // nex-playwright-engineering (NPW · 7)
  | "NPW_MISSING_AWAIT_ON_ACTION"
  | "NPW_HARDCODED_LARGE_TIMEOUT"
  | "NPW_GETBYTEXT_WITHOUT_ROLE"
  | "NPW_SCREENSHOT_WITHOUT_ASSERTION"
  | "NPW_TEST_NAME_MENTIONS_LOCALHOST"
  | "NPW_TEST_SKIP_OR_FIXME_LEFT_IN"
  | "NPW_NO_PAGE_INITIALIZER";

export const WAVE_B_FINDING_ID_SEVERITY_MAP: Readonly<Record<WaveBSpecialistFindingId, WaveBSpecialistFindingSeverity>> = Object.freeze({
  NDG_CONSOLE_LOG_IN_PRODUCTION: "advisory",
  NDG_DEBUGGER_STATEMENT: "critical",
  NDG_UNSILENCED_CATCH: "warning",
  NDG_BROAD_CATCH_ANY: "advisory",
  NDG_SWALLOWED_PROMISE: "warning",
  NDG_SHORT_ERROR_MESSAGE: "advisory",
  NDG_UNCONDITIONAL_PROCESS_EXIT: "critical",
  NGI_LARGE_FILE_NEW_1000LINES: "warning",
  NGI_FILE_DELETE_OP: "critical",
  NGI_TOUCHES_PROTECTED_MODULE: "critical",
  NGI_TEST_FILE_WITHOUT_KNOWN_SOURCE: "advisory",
  NGI_SOURCE_WITHOUT_TEST_HINT: "warning",
  NGI_CROSS_MODULE_FANOUT: "advisory",
  NGI_MIGRATION_MODIFIED_IN_PLACE: "warning",
  NSE_HARDCODED_SECRET_LOOKALIKE: "critical",
  NSE_EVAL_LIKE_EXECUTION: "critical",
  NSE_UNSAFE_HTML_INSERTION: "critical",
  NSE_UNVALIDATED_REDIRECT: "warning",
  NSE_SQL_STRING_CONCATENATION: "warning",
  NSE_PATH_TRAVERSAL_LITERAL: "warning",
  NSE_DISABLED_TLS: "critical",
  NPW_MISSING_AWAIT_ON_ACTION: "warning",
  NPW_HARDCODED_LARGE_TIMEOUT: "warning",
  NPW_GETBYTEXT_WITHOUT_ROLE: "advisory",
  NPW_SCREENSHOT_WITHOUT_ASSERTION: "advisory",
  NPW_TEST_NAME_MENTIONS_LOCALHOST: "advisory",
  NPW_TEST_SKIP_OR_FIXME_LEFT_IN: "warning",
  NPW_NO_PAGE_INITIALIZER: "advisory",
});

export interface WaveBSpecialistFinding {
  readonly specialist_id: WaveBSpecialistId;
  readonly finding_id: WaveBSpecialistFindingId;
  readonly severity: WaveBSpecialistFindingSeverity;
  readonly evidence_summary: string;
}

export type WaveBSpecialistOverallVerdict = "no_findings" | "advisory_only" | "action_required";

export interface RunWaveBSpecialistsRequest {
  readonly candidate: SkillCandidate;
  readonly specialists_to_run: readonly WaveBSpecialistId[] | "all";
}

export interface WaveBPerSpecialistResult {
  readonly specialist_id: WaveBSpecialistId;
  readonly findings: readonly WaveBSpecialistFinding[];
}

export interface RunWaveBSpecialistsSuccess {
  readonly kind: "SUCCESS";
  readonly per_specialist: readonly WaveBPerSpecialistResult[];
  readonly total_findings: number;
  readonly critical_count: number;
  readonly warning_count: number;
  readonly advisory_count: number;
  readonly overall_verdict: WaveBSpecialistOverallVerdict;
  readonly grep_marker: WaveBGrepMarker;
}

export interface RunWaveBSpecialistsFailure {
  readonly kind: "FAILURE";
  readonly refusal_code: WaveBSpecialistRefusalCode;
  readonly reason: string;
  readonly offending_specialist: WaveBSpecialistId | null;
  readonly grep_marker: WaveBGrepMarker;
}

export type RunWaveBSpecialistsResult = RunWaveBSpecialistsSuccess | RunWaveBSpecialistsFailure;
