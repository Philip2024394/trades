// src/lib/nex-agent/code-engine/capability-class2-bridge.test.ts
//
// Vitest suite for Fix 24 (Class 2 Bridge) + Fix 24 assertion parser.
// Founder-authorised 2026-09-18.
//
// Discipline: deterministic; every case runs a pure function; no fixtures on
// disk; no network. Every test is a proof of a specific stated behaviour or
// refusal contract. The suite is intended to be executable via `vitest run
// src/lib/nex-agent/code-engine/capability-class2-bridge.test.ts`.

import { describe, expect, it } from "vitest";
import {
  parseVitestAssertion,
  VITEST_ASSERTION_PARSER_VERSION,
  VITEST_ASSERTION_PARSER_SUPPORTED_MATCHERS,
} from "./capability-vitest-assertion-parser";
import {
  composeExpectedBehaviourFromAssertion,
  CLASS2_BRIDGE_VERSION,
  CLASS2_BRIDGE_PATTERN_ID,
} from "./capability-class2-bridge";

// ─── Group A · parser positive shapes ────────────────────────────────────

describe("parseVitestAssertion · positive shapes", () => {
  it("A1 · parses simple call form with .property and numeric toBe", () => {
    const r = parseVitestAssertion("expect(computeWorkerPool().size).toBe(3)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.call_target).toBe("computeWorkerPool");
    expect(r.is_call_form).toBe(true);
    expect(r.argument_list_verbatim).toBe("");
    expect(r.property_path).toEqual(["size"]);
    expect(r.matcher).toBe("toBe");
    expect(r.expected_normalised).toBe("3");
    expect(r.expected_is_simple_primitive).toBe(true);
    expect(r.evidence_kind).toBe("OBSERVED");
  });

  it("A2 · parses single-arg call with numeric outcome", () => {
    const r = parseVitestAssertion("expect(compute(5)).toBe(42)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.call_target).toBe("compute");
    expect(r.is_call_form).toBe(true);
    expect(r.argument_list_verbatim).toBe("5");
    expect(r.property_path).toEqual([]);
    expect(r.expected_normalised).toBe("42");
  });

  it("A3 · parses toEqual with double-quoted string", () => {
    const r = parseVitestAssertion(`expect(greet()).toEqual("hi")`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.matcher).toBe("toEqual");
    expect(r.expected_normalised).toBe("hi");
  });

  it("A4 · parses toStrictEqual with boolean true", () => {
    const r = parseVitestAssertion("expect(isReady()).toStrictEqual(true)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.matcher).toBe("toStrictEqual");
    expect(r.expected_normalised).toBe("true");
  });

  it("A5 · parses multi-level property path", () => {
    const r = parseVitestAssertion("expect(getConfig().http.timeout).toBe(3000)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.property_path).toEqual(["http", "timeout"]);
    expect(r.expected_normalised).toBe("3000");
  });

  it("A6 · normalises leading + on positive zero (Fix 22 shape)", () => {
    const r = parseVitestAssertion("expect(sign()).toBe(+0)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.expected_normalised).toBe("0");
  });

  it("A7 · accepts negative numeric literal", () => {
    const r = parseVitestAssertion("expect(offset()).toBe(-7)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.expected_normalised).toBe("-7");
  });

  it("A8 · handles surrounding whitespace", () => {
    const r = parseVitestAssertion("  expect( fn() ).toBe(  1  )  ");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.call_target).toBe("fn");
    expect(r.expected_normalised).toBe("1");
  });
});

// ─── Group B · parser refusal shapes ─────────────────────────────────────

describe("parseVitestAssertion · refusal shapes", () => {
  it("B1 · refuses empty input", () => {
    const r = parseVitestAssertion("");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refusal_kind).toBe("empty_input");
  });

  it("B2 · refuses missing expect(", () => {
    const r = parseVitestAssertion("assert(x).eq(3)");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refusal_kind).toBe("no_expect_call");
  });

  it("B3 · refuses unbalanced parens", () => {
    const r = parseVitestAssertion("expect(fn().size).toBe(3");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refusal_kind).toBe("unbalanced_parens");
  });

  it("B4 · refuses .not chain (v1 unsupported)", () => {
    const r = parseVitestAssertion("expect(fn()).not.toBe(3)");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refusal_kind).toBe("unsupported_matcher");
  });

  it("B5 · refuses unknown matcher (v1)", () => {
    const r = parseVitestAssertion("expect(fn()).toBeGreaterThan(3)");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refusal_kind).toBe("unsupported_matcher");
  });

  it("B6 · refuses empty matcher arg", () => {
    const r = parseVitestAssertion("expect(fn()).toBe()");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refusal_kind).toBe("no_expected_argument");
  });
});

// ─── Group C · bridge composition · success ──────────────────────────────

