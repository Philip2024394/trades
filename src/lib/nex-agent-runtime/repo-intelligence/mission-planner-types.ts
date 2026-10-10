// §36-D-B · ROUTE-R1B · 2026-09-14 · mission-planner
//
// Type definitions and refusal codes for the pure-function mission-planner primitive.
// See docs/NEX1/SECTION_36_D_B_ROUTE_R1B_MISSION_PLANNER_AMENDMENT.md.
//
// Boundary (verbatim · unamendable):
//   "Route R1b enables NEX1 to plan safely from structured input; it does
//    not permit NEX1 to invoke any primitive, write any file, or expand
//    its authoring vocabulary."

import type {
  TypedDataContractSpec,
  TDCTypeOnlyImport,
  TDCRuntimeImport,
} from "../programming-mission/types";
import type { RepoImportEntry } from "./repo-scan-types";

// ── MissionPlanDocument grammar (locked · structured only) ─────────────

/** File to produce in this mission. `contract_spec_hint` required when
 *  kind === "typed_data_contract". Other kinds are flagged as "MAI supplies". */
export interface FileToProduce {
  readonly path: string;                             // relative to target_directory · forward slashes
  readonly kind: "typed_data_contract" | "test_scaffold" | "governance_doc";
  /** Required when kind === "typed_data_contract". Mirrors TypedDataContractSpec
   *  shape exactly; the planner validates + emits as a spec. */
  readonly contract_spec_hint?: TypedDataContractSpec;
}

/** Hint for expected type-only imports across the mission. Informational only;
 *  the planner does not validate them against the RepositoryMap unless the same
 *  edge appears in a contract_spec_hint's type_only_imports (via file). */
export interface TypeOnlyImportHint {
  readonly symbol: string;
  readonly from_specifier: string;
}

/** Hint for expected runtime imports across the mission. Same rule as above. */
export interface RuntimeImportHint {
  readonly kind: "numeric_range_constant" | "literal_union";
  readonly name: string;
  readonly from_specifier: string;
  readonly literals?: readonly string[];              // Route 2c · when kind === "literal_union" and needed for validator refusal-union
}

/** Test target hints describing expected test-file structure. Advisory. */
export interface TestTargetHint {
  readonly test_file_path: string;                    // relative to target_directory
  readonly test_group_names: readonly string[];
  readonly expected_test_count_min: number;           // integer >= 0
}

/** The mission-plan document authored by the caller (founder or MAI). */
export interface MissionPlanDocument {
  readonly mission_id: string;                        // valid identifier
  readonly objective: string;                         // one-line human-readable · echoed
  readonly target_directory: string;                  // workspace-relative · must start with approved prefix
  readonly files_to_produce: readonly FileToProduce[];
  readonly type_only_import_hints: readonly TypeOnlyImportHint[];
  readonly runtime_import_hints: readonly RuntimeImportHint[];
  readonly protected_paths_declared: readonly string[];
  readonly test_targets: readonly TestTargetHint[];
  readonly rollback_strategy: "delete_new_files" | "restore_from_backup" | "deterministic_reauthoring";
}

// ── Request wrapper ────────────────────────────────────────────────────

export interface MissionConstraints {
  readonly protected_paths: readonly string[];        // callers may add extra protection
  readonly max_files: number;                         // must be integer in [1, 32] · defensive cap
}

/** Full request to the mission-planner. */
export interface MissionPlannerRequest {
  readonly mission_plan: MissionPlanDocument;
  readonly repository_map_sha256: string;             // = repository_map.scan_sha256 · guard
  readonly scan_sha256_expected: string;              // MUST equal repository_map_sha256
  readonly constraints: MissionConstraints;
}

// ── Output shapes ──────────────────────────────────────────────────────

export interface PlannedFile {
  readonly path: string;                              // workspace-relative
  readonly kind: "typed_data_contract" | "test_scaffold" | "governance_doc";
  readonly typed_data_contract_spec?: TypedDataContractSpec;    // only for typed_data_contract kind
  readonly mai_supplies_note?: string;                          // for test_scaffold + governance_doc kinds
}

export interface DependencyEdge {
  readonly from_file: string;                         // workspace-relative
  readonly imports_symbol: string;
  readonly from_specifier: string;
  readonly is_type_only: boolean;
  readonly resolved_target?: string;                  // workspace-relative if resolvable
}

export type RiskSeverity = "low" | "medium" | "high";
export type RiskCategory =
  | "unresolved_dependency"
  | "protected_path_conflict"
  | "spec_hint_gap"
  | "grammar_edge_case"
  | "cross_file_ordering"
  | "test_coverage_gap";

