// src/lib/nex-agent/code-engine/capability-spec-representation.ts
//
// NEX1 · Specification Representation · Phase 1 · Ledger B additive
// Founder-authorised 2026-09-19 · Full Autonomous Build Mandate
//
// PURPOSE
//   Compile founder prose into a structured, machine-checkable
//   SpecificationRepresentation. Distinguish "what founder said" from
//   "what NEX inferred." Return SPECIFICATION_UNRESOLVED when evidence is
//   insufficient rather than fabricating a target.
//
// DISCIPLINE
//   · Zero LLM. Deterministic.
//   · Additive · frozen capability-specification-extractor.ts untouched
//   · Consumes extractor output · does not replace it
//   · No test-specific hardcoding · no expected-value substitution
//   · Every inference tagged with source + confidence
//   · Refuses to guess · UNRESOLVED is a legitimate outcome
//
// FOUNDER PRINCIPLE (verbatim)
//   "Give NEX the right evidence, not the conclusion."
//   "Do not let NEX learn what kind of answer is desirable."

import { registerAgent } from "./capability-agent-registry";
import {
  extractSpecification,
  classifyExtraction,
  type ExpectedBehaviour,
} from "./capability-specification-extractor";
import * as crypto from "node:crypto";

registerAgent({
  id: "specification_representation",
  name: "Specification Representation · Phase 1 · Ledger B additive",
  cognitive_layer: "infrastructure_registry",
  description:
    "Compiles founder prose into a structured SpecificationRepresentation. Distinguishes founder-stated from NEX-inferred claims. Refuses to fabricate target values. Emits SPECIFICATION_UNRESOLVED when ambiguous. Additive · does not modify existing extractor.",
});

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export type ResolutionStatus = "RESOLVED" | "PARTIALLY_RESOLVED" | "UNRESOLVED";
export type Provenance = "founder" | "nex_inferred" | "repository" | "extractor_pattern";
export type OutcomeKind = "return_value" | "throw" | "side_effect" | "no_change" | "unresolved";
export type OutcomeType = "number" | "string" | "boolean" | "object" | "array" | "null" | "undefined" | "unresolved";
export type TargetScope = "single_symbol" | "multi_symbol" | "file" | "module" | "unresolved";
export type ChangeKind =
  | "modify_return_literal"
  | "modify_condition"
  | "add_case"
  | "remove_case"
  | "modify_comparison"
  | "modify_math"
  | "add_property"
  | "remove_property"
  | "unresolved";

export interface ProvenanceClaim {
  readonly claim: string;
  readonly source: Provenance;
  readonly confidence: number; // 0..1
  readonly evidence: string | null;
}

export interface ExpectedBehaviourRepr {
  readonly condition: string | null;      // e.g., "when score is 3"
  readonly outcome_kind: OutcomeKind;
  readonly outcome_value: unknown;         // the expected value if determinable, else null
  readonly outcome_type: OutcomeType;
  readonly determinable: boolean;
  readonly source_pattern_id: string | null;
}

export interface RequiredChangeRepr {
  readonly kind: ChangeKind;
  readonly target_line: number | null;
  readonly before_value_hint: unknown;
  readonly after_value_hint: unknown;
  readonly confidence: number;
}

export interface AffectedScope {
  readonly primary_file: string | null;
  readonly additional_files: readonly string[];
  readonly scope: TargetScope;
}

export interface AcceptancePredicates {
  readonly fail_to_pass: readonly string[];    // predicates that MUST transition fail→pass
  readonly pass_to_pass: readonly string[];    // predicates that must remain passing
  readonly verification_hints: readonly string[]; // property-level hints
}

export interface SpecificationRepresentation {
  readonly spec_id: string;
  readonly version: string;
  readonly compiled_at_iso: string;

  // Founder-provided (verbatim)
  readonly raw_founder_goal: string;
  readonly target_source_file_provided: string | null;

  // NEX inference
  readonly objective: string;
  readonly target: {
    readonly subject: string | null;
    readonly scope: TargetScope;
    readonly symbols: readonly string[];
  };
  readonly affected_scope: AffectedScope;
  readonly expected_behaviours: readonly ExpectedBehaviourRepr[];
  readonly required_changes: readonly RequiredChangeRepr[];
  readonly forbidden_changes: readonly string[];
  readonly constraints: readonly string[];
  readonly acceptance_predicates: AcceptancePredicates;
  readonly ambiguities: readonly string[];
  readonly unknowns: readonly string[];
  readonly assumptions: readonly string[];

