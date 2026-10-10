// §36-L-1 · WAVE-L1 · 2026-09-14 · change-surface-manifest
//
// Types + refusal codes + locked constants for the change-surface-manifest
// primitive. See docs/NEX1/SECTION_36_L_1_CHANGE_SURFACE_MANIFEST_AMENDMENT.md.
//
// Boundary (verbatim · unamendable):
//   "Wave L1 enables NEX1 to interpret an engineering-objective description +
//    R1a repo-scan output into a deterministic, evidence-cited change manifest
//    containing candidate change-surface files, categorical impact predictions,
//    and a locked protected-set. It does not permit NEX1 to modify any file,
//    invoke primitives, execute changes, expand authoring vocabulary, produce
//    numeric impact scores, or grant itself authority to execute the analysed
//    change."

import type { RepositoryMap } from "../repo-intelligence/repo-scan-types";

// ── Locked change kinds (exhaustive · 4) ───────────────────────────────

export type ChangeKind = "file_content" | "file_new" | "file_delete" | "test_only";

export const APPROVED_CHANGE_KINDS: readonly ChangeKind[] = Object.freeze([
  "file_content",
  "file_new",
  "file_delete",
  "test_only",
]);

// ── Locked impact states (exhaustive · 4) ──────────────────────────────

export type ImpactState = "must_change" | "likely_change" | "must_not_change" | "unknown";

// ── Engineering objective descriptor ───────────────────────────────────

/** A bounded, structured description of an engineering objective. No prose
 *  interpretation. Every field is deterministically parsed. */
export interface EngineeringObjectiveDescriptor {
  /** Short slug (kebab-case) · e.g. "add-error-code" · "rename-symbol" · used for tracing. */
  readonly slug: string;
  /** Locked scope hints (subset of tokens the caller pre-declares). */
  readonly scope_hints: readonly ScopeHint[];
  /** Files the caller ASSERTS must change (positive intent) · optional. */
  readonly asserted_must_change: readonly string[];
  /** Files the caller ASSERTS must NOT change (protection set) · optional but strongly encouraged. */
  readonly asserted_must_not_change: readonly string[];
  /** Symbols referenced by the objective · used to trace import ripples. */
  readonly referenced_symbols: readonly string[];
  /** Locked change-kind hint · what kind of change is the objective. */
  readonly change_kind_hint: ChangeKind;
}

/** Locked scope-hint vocabulary. Any string outside this set → refusal. */
export type ScopeHint =
  | "types_only"
  | "implementation_and_tests"
  | "imports_ripple"
  | "governance_only"
  | "test_only"
  | "documentation_only"
  | "cross_module";

export const APPROVED_SCOPE_HINTS: readonly ScopeHint[] = Object.freeze([
  "types_only",
  "implementation_and_tests",
  "imports_ripple",
  "governance_only",
  "test_only",
  "documentation_only",
  "cross_module",
]);

// ── Request ────────────────────────────────────────────────────────────

export interface ChangeSurfaceManifestRequest {
  readonly repo_map: RepositoryMap;
  readonly objective: EngineeringObjectiveDescriptor;
  readonly clock?: () => Date;
}

// ── Output records ─────────────────────────────────────────────────────

export interface ImpactPrediction {
  readonly path: string;
  readonly impact_state: ImpactState;
  readonly reason_code: ImpactReasonCode;
  readonly evidence_summary: string;
}

/** Locked deterministic reason codes for impact predictions. No natural
 *  language interpretation. */
export type ImpactReasonCode =
  | "asserted_by_caller_must_change"
  | "asserted_by_caller_must_not_change"
  | "declares_referenced_symbol"
  | "imports_referenced_symbol"
  | "is_test_of_impacted_file"
  | "in_module_of_impacted_file"
  | "outside_scope_hints"
  | "unknown_state";

export interface ChangeSurfaceManifestSuccess {
  readonly ok: true;
  readonly assessed_at: string;
  readonly repo_map_sha256_verified: string;
  readonly objective_slug: string;
  readonly expected_change_set: readonly string[];
  readonly protected_set: readonly string[];
  readonly impact_predictions: readonly ImpactPrediction[];
  readonly manifest_sha256: string;
}

// ── Refusal codes (exhaustive · 6) ─────────────────────────────────────

export type ChangeSurfaceManifestRefusalCode =
  | "L1_INVALID_REQUEST"
  | "L1_INVALID_REPO_MAP"
  | "L1_INVALID_OBJECTIVE"
  | "L1_UNKNOWN_SCOPE_HINT"
  | "L1_UNKNOWN_CHANGE_KIND"
  | "L1_OUTPUT_TOO_LARGE";

export interface ChangeSurfaceManifestFailure {
  readonly ok: false;
  readonly refusal_code: ChangeSurfaceManifestRefusalCode;
  readonly reason: string;
  readonly offending_field?: string;
}

export type ChangeSurfaceManifestResult = ChangeSurfaceManifestSuccess | ChangeSurfaceManifestFailure;

// ── Locked bounds ──────────────────────────────────────────────────────

export const L1_MAX_OUTPUT_BYTES = 256 * 1024;
export const L1_MAX_ASSERTED_MUST_CHANGE = 512;
export const L1_MAX_ASSERTED_MUST_NOT_CHANGE = 1024;
export const L1_MAX_REFERENCED_SYMBOLS = 256;
export const L1_MAX_SLUG_LENGTH = 128;

/** Prohibited substrings scanned in strings from the request. */
export const L1_PROHIBITED_SUBSTRINGS: readonly string[] = Object.freeze([
  "\0",
  "eval(",
  "Function(",
  "new Function",
  "child_process",
  "__proto__",
  "constructor.prototype",
  "<script",
  "</script",
]);
