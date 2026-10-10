// WO-NEX-RUNTIME-11 · programming mission types.
//
// Founder-locked 2026-09-14. The FIRST real programming mission types.
// Every ProgrammingMissionCompletionReceipt must carry 12 distinct
// persisted evidence links · founder-locked rule:
//
//   "If one link is missing, the completion receipt should not be able
//    to become VERIFIED_END_TO_END."
//
// The receipt shape uses NOT_VERIFIED semantics for any missing / failed
// stage · the string "SUCCESS" is banned when any link is not present.

// ── Mission input ──────────────────────────────────────────────────────

/** Formal specification of a small programming task. Deterministic (P-S)
 *  code authoring composes a real implementation from this + real style
 *  detected in existing workspace files. */
export interface FunctionSpec {
  readonly function_name: string;                    // e.g. "truncate_words"
  readonly parameters: readonly {
    readonly name: string;
    readonly type: "string" | "number" | "boolean";
  }[];
  readonly return_type: "string" | "number" | "boolean";
  /** The algorithm NEX1 must implement. NEX1 selects the algorithm kind
   *  and composes primitives · this is not a template substitution. Each
   *  algorithm kind ships with its own primitive composition rules.
   *  `pair_composition` is F-C-02 · bounded pairwise composition of two
   *  registered primitives discovered from test evidence · the specific
   *  pair and template live in FunctionSpec.pair_composition below.
   *  `typed_data_contract` is §36-A · Route 2 · specification-driven
   *  (not evidence-driven) authoring of a bounded typed-data-contract
   *  file · the spec lives in FunctionSpec.typed_data_contract_spec. */
  readonly algorithm_kind: "truncate_words" | "short_report" | "text_stats" | "describe_text" | "fibonacci_memoised" | "pair_composition" | "unguided" | "typed_data_contract";
  /** Concrete edge cases with expected outputs. These drive the tests
   *  NEX1 authors AND become defensive branches inside the implementation. */
  readonly edge_cases: readonly {
    readonly when: string;
    readonly input: readonly (string | number | boolean)[];
    readonly expect: string | number | boolean;
  }[];
  /** M-02 · imports required by this function's algorithm.
   *  Each entry drives one `import { symbol } from "specifier"` line in
   *  the authored source. NEX1 uses the workspace dependency graph to
   *  make these specifiers consistent with what OTHER authored files
   *  actually export. If the target file's exports and this imports_needed
   *  become inconsistent, the build will catch it — which is the whole
   *  point of the ripple test. */
  readonly imports_needed?: readonly {
    readonly symbol: string;               // e.g. "truncate_words"
    readonly from_specifier: string;       // e.g. "./word_utils.mjs"
  }[];
  /** F-C-02 · when algorithm_kind is "pair_composition", the specific
   *  pair + discovered template (both derived from test evidence by
   *  pair-matcher.ts, never hard-coded per-mission) travel here. Absent
   *  for every other algorithm_kind. */
  readonly pair_composition?: PairComposition;
  /** §36-A · Route 2 · when algorithm_kind is "typed_data_contract", the
   *  bounded specification describing which declarations to render into
   *  the target file. Absent for every other algorithm_kind. Validated
   *  against the locked grammar by typed-data-contract-authoring.ts
   *  before any bytes are produced. See docs/NEX1/SECTION_36_A_ROUTE_2_
   *  LAB_AUTHORING_AMENDMENT.md for the full grammar + boundaries. */
  readonly typed_data_contract_spec?: TypedDataContractSpec;
}

// ── F-C-02 · Bounded pairwise composition (founder-locked 2026-09-14) ──
//
// A composition is a decision by pair-matcher.ts: two known primitives
// applied in a discovered order, connected by a template string derived
// from the mission's own test assertions. Neither the pair nor the
// template may be hard-coded per-mission · they must be inferred from
// evidence and preserved as record. See docs/NEX1/F-C-02_BUILD_SPEC.md.
export interface PairPlaceholderBinding {
  readonly source: "A" | "B";              // which primitive supplies the value
  readonly path: string | null;            // e.g. "words" · null = whole scalar output
  readonly rendered_placeholder: string;   // e.g. "{A.words}" · human-readable audit trail
}