  // Provenance chain
  readonly provenance: readonly ProvenanceClaim[];

  // Overall status
  readonly resolution_status: ResolutionStatus;
  readonly refusal_reason: string | null;
  readonly zero_llm: true;
}

export interface CompileSpecInput {
  readonly founder_goal: string;
  readonly target_source_file?: string | null;
  readonly forbidden_paths?: readonly string[]; // e.g., safety-doctrine, pricing.ts
}

// ═══════════════════════════════════════════════════════════════════════
// SAFETY-BAKED FORBIDDEN PATHS · from existing NEX safety doctrine
// These are Claude-authored guardrails · disclosed openly
// NOT test-specific · they come from the frozen Fear layer's known list
// ═══════════════════════════════════════════════════════════════════════

const DEFAULT_FORBIDDEN_PATHS: readonly string[] = [
  "src/lib/pricing.ts",
  "src/lib/pricing/",
  "src/lib/nex-agent/code-engine/capability-fear.ts",
  "src/lib/nex-agent/code-engine/capability-concern.ts",
  "src/lib/nex-agent/code-engine/capability-afraid.ts",
  "docs/DECISIONS/",
  ".env",
];

// ═══════════════════════════════════════════════════════════════════════
// DETERMINISTIC OUTCOME TYPE INFERENCE
// ═══════════════════════════════════════════════════════════════════════

function inferOutcomeType(value: unknown): OutcomeType {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  switch (typeof value) {
    case "number": return "number";
    case "string": return "string";
    case "boolean": return "boolean";
    case "object": return Array.isArray(value) ? "array" : "object";
    default: return "unresolved";
  }
}

/**
 * Parse literal value from prose. Deterministic. Only extracts what founder
 * explicitly wrote. Returns { value, determinable, type } tuple.
 *
 * NO substitution of "reasonable defaults." If the prose does not contain
 * an explicit value, `determinable` is false.
 */
