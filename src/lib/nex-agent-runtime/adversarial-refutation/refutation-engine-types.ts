// §36-E-6 · WAVE-E6 · 2026-09-14 · adversarial-refutation
// NEX bounded infrastructure · refutation-engine types · 2026-09-14
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.

import type { SkillCandidate } from "../skills/skill-schema-types";
import type {
  SpecialistFinding,
  SpecialistFindingId,
} from "../specialist-reviewers/specialist-reviewer-types";

// ── Locked refusal codes (4) ────────────────────────────────────────────

export type RefutationRefusalCode =
  | "ARE_INVALID_REQUEST"
  | "ARE_INVALID_CANDIDATE"
  | "ARE_MALFORMED_FINDING"
  | "ARE_INTERNAL";

export const REFUTATION_REFUSAL_CODES: readonly RefutationRefusalCode[] = Object.freeze([
  "ARE_INVALID_REQUEST",
  "ARE_INVALID_CANDIDATE",
  "ARE_MALFORMED_FINDING",
  "ARE_INTERNAL",
]);

// ── Locked verdicts (3) ─────────────────────────────────────────────────

export type RefutationVerdict = "ACCEPTED" | "REFUTED" | "UNRESOLVED";

export const REFUTATION_VERDICTS: readonly RefutationVerdict[] = Object.freeze([
  "ACCEPTED",
  "REFUTED",
  "UNRESOLVED",
]);

// ── Epistemic status (locked · 4 subset of Engineering-Memory v2) ──────

export type RefutationEpistemicStatus = "FACT" | "OBSERVATION" | "INFERENCE" | "HYPOTHESIS";

// ── Refutation strategy id (locked · 4) ─────────────────────────────────

export type RefutationStrategyId =
  | "evidence_absent"
  | "verifiability"
  | "over_general_claim"
  | "contradiction_detection";

// ── Per-finding refutation record (locked shape) ────────────────────────

export interface FindingRefutationRecord {
  readonly source_finding: SpecialistFinding;
  readonly verdict: RefutationVerdict;
  readonly strategy_id: RefutationStrategyId;
  readonly refutation_reason: string;
  readonly refutation_epistemic_status: RefutationEpistemicStatus;
  readonly evidence_pattern_examined: string | null;
  readonly evidence_pattern_matched: boolean;
}

// ── Request / response shapes ───────────────────────────────────────────

export interface RunRefutationRequest {
  readonly candidate: SkillCandidate;
  readonly findings: readonly SpecialistFinding[];
}

export interface RunRefutationSuccess {
  readonly kind: "SUCCESS";
  readonly per_finding_records: readonly FindingRefutationRecord[];
  readonly accepted_count: number;
  readonly refuted_count: number;
  readonly unresolved_count: number;
  readonly overall_finding_count: number;
  readonly grep_marker: "§36-E-6 · WAVE-E6 · 2026-09-14 · adversarial-refutation";
}

export interface RunRefutationFailure {
  readonly kind: "FAILURE";
  readonly refusal_code: RefutationRefusalCode;
  readonly reason: string;
  readonly offending_finding_id: SpecialistFindingId | null;
  readonly grep_marker: "§36-E-6 · WAVE-E6 · 2026-09-14 · adversarial-refutation";
}

export type RunRefutationResult = RunRefutationSuccess | RunRefutationFailure;

// ── Canonical evidence pattern per finding_id (locked · 25) ────────────
//
// If a reviewer emits a finding whose canonical pattern is absent from
// the candidate content, the refuter marks it REFUTED with evidence_absent
// strategy. This is the primary anti-fabrication guarantee.

export const CANONICAL_EVIDENCE_PATTERN: Readonly<Record<SpecialistFindingId, RegExp>> = Object.freeze({
  TSA_DEEP_RELATIVE_IMPORT: /from\s+['"]\.\.\/\.\.\/\.\.\/\.\.\//,
  TSA_TYPE_FILE_HAS_RUNTIME_IMPORT: /^import\s+(?!type\b)/m,
  TSA_INTERNAL_IMPORT_BYPASS: /from\s+['"][^'"]*\/(?:_internal|private)\//,
  TSA_CIRCULAR_SIBLING_IMPORT: /from\s+['"]\.\/[a-zA-Z0-9_-]+['"]/,
  TTS_EXPLICIT_ANY: /:\s*any\b|\bas\s+any\b/,
  TTS_UNCHECKED_CAST: /\bas\s+unknown\s+as\s+/,
  TTS_UNCONTROLLED_THROW: /\bthrow\s+new\s+/,
  TTS_NON_EXHAUSTIVE_SWITCH: /\bswitch\s*\(/,
  TTS_MISSING_RESULT_TYPE: /\basync\s+function\b/,
  RCR_HOOK_INSIDE_CONDITIONAL: /\bif\s*\([^)]*\)[^{]*\{[^}]*\buse[A-Z]\w+\s*\(/,
  RCR_STATE_IN_SERVER_COMPONENT: /\b(useState|useReducer|useRef)\s*\(/,
  RCR_MISSING_EFFECT_DEPS: /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[^}]*\}\s*,\s*\[\s*\]\s*\)/,
  RCR_DIRECT_DOM_ACCESS: /\b(document|window)\./,
  RCR_ASYNC_CLIENT_COMPONENT: /export\s+default\s+async\s+function/,
  SMR_DROP_WITHOUT_IF_EXISTS: /\bDROP\s+(TABLE|COLUMN|INDEX)\b(?!\s+IF\s+EXISTS)/i,
  SMR_ADD_COLUMN_NOT_NULL_WITHOUT_DEFAULT: /ADD\s+COLUMN\s+\w+\s+\w+[^;]*\bNOT\s+NULL\b(?![^;]*\bDEFAULT\b)/i,
  SMR_UNSCOPED_DELETE: /\bDELETE\s+FROM\s+\w+\s*;/i,
  SMR_INDEX_NOT_CONCURRENT: /\bCREATE\s+INDEX\b(?!\s+CONCURRENTLY\b)/i,
  SMR_MISSING_DOWN_MIGRATION: /^(?:(?!\b(down|reverse|rollback)\b).)*$/is,
  NRB_MISSING_GREP_MARKER: /^(?:(?!§36-[A-Z0-9-]+ · [A-Z]+-[A-Z0-9-]+ · \d{4}-\d{2}-\d{2}).)*$/s,
  NRB_FS_WRITE_IN_RUNTIME: /\bfs\.(writeFile|writeFileSync|mkdirSync|unlink|rmdir|rmSync|appendFile|copyFile|rename|chmod|chown)\b/,
  NRB_SUBPROCESS_IN_RUNTIME: /["']child_process["']|from\s+["']node:child_process["']/,
  NRB_NETWORK_IN_RUNTIME: /\bfetch\s*\(|\bhttp\.[a-z]+\(|\bhttps\.[a-z]+\(|\bWebSocket\b/,
  NRB_MISSING_REFUSAL_UNION: /^(?:(?!\btype\s+\w*RefusalCode\b).)*$/s,
  NRB_MISSING_NEX_AUTHORSHIP_HEADER: /^(?:(?!NEX bounded infrastructure|Coded by NEX1).)*$/s,
});

// ── Contradiction pairs (locked · 1 pair) ───────────────────────────────

export const CONTRADICTION_PAIRS: ReadonlyArray<readonly [SpecialistFindingId, SpecialistFindingId]> = Object.freeze([
  ["RCR_STATE_IN_SERVER_COMPONENT", "RCR_ASYNC_CLIENT_COMPONENT"],
]);