export interface RiskEntry {
  readonly severity: RiskSeverity;
  readonly category: RiskCategory;
  readonly description: string;                       // deterministic template output
  readonly reference: string;                         // file path / symbol / spec index
}

export interface TestPlan {
  readonly positive_test_targets: readonly string[];
  readonly negative_test_targets: readonly string[];
  readonly regression_targets: readonly string[];
  readonly total_target: number;                      // >= 0
}

export interface ImpactAnalysis {
  readonly files_that_will_be_created: readonly string[];
  readonly files_that_must_not_change: readonly string[];
  readonly downstream_symbols_potentially_affected: readonly string[];
  readonly protected_root_conflict_detected: boolean;
}

export interface RollbackPlan {
  readonly strategy: "delete_new_files" | "restore_from_backup" | "deterministic_reauthoring";
  readonly files_to_delete_on_rollback: readonly string[];
  readonly baseline_sha256_manifest_reference: string;
}

/** Success shape. */
export interface MissionPlanResult {
  readonly ok: true;
  readonly mission_id: string;
  readonly objective: string;
  readonly files_planned: readonly PlannedFile[];
  readonly dependencies: readonly DependencyEdge[];
  readonly risks: readonly RiskEntry[];
  readonly test_plan: TestPlan;
  readonly impact_analysis: ImpactAnalysis;
  readonly rollback_plan: RollbackPlan;
  readonly planner_sha256: string;                    // deterministic hash of the result (excluding this field)
}

// ── Refusal codes (exhaustive · 17 variants) ───────────────────────────

export type MissionPlannerRefusalCode =
  | "MP_INVALID_REQUEST"
  | "MP_SCAN_SHA256_MISMATCH"
  | "MP_INVALID_MISSION_ID"
  | "MP_INVALID_OBJECTIVE"
  | "MP_INVALID_TARGET_DIRECTORY"
  | "MP_EMPTY_FILES_TO_PRODUCE"
  | "MP_DUPLICATE_FILE_PATH"
  | "MP_INVALID_FILE_KIND"
  | "MP_MISSING_SPEC_HINT"
  | "MP_INVALID_SPEC_HINT_GRAMMAR"
  | "MP_UNKNOWN_DECLARATION_KIND"
  | "MP_REQUIRES_NEW_PRIMITIVE"
  | "MP_PROTECTED_PATH_CONFLICT"
  | "MP_UNRESOLVED_DEPENDENCY"
  | "MP_INVALID_PROTECTED_PATH_LIST"
  | "MP_INVALID_ROLLBACK_STRATEGY"
  | "MP_TEST_TARGETS_INVALID"
  | "MP_OUTPUT_TOO_LARGE";

export interface MissionPlanFailure {
  readonly ok: false;
  readonly refusal_code: MissionPlannerRefusalCode;
  readonly reason: string;
  readonly offending_field?: string;                  // JSON pointer OR path OR spec index
}

export type MissionPlannerResult = MissionPlanResult | MissionPlanFailure;

// ── Approved target-directory prefixes (locked) ────────────────────────

/** Workspace-relative prefixes under which `target_directory` may resolve.
 *  Any other prefix → MP_INVALID_TARGET_DIRECTORY. */
export const APPROVED_TARGET_DIRECTORY_PREFIXES: readonly string[] = Object.freeze([
  "src/lib/capability-labs/",
  "src/lib/nex-agent-runtime/",
]);

/** Approved rollback strategies. Any other value → MP_INVALID_ROLLBACK_STRATEGY. */
export const APPROVED_ROLLBACK_STRATEGIES: readonly ("delete_new_files" | "restore_from_backup" | "deterministic_reauthoring")[]
  = Object.freeze(["delete_new_files", "restore_from_backup", "deterministic_reauthoring"]);

/** Locked declaration kinds (mirrors Route 2/2b/2c grammar). Any other declaration
 *  kind inside a contract_spec_hint → MP_UNKNOWN_DECLARATION_KIND. */
export const LOCKED_DECLARATION_KINDS: readonly string[] = Object.freeze([
  "interface", "type_alias", "discriminated_union", "literal_union",
  "numeric_range_constant", "validator_function", "serialiser_function",
  "refusal_reason_union",
]);

/** Approved file kinds. */
export const APPROVED_FILE_KINDS: readonly ("typed_data_contract" | "test_scaffold" | "governance_doc")[]
  = Object.freeze(["typed_data_contract", "test_scaffold", "governance_doc"]);

/** Hard caps. */
export const MP_MAX_OUTPUT_BYTES = 512 * 1024;
export const MP_MAX_FILES_PER_MISSION = 32;
export const MP_MAX_OBJECTIVE_LENGTH = 512;
export const MP_MAX_IDENTIFIER_LENGTH = 128;
