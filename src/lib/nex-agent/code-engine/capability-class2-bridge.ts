// src/lib/nex-agent/code-engine/capability-class2-bridge.ts
//
// NEX1 · Fix 24 · Class 2 Bridge · Failing-Test → ExpectedBehaviour.
// Founder-authorised 2026-09-18.
//
// PURPOSE
//   Given (a) a failing-test source string with a supported vitest assertion,
//   and (b) optional context from Q8 / Fix 12 / Fix 10, deterministically
//   compose an ExpectedBehaviour object of the exact shape consumed by the
//   existing spec-driven-loop's verification-case-generator.
//
//   This bridge is a pure translator. It does not run vitest, does not modify
//   any file, does not invoke LLMs, does not extend Q8, does not touch
//   Schema V1 or the coding loop. It just packs already-observed evidence
//   into a shape the existing loop already accepts.
//
// ARCHITECTURAL DECISION (per Pre-Build Audit 2026-09-18)
//   D1 — matcher scope: v1 supports toBe / toEqual / toStrictEqual with a
//        simple primitive expected value. Everything else refused cleanly.
//   D2 — coexistence: not decided in code. The bridge is called only when
//        the coding loop's own extractor has already returned
//        SPECIFICATION_INSUFFICIENT AND the caller has decided per policy
//        that the bridge should be attempted. This module does not make
//        the policy choice; it only performs the translation.
//   D3 — precondition strictness: all documented preconditions must hold,
//        else refuse. Fallback is loud, not silent.
//
// EVIDENCE_KIND
//   The composed ExpectedBehaviour carries evidence_kind: "OBSERVED" because
//   every field is a verbatim copy or a deterministic parse of a real vitest
//   assertion string produced by Fix J. Nothing is inferred.
//
// SAFETY
//   · Deterministic, zero LLM, zero network.
//   · Never modifies files.
//   · Refuses on any unsupported matcher, non-primitive expected value,
//     ambiguous subject, or missing input.
//   · R11-B unaffected: this bridge does NOT create retrieved evidence; it
//     translates a currently-observed failing test into a spec input for
//     the existing verified coding loop.

import type { ExpectedBehaviour } from "./capability-specification-extractor";
import {
  parseVitestAssertion,
  type ParsedAssertion,
  type ParseAssertionResult,
} from "./capability-vitest-assertion-parser";

// ── Public shape ─────────────────────────────────────────────────────────

export interface Class2BridgeInput {
  /** Raw assertion source, e.g. `expect(computeWorkerPool().size).toBe(3)`.
   *  This is what Fix J emits at `Nex1RuntimeFailureFinding.assertion`. */
  readonly assertion_source: string;
  /** Optional expected-value verbatim from Fix J. When present it is
   *  cross-checked against the parsed matcher argument for provenance. */
  readonly fix_j_expected?: string | null;
  /** Optional test file path (repo-relative). Used only for provenance. */
  readonly test_file_hint?: string | null;
  /** Optional line info for provenance. */
  readonly test_line?: number | null;
  /** Optional list of exported functions discovered by Fix 10 source
   *  inspection of the target source file. When provided, the bridge
   *  cross-checks that the parsed call target is in this set; when omitted,
   *  this precondition is skipped (spec-driven-loop's own
   *  `findFunctionCandidates` will catch any mismatch downstream). */
  readonly target_exported_functions?: readonly string[];
  /** Optional Q8 selected candidate id — provenance only. */
  readonly q8_selected_candidate_id?: string | null;
}

export type Class2BridgeRefusalKind =
  | "empty_assertion"
  | "assertion_parse_refused"
  | "expected_not_primitive"
  | "expected_mismatch_between_fix_j_and_matcher"
  | "call_target_not_exported"
  | "not_call_form_and_no_property_path";

export interface Class2BridgeRefusal {
  readonly ok: false;
  readonly refusal_kind: Class2BridgeRefusalKind;
  readonly detail: string;
  readonly source_assertion: string;
}

export interface Class2BridgeSuccess {
  readonly ok: true;
  readonly evidence_kind: "OBSERVED";
  readonly expected_behaviour: ExpectedBehaviour;
  /** Verbatim synthesised prose in the exact form the existing extractor
   *  accepts, useful when a caller wants to hand the loop a prose input
   *  instead of a structured behaviour list. Example:
   *  `"When computeWorkerPool is called, size should be 3."` */
  readonly synthesised_prose: string;
  /** Diagnostic provenance for auditing. */
  readonly provenance: {
    readonly parser_version: "fix24.v1";
    readonly matcher: "toBe" | "toEqual" | "toStrictEqual";
    readonly source_assertion: string;
    readonly test_file: string | null;
    readonly test_line: number | null;
    readonly call_target: string;
    readonly property_path: readonly string[];
    readonly expected_normalised: string;
    readonly q8_selected_candidate_id: string | null;
  };
}

export type Class2BridgeResult = Class2BridgeSuccess | Class2BridgeRefusal;

// ── Implementation ───────────────────────────────────────────────────────

const BRIDGE_PATTERN_ID = "CLASS2_BRIDGE_ASSERTION_MISMATCH";

/** Compose an ExpectedBehaviour from a failing vitest assertion.
 *  Pure function. Zero LLM. Zero side effects.
 */