export interface PairComposition {
  readonly primitive_a: {
    readonly algorithm_kind: string;
    readonly extracted_args: readonly (string | number | boolean)[];  // args beyond the mission's input
  };
  readonly primitive_b: {
    readonly algorithm_kind: string;
    readonly extracted_args: readonly (string | number | boolean)[];
  };
  readonly template: string;                              // "Words: {A.words}. First: {B}"
  readonly placeholders: readonly PairPlaceholderBinding[];
  readonly return_type: "string" | "number" | "boolean";  // shape the composition emits
}

// ── §36-A · Route 2 · Typed Data Contract Spec (founder-authorised 2026-09-14) ──
//
// Bounded, specification-driven authoring vocabulary. The primitive
// `typed_data_contract` emits one TypeScript module per mission file
// containing exactly the declarations listed in the spec, in the order
// listed, with deterministic formatting. It is NOT a general-purpose
// code generator: any spec outside this grammar is refused deterministically
// with a structured refusal code (see typed-data-contract-authoring.ts).
//
// Locked grammar (see SECTION_36_A_ROUTE_2_LAB_AUTHORING_AMENDMENT.md §5):
//   1. interface              - named fields + nested object types
//   2. type_alias             - one name aliased to a type expression
//   3. discriminated_union    - union of tagged interface variants
//   4. literal_union          - string-literal union
//   5. numeric_range_constant - { min, max } readonly constant
//   6. validator_function     - pure predicate returning discriminated result
//   7. serialiser_function    - pure byte-stable JSON producer
//   8. refusal_reason_union   - string-literal union scoped to refusals

/** Locked primitive types permitted inside a TDC type expression.
 *  Deliberately narrow · no `unknown` · no `any` · no `object` · no
 *  index signatures · no template literals · no mapped types. */
export type TDCPrimitiveType = "string" | "number" | "boolean";

/** A type expression usable inside interfaces, type aliases, or field
 *  declarations. Supports only: primitives, references to declared types,
 *  arrays, and nested object literals. */
export type TDCTypeExpression =
  | { readonly kind: "primitive"; readonly type: TDCPrimitiveType }
  | { readonly kind: "reference"; readonly to: string }
  | { readonly kind: "array"; readonly element: TDCTypeExpression }
  | { readonly kind: "object"; readonly fields: readonly TDCField[] };

/** A named field on an interface, discriminated variant, or nested object. */
export interface TDCField {
  readonly name: string;              // must be a valid JS identifier
  readonly type: TDCTypeExpression;
  readonly optional: boolean;         // renders as `field?: T`
  readonly readonly_modifier: boolean; // renders as `readonly field: T`
}

/** One variant of a discriminated union. The discriminator field on the
 *  parent declaration takes `tag_value` as its literal string type here. */
export interface TDCDiscriminatedVariant {
  readonly tag_value: string;
  readonly fields: readonly TDCField[];
}

/** One check inside a validator function body. Bounded: cannot invoke
 *  arbitrary code · can only compare against declared ranges/literals
 *  and return a declared refusal reason. */
export interface TDCValidatorCheck {
  readonly field_path: string;                                     // dot-notation, e.g. "eye_state.aperture"
  readonly check_kind: "range_within" | "literal_union_member" | "required_present";
  readonly reference_name?: string;                                 // name of numeric_range_constant OR literal_union to check against
  readonly refusal_reason_literal: string;                          // must be a member of a refusal_reason_union declared in the same spec
}

/** One declaration to emit into the target file. Order in the spec is
 *  the render order in the emitted TypeScript · deterministic. */
