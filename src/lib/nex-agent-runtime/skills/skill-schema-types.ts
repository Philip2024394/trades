// §36-E-3A · WAVE-E3A · 2026-09-14 · skill-data-model
// NEX bounded infrastructure · skill-schema types + locked predicate catalogue · 2026-09-14
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// Types for the invocable NEX skill schema.
//
// FOUNDER-LOCKED PRINCIPLE (unamendable):
//   A skill is INVOCABLE ENGINEERING KNOWLEDGE, not documentation. Every
//   validator in a skill references the LOCKED CATALOGUE by name; skills
//   never execute arbitrary code, never load LLMs, never fabricate.

// ── Locked validator catalogue (exhaustive · 15 named predicates) ──────
//
// Each predicate takes deterministic inputs and returns a categorical
// verdict. Skills reference predicates by `predicate_id`. The catalogue
// is CLOSED · adding predicates requires `AMEND WAVE E3A SKILL PLAN`.

export type LockedPredicateId =
  | "path_matches_glob"
  | "path_matches_regex"
  | "file_declares_symbol"
  | "file_imports_symbol"
  | "file_imports_from_specifier"
  | "text_contains_substring"
  | "text_matches_regex"
  | "text_does_not_contain_substring"
  | "text_does_not_match_regex"
  | "sha256_equals_declared"
  | "candidate_change_kind_is"
  | "candidate_touches_module"
  | "test_count_at_least"
  | "candidate_authorised"
  | "no_operation";

export const APPROVED_PREDICATES: readonly LockedPredicateId[] = Object.freeze([
  "path_matches_glob",
  "path_matches_regex",
  "file_declares_symbol",
  "file_imports_symbol",
  "file_imports_from_specifier",
  "text_contains_substring",
  "text_matches_regex",
  "text_does_not_contain_substring",
  "text_does_not_match_regex",
  "sha256_equals_declared",
  "candidate_change_kind_is",
  "candidate_touches_module",
  "test_count_at_least",
  "candidate_authorised",
  "no_operation",
]);

// ── Locked verdict states (exhaustive · 4) ─────────────────────────────

export type ValidatorVerdict = "satisfied" | "violated" | "not_applicable" | "inconclusive";

// ── Locked change kinds (matches L1) ───────────────────────────────────

export type SkillChangeKind = "file_new" | "file_content" | "file_delete" | "test_only";

// ── Skill schema (structured · typed · invocable) ──────────────────────

export interface SkillIdentity {
  readonly slug: string;                  // kebab-case
  readonly version: `${number}.${number}.${number}`;
  readonly display_name: string;
  readonly domain: SkillDomain;
}

export type SkillDomain =
  | "language"
  | "framework"
  | "runtime"
  | "database"
  | "security"
  | "testing"
  | "architecture"
  | "nex-agent-runtime";

export interface SkillApplicability {
  readonly applicable_languages: readonly string[];  // e.g. ["typescript", "tsx"]
  readonly applicable_frameworks: readonly string[];  // e.g. ["react", "nextjs"]
  readonly applicable_change_kinds: readonly SkillChangeKind[];
}

// ── Validator reference (skill → locked catalogue) ─────────────────────

export interface SkillValidatorRef {
  readonly validator_id: string;                   // caller-chosen name for this rule
  readonly predicate_id: LockedPredicateId;         // must be in APPROVED_PREDICATES
  readonly predicate_args: PredicateArgs;
  readonly kind: "invariant" | "anti_pattern" | "evidence_requirement" | "precondition";
  readonly rationale: string;                       // short human-readable rationale
}

/** Locked arg-shape per predicate · discriminated union. */
export type PredicateArgs =
  | { readonly kind: "path_matches_glob"; readonly glob: string }
  | { readonly kind: "path_matches_regex"; readonly regex: string }
  | { readonly kind: "file_declares_symbol"; readonly symbol_name: string }
  | { readonly kind: "file_imports_symbol"; readonly symbol_name: string }
  | { readonly kind: "file_imports_from_specifier"; readonly specifier: string }
  | { readonly kind: "text_contains_substring"; readonly substring: string }
  | { readonly kind: "text_matches_regex"; readonly regex: string }
  | { readonly kind: "text_does_not_contain_substring"; readonly substring: string }
  | { readonly kind: "text_does_not_match_regex"; readonly regex: string }
  | { readonly kind: "sha256_equals_declared"; readonly expected_sha256_hex: string }
  | { readonly kind: "candidate_change_kind_is"; readonly change_kind: SkillChangeKind }
  | { readonly kind: "candidate_touches_module"; readonly module_prefix: string }
  | { readonly kind: "test_count_at_least"; readonly minimum: number }
  | { readonly kind: "candidate_authorised" }
  | { readonly kind: "no_operation" };

