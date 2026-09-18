// src/lib/nex-agent/code-engine/capability-specification-extractor.ts
//
// NEX1 · Deterministic Specification Extractor · zero LLM · READ-ONLY.
// Founder-authorised 2026-09-17 · Specification-Driven Coding Capability.
//
// PURPOSE
//   Transform a founder's natural-language coding request into a structured
//   list of expected-behaviour records that a downstream generator can turn
//   into real vitest cases. Deterministic regex-driven · no external model ·
//   honest INSUFFICIENT_SPECIFICATION boundary when prose lacks an explicit
//   expected value.
//
// GENERALIZED · NOT DOMAIN-SPECIFIC
//   · Handles patterns like:
//     "When X is Y, Z should be W"
//     "When X is Y, Z must be W"
//     "For X = Y, expect Z = W"
//     "receiving an incorrect X when Y" (case-only · no explicit expected)
//   · NEVER inference or synthesis of implicit expected values
//   · NEVER LLM · NEVER synonym engine
//   · NEVER hard-codes any domain term (staircase · quantity · pricing · etc)
//
// NON-GOALS
//   · Full NLP · sentence parsing · semantic reasoning — deferred to
//     future authorized capability if the founder decides
//   · Generating expected values from context clues (would require inference)
//   · Cross-sentence coreference resolution
//   · Anaphora resolution
//
// OUTPUT DISCIPLINE
//   · confidence: "high" ⇔ explicit subject + condition + expected all found
//   · confidence: "medium" ⇔ subject + condition found · expected inferred
//     from limited canonical vocabulary (e.g. "empty" · "null" · "true" ·
//     "false") without LLM
//   · confidence: "insufficient" ⇔ case identified without explicit expected

// ── Public shape ─────────────────────────────────────────────────────────

export type SpecificationConfidence = "high" | "medium" | "insufficient";

export type AssertionForm = "explicit" | "case_only" | "insufficient";

export interface ExpectedBehaviour {
  /** The originating clause from the founder_goal · verbatim substring. */
  readonly statement: string;
  /** The subject noun (e.g., function name · variable · parameter reference)
   *  extracted from the "when [X] is [Y]" clause. Case-insensitive lookup ·
   *  original case preserved. */
  readonly subject: string | null;
  /** The condition value · verbatim from prose (e.g. "zero" · "empty" · "'5'"). */
  readonly condition_value: string | null;
  /** The output-side subject (e.g. "total" · "result"). */
  readonly outcome_subject: string | null;
  /** The expected outcome value · verbatim from prose · null when not stated. */
  readonly expected_value: string | null;
  readonly assertion_form: AssertionForm;
  readonly confidence: SpecificationConfidence;
  readonly source_span: { readonly start: number; readonly end: number };
  readonly pattern_id: string;
  readonly evidence_kind: "OBSERVED";
}

export interface ExtractSpecificationResult {
  readonly ok: true;
  readonly expected_behaviours: readonly ExpectedBehaviour[];
  readonly stats: {
    readonly total_patterns_tested: number;
    readonly matches_high: number;
    readonly matches_medium: number;
    readonly matches_insufficient: number;
    readonly total_length: number;
    readonly capped_by: string;
  };
  readonly zero_llm: true;
  readonly evidence_kind: "OBSERVED";
}

// ── Constants ────────────────────────────────────────────────────────────

const MAX_INPUT_LENGTH = 20_000;
const MAX_MATCHES = 50;

/** Canonical "empty" / "not present" values that can be inferred without LLM.
 *  These are language-level constants (not domain vocabulary). */
const CANONICAL_ABSENT_VALUES = new Set([
  "empty",
  "null",
  "undefined",
  "none",
  "nothing",
  "nil",
]);

const CANONICAL_BOOLEAN_TRUE = new Set(["true", "truthy", "yes"]);
const CANONICAL_BOOLEAN_FALSE = new Set(["false", "falsy", "no"]);

// ── Pattern registry · deterministic · ordered · non-overlapping ────────

interface PatternDef {
  readonly id: string;
  /** MUST have global (g) flag · MUST have case-insensitive (i) flag.
   *  Named capture groups: subject · condition · outcome · expected. */
  readonly regex: RegExp;
  readonly assertion_form: AssertionForm;
  readonly base_confidence: SpecificationConfidence;
}