export type TypedDataContractDeclaration =
  | {
      readonly declaration_kind: "interface";
      readonly name: string;
      readonly fields: readonly TDCField[];
      readonly exported: boolean;
    }
  | {
      readonly declaration_kind: "type_alias";
      readonly name: string;
      readonly aliased_to: TDCTypeExpression;
      readonly exported: boolean;
    }
  | {
      readonly declaration_kind: "discriminated_union";
      readonly name: string;
      readonly discriminator_field: string;
      readonly variants: readonly TDCDiscriminatedVariant[];
      readonly exported: boolean;
    }
  | {
      readonly declaration_kind: "literal_union";
      readonly name: string;
      readonly literals: readonly string[];
      readonly exported: boolean;
    }
  | {
      readonly declaration_kind: "numeric_range_constant";
      readonly name: string;
      readonly min: number;
      readonly max: number;
      readonly exported: boolean;
    }
  | {
      readonly declaration_kind: "validator_function";
      readonly name: string;
      readonly input_type_name: string;             // name of an interface or discriminated_union declared in this spec OR referenced via type-only import
      readonly refusal_union_name: string;          // name of the refusal_reason_union to draw refusal reasons from
      readonly checks: readonly TDCValidatorCheck[];
      readonly exported: boolean;
    }
  | {
      readonly declaration_kind: "serialiser_function";
      readonly name: string;
      readonly input_type_name: string;
      readonly property_order: readonly string[];   // deterministic property emission order for byte-stable JSON
      readonly exported: boolean;
    }
  | {
      readonly declaration_kind: "refusal_reason_union";
      readonly name: string;
      readonly reasons: readonly string[];
      readonly exported: boolean;
    };

/** A type-only import for cross-file references (e.g. validator.ts
 *  importing FacialState from facial-state.ts). Emitted as
 *  `import type { X } from "specifier"`. Runtime imports are prohibited
 *  by this shape · use TDCRuntimeImport (§36-B · Route 2b) instead. */
export interface TDCTypeOnlyImport {
  readonly symbol: string;
  readonly from_specifier: string;   // e.g. "./facial-state"
}

// ── §36-B · Route 2b · Runtime import (founder-authorised 2026-09-14) ──
//
// Bounded runtime import for cross-file references that need a RUNTIME
// value (not just a type). Deliberately narrow: only two declaration
// kinds may be imported at runtime. Everything else stays type-only
// or unimportable. Emission is fully deterministic — the caller cannot
// choose arbitrary symbol names, only what the `kind` field derives.
//
// Emission rules (locked · no configurability):
//   kind: "numeric_range_constant" → `import { <name> } from "..."`
//   kind: "literal_union"          → `import { <name>, <name>_MEMBERS } from "..."`
//
// Security: from_specifier must be workspace-relative sibling · no `..` ·
// no absolute paths · no Node built-ins · no protocol schemes · no bare
// package specifiers. Every violation is a deterministic refusal.
//
// See docs/NEX1/SECTION_36_B_ROUTE_2B_RUNTIME_IMPORTS_AMENDMENT.md.

/** §36-B · Route 2b · a runtime import for a specific declaration kind
 *  whose RUNTIME VALUE is needed by a validator in this file.
 *  §36-C · Route 2c · optional `literals` field allows the validator's
 *  `refusal_union_name` to resolve to a runtime-imported `literal_union`
 *  (permitted only when kind === "literal_union"). The supplied literals
 *  are the author-time member vocabulary used to validate each check's
 *  `refusal_reason_literal`. The mission is required to supply literals
 *  that exactly correspond to the sibling file's exported union. */
export interface TDCRuntimeImport {
  readonly kind: "numeric_range_constant" | "literal_union";
  readonly name: string;              // valid identifier · the declared name at the source
  readonly from_specifier: string;    // workspace-relative sibling · e.g. "./ranges"
  readonly literals?: readonly string[];  // §36-C · Route 2c · optional · only with kind === "literal_union"
}

/** The complete spec for one file emitted by typed_data_contract. */
export interface TypedDataContractSpec {
  readonly contract_name: string;    // human-readable name for the file header
  readonly type_only_imports: readonly TDCTypeOnlyImport[];  // may be empty
  readonly declarations: readonly TypedDataContractDeclaration[];
  readonly header_comment: string;   // deterministic; renders at top of file
  /** §36-B · Route 2b · optional runtime imports for cross-file constants
   *  (numeric_range_constant and literal_union kinds only). Absent or
   *  empty produces byte-identical output to pre-Route-2b behaviour. */
  readonly runtime_imports?: readonly TDCRuntimeImport[];
}

