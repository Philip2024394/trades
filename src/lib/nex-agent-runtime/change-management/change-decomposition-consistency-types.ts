// §36-L-2 · WAVE-L2 · 2026-09-14 · change-decomposition-consistency

import type { ChangeSurfaceManifestSuccess } from "./change-surface-manifest-types";
import type { RepositoryMap } from "../repo-intelligence/repo-scan-types";

// ── Locked ChangeUnit kinds (exhaustive · 6) · order = execution order ──

export type ChangeUnitKind =
  | "types_first"
  | "implementation"
  | "imports_ripple"
  | "tests"
  | "documentation"
  | "governance";

export const APPROVED_UNIT_KINDS: readonly ChangeUnitKind[] = Object.freeze([
  "types_first",
  "implementation",
  "imports_ripple",
  "tests",
  "documentation",
  "governance",
]);

/** Locked execution priority. Lower number = runs earlier. */
export const UNIT_KIND_PRIORITY: Readonly<Record<ChangeUnitKind, number>> = Object.freeze({
  types_first: 0,
  implementation: 1,
  imports_ripple: 2,
  tests: 3,
  documentation: 4,
  governance: 5,
});

// ── Locked consistency checks (exhaustive · 6) ─────────────────────────

export type ConsistencyCheckId =
  | "types_have_implementation"
  | "implementation_has_tests"
  | "imports_have_declarations"
  | "governance_covers_new_files"
  | "tests_cover_new_symbols"
  | "docs_reference_implementation";

export const APPROVED_CONSISTENCY_CHECKS: readonly ConsistencyCheckId[] = Object.freeze([
  "types_have_implementation",
  "implementation_has_tests",
  "imports_have_declarations",
  "governance_covers_new_files",
  "tests_cover_new_symbols",
  "docs_reference_implementation",
]);

// ── Locked categorical consistency states (4) ──────────────────────────

export type ConsistencyState = "consistent" | "inconsistent" | "partial" | "not_applicable";

// ── Request ────────────────────────────────────────────────────────────

export interface ChangeDecompositionRequest {
  readonly manifest: ChangeSurfaceManifestSuccess;
  readonly repo_map: RepositoryMap;
  readonly clock?: () => Date;
}

// ── Output records ─────────────────────────────────────────────────────

export interface ChangeUnit {
  readonly unit_id: string;
  readonly kind: ChangeUnitKind;
  readonly execution_order: number;
  readonly files: readonly string[];
  readonly depends_on_unit_ids: readonly string[];
  readonly evidence_summary: string;
}

export interface ConsistencyCheckResult {
  readonly check_id: ConsistencyCheckId;
  readonly state: ConsistencyState;
  readonly involved_files: readonly string[];
  readonly evidence_summary: string;
}

export interface ChangeDecompositionSuccess {
  readonly ok: true;
  readonly assessed_at: string;
  readonly manifest_sha256_verified: string;
  readonly repo_map_sha256_verified: string;
  readonly change_units: readonly ChangeUnit[];
  readonly consistency_checks: readonly ConsistencyCheckResult[];
  readonly decomposition_sha256: string;
}

// ── Refusal codes (exhaustive · 7) ─────────────────────────────────────

export type ChangeDecompositionRefusalCode =
  | "L2_INVALID_REQUEST"
  | "L2_INVALID_MANIFEST"
  | "L2_INVALID_REPO_MAP"
  | "L2_MANIFEST_REPO_MAP_MISMATCH"
  | "L2_UNKNOWN_UNIT_KIND"
  | "L2_UNKNOWN_CONSISTENCY_CHECK"
  | "L2_OUTPUT_TOO_LARGE";

export interface ChangeDecompositionFailure {
  readonly ok: false;
  readonly refusal_code: ChangeDecompositionRefusalCode;
  readonly reason: string;
  readonly offending_field?: string;
}

export type ChangeDecompositionResult = ChangeDecompositionSuccess | ChangeDecompositionFailure;

// ── Locked bounds ──────────────────────────────────────────────────────

export const L2_MAX_OUTPUT_BYTES = 256 * 1024;
export const L2_MAX_FILES_PER_UNIT = 64;
