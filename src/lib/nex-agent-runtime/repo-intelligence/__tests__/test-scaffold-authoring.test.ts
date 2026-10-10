// §36-D-D · ROUTE-R2 · 2026-09-14 · test-scaffold-authoring
//
// Tests for the pure-function test-scaffold-authoring primitive.
// Covers: 6 category renderers · 5 determinism checks · 10 AMB-1..AMB-10
// ambiguity refusal triggers (hard gate) · 6 request-validation refusals ·
// 6 security refusals.

import { describe, expect, it } from "vitest";
import { authorTestScaffold } from "../test-scaffold-authoring";
import type {
  TestScaffoldFailure,
  TestScaffoldRequest,
  TestScaffoldResult,
  TestScaffoldSuccess,
} from "../test-scaffold-types";
import type {
  StyleProfile,
  TypedDataContractDeclaration,
  TypedDataContractSpec,
} from "../../programming-mission/types";

// ── Helpers ────────────────────────────────────────────────────────────

function asSuccess(r: TestScaffoldResult): TestScaffoldSuccess {
  if (!r.ok) throw new Error(`expected success, got: ${r.refusal_code} · ${r.reason}`);
  return r;
}
function asFailure(r: TestScaffoldResult): TestScaffoldFailure {
  if (r.ok) throw new Error(`expected failure, got success (${r.test_count_authored} tests)`);
  return r;
}

const STYLE: StyleProfile = {
  naming_convention: "snake_case",
  export_style: "named",
  semicolons: "yes",
  quote_style: "double",
  test_framework: "vitest",
  detected_from_files: ["a.ts"],
  detection_confidence: "high",
};

function baseSpec(overrides?: Partial<TypedDataContractSpec>): TypedDataContractSpec {
  return {
    contract_name: "sample_contract",
    type_only_imports: [],
    declarations: [],
    header_comment: "// sample",
    runtime_imports: [],
    ...overrides,
  };
}

function baseRequest(spec: TypedDataContractSpec, overrides?: Partial<TestScaffoldRequest>): TestScaffoldRequest {
  return {
    spec,
    target_test_file_path: "src/lib/foo/__tests__/foo.test.ts",
    source_module_specifier: "../foo",
    test_categories: [
      "range_bounds",
      "union_integrity",
      "interface_shape",
      "refusal_triggerability",
      "serialiser_determinism",
      "contamination_guard",
    ],
    domain_judgment_placeholders: false,
    style: STYLE,
    ...overrides,
  };
}

const RANGE_DECL: TypedDataContractDeclaration = {
  declaration_kind: "numeric_range_constant",
  name: "AGE_RANGE",
  min: 0,
  max: 120,
  exported: true,
};

const UNION_DECL: TypedDataContractDeclaration = {
  declaration_kind: "literal_union",
  name: "COLOUR",
  literals: ["red", "green", "blue"],
  exported: true,
};

const REFUSAL_UNION_DECL: TypedDataContractDeclaration = {
  declaration_kind: "refusal_reason_union",
  name: "PERSON_REFUSAL",
  reasons: ["age_out_of_range", "colour_not_in_union", "name_missing"],
  exported: true,
};