export function composeExpectedBehaviourFromAssertion(
  input: Class2BridgeInput,
): Class2BridgeResult {
  const raw = typeof input.assertion_source === "string" ? input.assertion_source : "";
  if (raw.trim() === "") {
    return {
      ok: false,
      refusal_kind: "empty_assertion",
      detail: "assertion_source is empty",
      source_assertion: raw,
    };
  }

  const parsed: ParseAssertionResult = parseVitestAssertion(raw);
  if (!parsed.ok) {
    return {
      ok: false,
      refusal_kind: "assertion_parse_refused",
      detail: `parser refused: ${parsed.refusal_kind} · ${parsed.detail}`,
      source_assertion: raw,
    };
  }

  const p: ParsedAssertion = parsed;

  if (!p.expected_is_simple_primitive || p.expected_normalised === null) {
    return {
      ok: false,
      refusal_kind: "expected_not_primitive",
      detail:
        `expected literal is not a simple primitive: ${JSON.stringify(p.expected_literal_verbatim)}`,
      source_assertion: raw,
    };
  }

  // If Fix J supplied an `expected` field separately, cross-check that it
  // agrees with the parsed matcher argument. Mismatch → refuse (evidence
  // conflict).
  if (
    typeof input.fix_j_expected === "string" &&
    input.fix_j_expected.trim() !== "" &&
    input.fix_j_expected.trim() !== p.expected_literal_verbatim &&
    input.fix_j_expected.trim() !== p.expected_normalised
  ) {
    return {
      ok: false,
      refusal_kind: "expected_mismatch_between_fix_j_and_matcher",
      detail:
        `Fix J expected=${JSON.stringify(input.fix_j_expected)} but matcher argument=${
          JSON.stringify(p.expected_literal_verbatim)
        }`,
      source_assertion: raw,
    };
  }

  // Optional cross-check: call_target must be in the exported-function list
  // when the caller supplied one.
  if (input.target_exported_functions && input.target_exported_functions.length > 0) {
    if (!input.target_exported_functions.includes(p.call_target)) {
      return {
        ok: false,
        refusal_kind: "call_target_not_exported",
        detail:
          `parsed call target ${JSON.stringify(p.call_target)} is not in the target file's exported functions (${
            input.target_exported_functions.length
          } exported)`,
        source_assertion: raw,
      };
    }
  }

  // For v1: require either a call form OR a non-empty property path. This
  // matches the shapes the spec-driven-loop's verification-case-generator
  // can turn into a real test (`fn(arg).field` or `fn(arg)` directly).
  if (!p.is_call_form && p.property_path.length === 0) {
    return {
      ok: false,
      refusal_kind: "not_call_form_and_no_property_path",
      detail:
        `expect(<bare-identifier>).<matcher>(...) shape has no target to invoke; v1 requires a call form or a property path`,
      source_assertion: raw,
    };
  }

  // Compose fields.
  // subject: the function to invoke. Always p.call_target.
  const subject = p.call_target;

  // outcome_subject: last element of property_path when present. Null when
  // no property access (assertion checks the direct return value). Note the
  // existing verification-case-generator (see line 349 there) uses
  // outcome_subject only for disambiguation when multiple candidates match;
  // it's not mandatory.
  const outcome_subject = p.property_path.length > 0
    ? p.property_path[p.property_path.length - 1]
    : null;

  // condition_value: the argument value passed to the call, if any.
  // The existing generator uses condition_value ?? "1" as the argument, so:
  //   - empty argument list (`fn()`)  → null → default "1" downstream
  //   - single simple argument (`fn(5)`) → the argument, verbatim trimmed
  //   - anything else → null (safe default)
  let condition_value: string | null = null;
  if (p.is_call_form && p.argument_list_verbatim !== null) {
    const args = p.argument_list_verbatim.trim();
    if (args === "") {
      condition_value = null;
    } else if (!args.includes(",") && !args.includes("(") && !args.includes("{") && !args.includes("[")) {
      // Single simple arg
      condition_value = args;
    } else {
      condition_value = null;
    }
  }

  // Synthesised statement matching the extractor's canonical prose form.
  //
  // Fix 33 · 2026-09-18 · shape selection:
  //   - When property_path is non-empty (`expect(fn().field).toBe(N)`), emit
  //     the P1 shape: "When <subject> is called, <outcome> should be <N>."
  //   - When property_path is empty (`expect(fn()).toBe(N)`), emit the P9
  //     shape: "When <subject> is called, it should return <N>." This
  //     signals BARE DIRECT-RETURN to the extractor, which sets
  //     outcome_subject=null so the generator produces `expect(result)`
  //     rather than `expect(result.<placeholder>)`.
  const synthesised_prose =
    outcome_subject !== null
      ? `When ${subject} is called, ${outcome_subject} should be ${p.expected_normalised}.`
      : `When ${subject} is called, it should return ${p.expected_normalised}.`;

  const expected_behaviour: ExpectedBehaviour = {
    statement: synthesised_prose,
    subject,
    condition_value,
    outcome_subject,
    expected_value: p.expected_normalised,
    assertion_form: "explicit",
    confidence: "high",
    source_span: { start: 0, end: synthesised_prose.length },
    pattern_id: BRIDGE_PATTERN_ID,
    evidence_kind: "OBSERVED",
  };

  return {
    ok: true,
    evidence_kind: "OBSERVED",
    expected_behaviour,
    synthesised_prose,
    provenance: {
      parser_version: "fix24.v1",
      matcher: p.matcher,
      source_assertion: raw,
      test_file: input.test_file_hint ?? null,
      test_line: input.test_line ?? null,
      call_target: p.call_target,
      property_path: p.property_path,
      expected_normalised: p.expected_normalised,
      q8_selected_candidate_id: input.q8_selected_candidate_id ?? null,
    },
  };
}

export const CLASS2_BRIDGE_VERSION = "fix24.v1";
export const CLASS2_BRIDGE_PATTERN_ID = BRIDGE_PATTERN_ID;
