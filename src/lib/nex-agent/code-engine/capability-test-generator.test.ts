import { describe, it, expect } from "vitest";
import { generateTestFile, TEST_GENERATOR_VERSION } from "./capability-test-generator";
import type { SpecificationRepresentation } from "./capability-spec-representation";

function stubSpec(over: Partial<SpecificationRepresentation> = {}): SpecificationRepresentation {
  return {
    spec_id: "spec_test_gen",
    version: "spec-representation.v1.2026-09-19",
    compiled_at_iso: new Date().toISOString(),
    raw_founder_goal: "when fn(3) is called it should return 30",
    resolution_status: "RESOLVED",
    refusal_reason: null,
    target_source_file: "src/foo.ts",
    expected_behaviours: [
      {
        subject: "fn",
        input_arguments: [{ value: 3, type: "number" }],
        outcome_value: 30,
        outcome_type: "number",
        determinable: true,
        source_span: null,
      },
    ],
    acceptance_predicates: { fail_to_pass: [], pass_to_pass: [] },
    forbidden_changes: [],
    provenance: [],
    zero_llm: true,
    ledger: "B",
    ...over,
  } as unknown as SpecificationRepresentation;
}

describe("test generator · deterministic vitest file emission", () => {
  describe("happy path", () => {
    it("emits a real vitest file from a RESOLVED spec", () => {
      const spec = stubSpec();
      const r = generateTestFile({
        specification: spec,
        test_file_rel_path: "src/foo.test.ts",
        import_source_rel_path: "./foo",
      });
      expect(r.ok).toBe(true);
      expect(r.rel_path).toBe("src/foo.test.ts");
      expect(r.test_case_count).toBe(1);
      expect(r.content).toContain(`import { describe, it, expect } from "vitest";`);
      expect(r.content).toContain(`import { fn } from "./foo";`);
      expect(r.content).toContain(`expect(fn(3)).toBe(30);`);
      expect(r.content).toContain(`spec_id=${spec.spec_id}`);
    });

    it("emits multiple test cases for multiple determinable behaviours", () => {
      const spec = stubSpec({
        expected_behaviours: [
          { subject: "fn", input_arguments: [{ value: 3, type: "number" }], outcome_value: 30, outcome_type: "number", determinable: true, source_span: null },
          { subject: "fn", input_arguments: [{ value: 5, type: "number" }], outcome_value: 50, outcome_type: "number", determinable: true, source_span: null },
        ] as never,
      });
      const r = generateTestFile({ specification: spec });
      expect(r.test_case_count).toBe(2);
      expect(r.content).toContain(`expect(fn(3)).toBe(30);`);
      expect(r.content).toContain(`expect(fn(5)).toBe(50);`);
    });

    it("uses toEqual for object/array types", () => {
      const spec = stubSpec({
        expected_behaviours: [
          { subject: "getConfig", input_arguments: [], outcome_value: { theme: "dark" }, outcome_type: "object", determinable: true, source_span: null },
        ] as never,
      });
      const r = generateTestFile({ specification: spec });
      expect(r.content).toContain(`.toEqual({"theme":"dark"});`);
    });

    it("handles string expected values with JSON-escaping", () => {
      const spec = stubSpec({
        expected_behaviours: [
          { subject: "greet", input_arguments: [{ value: "world", type: "string" }], outcome_value: "hello world", outcome_type: "string", determinable: true, source_span: null },
        ] as never,
      });
      const r = generateTestFile({ specification: spec });
      expect(r.content).toContain(`expect(greet("world")).toBe("hello world");`);
    });
  });

  describe("anti-fabrication (refuses to invent expected values)", () => {
    it("refuses when spec is UNRESOLVED", () => {
      const spec = stubSpec({ resolution_status: "UNRESOLVED" as never, refusal_reason: "prose ambiguous" });
      const r = generateTestFile({ specification: spec });
      expect(r.ok).toBe(false);
      expect(r.refusal_reason).toContain("spec_not_resolved");
    });

    it("refuses when spec has no determinable expected behaviours", () => {
      const spec = stubSpec({
        expected_behaviours: [
          { subject: "fn", input_arguments: [], outcome_value: null, outcome_type: null, determinable: false, source_span: null },
        ] as never,
      });
      const r = generateTestFile({ specification: spec });
      expect(r.ok).toBe(false);
      expect(r.refusal_reason).toBe("no_determinable_expected_behaviour");
    });

    it("does NOT include tests for non-determinable behaviours even when RESOLVED", () => {
      const spec = stubSpec({
        expected_behaviours: [
          { subject: "fn", input_arguments: [{ value: 3, type: "number" }], outcome_value: 30, outcome_type: "number", determinable: true, source_span: null },
          { subject: "fn", input_arguments: [], outcome_value: null, outcome_type: null, determinable: false, source_span: null },
        ] as never,
      });
      const r = generateTestFile({ specification: spec });
      expect(r.test_case_count).toBe(1);
    });
  });

  describe("determinism", () => {
    it("produces byte-identical output for identical spec", () => {
      const spec = stubSpec();
      const a = generateTestFile({ specification: spec, test_file_rel_path: "src/x.test.ts", import_source_rel_path: "./x" });
      const b = generateTestFile({ specification: spec, test_file_rel_path: "src/x.test.ts", import_source_rel_path: "./x" });
      expect(a.content).toBe(b.content);
      expect(a.content_hash).toBe(b.content_hash);
    });

    it("content_hash changes when spec expected value changes", () => {
      const spec1 = stubSpec();
      const spec2 = stubSpec({
        expected_behaviours: [
          { subject: "fn", input_arguments: [{ value: 3, type: "number" }], outcome_value: 99, outcome_type: "number", determinable: true, source_span: null },
        ] as never,
      });
      const a = generateTestFile({ specification: spec1 });
      const b = generateTestFile({ specification: spec2 });
      expect(a.content_hash).not.toBe(b.content_hash);
    });
  });

  describe("citations", () => {
    it("every generated file references the spec_id it came from", () => {
      const spec = stubSpec({ spec_id: "spec_traceable_id" } as never);
      const r = generateTestFile({ specification: spec });
      expect(r.content).toContain(`spec_id=spec_traceable_id`);
      expect(r.spec_id).toBe("spec_traceable_id");
    });
  });

  describe("invariants", () => {
    it("declares zero_llm=true, ledger=B, caller_must_decide=true", () => {
      const spec = stubSpec();
      const r = generateTestFile({ specification: spec });
      expect(r.zero_llm).toBe(true);
      expect(r.ledger).toBe("B");
      expect(r.caller_must_decide).toBe(true);
    });

    it("canonical version", () => {
      expect(TEST_GENERATOR_VERSION).toBe("test-generator.v1.2026-09-19");
    });
  });
});