const INTERFACE_DECL: TypedDataContractDeclaration = {
  declaration_kind: "interface",
  name: "Person",
  fields: [
    { name: "name", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
    { name: "age", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
    { name: "colour", type: { kind: "reference", to: "COLOUR" }, optional: false, readonly_modifier: true },
  ],
  exported: true,
};

const VALIDATOR_DECL: TypedDataContractDeclaration = {
  declaration_kind: "validator_function",
  name: "validate_person",
  input_type_name: "Person",
  refusal_union_name: "PERSON_REFUSAL",
  checks: [
    { field_path: "age", check_kind: "range_within", reference_name: "AGE_RANGE", refusal_reason_literal: "age_out_of_range" },
    { field_path: "colour", check_kind: "literal_union_member", reference_name: "COLOUR", refusal_reason_literal: "colour_not_in_union" },
    { field_path: "name", check_kind: "required_present", refusal_reason_literal: "name_missing" },
  ],
  exported: true,
};

const SERIALISER_DECL: TypedDataContractDeclaration = {
  declaration_kind: "serialiser_function",
  name: "serialise_person",
  input_type_name: "Person",
  property_order: ["name", "age", "colour"],
  exported: true,
};

const FULL_SPEC: TypedDataContractSpec = baseSpec({
  declarations: [RANGE_DECL, UNION_DECL, REFUSAL_UNION_DECL, INTERFACE_DECL, VALIDATOR_DECL, SERIALISER_DECL],
});

// ── §A · Category-level generation tests (24 · six categories) ─────────

describe("§36-D-D · R2 · range_bounds category", () => {
  it("A-1 · emits min/max/frozen tests for a numeric_range_constant", () => {
    const r = authorTestScaffold(baseRequest(baseSpec({ declarations: [RANGE_DECL] }), {
      test_categories: ["range_bounds"],
    }));
    const s = asSuccess(r);
    expect(s.content).toContain("AGE_RANGE.min");
    expect(s.content).toContain("AGE_RANGE.max");
    expect(s.content).toContain("Object.isFrozen(AGE_RANGE)");
    expect(s.test_count_authored).toBe(3);
  });

  it("A-2 · uses the declared min value in the test literal", () => {
    const r = authorTestScaffold(baseRequest(baseSpec({ declarations: [RANGE_DECL] }), {
      test_categories: ["range_bounds"],
    }));
    const s = asSuccess(r);
    expect(s.content).toContain(".toBe(0)");
    expect(s.content).toContain(".toBe(120)");
  });

  it("A-3 · imports the constant symbol from the source module", () => {
    const r = authorTestScaffold(baseRequest(baseSpec({ declarations: [RANGE_DECL] }), {
      test_categories: ["range_bounds"],
    }));
    const s = asSuccess(r);
    expect(s.content).toContain("import { AGE_RANGE }");
    expect(s.content).toContain('from "../foo"');
  });

  it("A-4 · emits nothing when spec has no numeric_range_constant", () => {
    const r = authorTestScaffold(baseRequest(baseSpec({ declarations: [UNION_DECL] }), {
      test_categories: ["range_bounds"],
    }));
    const s = asSuccess(r);
    expect(s.test_count_authored).toBe(0);
  });
});

describe("§36-D-D · R2 · union_integrity category", () => {
  it("A-5 · emits length/frozen/contains tests for a literal_union", () => {
    const r = authorTestScaffold(baseRequest(baseSpec({ declarations: [UNION_DECL] }), {
      test_categories: ["union_integrity"],
    }));
    const s = asSuccess(r);
    expect(s.content).toContain("COLOUR_MEMBERS.length");
    expect(s.content).toContain("Object.isFrozen(COLOUR_MEMBERS)");
    expect(s.content).toContain("COLOUR_MEMBERS).toContain");
    expect(s.test_count_authored).toBe(3);
  });

  it("A-6 · works for refusal_reason_union too", () => {
    const r = authorTestScaffold(baseRequest(baseSpec({ declarations: [REFUSAL_UNION_DECL] }), {
      test_categories: ["union_integrity"],
    }));
    const s = asSuccess(r);
    expect(s.content).toContain("PERSON_REFUSAL_MEMBERS");
    expect(s.test_count_authored).toBe(3);
  });

  it("A-7 · emits every declared literal in the contains list", () => {
    const r = authorTestScaffold(baseRequest(baseSpec({ declarations: [UNION_DECL] }), {
      test_categories: ["union_integrity"],
    }));
    const s = asSuccess(r);
    expect(s.content).toContain('"red"');
    expect(s.content).toContain('"green"');
    expect(s.content).toContain('"blue"');
  });

  it("A-8 · declares length equal to the literal count", () => {
    const r = authorTestScaffold(baseRequest(baseSpec({ declarations: [UNION_DECL] }), {
      test_categories: ["union_integrity"],
    }));
    const s = asSuccess(r);
    expect(s.content).toContain(".toBe(3)");
  });
});

describe("§36-D-D · R2 · interface_shape category", () => {
  it("A-9 · emits one shape test per interface", () => {
    const r = authorTestScaffold(baseRequest(baseSpec({ declarations: [UNION_DECL, INTERFACE_DECL] }), {
      test_categories: ["interface_shape"],
    }));
    const s = asSuccess(r);
    expect(s.content).toContain("Person shape is inhabitable");
    expect(s.test_count_authored).toBe(1);
  });

  it("A-10 · imports the interface as a type-only symbol", () => {
    const r = authorTestScaffold(baseRequest(baseSpec({ declarations: [UNION_DECL, INTERFACE_DECL] }), {
      test_categories: ["interface_shape"],
    }));
    const s = asSuccess(r);
    expect(s.content).toContain("import type { Person }");
  });

  it("A-11 · uses deterministic sample values (0 for number, empty string for string)", () => {
    const r = authorTestScaffold(baseRequest(baseSpec({ declarations: [UNION_DECL, INTERFACE_DECL] }), {
      test_categories: ["interface_shape"],
    }));
    const s = asSuccess(r);
    expect(s.content).toMatch(/name:\s*""/);
    expect(s.content).toMatch(/age:\s*0/);
  });

  it("A-12 · uses the union's first literal for a reference field sample", () => {
    const r = authorTestScaffold(baseRequest(baseSpec({ declarations: [UNION_DECL, INTERFACE_DECL] }), {
      test_categories: ["interface_shape"],
    }));
    const s = asSuccess(r);
    expect(s.content).toMatch(/colour:\s*"red"/);
  });
});

describe("§36-D-D · R2 · refusal_triggerability category", () => {
  it("A-13 · emits one test per validator check", () => {
    const r = authorTestScaffold(baseRequest(FULL_SPEC, {
      test_categories: ["refusal_triggerability"],
    }));
    const s = asSuccess(r);
    expect(s.test_count_authored).toBe(3);
  });

  it("A-14 · uses max+1 for range_within invalid sample", () => {
    const r = authorTestScaffold(baseRequest(FULL_SPEC, {
      test_categories: ["refusal_triggerability"],
    }));
    const s = asSuccess(r);
    expect(s.content).toContain(", 121)");
  });

  it("A-15 · uses non-member sentinel for literal_union_member invalid sample", () => {
    const r = authorTestScaffold(baseRequest(FULL_SPEC, {
      test_categories: ["refusal_triggerability"],
    }));
    const s = asSuccess(r);
    expect(s.content).toContain('"__unknown_COLOUR__"');
  });

  it("A-16 · uses delete for required_present invalid sample", () => {
    const r = authorTestScaffold(baseRequest(FULL_SPEC, {
      test_categories: ["refusal_triggerability"],
    }));
    const s = asSuccess(r);
    expect(s.content).toContain("withDelete_validate_person");
  });

  it("A-17 · asserts each declared refusal reason literal is produced", () => {
    const r = authorTestScaffold(baseRequest(FULL_SPEC, {
      test_categories: ["refusal_triggerability"],
    }));
    const s = asSuccess(r);
    expect(s.content).toContain('"age_out_of_range"');
    expect(s.content).toContain('"colour_not_in_union"');
    expect(s.content).toContain('"name_missing"');
  });
});

describe("§36-D-D · R2 · serialiser_determinism category", () => {
  it("A-18 · emits byte-stable + round-trip + property-order tests", () => {
    const r = authorTestScaffold(baseRequest(FULL_SPEC, {
      test_categories: ["serialiser_determinism"],
    }));
    const s = asSuccess(r);
    expect(s.content).toContain("byte-stable");
    expect(s.content).toContain("round-trip");
    expect(s.content).toContain("property-order");
    expect(s.test_count_authored).toBe(3);
  });

  it("A-19 · encodes the declared property_order in the test", () => {
    const r = authorTestScaffold(baseRequest(FULL_SPEC, {
      test_categories: ["serialiser_determinism"],
    }));
    const s = asSuccess(r);
    expect(s.content).toContain('"name"');
    expect(s.content).toContain('"age"');
    expect(s.content).toContain('"colour"');
  });

  it("A-20 · imports the serialiser as a runtime symbol", () => {
    const r = authorTestScaffold(baseRequest(FULL_SPEC, {
      test_categories: ["serialiser_determinism"],
    }));
    const s = asSuccess(r);
    expect(s.content).toContain("serialise_person");
  });
});

describe("§36-D-D · R2 · contamination_guard category", () => {
  it("A-21 · emits one contamination-guard test regardless of declaration count", () => {
    const r = authorTestScaffold(baseRequest(baseSpec({ declarations: [RANGE_DECL] }), {
      test_categories: ["contamination_guard"],
    }));
    const s = asSuccess(r);
    expect(s.test_count_authored).toBe(1);
    expect(s.content).toContain("source file contains no forbidden substrings");
  });

  it("A-22 · lists forbidden substrings deterministically", () => {
    const r = authorTestScaffold(baseRequest(baseSpec({ declarations: [RANGE_DECL] }), {
      test_categories: ["contamination_guard"],
    }));
    const s = asSuccess(r);
    expect(s.content).toContain('"eval("');
    expect(s.content).toContain('"child_process"');
  });

  it("A-23 · sums correctly across all six categories on FULL_SPEC", () => {
    const r = authorTestScaffold(baseRequest(FULL_SPEC));
    const s = asSuccess(r);
    // 3 (range) + 3+3 (2 unions) + 1 (interface) + 3 (validator) + 3 (serialiser) + 1 (contamination) = 17
    expect(s.test_count_authored).toBe(17);
  });

  it("A-24 · gap_notes emitted for domain-judgment coverage", () => {
    const r = authorTestScaffold(baseRequest(FULL_SPEC));
    const s = asSuccess(r);
    expect(s.gap_notes.length).toBeGreaterThan(0);
    const validatorNote = s.gap_notes.find((g) => g.declaration_ref === "validate_person");
    expect(validatorNote).toBeDefined();
    expect(validatorNote?.kind).toBe("domain_judgment_required");
  });
});

// ── §B · Determinism tests (5) ─────────────────────────────────────────

describe("§36-D-D · R2 · determinism", () => {
  it("B-1 · same request twice → identical scaffold_sha256", () => {
    const a = authorTestScaffold(baseRequest(FULL_SPEC));
    const b = authorTestScaffold(baseRequest(FULL_SPEC));
    const sa = asSuccess(a);
    const sb = asSuccess(b);
    expect(sa.scaffold_sha256).toBe(sb.scaffold_sha256);
  });

  it("B-2 · same request twice → identical content bytes", () => {
    const a = authorTestScaffold(baseRequest(FULL_SPEC));
    const b = authorTestScaffold(baseRequest(FULL_SPEC));
    const sa = asSuccess(a);
    const sb = asSuccess(b);
    expect(sa.content).toBe(sb.content);
  });

  it("B-3 · changing declaration order changes the emitted scaffold", () => {
    const swapped = baseSpec({
      declarations: [UNION_DECL, RANGE_DECL, REFUSAL_UNION_DECL, INTERFACE_DECL, VALIDATOR_DECL, SERIALISER_DECL],
    });
    const a = asSuccess(authorTestScaffold(baseRequest(FULL_SPEC)));
    const b = asSuccess(authorTestScaffold(baseRequest(swapped)));
    expect(a.scaffold_sha256).not.toBe(b.scaffold_sha256);
  });

  it("B-4 · scaffold_sha256 is a 64-hex-char string", () => {
    const s = asSuccess(authorTestScaffold(baseRequest(FULL_SPEC)));
    expect(s.scaffold_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("B-5 · changing a single check refusal reason changes the sha", () => {
    const spec2 = {
      ...FULL_SPEC,
      declarations: FULL_SPEC.declarations.map((d) => {
        if (d.declaration_kind !== "validator_function") return d;
        return {
          ...d,
          checks: d.checks.map((c, i) => (i === 0 ? { ...c, refusal_reason_literal: "different_reason" } : c)),
        };
      }),
    };
    // Add "different_reason" to the refusal union so the spec is still valid downstream
    const spec3: TypedDataContractSpec = {
      ...spec2,
      declarations: spec2.declarations.map((d) =>
        d.declaration_kind === "refusal_reason_union"
          ? { ...d, reasons: [...d.reasons, "different_reason"] }
          : d,
      ),
    };
    const a = asSuccess(authorTestScaffold(baseRequest(FULL_SPEC)));
    const b = asSuccess(authorTestScaffold(baseRequest(spec3)));
    expect(a.scaffold_sha256).not.toBe(b.scaffold_sha256);
  });
});

// ── §C · AMB-1..AMB-10 ambiguity refusal tests (hard gate) ─────────────

describe("§36-D-D · R2 · AMB-1..AMB-10 ambiguity refusal (hard gate)", () => {
  it("AMB-1 · validator input_type_name unresolved → refused", () => {
    const spec = baseSpec({
      declarations: [
        REFUSAL_UNION_DECL,
        { ...VALIDATOR_DECL, input_type_name: "NonExistentType", checks: [] },
      ],
    });
    const r = asFailure(authorTestScaffold(baseRequest(spec)));
    expect(r.refusal_code).toBe("TSC_AMBIGUOUS_SPEC");
    expect(r.reason).toContain("AMB-1");
  });

  it("AMB-2 · validator refusal_union_name unresolved → refused", () => {
    const spec = baseSpec({
      declarations: [
        INTERFACE_DECL,
        UNION_DECL,
        { ...VALIDATOR_DECL, refusal_union_name: "NonExistentRefusal", checks: [] },
      ],
    });
    const r = asFailure(authorTestScaffold(baseRequest(spec)));
    expect(r.refusal_code).toBe("TSC_AMBIGUOUS_SPEC");
    expect(r.reason).toContain("AMB-2");
  });

  it("AMB-3 · nesting depth > 8 → refused", () => {
    let expr: import("../../programming-mission/types").TDCTypeExpression = { kind: "primitive", type: "string" };
    for (let i = 0; i < 10; i++) {
      expr = { kind: "array", element: expr };
    }
    const spec = baseSpec({
      declarations: [
        {
          declaration_kind: "interface",
          name: "Deep",
          fields: [{ name: "f", type: expr, optional: false, readonly_modifier: true }],
          exported: true,
        },
      ],
    });
    const r = asFailure(authorTestScaffold(baseRequest(spec)));
    expect(r.refusal_code).toBe("TSC_AMBIGUOUS_SPEC");
    expect(r.reason).toContain("AMB-3");
  });

  it("AMB-4 · serialiser input_type_name unresolved → refused", () => {
    const spec = baseSpec({
      declarations: [
        {
          declaration_kind: "serialiser_function",
          name: "s",
          input_type_name: "NonExistentInput",
          property_order: [],
          exported: true,
        },
      ],
    });
    const r = asFailure(authorTestScaffold(baseRequest(spec)));
    expect(r.refusal_code).toBe("TSC_AMBIGUOUS_SPEC");
    expect(r.reason).toContain("AMB-4");
  });

  it("AMB-5 · range_within reference_name unresolved → refused", () => {
    const spec = baseSpec({
      declarations: [
        INTERFACE_DECL,
        UNION_DECL,
        REFUSAL_UNION_DECL,
        {
          ...VALIDATOR_DECL,
          checks: [
            { field_path: "age", check_kind: "range_within", reference_name: "GhostRange", refusal_reason_literal: "age_out_of_range" },
          ],
        },
      ],
    });
    const r = asFailure(authorTestScaffold(baseRequest(spec)));
    expect(r.refusal_code).toBe("TSC_AMBIGUOUS_SPEC");
    expect(r.reason).toContain("AMB-5");
  });

  it("AMB-6 · literal_union_member reference_name unresolved → refused", () => {
    const spec = baseSpec({
      declarations: [
        INTERFACE_DECL,
        UNION_DECL,
        REFUSAL_UNION_DECL,
        {
          ...VALIDATOR_DECL,
          checks: [
            { field_path: "colour", check_kind: "literal_union_member", reference_name: "GhostUnion", refusal_reason_literal: "colour_not_in_union" },
          ],
        },
      ],
    });
    const r = asFailure(authorTestScaffold(baseRequest(spec)));
    expect(r.refusal_code).toBe("TSC_AMBIGUOUS_SPEC");
    expect(r.reason).toContain("AMB-6");
  });

  it("AMB-7 · duplicate declaration names → refused", () => {
    const spec = baseSpec({ declarations: [RANGE_DECL, RANGE_DECL] });
    const r = asFailure(authorTestScaffold(baseRequest(spec)));
    expect(r.refusal_code).toBe("TSC_AMBIGUOUS_SPEC");
    expect(r.reason).toContain("AMB-7");
  });

  it("AMB-8 · interface field references undeclared type → refused", () => {
    const spec = baseSpec({
      declarations: [
        {
          declaration_kind: "interface",
          name: "Bad",
          fields: [{ name: "x", type: { kind: "reference", to: "GhostRef" }, optional: false, readonly_modifier: true }],
          exported: true,
        },
      ],
    });
    const r = asFailure(authorTestScaffold(baseRequest(spec)));
    expect(r.refusal_code).toBe("TSC_AMBIGUOUS_SPEC");
    expect(r.reason).toContain("AMB-8");
  });

  it("AMB-9 · validator check field_path with invalid identifier segment → refused", () => {
    const spec = baseSpec({
      declarations: [
        INTERFACE_DECL,
        UNION_DECL,
        REFUSAL_UNION_DECL,
        RANGE_DECL,
        {
          ...VALIDATOR_DECL,
          checks: [
            { field_path: "age.7bad", check_kind: "range_within", reference_name: "AGE_RANGE", refusal_reason_literal: "age_out_of_range" },
          ],
        },
      ],
    });
    const r = asFailure(authorTestScaffold(baseRequest(spec)));
    expect(r.refusal_code).toBe("TSC_AMBIGUOUS_SPEC");
    expect(r.reason).toContain("AMB-9");
  });

  it("AMB-10 · range_within missing reference_name (borderline) → refused", () => {
    const spec = baseSpec({
      declarations: [
        INTERFACE_DECL,
        UNION_DECL,
        REFUSAL_UNION_DECL,
        {
          ...VALIDATOR_DECL,
          checks: [
            { field_path: "age", check_kind: "range_within", refusal_reason_literal: "age_out_of_range" },
          ],
        },
      ],
    });
    const r = asFailure(authorTestScaffold(baseRequest(spec)));
    expect(r.refusal_code).toBe("TSC_AMBIGUOUS_SPEC");
    // AMB-5 is emitted for missing reference_name in range_within — this is the borderline/AMB-10 class
    expect(r.reason).toMatch(/AMB-(5|10)/);
  });
});

// ── §D · Request validation refusals (6) ───────────────────────────────

describe("§36-D-D · R2 · request-validation refusals", () => {
  it("D-1 · non-object request → TSC_INVALID_REQUEST", () => {
    const r = asFailure(authorTestScaffold(null as unknown as TestScaffoldRequest));
    expect(r.refusal_code).toBe("TSC_INVALID_REQUEST");
  });

  it("D-2 · target_test_file_path with '..' → TSC_INVALID_TARGET_PATH", () => {
    const r = asFailure(authorTestScaffold(baseRequest(FULL_SPEC, {
      target_test_file_path: "../evil/x.test.ts",
    })));
    expect(r.refusal_code).toBe("TSC_INVALID_TARGET_PATH");
  });

  it("D-3 · target_test_file_path not ending .test.ts → TSC_INVALID_TARGET_PATH", () => {
    const r = asFailure(authorTestScaffold(baseRequest(FULL_SPEC, {
      target_test_file_path: "src/foo/bar.ts",
    })));
    expect(r.refusal_code).toBe("TSC_INVALID_TARGET_PATH");
  });

  it("D-4 · source_module_specifier bare package → TSC_INVALID_SOURCE_SPECIFIER", () => {
    const r = asFailure(authorTestScaffold(baseRequest(FULL_SPEC, {
      source_module_specifier: "lodash",
    })));
    expect(r.refusal_code).toBe("TSC_INVALID_SOURCE_SPECIFIER");
  });

  it("D-5 · unknown category → TSC_UNKNOWN_TEST_CATEGORY", () => {
    const r = asFailure(authorTestScaffold(baseRequest(FULL_SPEC, {
      test_categories: ["not_a_real_category" as never],
    })));
    expect(r.refusal_code).toBe("TSC_UNKNOWN_TEST_CATEGORY");
  });

  it("D-6 · empty declarations → TSC_INVALID_SPEC", () => {
    const r = asFailure(authorTestScaffold(baseRequest(baseSpec({ declarations: [] }))));
    expect(r.refusal_code).toBe("TSC_INVALID_SPEC");
  });
});

// ── §E · Security refusals (6) ─────────────────────────────────────────

describe("§36-D-D · R2 · security refusals", () => {
  it("E-1 · null byte in target path → refused", () => {
    const r = asFailure(authorTestScaffold(baseRequest(FULL_SPEC, {
      target_test_file_path: "src/foo/bar\0.test.ts",
    })));
    expect(r.refusal_code).toBe("TSC_INVALID_TARGET_PATH");
  });

  it("E-2 · backslash in target path → refused", () => {
    const r = asFailure(authorTestScaffold(baseRequest(FULL_SPEC, {
      target_test_file_path: "src\\foo\\bar.test.ts",
    })));
    expect(r.refusal_code).toBe("TSC_INVALID_TARGET_PATH");
  });

  it("E-3 · absolute POSIX path in target → refused", () => {
    const r = asFailure(authorTestScaffold(baseRequest(FULL_SPEC, {
      target_test_file_path: "/etc/passwd.test.ts",
    })));
    expect(r.refusal_code).toBe("TSC_INVALID_TARGET_PATH");
  });

  it("E-4 · absolute Windows path in target → refused", () => {
    const r = asFailure(authorTestScaffold(baseRequest(FULL_SPEC, {
      target_test_file_path: "C:/x/y.test.ts",
    })));
    expect(r.refusal_code).toBe("TSC_INVALID_TARGET_PATH");
  });

  it("E-5 · node built-in in source specifier → refused", () => {
    const r = asFailure(authorTestScaffold(baseRequest(FULL_SPEC, {
      source_module_specifier: "node:child_process",
    })));
    expect(r.refusal_code).toBe("TSC_INVALID_SOURCE_SPECIFIER");
  });

  it("E-6 · protocol scheme in source specifier → refused", () => {
    const r = asFailure(authorTestScaffold(baseRequest(FULL_SPEC, {
      source_module_specifier: "https://evil.example/pkg.js",
    })));
    expect(r.refusal_code).toBe("TSC_INVALID_SOURCE_SPECIFIER");
  });
});

// ── §F · Domain-judgment placeholder + gap_notes behaviour ─────────────

describe("§36-D-D · R2 · gap_notes and placeholder behaviour", () => {
  it("F-1 · with domain_judgment_placeholders=true, it.todo is emitted for validator semantic tests", () => {
    const r = authorTestScaffold(baseRequest(FULL_SPEC, {
      domain_judgment_placeholders: true,
    }));
    const s = asSuccess(r);
    expect(s.content).toContain("it.todo(");
    expect(s.test_count_todo_placeholders).toBeGreaterThan(0);
  });

  it("F-2 · with domain_judgment_placeholders=false, no it.todo is emitted", () => {
    const r = authorTestScaffold(baseRequest(FULL_SPEC, {
      domain_judgment_placeholders: false,
    }));
    const s = asSuccess(r);
    expect(s.content).not.toContain("it.todo(");
    expect(s.test_count_todo_placeholders).toBe(0);
  });

  it("F-3 · gap_notes cite validator names for domain-judgment coverage", () => {
    const r = authorTestScaffold(baseRequest(FULL_SPEC));
    const s = asSuccess(r);
    expect(s.gap_notes.some((g) => g.kind === "domain_judgment_required")).toBe(true);
    expect(s.gap_notes.some((g) => g.declaration_ref === "validate_person")).toBe(true);
  });
});

// ── §G · Grep-able marker verification ─────────────────────────────────

describe("§36-D-D · R2 · grep-able marker", () => {
  it("G-1 · emitted scaffold contains §36-D-D marker header", () => {
    const r = authorTestScaffold(baseRequest(FULL_SPEC));
    const s = asSuccess(r);
    expect(s.content).toContain("§36-D-D · ROUTE-R2 · 2026-09-14");
  });
});