describe("composeExpectedBehaviourFromAssertion · success", () => {
  it("C1 · composes for niladic call with .size", () => {
    const r = composeExpectedBehaviourFromAssertion({
      assertion_source: "expect(computeWorkerPool().size).toBe(3)",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.expected_behaviour.subject).toBe("computeWorkerPool");
    expect(r.expected_behaviour.outcome_subject).toBe("size");
    expect(r.expected_behaviour.expected_value).toBe("3");
    expect(r.expected_behaviour.condition_value).toBe(null);
    expect(r.expected_behaviour.assertion_form).toBe("explicit");
    expect(r.expected_behaviour.confidence).toBe("high");
    expect(r.expected_behaviour.evidence_kind).toBe("OBSERVED");
    expect(r.expected_behaviour.pattern_id).toBe(CLASS2_BRIDGE_PATTERN_ID);
    expect(r.synthesised_prose).toBe(
      "When computeWorkerPool is called, size should be 3.",
    );
  });

  it("C2 · composes for single-arg call, no property path", () => {
    const r = composeExpectedBehaviourFromAssertion({
      assertion_source: "expect(compute(5)).toBe(42)",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.expected_behaviour.subject).toBe("compute");
    expect(r.expected_behaviour.outcome_subject).toBe(null);
    expect(r.expected_behaviour.expected_value).toBe("42");
    expect(r.expected_behaviour.condition_value).toBe("5");
    // Fix 33 · 2026-09-18 · P9 shape for bare direct-return
    // (`expect(fn()).toBe(N)`) so the extractor knows outcome_subject is null
    // and the generator emits `expect(result)` instead of `expect(result.<x>)`.
    expect(r.synthesised_prose).toBe(
      "When compute is called, it should return 42.",
    );
  });

  it("C3 · cross-check Fix J expected matches matcher argument", () => {
    const r = composeExpectedBehaviourFromAssertion({
      assertion_source: "expect(fn().value).toBe(42)",
      fix_j_expected: "42",
    });
    expect(r.ok).toBe(true);
  });

  it("C4 · cross-check exported function present", () => {
    const r = composeExpectedBehaviourFromAssertion({
      assertion_source: "expect(myFn()).toBe(1)",
      target_exported_functions: ["myFn", "other"],
    });
    expect(r.ok).toBe(true);
  });

  it("C5 · provenance carries matcher + parser version + q8 id", () => {
    const r = composeExpectedBehaviourFromAssertion({
      assertion_source: "expect(fn().size).toBe(3)",
      q8_selected_candidate_id: "candidate-abc",
      test_file_hint: "src/lib/x.test.ts",
      test_line: 12,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.provenance.parser_version).toBe("fix24.v1");
    expect(r.provenance.matcher).toBe("toBe");
    expect(r.provenance.q8_selected_candidate_id).toBe("candidate-abc");
    expect(r.provenance.test_file).toBe("src/lib/x.test.ts");
    expect(r.provenance.test_line).toBe(12);
  });
});

// ─── Group D · bridge composition · refusal ──────────────────────────────

describe("composeExpectedBehaviourFromAssertion · refusal", () => {
  it("D1 · refuses empty assertion", () => {
    const r = composeExpectedBehaviourFromAssertion({ assertion_source: "" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refusal_kind).toBe("empty_assertion");
  });

  it("D2 · refuses when parser refuses (unsupported matcher)", () => {
    const r = composeExpectedBehaviourFromAssertion({
      assertion_source: "expect(fn()).toBeGreaterThan(3)",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refusal_kind).toBe("assertion_parse_refused");
    expect(r.detail).toContain("unsupported_matcher");
  });

  it("D3 · refuses non-primitive expected (object literal)", () => {
    const r = composeExpectedBehaviourFromAssertion({
      assertion_source: "expect(fn()).toEqual({size: 3})",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refusal_kind).toBe("expected_not_primitive");
  });

  it("D4 · refuses mismatch between Fix J expected and matcher arg", () => {
    const r = composeExpectedBehaviourFromAssertion({
      assertion_source: "expect(fn()).toBe(3)",
      fix_j_expected: "7",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refusal_kind).toBe("expected_mismatch_between_fix_j_and_matcher");
  });

  it("D5 · refuses when call target not in exported list", () => {
    const r = composeExpectedBehaviourFromAssertion({
      assertion_source: "expect(unknownFn()).toBe(1)",
      target_exported_functions: ["realFn", "another"],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refusal_kind).toBe("call_target_not_exported");
  });

  it("D6 · refuses bare identifier with no call and no property path", () => {
    const r = composeExpectedBehaviourFromAssertion({
      assertion_source: "expect(value).toBe(1)",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refusal_kind).toBe("not_call_form_and_no_property_path");
  });
});

// ─── Group E · determinism + version markers ─────────────────────────────

describe("determinism + versioning", () => {
  it("E1 · same input twice produces byte-identical output", () => {
    const a = composeExpectedBehaviourFromAssertion({
      assertion_source: "expect(computeWorkerPool().size).toBe(3)",
    });
    const b = composeExpectedBehaviourFromAssertion({
      assertion_source: "expect(computeWorkerPool().size).toBe(3)",
    });
    expect(a).toEqual(b);
  });

  it("E2 · parser version marker is fix24.v1", () => {
    expect(VITEST_ASSERTION_PARSER_VERSION).toBe("fix24.v1");
  });

  it("E3 · bridge version marker is fix24.v1", () => {
    expect(CLASS2_BRIDGE_VERSION).toBe("fix24.v1");
  });

  it("E4 · supported matchers are exactly toBe / toEqual / toStrictEqual", () => {
    expect(VITEST_ASSERTION_PARSER_SUPPORTED_MATCHERS).toEqual([
      "toBe",
      "toEqual",
      "toStrictEqual",
    ]);
  });
});

// ─── Group F · round-trip provenance for downstream consumers ────────────

describe("round-trip · ExpectedBehaviour fields present", () => {
  it("F1 · every field required by the verification-case-generator refusal contract is populated", () => {
    // The generator refuses if assertion_form !== 'explicit' OR
    // expected_value === null OR subject falsy. All must be set.
    const r = composeExpectedBehaviourFromAssertion({
      assertion_source: "expect(fn().size).toBe(3)",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.expected_behaviour.assertion_form).toBe("explicit");
    expect(r.expected_behaviour.expected_value).not.toBe(null);
    expect(r.expected_behaviour.subject).toBeTruthy();
  });
});