// Pattern definitions · ordered from most-specific to least-specific.
// Each pattern targets ONE English construction · zero domain-specific terms.
const PATTERNS: readonly PatternDef[] = [
  // P1: "When [subject] is [value], [outcome] should be [expected]"
  {
    id: "P1_when_is_should_be",
    regex:
      /when\s+(?:the\s+)?(?<subject>[a-zA-Z_][\w-]*)\s+is\s+(?<condition>[^,.]+?)\s*[,.]\s+(?:the\s+)?(?<outcome>[a-zA-Z_][\w-]*)\s+should\s+be\s+(?<expected>[^,.]+?)[.,\n]/gi,
    assertion_form: "explicit",
    base_confidence: "high",
  },
  // P2: "When [subject] is [value], [outcome] must be [expected]"
  {
    id: "P2_when_is_must_be",
    regex:
      /when\s+(?:the\s+)?(?<subject>[a-zA-Z_][\w-]*)\s+is\s+(?<condition>[^,.]+?)\s*[,.]\s+(?:the\s+)?(?<outcome>[a-zA-Z_][\w-]*)\s+must\s+be\s+(?<expected>[^,.]+?)[.,\n]/gi,
    assertion_form: "explicit",
    base_confidence: "high",
  },
  // P3: "When [subject] is [value], [outcome] should return [expected]"
  {
    id: "P3_when_is_should_return",
    regex:
      /when\s+(?:the\s+)?(?<subject>[a-zA-Z_][\w-]*)\s+is\s+(?<condition>[^,.]+?)\s*[,.]\s+(?:the\s+)?(?<outcome>[a-zA-Z_][\w-]*)\s+should\s+return\s+(?<expected>[^,.]+?)[.,\n]/gi,
    assertion_form: "explicit",
    base_confidence: "high",
  },
  // P4: "For [subject] = [value], expect [outcome] = [expected]" (equation form)
  {
    id: "P4_equation_form",
    regex:
      /for\s+(?<subject>[a-zA-Z_][\w-]*)\s*[=:]\s*(?<condition>[^,]+?)\s*,\s*expect(?:ed)?\s+(?<outcome>[a-zA-Z_][\w-]*)\s*[=:]\s*(?<expected>[^,.]+?)[.,\n]/gi,
    assertion_form: "explicit",
    base_confidence: "high",
  },
  // P5: "[outcome] should [verb] when [subject] is [condition]" (post-position)
  {
    id: "P5_should_when_post",
    regex:
      /(?:the\s+)?(?<outcome>[a-zA-Z_][\w-]*)\s+should\s+(?:be\s+|return\s+|equal\s+)(?<expected>[^,.]+?)\s+when\s+(?:the\s+)?(?<subject>[a-zA-Z_][\w-]*)\s+is\s+(?<condition>[^,.]+?)[.,\n]/gi,
    assertion_form: "explicit",
    base_confidence: "high",
  },
  // P6: "When [subject] is [value], [outcome] must be rejected/denied/refused"
  //     Recognizes rejection semantics without a value.
  {
    id: "P6_rejection",
    regex:
      /when\s+(?:the\s+)?(?<subject>[a-zA-Z_][\w-]*)\s+is\s+(?<condition>[^,.]+?)\s*[,.]\s+(?:the\s+)?(?<outcome>[a-zA-Z_][\w-]*)\s+(?:must|should)\s+be\s+(?<expected>rejected|denied|refused|forbidden)[.,\n]/gi,
    assertion_form: "explicit",
    base_confidence: "high",
  },
  // P7: CASE-ONLY · "receiving an incorrect [outcome] when [subject] is [condition]"
  //     Emits an ExpectedBehaviour with condition but null expected · flags
  //     as INSUFFICIENT because prose describes wrongness without correctness.
  {
    id: "P7_incorrect_when_case_only",
    regex:
      /(?:receiving|getting|producing|returning)\s+(?:an?\s+)?incorrect\s+(?<outcome>[a-zA-Z_][\w-]*)\s+when\s+(?:the\s+)?(?<subject>[a-zA-Z_][\w-]*)\s+is\s+(?<condition>[^,.]+?)[.,\n]/gi,
    assertion_form: "case_only",
    base_confidence: "insufficient",
  },
  // P8: "[subject] must not throw / must be defined / must exist" · limited canonical patterns
  {
    id: "P8_must_not_throw",
    regex:
      /(?:the\s+)?(?<subject>[a-zA-Z_][\w-]*)\s+must\s+not\s+throw[.,\n]/gi,
    assertion_form: "explicit",
    base_confidence: "medium",
  },
  // P9 · Fix 33 · 2026-09-18 · BARE DIRECT-RETURN SEMANTICS.
  // "When [subject] is called, it should return [expected]"
  // Emits an ExpectedBehaviour with outcome_subject === null so downstream
  // consumers know the assertion is on the direct return value (no member
  // access). Load-bearing for functions like `emotionCheck() { return 7; }`
  // where the assertion is `expect(emotionCheck()).toBe(42)` — no property.
  {
    id: "P9_when_called_should_return",
    regex:
      /when\s+(?:the\s+)?(?<subject>[a-zA-Z_][\w-]*)\s+is\s+called\s*[,.]\s+it\s+should\s+return\s+(?<expected>[^,.]+?)[.,\n]/gi,
    assertion_form: "explicit",
    base_confidence: "high",
  },
];

// ── Utilities ────────────────────────────────────────────────────────────

/** Normalize an expected-value clause to a canonical form when possible.
 *  Deterministic · language-level · no domain reasoning.
 *  Returns:
 *    - "0" / "1" / "true" / "false" / "[]" / "null" / "undefined" when it maps
 *    - the input trimmed otherwise (verbatim · never invented) */