function parseExpectedValue(prose: string | null | undefined): {
  value: unknown;
  determinable: boolean;
  type: OutcomeType;
} {
  if (!prose) return { value: null, determinable: false, type: "unresolved" };
  const trimmed = String(prose).trim();

  // Explicit quoted string (double or single)
  const strMatch = trimmed.match(/^(["'])(.*?)\1$/);
  if (strMatch) return { value: strMatch[2], determinable: true, type: "string" };

  // Explicit number (integer or decimal, positive or negative)
  const numMatch = trimmed.match(/^-?\d+(\.\d+)?$/);
  if (numMatch) return { value: parseFloat(trimmed), determinable: true, type: "number" };

  // Explicit boolean
  if (/^(true|false)$/i.test(trimmed)) {
    return { value: trimmed.toLowerCase() === "true", determinable: true, type: "boolean" };
  }

  // Explicit null / undefined
  if (/^null$/i.test(trimmed)) return { value: null, determinable: true, type: "null" };
  if (/^undefined$/i.test(trimmed)) return { value: undefined, determinable: true, type: "undefined" };

  // Bareword that MIGHT be a string · low confidence · return determinable=true
  // but flagged via the caller as needing confirmation
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
    return { value: trimmed, determinable: true, type: "string" };
  }

  // Unable to determine
  return { value: null, determinable: false, type: "unresolved" };
}

// ═══════════════════════════════════════════════════════════════════════
// EXPECTED BEHAVIOUR CONVERSION
// ═══════════════════════════════════════════════════════════════════════

function convertExpectedBehaviour(eb: ExpectedBehaviour): ExpectedBehaviourRepr {
  // ExpectedBehaviour from extractor has: pattern_id, confidence, subject, expected_value, condition_text
  const parsed = parseExpectedValue(eb.expected_value as string | null | undefined);
  return {
    condition: (eb.condition_text as string | null) ?? null,
    outcome_kind: parsed.determinable ? "return_value" : "unresolved",
    outcome_value: parsed.value,
    outcome_type: parsed.type,
    determinable: parsed.determinable,
    source_pattern_id: (eb.pattern_id as string | null) ?? null,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// FAIL_TO_PASS PREDICATE GENERATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Compose fail-to-pass predicates from expected-behaviour records. Each
 * predicate is a string expression that a test-runner or verifier can
 * check. NOT generated code · a description of what must become true.
 *
 * If subject/condition/value are all present: emit a strict predicate.
 * If any is missing: emit UNRESOLVED marker so downstream never treats
 * a passing weak-test as satisfaction.
 */
function generateFailToPassPredicates(
  expected_behaviours: readonly ExpectedBehaviourRepr[],
  subject: string | null,
): readonly string[] {
  const preds: string[] = [];
  for (const eb of expected_behaviours) {
    if (!eb.determinable || !subject) {
      preds.push("UNRESOLVED_PREDICATE: expected_value not extractable from prose");
      continue;
    }
    const arg = eb.condition ? extractConditionArg(eb.condition) : null;
    if (arg === null) {
      preds.push("UNRESOLVED_PREDICATE: condition arg not extractable");
      continue;
    }
    const expr = `${subject}(${arg})`;
    const target = JSON.stringify(eb.outcome_value);
    preds.push(`${expr} === ${target}`);
  }
  return preds;
}

/**
 * Extract argument value from a condition like "when score is 3" or
 * "when level is 'medium'" — deterministic. Returns null if not extractable.
 */
function extractConditionArg(condition: string): string | null {
  // "when X is Y" · "with X Y" · "for X = Y" · "called with X Y" · direct value patterns
  const patterns = [
    /\bis\s+([^\s,;]+)/i,
    /\bwith\s+\w+\s+([^\s,;]+)/i,
    /=\s*([^\s,;]+)/,
    /called\s+with\s+\w+\s+([^\s,;]+)/i,
  ];
  for (const p of patterns) {
    const m = condition.match(p);
    if (m) {
      const raw = m[1].replace(/[.,;'"]$/, "").trim();
      const parsed = parseExpectedValue(raw);
      if (parsed.determinable) {
        return JSON.stringify(parsed.value);
      }
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// PROVENANCE CHAIN CONSTRUCTION
// ═══════════════════════════════════════════════════════════════════════

function buildProvenance(
  founder_goal: string,
  expected_behaviours: readonly ExpectedBehaviourRepr[],
  subject: string | null,
  target_file: string | null,
): readonly ProvenanceClaim[] {
  const chain: ProvenanceClaim[] = [];

  chain.push({
    claim: "raw_founder_goal",
    source: "founder",
    confidence: 1.0,
    evidence: founder_goal,
  });

  if (target_file) {
    chain.push({
      claim: `target_file=${target_file}`,
      source: "founder",
      confidence: 1.0,
      evidence: target_file,
    });
  }

  if (subject) {
    chain.push({
      claim: `subject=${subject}`,
      source: "nex_inferred",
      confidence: 0.7,
      evidence: "extracted via pattern matching against founder prose",
    });
  }

  for (const eb of expected_behaviours) {
    chain.push({
      claim: `expected_outcome_kind=${eb.outcome_kind}`,
      source: eb.determinable ? "nex_inferred" : "nex_inferred",
      confidence: eb.determinable ? 0.85 : 0.3,
      evidence: `pattern=${eb.source_pattern_id ?? "unknown"} condition=${eb.condition ?? "none"}`,
    });
  }

  return chain;
}

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════

export function compileSpecification(input: CompileSpecInput): SpecificationRepresentation {
  const raw = input.founder_goal ?? "";
  const target_file = input.target_source_file ?? null;

  // Reuse existing deterministic extractor (Stage 1 · frozen)
  const extraction = extractSpecification(raw);
  const classification = classifyExtraction(extraction);

  // Convert extracted behaviours to our representation
  const expected_behaviours: ExpectedBehaviourRepr[] = extraction.expected_behaviours.map(convertExpectedBehaviour);

  // Determine subject deterministically · first high-confidence subject found
  const subject = pickSubject(extraction.expected_behaviours);

  // Assemble target
  const target = {
    subject,
    scope: subject ? ("single_symbol" as TargetScope) : ("unresolved" as TargetScope),
    symbols: subject ? [subject] : [],
  };

  // Affected scope
  const affected_scope: AffectedScope = {
    primary_file: target_file,
    additional_files: [],
    scope: target.scope,
  };

  // Required changes (only when we have determinable expected values)
  const required_changes: RequiredChangeRepr[] = expected_behaviours
    .filter((eb) => eb.determinable)
    .map((eb) => ({
      kind: "modify_return_literal" as ChangeKind,
      target_line: null,
      before_value_hint: null, // known only after repo inspection
      after_value_hint: eb.outcome_value,
      confidence: 0.7,
    }));

  // Acceptance predicates
  const failToPass = generateFailToPassPredicates(expected_behaviours, subject);
  const acceptance_predicates: AcceptancePredicates = {
    fail_to_pass: failToPass,
    pass_to_pass: [
      `all_regression_tests_in_repo_unchanged`,
    ],
    verification_hints: [],
  };

  // Forbidden paths · combine defaults with input
  const forbidden_changes = [
    ...DEFAULT_FORBIDDEN_PATHS,
    ...(input.forbidden_paths ?? []),
  ];

  // Ambiguities and unknowns
  const ambiguities: string[] = [];
  const unknowns: string[] = [];

  if (expected_behaviours.length === 0) {
    unknowns.push("no_expected_behaviour_extracted");
  }
  for (const eb of expected_behaviours) {
    if (!eb.determinable) unknowns.push(`expected_value_not_determinable: pattern=${eb.source_pattern_id}`);
  }
  if (!subject) unknowns.push("target_subject_not_identifiable");
  if (!target_file) unknowns.push("target_source_file_not_provided_by_founder");

  // Failure-to-pass has UNRESOLVED tokens?
  const hasUnresolvedPredicate = failToPass.some((p) => p.startsWith("UNRESOLVED_PREDICATE"));
  if (hasUnresolvedPredicate) ambiguities.push("acceptance_predicate_incomplete");

  // Resolution status
  let resolution: ResolutionStatus;
  let refusal_reason: string | null = null;
  if (classification === "SPECIFICATION_INSUFFICIENT") {
    resolution = "UNRESOLVED";
    refusal_reason = "extractor_returned_SPECIFICATION_INSUFFICIENT";
  } else if (unknowns.length === 0 && ambiguities.length === 0 && failToPass.length > 0) {
    resolution = "RESOLVED";
  } else if (failToPass.some((p) => !p.startsWith("UNRESOLVED_PREDICATE"))) {
    resolution = "PARTIALLY_RESOLVED";
  } else {
    resolution = "UNRESOLVED";
    refusal_reason = "no_verifiable_fail_to_pass_predicate";
  }

  const provenance = buildProvenance(raw, expected_behaviours, subject, target_file);

  // Deterministic spec_id
  const specIdInput = JSON.stringify({
    raw,
    target_file,
    subject,
    expected_behaviours: expected_behaviours.map((eb) => ({
      condition: eb.condition,
      outcome_kind: eb.outcome_kind,
      outcome_value: eb.outcome_value,
    })),
  });
  const spec_id = "spec_" + crypto.createHash("sha256").update(specIdInput).digest("hex").slice(0, 16);

  return {
    spec_id,
    version: "spec-repr.v1.2026-09-19",
    compiled_at_iso: new Date().toISOString(),
    raw_founder_goal: raw,
    target_source_file_provided: target_file,
    objective: expected_behaviours.length > 0
      ? `Modify ${subject ?? "unknown_subject"} so that ${expected_behaviours[0].condition ?? "the condition"} yields ${JSON.stringify(expected_behaviours[0].outcome_value)}`
      : `objective_unresolved`,
    target,
    affected_scope,
    expected_behaviours,
    required_changes,
    forbidden_changes,
    constraints: ["no_new_dependencies", "preserve_public_api"],
    acceptance_predicates,
    ambiguities,
    unknowns,
    assumptions: [],
    provenance,
    resolution_status: resolution,
    refusal_reason,
    zero_llm: true,
  };
}

function pickSubject(behaviours: readonly ExpectedBehaviour[]): string | null {
  for (const b of behaviours) {
    const s = (b.subject as string | null | undefined) ?? null;
    if (s && s.length > 0) return s;
  }
  return null;
}

export const SPEC_REPRESENTATION_VERSION = "spec-repr.v1.2026-09-19";