// ── Skill procedure (structured, deterministic-hint, not-executable-code) ──

export interface SkillProcedure {
  readonly step_id: string;
  readonly step_kind: "read" | "analyse" | "declare" | "verify" | "record";
  readonly description: string;                     // human-readable
  readonly required_predicate_verdicts: readonly {
    readonly validator_id: string;
    readonly required_verdict: ValidatorVerdict;
  }[];
}

// ── Full Skill (invocable data record) ─────────────────────────────────

export interface Skill {
  readonly identity: SkillIdentity;
  readonly applicability: SkillApplicability;
  readonly validators: readonly SkillValidatorRef[];
  readonly procedures: readonly SkillProcedure[];
  readonly known_anti_patterns: readonly SkillValidatorRef[];   // subset: kind === "anti_pattern"
  readonly evidence_requirements: readonly SkillValidatorRef[]; // subset: kind === "evidence_requirement"
  readonly provenance: SkillProvenance;
}

export interface SkillProvenance {
  readonly authored_by: "NEX1_via_typed_data_contract" | "MAI_infrastructure";
  readonly authored_at: string;                      // ISO 8601
  readonly authoring_evidence_sha256: string;        // 64-hex
  readonly promotion_state: "PROMOTED" | "PENDING" | "SUPERSEDED" | "NEEDS_REVIEW";
}

// ── Candidate (a change under evaluation) ──────────────────────────────

/** Deterministic representation of a candidate change. Skills evaluate
 *  their validators against this record. */
export interface SkillCandidate {
  readonly workspace_relative_path: string;
  readonly change_kind: SkillChangeKind;
  readonly current_sha256_hex: string | null;
  readonly proposed_content: string | null;
  readonly proposed_content_sha256_hex: string | null;
  readonly declared_symbols: readonly string[];      // e.g. from R1a
  readonly imported_symbols: readonly string[];
  readonly imported_from_specifiers: readonly string[];
  readonly authorised: boolean;                       // caller confirms authority
  readonly test_count_declared: number | null;
}

// ── validateSkillDefinition request/response ───────────────────────────

export interface ValidateSkillRequest {
  readonly skill: Skill;
}

export interface ValidateSkillSuccess {
  readonly ok: true;
  readonly skill_slug: string;
  readonly skill_version: string;
  readonly validator_count: number;
  readonly procedure_count: number;
  readonly definition_sha256: string;
}

// ── applySkillValidatorsToCandidate request/response ───────────────────

export interface ApplyValidatorsRequest {
  readonly skill: Skill;
  readonly candidate: SkillCandidate;
}

export interface ValidatorInvocationResult {
  readonly validator_id: string;
  readonly predicate_id: LockedPredicateId;
  readonly kind: SkillValidatorRef["kind"];
  readonly verdict: ValidatorVerdict;
  readonly evidence_summary: string;
}

export interface ApplyValidatorsSuccess {
  readonly ok: true;
  readonly skill_slug: string;
  readonly candidate_path: string;
  readonly invocations: readonly ValidatorInvocationResult[];
  readonly satisfied_count: number;
  readonly violated_count: number;
  readonly not_applicable_count: number;
  readonly inconclusive_count: number;
  readonly overall_verdict: "all_satisfied" | "any_violated" | "no_applicable" | "mixed";
  readonly invocation_sha256: string;
}

// ── Refusal codes (exhaustive) ─────────────────────────────────────────

export type SkillSchemaRefusalCode =
  | "SS_INVALID_REQUEST"
  | "SS_INVALID_SKILL"
  | "SS_UNKNOWN_PREDICATE"
  | "SS_INVALID_PREDICATE_ARGS"
  | "SS_INVALID_CANDIDATE"
  | "SS_PROHIBITED_STRING_CONTENT";

export interface SkillSchemaFailure {
  readonly ok: false;
  readonly refusal_code: SkillSchemaRefusalCode;
  readonly reason: string;
  readonly offending_field?: string;
}

export type ValidateSkillResult = ValidateSkillSuccess | SkillSchemaFailure;
export type ApplyValidatorsResult = ApplyValidatorsSuccess | SkillSchemaFailure;

// ── Locked bounds ──────────────────────────────────────────────────────

export const SS_MAX_VALIDATORS_PER_SKILL = 32;
export const SS_MAX_PROCEDURES_PER_SKILL = 16;
export const SS_MAX_STRING_LENGTH = 512;

export const SS_PROHIBITED_SUBSTRINGS: readonly string[] = Object.freeze([
  "\0", "eval(", "Function(", "new Function", "child_process",
  "__proto__", "constructor.prototype", "<script", "</script",
]);