function normalizeExpectedValue(v: string): string {
  const trimmed = v.trim().replace(/^[\s"'`]+|[\s"'`]+$/g, "");
  const lower = trimmed.toLowerCase();
  // Digit-word to digit · language-level (English number-word conversion is
  // NOT domain-specific · it's a limited canonical vocabulary).
  const digitWords: Record<string, string> = {
    zero: "0",
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
    ten: "10",
  };
  if (digitWords[lower]) return digitWords[lower];
  if (CANONICAL_ABSENT_VALUES.has(lower)) return lower === "empty" ? "[]" : lower;
  if (CANONICAL_BOOLEAN_TRUE.has(lower)) return "true";
  if (CANONICAL_BOOLEAN_FALSE.has(lower)) return "false";
  return trimmed;
}

/** Determine if an expected value is numerically-typed after normalization. */
function isNumericExpected(normalized: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(normalized);
}

// ── Entry point ──────────────────────────────────────────────────────────

export function extractSpecification(founder_goal: string): ExtractSpecificationResult {
  const total_length = founder_goal.length;
  const cappedInput = founder_goal.slice(0, MAX_INPUT_LENGTH);
  const capped_by = total_length > MAX_INPUT_LENGTH ? `input_truncated_at_${MAX_INPUT_LENGTH}` : "natural";

  const behaviours: ExpectedBehaviour[] = [];
  const stats = {
    total_patterns_tested: PATTERNS.length,
    matches_high: 0,
    matches_medium: 0,
    matches_insufficient: 0,
  };

  for (const pattern of PATTERNS) {
    // Reset regex state · defensive
    pattern.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    let matchesForThisPattern = 0;
    while (
      (m = pattern.regex.exec(cappedInput)) !== null &&
      behaviours.length < MAX_MATCHES &&
      matchesForThisPattern < 20
    ) {
      matchesForThisPattern++;
      const groups = m.groups ?? {};
      const subject = groups.subject?.trim() ?? null;
      const condition_value = groups.condition ? normalizeExpectedValue(groups.condition) : null;
      const outcome_subject = groups.outcome?.trim() ?? null;
      const expectedRaw = groups.expected?.trim() ?? null;
      const expected_value = expectedRaw ? normalizeExpectedValue(expectedRaw) : null;

      let confidence: SpecificationConfidence;
      if (pattern.assertion_form === "case_only") {
        confidence = "insufficient";
      } else if (pattern.assertion_form === "explicit" && expected_value !== null && subject && outcome_subject) {
        confidence = "high";
      } else if (
        // Fix 33 · P9 direct-return: outcome_subject is deliberately null.
        // Confidence stays "high" when subject + expected_value are present
        // AND the pattern is P9 (bare direct-return semantics recognised).
        pattern.id === "P9_when_called_should_return" &&
        pattern.assertion_form === "explicit" &&
        expected_value !== null &&
        subject
      ) {
        confidence = "high";
      } else if (pattern.assertion_form === "explicit") {
        confidence = "medium";
      } else {
        confidence = pattern.base_confidence;
      }

      behaviours.push({
        statement: m[0].trim(),
        subject,
        condition_value,
        outcome_subject,
        expected_value,
        assertion_form: pattern.assertion_form,
        confidence,
        source_span: {
          start: m.index,
          end: m.index + m[0].length,
        },
        pattern_id: pattern.id,
        evidence_kind: "OBSERVED",
      });

      if (confidence === "high") stats.matches_high++;
      else if (confidence === "medium") stats.matches_medium++;
      else stats.matches_insufficient++;
    }
  }

  // Deterministic sort · by source_span.start then pattern_id
  behaviours.sort((a, b) => {
    if (a.source_span.start !== b.source_span.start) return a.source_span.start - b.source_span.start;
    return a.pattern_id.localeCompare(b.pattern_id);
  });

  return {
    ok: true,
    expected_behaviours: behaviours,
    stats: {
      ...stats,
      total_length,
      capped_by,
    },
    zero_llm: true,
    evidence_kind: "OBSERVED",
  };
}

/** Utility · classify overall extraction result. */
export function classifyExtraction(result: ExtractSpecificationResult):
  | "SPECIFICATION_HIGH_CONFIDENCE"
  | "SPECIFICATION_PARTIAL"
  | "SPECIFICATION_INSUFFICIENT" {
  if (result.stats.matches_high > 0) return "SPECIFICATION_HIGH_CONFIDENCE";
  if (result.stats.matches_medium > 0) return "SPECIFICATION_PARTIAL";
  return "SPECIFICATION_INSUFFICIENT";
}

/** Introspection helper · exposes pattern IDs for verifier tests. */
export function getRegisteredPatternIds(): readonly string[] {
  return PATTERNS.map((p) => p.id);
}

/** Introspection helper · exposes normalized-value function for verifiers. */
export function _testNormalizeExpectedValue(v: string): string {
  return normalizeExpectedValue(v);
}

export { isNumericExpected };