export interface ProgrammingMissionBrief {
  readonly mission_id: string;
  readonly title: string;
  /** Absolute path to a sanctioned workspace under data/nex-agent-workspaces. */
  readonly workspace_root: string;
  /** Paths NEX1 must READ before authoring (relative to workspace_root).
   *  Real read evidence is a precondition of an honest completion receipt. */
  readonly target_files_to_inspect: readonly string[];
  /** Files NEX1 will create · path relative to workspace_root. */
  readonly proposed_new_files: readonly {
    readonly path: string;
    readonly kind: "implementation" | "test";
    readonly function_spec: FunctionSpec;
  }[];
  readonly requirements_summary: string;
  readonly requester_agent_id: string;
}

// ── Style inspection (what NEX1 detected by reading) ───────────────────

export interface StyleProfile {
  readonly naming_convention: "snake_case" | "camelCase" | "unknown";
  readonly export_style: "named" | "default" | "unknown";
  readonly semicolons: "yes" | "no" | "unknown";
  readonly quote_style: "double" | "single" | "unknown";
  readonly test_framework: "vitest" | "unknown";
  readonly detected_from_files: readonly string[];
  readonly detection_confidence: "high" | "medium" | "low";
}

// ── Authored code (real bytes NEX1 produced) ───────────────────────────

export interface AuthoredFile {
  readonly path: string;
  readonly content: string;
  readonly content_bytes: number;
  readonly content_sha256_hex: string;
  readonly extension: "ts" | "tsx" | "js" | "json" | "md" | "css" | "txt";
  readonly authored_from_spec: FunctionSpec;
  readonly authored_using_style: StyleProfile;
}

// ── The 12 evidence links (founder-locked) ─────────────────────────────

/** Every one of these must reference an ACTUAL persisted record when the
 *  receipt is VERIFIED_END_TO_END. Missing / null → cannot be verified. */
export interface TwelveEvidenceLinks {
  readonly link_1_mission_record_id: string | null;                    // this brief, persisted
  readonly link_2_nex1_inspection_evidence_id: string | null;          // NEX1's read audit
  readonly link_3_proposal_record_id: string | null;                   // CapEngineeringProposal
  readonly link_4_authorised_diff_bundle_id: string | null;            // WO-03 pipeline output
  readonly link_5_delegated_authorization_id: string | null;           // RUNTIME-08
  readonly link_6_workstation_gate_receipt_id: string | null;          // RUNTIME-07
  readonly link_7_wo04_execution_report_id: string | null;             // WO-04 broker-write report
  readonly link_8_wo05_build_report_id: string | null;                 // WO-05 build report
  readonly link_9_wo07_test_report_id: string | null;                  // WO-07 specialist report (vitest+tsc)
  readonly link_10_nex2_review_id: string | null;                      // NEX2 review verdict
  readonly link_11_security_veto_id: string | null;                    // Security verdict
  readonly link_12_workstation_execution_attestation_id: string | null; // RUNTIME-10 signed attestation
}

// ── Completion verdict ─────────────────────────────────────────────────

export type ProgrammingMissionVerdict =
  | "VERIFIED_END_TO_END"                    // all 12 links present · all stages passed · signed attestation OK
  | "NOT_VERIFIED_INSPECTION_FAILED"         // NEX1 couldn't read target files
  | "NOT_VERIFIED_AUTHORING_FAILED"          // code-authoring produced no diff
  | "NOT_VERIFIED_PROPOSAL_INVALID"          // proposal shape didn't pass validation
  | "NOT_VERIFIED_DELEGATION_INVALID"        // delegation refused
  | "NOT_VERIFIED_RECEIPT_NOT_ALLOWED"       // Orchestrator receipt didn't reach WORKSTATION_ALLOWED
  | "NOT_VERIFIED_WORKSTATION_REFUSED"       // RUNTIME-10 integration refused
  | "NOT_VERIFIED_BUILD_FAILED"              // WO-05 exit code != expected
  | "NOT_VERIFIED_TESTS_FAILED"              // WO-07 test verdict != PASSED
  | "NOT_VERIFIED_NEX2_REJECTED"             // NEX2 review not INDEPENDENTLY_VERIFIED
  | "NOT_VERIFIED_SECURITY_REJECTED"         // Security veto not CLEARED
  | "NOT_VERIFIED_EVIDENCE_INCOMPLETE"       // one or more of the 12 links missing
  | "REFUSED_MISSION_INVALID"                // mission brief itself rejected
  | "REFUSED_OUT_OF_SCOPE";                  // mission targets protected roots

