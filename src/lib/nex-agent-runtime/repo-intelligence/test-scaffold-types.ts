// §36-D-D · ROUTE-R2 · 2026-09-14 · test-scaffold-authoring
//
// Type definitions and refusal codes for the pure-function test-scaffold-authoring primitive.
// See docs/NEX1/SECTION_36_D_D_ROUTE_R2_TEST_SCAFFOLD_AMENDMENT.md.
//
// Boundary (verbatim · unamendable):
//   "Route R2 enables NEX1 to author mechanical test scaffolds deterministically
//    from a TypedDataContractSpec; it does not permit NEX1 to invent domain-judgment
//    tests, invoke primitives, write files, or expand its authoring vocabulary."

import type {
  StyleProfile,
  TypedDataContractSpec,
} from "../programming-mission/types";

// ── Test-category grammar (locked · 6 categories) ──────────────────────

/** The six locked mechanical test categories R2 may generate.
 *  Any other category → TSC_UNKNOWN_TEST_CATEGORY. */
export type TestCategory =
  | "range_bounds"            // numeric_range_constant · min/max/frozen
  | "union_integrity"          // literal_union + refusal_reason_union · _MEMBERS length/frozen/contains
  | "interface_shape"          // interface · inhabitability with deterministic sample
  | "refusal_triggerability"   // validator_function · each declared refusal reason emitted
  | "serialiser_determinism"   // serialiser_function · byte-stable + round-trip + property-order
  | "contamination_guard";     // source file · no forbidden substrings

/** All six categories · used for validation and defaulting. */
export const APPROVED_TEST_CATEGORIES: readonly TestCategory[] = Object.freeze([
  "range_bounds",
  "union_integrity",
  "interface_shape",
  "refusal_triggerability",
  "serialiser_determinism",
  "contamination_guard",
]);

// ── Request shape ──────────────────────────────────────────────────────

export interface TestScaffoldRequest {
  readonly spec: TypedDataContractSpec;
  readonly target_test_file_path: string;
  readonly source_module_specifier: string;
  readonly test_categories: readonly TestCategory[];
  readonly domain_judgment_placeholders: boolean;
  readonly style: StyleProfile;
}

// ── Output shape (success) ─────────────────────────────────────────────

export interface GapNote {
  readonly kind: "domain_judgment_required" | "cross_file_test_needed" | "semantic_check_needed" | "product_data_needed";
  readonly declaration_ref: string;
  readonly description: string;
}

export interface TestScaffoldSuccess {
  readonly ok: true;
  readonly content: string;
  readonly test_count_authored: number;
  readonly test_count_todo_placeholders: number;
  readonly gap_notes: readonly GapNote[];
  readonly scaffold_sha256: string;
}

// ── Refusal codes (exhaustive · 12) ────────────────────────────────────

export type TestScaffoldRefusalCode =
  | "TSC_INVALID_REQUEST"
  | "TSC_INVALID_SPEC"
  | "TSC_INVALID_TARGET_PATH"
  | "TSC_INVALID_SOURCE_SPECIFIER"
  | "TSC_UNKNOWN_TEST_CATEGORY"
  | "TSC_UNSUPPORTED_DECLARATION_KIND"
  | "TSC_AMBIGUOUS_SPEC"
  | "TSC_DOMAIN_JUDGMENT_REQUIRED"   // internal marker · not typically top-level refusal (used in gap_notes)
  | "TSC_OUTPUT_TOO_LARGE"
  | "TSC_INVALID_IDENTIFIER"
  | "TSC_PROHIBITED_STRING_CONTENT"
  | "TSC_INVALID_STYLE";

export interface TestScaffoldFailure {
  readonly ok: false;
  readonly refusal_code: TestScaffoldRefusalCode;
  readonly reason: string;
  readonly offending_field?: string;
}

export type TestScaffoldResult = TestScaffoldSuccess | TestScaffoldFailure;

// ── Locked constants ───────────────────────────────────────────────────

export const TSC_MAX_OUTPUT_BYTES = 128 * 1024;
export const TSC_MAX_NESTING_DEPTH = 8;                // matches Route 2 MAX_NESTING_DEPTH
export const TSC_MAX_IDENTIFIER_LENGTH = 128;

/** Locked declaration kinds from typed_data_contract grammar. Any spec that
 *  contains a declaration kind outside this set → TSC_UNSUPPORTED_DECLARATION_KIND. */
export const LOCKED_DECLARATION_KINDS: readonly string[] = Object.freeze([
  "interface",
  "type_alias",
  "discriminated_union",
  "literal_union",
  "numeric_range_constant",
  "validator_function",
  "serialiser_function",
  "refusal_reason_union",
]);

/** Prohibited substrings scanned in strings that come from the request.
 *  Matches Route 2/2b/2c defensive posture. */
export const TSC_PROHIBITED_SUBSTRINGS: readonly string[] = Object.freeze([
  "eval(",
  "Function(",
  "new Function",
  "setTimeout",
  "setInterval",
  "queueMicrotask",
  "require(",
  "import(",
  "process.",
  "child_process",
  "__proto__",
  "constructor.prototype",
  "</script",
  "<script",
]);