/** Founder-locked rule: this ONLY becomes VERIFIED_END_TO_END when every
 *  one of the 12 links is a non-null persisted record ID AND every stage
 *  reached its passing verdict. */
export interface ProgrammingMissionCompletionReceipt {
  readonly record_type: "NEX_PROGRAMMING_MISSION_COMPLETION_RECEIPT";
  readonly receipt_id: string;
  readonly mission_id: string;
  readonly title: string;
  readonly verdict: ProgrammingMissionVerdict;
  readonly links: TwelveEvidenceLinks;
  readonly stage_summary: {
    readonly nex1_inspection: "PASSED" | "FAILED" | "NOT_REACHED";
    readonly code_authored: "PASSED" | "FAILED" | "NOT_REACHED";
    readonly proposal_valid: "PASSED" | "FAILED" | "NOT_REACHED";
    readonly delegation_authorised: "PASSED" | "FAILED" | "NOT_REACHED";
    readonly orchestrator_receipt: "WORKSTATION_ALLOWED" | "BLOCKED" | "PENDING_INPUT" | "EXPIRED" | "NOT_REACHED";
    readonly wo04_broker_write: "PASSED" | "FAILED" | "NOT_REACHED";
    readonly wo05_build: "PASSED" | "FAILED" | "NOT_REACHED";
    readonly wo07_tests: "PASSED" | "FAILED" | "NOT_REACHED";
    readonly nex2_review: "INDEPENDENTLY_VERIFIED" | "REJECTED" | "NOT_REACHED";
    readonly security_verdict: "CLEARED" | "REJECTED" | "NOT_REACHED";
    readonly workstation_attestation: "EXECUTED" | "REFUSED" | "NOT_REACHED";
  };
  readonly reason_summary: string;
  readonly attempted_at: string;
  readonly finished_at: string;
  readonly requester_agent_id: string;
  readonly requester_public_key_der_hex: string;
  readonly signature_hex: string;
}

export const PROGRAMMING_MISSION_COMPLETION_COLLECTION = "nex_programming_mission_completions" as const;
export const PROGRAMMING_MISSION_BRIEF_COLLECTION = "nex_programming_mission_briefs" as const;
export const PROGRAMMING_MISSION_INSPECTION_COLLECTION = "nex_programming_mission_inspections" as const;

// ── Rules for VERIFIED_END_TO_END (deterministic check) ────────────────

/** All 12 evidence links non-null AND every stage passed. Any failure
 *  drops to NOT_VERIFIED_*. Language rule: the word "SUCCESS" and its
 *  variants are BANNED in a receipt whose verdict is not VERIFIED_END_TO_END. */
export function allTwelveLinksPresent(links: TwelveEvidenceLinks): boolean {
  return (
    links.link_1_mission_record_id !== null &&
    links.link_2_nex1_inspection_evidence_id !== null &&
    links.link_3_proposal_record_id !== null &&
    links.link_4_authorised_diff_bundle_id !== null &&
    links.link_5_delegated_authorization_id !== null &&
    links.link_6_workstation_gate_receipt_id !== null &&
    links.link_7_wo04_execution_report_id !== null &&
    links.link_8_wo05_build_report_id !== null &&
    links.link_9_wo07_test_report_id !== null &&
    links.link_10_nex2_review_id !== null &&
    links.link_11_security_veto_id !== null &&
    links.link_12_workstation_execution_attestation_id !== null
  );
}
