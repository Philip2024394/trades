// §36-A · ROUTE-2 · 2026-09-14 · typed-data-contract infrastructure tests.
//
// This suite is the machine-checkable acceptance evidence for the
// `typed_data_contract` primitive. Every claim in the amendment
// (docs/NEX1/SECTION_36_A_ROUTE_2_LAB_AUTHORING_AMENDMENT.md) has a
// corresponding test here.
//
// Test groups:
//   1. Positive · valid specs render deterministic byte-stable output
//   2. Determinism · identical spec → identical SHA-256 across runs
//   3. Grammar rejection · every prohibited construct is refused
//   4. Path security · traversal / absolute / Windows-drive rejected
//   5. Output limits · file size / declaration count / field count
//   6. Integration · dispatches through code-authoring.ts correctly
//   7. Regression protection · existing primitives untouched
//
// Founder rule (Constitution §20): "Never Reward False Success" — every
// negative test MUST actually observe the deterministic refusal · not
// merely assert that "no exception thrown". A missing refusal is a bug.

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  authorTypedDataContract,
  type TypedDataContractAuthoringFailure,
  type TypedDataContractAuthoringSuccess,
} from "../typed-data-contract-authoring";
import { authorMultiFileProgrammingChange } from "../code-authoring";
import type {
  StyleProfile,
  TypedDataContractSpec,
  TypedDataContractDeclaration,
  TDCField,
  FunctionSpec,
} from "../types";

// ── Fixtures ──────────────────────────────────────────────────────────

const STYLE: StyleProfile = {
  naming_convention: "snake_case",
  export_style: "named",
  semicolons: "yes",
  quote_style: "double",
  test_framework: "vitest",
  detected_from_files: ["fixture.ts"],
  detection_confidence: "high",
};

function sha(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** Small synthetic spec — deliberately NOT C1's real facial-state contract.
 *  This exists to prove the primitive works · not to reproduce C1. Per
 *  §36-A boundary: "Infrastructure enables NEX1 to build C1; infrastructure
 *  does not build C1 on NEX1's behalf." */
function syntheticSpec(): TypedDataContractSpec {
  return {
    contract_name: "SyntheticShape",
    header_comment: "Synthetic test fixture · not a real capability contract",
    type_only_imports: [],
    declarations: [
      {
        declaration_kind: "numeric_range_constant",
        name: "SYNTH_AMPLITUDE_BOUNDS",
        min: -1,
        max: 1,
        exported: true,
      },
      {
        declaration_kind: "literal_union",
        name: "SynthMode",
        literals: ["neutral", "active", "resting"],
        exported: true,
      },
      {
        declaration_kind: "refusal_reason_union",
        name: "SynthRefusalReason",
        reasons: ["OUT_OF_RANGE_AMPLITUDE", "UNKNOWN_MODE", "MISSING_FIELD"],
        exported: true,
      },
      {
        declaration_kind: "interface",
        name: "SyntheticShape",
        exported: true,
        fields: [
          { name: "id", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "amplitude", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
          { name: "mode", type: { kind: "reference", to: "SynthMode" }, optional: false, readonly_modifier: true },
        ],
      },
      {
        declaration_kind: "validator_function",
        name: "validate_synthetic_shape",
        exported: true,
        input_type_name: "SyntheticShape",
        refusal_union_name: "SynthRefusalReason",
        checks: [
          { field_path: "id", check_kind: "required_present", refusal_reason_literal: "MISSING_FIELD" },
          { field_path: "amplitude", check_kind: "range_within", reference_name: "SYNTH_AMPLITUDE_BOUNDS", refusal_reason_literal: "OUT_OF_RANGE_AMPLITUDE" },
          { field_path: "mode", check_kind: "literal_union_member", reference_name: "SynthMode", refusal_reason_literal: "UNKNOWN_MODE" },
        ],
      },
      {
        declaration_kind: "serialiser_function",
        name: "serialise_synthetic_shape",
        exported: true,
        input_type_name: "SyntheticShape",
        property_order: ["id", "amplitude", "mode"],
      },
    ],
  };
}

function asSuccess(r: unknown): TypedDataContractAuthoringSuccess {
  if (!r || typeof r !== "object" || (r as { ok?: boolean }).ok !== true) {
    throw new Error(`expected success, got: ${JSON.stringify(r)}`);
  }
  return r as TypedDataContractAuthoringSuccess;
}

function asFailure(r: unknown): TypedDataContractAuthoringFailure {
  if (!r || typeof r !== "object" || (r as { ok?: boolean }).ok !== false) {
    throw new Error(`expected failure, got: ${JSON.stringify(r)}`);
  }
  return r as TypedDataContractAuthoringFailure;
}

// ── Group 1 · Positive tests · valid specs render ──────────────────────

describe("§36-A · Route 2 · positive · valid TDC spec renders", () => {
  it("P-1 · minimal single-interface spec produces output containing the interface", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "Minimal",
      header_comment: "",
      type_only_imports: [],
      declarations: [
        {
          declaration_kind: "interface",
          name: "Minimal",
          exported: true,
          fields: [{ name: "value", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true }],
        },
      ],
    };
    const r = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "output/minimal.ts" }));
    expect(r.content).toContain("export interface Minimal");
    expect(r.content).toContain("readonly value: string;");
    expect(r.declaration_count).toBe(1);
    expect(r.byte_size).toBe(Buffer.byteLength(r.content, "utf8"));
  });

  it("P-2 · numeric_range_constant renders Object.freeze with min/max", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "Bounds",
      header_comment: "",
      type_only_imports: [],
      declarations: [
        { declaration_kind: "numeric_range_constant", name: "AMP", min: -0.5, max: 0.5, exported: true },
      ],
    };
    const r = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "bounds.ts" }));
    expect(r.content).toContain("export const AMP:");
    expect(r.content).toContain("Object.freeze({ min: -0.5, max: 0.5 })");
  });

  it("P-3 · literal_union renders string-literal union + members array", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "Modes",
      header_comment: "",
      type_only_imports: [],
      declarations: [
        { declaration_kind: "literal_union", name: "Mode", literals: ["a", "b", "c"], exported: true },
      ],
    };
    const r = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "modes.ts" }));
    expect(r.content).toContain(`| "a"`);
    expect(r.content).toContain(`| "b"`);
    expect(r.content).toContain(`| "c"`);
    expect(r.content).toContain(`Mode_MEMBERS`);
  });

  it("P-4 · discriminated_union renders each variant with tag_value", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "Shape",
      header_comment: "",
      type_only_imports: [],
      declarations: [
        {
          declaration_kind: "discriminated_union",
          name: "Shape",
          discriminator_field: "kind",
          exported: true,
          variants: [
            { tag_value: "circle", fields: [{ name: "radius", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true }] },
            { tag_value: "square", fields: [{ name: "side", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true }] },
          ],
        },
      ],
    };
    const r = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "shape.ts" }));
    expect(r.content).toContain(`kind: "circle"`);
    expect(r.content).toContain(`kind: "square"`);
    expect(r.content).toContain(`readonly radius: number`);
    expect(r.content).toContain(`readonly side: number`);
  });

  it("P-5 · validator_function renders bounded checks referencing declared range/union", () => {
    const r = asSuccess(authorTypedDataContract({ spec: syntheticSpec(), style: STYLE, target_path: "synth.ts" }));
    expect(r.content).toContain("function validate_synthetic_shape(input: SyntheticShape)");
    expect(r.content).toContain(`return { ok: false, reason: "MISSING_FIELD" }`);
    expect(r.content).toContain(`v < SYNTH_AMPLITUDE_BOUNDS.min || v > SYNTH_AMPLITUDE_BOUNDS.max`);
    expect(r.content).toContain(`SynthMode_MEMBERS`);
  });

  it("P-6 · serialiser_function renders JSON.stringify with locked property order", () => {
    const r = asSuccess(authorTypedDataContract({ spec: syntheticSpec(), style: STYLE, target_path: "synth.ts" }));
    // Property order in spec is [id, amplitude, mode] — that must be the emitted order.
    const idIndex = r.content.indexOf(`hasOwnProperty.call(src, "id")`);
    const ampIndex = r.content.indexOf(`hasOwnProperty.call(src, "amplitude")`);
    const modeIndex = r.content.indexOf(`hasOwnProperty.call(src, "mode")`);
    expect(idIndex).toBeGreaterThan(-1);
    expect(ampIndex).toBeGreaterThan(idIndex);
    expect(modeIndex).toBeGreaterThan(ampIndex);
  });

  it("P-7 · type_only_imports render as `import type { X } from \"path\"`", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "Consumer",
      header_comment: "",
      type_only_imports: [{ symbol: "OtherType", from_specifier: "./other" }],
      declarations: [
        {
          declaration_kind: "type_alias",
          name: "Wrapper",
          aliased_to: { kind: "reference", to: "OtherType" },
          exported: true,
        },
      ],
    };
    const r = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "consumer.ts" }));
    expect(r.content).toContain(`import type { OtherType } from "./other";`);
    expect(r.content).toContain(`export type Wrapper = OtherType;`);
  });

  it("P-8 · array types render as `readonly T[]`", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "Container",
      header_comment: "",
      type_only_imports: [],
      declarations: [
        {
          declaration_kind: "interface",
          name: "Container",
          exported: true,
          fields: [{ name: "items", type: { kind: "array", element: { kind: "primitive", type: "string" } }, optional: false, readonly_modifier: true }],
        },
      ],
    };
    const r = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "container.ts" }));
    expect(r.content).toContain("readonly items: readonly string[];");
  });

  it("P-9 · nested object type renders inline", () => {
    const nestedFields: readonly TDCField[] = [
      { name: "x", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
      { name: "y", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
    ];
    const spec: TypedDataContractSpec = {
      contract_name: "Nested",
      header_comment: "",
      type_only_imports: [],
      declarations: [
        {
          declaration_kind: "interface",
          name: "Nested",
          exported: true,
          fields: [{ name: "point", type: { kind: "object", fields: nestedFields }, optional: false, readonly_modifier: true }],
        },
      ],
    };
    const r = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "nested.ts" }));
    expect(r.content).toContain("readonly point: {");
    expect(r.content).toContain("readonly x: number;");
    expect(r.content).toContain("readonly y: number;");
  });

  it("P-10 · header_comment lines are emitted as // comments", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "Header",
      header_comment: "line one\nline two",
      type_only_imports: [],
      declarations: [{ declaration_kind: "literal_union", name: "L", literals: ["x"], exported: true }],
    };
    const r = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "header.ts" }));
    expect(r.content).toContain("// line one");
    expect(r.content).toContain("// line two");
  });
});

// ── Group 2 · Determinism · byte-stable output ─────────────────────────

describe("§36-A · Route 2 · determinism · byte-stable output", () => {
  it("D-1 · authoring the same spec twice produces byte-identical SHA-256", () => {
    const a = asSuccess(authorTypedDataContract({ spec: syntheticSpec(), style: STYLE, target_path: "synth.ts" }));
    const b = asSuccess(authorTypedDataContract({ spec: syntheticSpec(), style: STYLE, target_path: "synth.ts" }));
    expect(sha(a.content)).toBe(sha(b.content));
    expect(a.byte_size).toBe(b.byte_size);
    expect(a.content).toBe(b.content);
  });

  it("D-2 · declaration order in emitted output matches declaration order in spec", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "Order",
      header_comment: "",
      type_only_imports: [],
      declarations: [
        { declaration_kind: "literal_union", name: "A", literals: ["a"], exported: true },
        { declaration_kind: "literal_union", name: "B", literals: ["b"], exported: true },
        { declaration_kind: "literal_union", name: "C", literals: ["c"], exported: true },
      ],
    };
    const r = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "order.ts" }));
    const aIdx = r.content.indexOf("type A");
    const bIdx = r.content.indexOf("type B");
    const cIdx = r.content.indexOf("type C");
    expect(aIdx).toBeGreaterThan(-1);
    expect(bIdx).toBeGreaterThan(aIdx);
    expect(cIdx).toBeGreaterThan(bIdx);
  });

  it("D-3 · style quote_style=single emits single quotes; double emits double", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "Q",
      header_comment: "",
      type_only_imports: [],
      declarations: [{ declaration_kind: "literal_union", name: "L", literals: ["hello"], exported: true }],
    };
    const doubleStyle: StyleProfile = { ...STYLE, quote_style: "double" };
    const singleStyle: StyleProfile = { ...STYLE, quote_style: "single" };
    const d = asSuccess(authorTypedDataContract({ spec, style: doubleStyle, target_path: "q.ts" }));
    const s = asSuccess(authorTypedDataContract({ spec, style: singleStyle, target_path: "q.ts" }));
    expect(d.content).toContain(`"hello"`);
    expect(s.content).toContain(`'hello'`);
  });

  it("D-4 · unknown style resolves to deterministic defaults (double, semi=yes, named)", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "U",
      header_comment: "",
      type_only_imports: [],
      declarations: [{ declaration_kind: "literal_union", name: "L", literals: ["x"], exported: true }],
    };
    const unknownStyle: StyleProfile = {
      naming_convention: "unknown",
      export_style: "unknown",
      semicolons: "unknown",
      quote_style: "unknown",
      test_framework: "unknown",
      detected_from_files: [],
      detection_confidence: "low",
    };
    const r = asSuccess(authorTypedDataContract({ spec, style: unknownStyle, target_path: "u.ts" }));
    // default double quote + semicolon
    expect(r.content).toContain(`"x"`);
    expect(r.content.match(/;\s*$/m)).not.toBeNull();
  });
});

// ── Group 3 · Grammar rejection · locked grammar boundary ──────────────

describe("§36-A · Route 2 · grammar rejection · locked grammar boundary", () => {
  it("N-1 · empty spec is refused with TDC_EMPTY_SPEC", () => {
    const spec = { contract_name: "X", header_comment: "", type_only_imports: [], declarations: [] } as unknown as TypedDataContractSpec;
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "x.ts" }));
    expect(r.refusal_code).toBe("TDC_EMPTY_SPEC");
  });

  it("N-2 · unknown declaration_kind is refused", () => {
    const spec = {
      contract_name: "X", header_comment: "", type_only_imports: [],
      declarations: [{ declaration_kind: "arbitrary_code", name: "X", body: "eval('bad')", exported: true } as unknown as TypedDataContractDeclaration],
    } as TypedDataContractSpec;
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "x.ts" }));
    expect(r.refusal_code).toBe("TDC_INVALID_IDENTIFIER");
    expect(r.reason).toContain("unknown declaration_kind");
  });

  it("N-3 · invalid identifier is refused", () => {
    const spec = {
      contract_name: "X", header_comment: "", type_only_imports: [],
      declarations: [{ declaration_kind: "literal_union", name: "1bad-name", literals: ["a"], exported: true }],
    } as TypedDataContractSpec;
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "x.ts" }));
    expect(r.refusal_code).toBe("TDC_INVALID_IDENTIFIER");
  });

  it("N-4 · duplicate declaration name is refused", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "X", header_comment: "", type_only_imports: [],
      declarations: [
        { declaration_kind: "literal_union", name: "L", literals: ["a"], exported: true },
        { declaration_kind: "literal_union", name: "L", literals: ["b"], exported: true },
      ],
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "x.ts" }));
    expect(r.refusal_code).toBe("TDC_DUPLICATE_DECLARATION");
  });

  it("N-5 · reference to undeclared type is refused", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "X", header_comment: "", type_only_imports: [],
      declarations: [
        {
          declaration_kind: "interface",
          name: "Bad",
          exported: true,
          fields: [{ name: "f", type: { kind: "reference", to: "DoesNotExist" }, optional: false, readonly_modifier: true }],
        },
      ],
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "x.ts" }));
    expect(r.refusal_code).toBe("TDC_INVALID_TYPE_REFERENCE");
  });

  it("N-6 · numeric range min > max is refused", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "X", header_comment: "", type_only_imports: [],
      declarations: [{ declaration_kind: "numeric_range_constant", name: "R", min: 10, max: 5, exported: true }],
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "x.ts" }));
    expect(r.refusal_code).toBe("TDC_INVALID_RANGE");
  });

  it("N-7 · literal with embedded newline is refused (single-line literals only)", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "X", header_comment: "", type_only_imports: [],
      declarations: [{ declaration_kind: "literal_union", name: "L", literals: ["multi\nline"], exported: true }],
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "x.ts" }));
    expect(r.refusal_code).toBe("TDC_INVALID_LITERAL");
  });

  it("N-8 · duplicate literal in union is refused", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "X", header_comment: "", type_only_imports: [],
      declarations: [{ declaration_kind: "literal_union", name: "L", literals: ["a", "a"], exported: true }],
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "x.ts" }));
    expect(r.refusal_code).toBe("TDC_DUPLICATE_LITERAL");
  });

  it("N-9 · duplicate variant tag_value in discriminated_union is refused", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "X", header_comment: "", type_only_imports: [],
      declarations: [
        {
          declaration_kind: "discriminated_union",
          name: "D",
          discriminator_field: "k",
          exported: true,
          variants: [
            { tag_value: "same", fields: [{ name: "a", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true }] },
            { tag_value: "same", fields: [{ name: "b", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true }] },
          ],
        },
      ],
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "x.ts" }));
    expect(r.refusal_code).toBe("TDC_DUPLICATE_VARIANT");
  });

  it("N-10 · validator with unknown refusal_union_name is refused", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "X", header_comment: "", type_only_imports: [],
      declarations: [
        {
          declaration_kind: "interface", name: "I", exported: true,
          fields: [{ name: "f", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true }],
        },
        {
          declaration_kind: "validator_function",
          name: "v", exported: true,
          input_type_name: "I",
          refusal_union_name: "DoesNotExist",
          checks: [{ field_path: "f", check_kind: "required_present", refusal_reason_literal: "FOO" }],
        },
      ],
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "x.ts" }));
    expect(r.refusal_code).toBe("TDC_VALIDATOR_MISSING_REFUSAL_UNION");
  });

  it("N-11 · validator refusal_reason_literal not in refusal_union is refused", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "X", header_comment: "", type_only_imports: [],
      declarations: [
        {
          declaration_kind: "interface", name: "I", exported: true,
          fields: [{ name: "f", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true }],
        },
        { declaration_kind: "refusal_reason_union", name: "R", reasons: ["ALLOWED_REASON"], exported: true },
        {
          declaration_kind: "validator_function", name: "v", exported: true,
          input_type_name: "I",
          refusal_union_name: "R",
          checks: [{ field_path: "f", check_kind: "required_present", refusal_reason_literal: "NOT_A_MEMBER" }],
        },
      ],
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "x.ts" }));
    expect(r.refusal_code).toBe("TDC_VALIDATOR_UNKNOWN_REFUSAL");
  });

  it("N-12 · serialiser property_order references non-existent field is refused", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "X", header_comment: "", type_only_imports: [],
      declarations: [
        {
          declaration_kind: "interface", name: "I", exported: true,
          fields: [{ name: "real_field", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true }],
        },
        {
          declaration_kind: "serialiser_function", name: "s", exported: true,
          input_type_name: "I",
          property_order: ["real_field", "ghost_field"],
        },
      ],
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "x.ts" }));
    expect(r.refusal_code).toBe("TDC_SERIALISER_PROPERTY_MISMATCH");
  });

  it("N-13 · empty interface is refused", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "X", header_comment: "", type_only_imports: [],
      declarations: [{ declaration_kind: "interface", name: "I", exported: true, fields: [] }],
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "x.ts" }));
    expect(r.refusal_code).toBe("TDC_EMPTY_DECLARATION");
  });

  it("N-14 · discriminated_union with < 2 variants is refused", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "X", header_comment: "", type_only_imports: [],
      declarations: [
        {
          declaration_kind: "discriminated_union",
          name: "D", discriminator_field: "k", exported: true,
          variants: [{ tag_value: "only", fields: [{ name: "f", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true }] }],
        },
      ],
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "x.ts" }));
    expect(r.refusal_code).toBe("TDC_EMPTY_DECLARATION");
  });
});

// ── Group 4 · Path security · workspace confinement ────────────────────

describe("§36-A · Route 2 · path security · workspace confinement", () => {
  const spec = syntheticSpec();

  it("PS-1 · path with '..' is refused", () => {
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "../escape.ts" }));
    expect(r.refusal_code).toBe("TDC_INVALID_PATH");
  });

  it("PS-2 · absolute Unix path is refused", () => {
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "/etc/passwd.ts" }));
    expect(r.refusal_code).toBe("TDC_INVALID_PATH");
  });

  it("PS-3 · Windows drive path is refused", () => {
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "C:/Windows/System32/notes.ts" }));
    expect(r.refusal_code).toBe("TDC_INVALID_PATH");
  });

  it("PS-4 · backslash path separator is refused (workspace expects forward-slash)", () => {
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "sub\\file.ts" }));
    expect(r.refusal_code).toBe("TDC_INVALID_PATH");
  });

  it("PS-5 · null-byte injection in path is refused", () => {
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "safe.ts\0evil" }));
    expect(r.refusal_code).toBe("TDC_INVALID_PATH");
  });

  it("PS-6 · non-.ts extension is refused (only TypeScript emitted)", () => {
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "file.js" }));
    expect(r.refusal_code).toBe("TDC_INVALID_EXTENSION");
  });

  it("PS-7 · empty target_path is refused", () => {
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "" }));
    expect(r.refusal_code).toBe("TDC_INVALID_PATH");
  });
});

// ── Group 5 · Security · no arbitrary code generation ──────────────────

describe("§36-A · Route 2 · security · no arbitrary code generation", () => {
  it("S-1 · header_comment containing eval() is refused as prohibited string content", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "X",
      header_comment: "safe line\neval(injected)",
      type_only_imports: [],
      declarations: [{ declaration_kind: "literal_union", name: "L", literals: ["a"], exported: true }],
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "x.ts" }));
    expect(r.refusal_code).toBe("TDC_PROHIBITED_STRING_CONTENT");
  });

  it("S-2 · header_comment containing require( is refused", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "X",
      header_comment: "require(child_process)",
      type_only_imports: [],
      declarations: [{ declaration_kind: "literal_union", name: "L", literals: ["a"], exported: true }],
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "x.ts" }));
    expect(r.refusal_code).toBe("TDC_PROHIBITED_STRING_CONTENT");
  });

  it("S-3 · literal containing new Function is refused", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "X", header_comment: "", type_only_imports: [],
      declarations: [{ declaration_kind: "literal_union", name: "L", literals: ["new Function('x')"], exported: true }],
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "x.ts" }));
    expect(r.refusal_code).toBe("TDC_INVALID_LITERAL");
  });

  it("S-4 · type_only_import from Node built-in (node:fs) is refused", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "X", header_comment: "",
      type_only_imports: [{ symbol: "readFileSync", from_specifier: "node:fs" }],
      declarations: [{ declaration_kind: "literal_union", name: "L", literals: ["a"], exported: true }],
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "x.ts" }));
    expect(r.refusal_code).toBe("TDC_PROHIBITED_STRING_CONTENT");
  });

  it("S-5 · type_only_import specifier with '..' is refused", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "X", header_comment: "",
      type_only_imports: [{ symbol: "Escape", from_specifier: "../../secret" }],
      declarations: [{ declaration_kind: "literal_union", name: "L", literals: ["a"], exported: true }],
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "x.ts" }));
    expect(r.refusal_code).toBe("TDC_INVALID_TYPE_REFERENCE");
  });

  it("S-6 · type_only_import with protocol scheme is refused", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "X", header_comment: "",
      type_only_imports: [{ symbol: "T", from_specifier: "http://evil.example/mod" }],
      declarations: [{ declaration_kind: "literal_union", name: "L", literals: ["a"], exported: true }],
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "x.ts" }));
    expect(r.refusal_code).toBe("TDC_INVALID_TYPE_REFERENCE");
  });

  it("S-7 · <script> in literal is refused", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "X", header_comment: "", type_only_imports: [],
      declarations: [{ declaration_kind: "literal_union", name: "L", literals: ["<script>alert(1)</script>"], exported: true }],
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "x.ts" }));
    expect(r.refusal_code).toBe("TDC_INVALID_LITERAL");
  });
});

// ── Group 6 · Output limits ─────────────────────────────────────────────

describe("§36-A · Route 2 · output limits", () => {
  it("L-1 · declarations count above 32 is refused", () => {
    const declarations: TypedDataContractDeclaration[] = [];
    for (let i = 0; i < 33; i++) {
      declarations.push({ declaration_kind: "literal_union", name: `L_${i}`, literals: ["a"], exported: true });
    }
    const spec: TypedDataContractSpec = { contract_name: "X", header_comment: "", type_only_imports: [], declarations };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "x.ts" }));
    expect(r.refusal_code).toBe("TDC_TOO_MANY_DECLARATIONS");
  });

  it("L-2 · fields count above 64 in one interface is refused", () => {
    const fields: TDCField[] = [];
    for (let i = 0; i < 65; i++) {
      fields.push({ name: `field_${i}`, type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true });
    }
    const spec: TypedDataContractSpec = {
      contract_name: "X", header_comment: "", type_only_imports: [],
      declarations: [{ declaration_kind: "interface", name: "Big", exported: true, fields }],
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "x.ts" }));
    expect(r.refusal_code).toBe("TDC_OUTPUT_LIMIT_EXCEEDED");
  });

  it("L-3 · header_comment above 4096 chars is refused", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "X", header_comment: "a".repeat(4097), type_only_imports: [],
      declarations: [{ declaration_kind: "literal_union", name: "L", literals: ["a"], exported: true }],
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "x.ts" }));
    expect(r.refusal_code).toBe("TDC_HEADER_TOO_LONG");
  });
});

// ── Group 7 · Integration · dispatches through code-authoring ──────────

describe("§36-A · Route 2 · integration · code-authoring dispatch", () => {
  it("I-1 · multi-file mission with typed_data_contract kind is authored via new primitive", async () => {
    const spec: TypedDataContractSpec = syntheticSpec();
    const funcSpec: FunctionSpec = {
      function_name: "synth_shape_module",
      parameters: [],
      return_type: "string",
      algorithm_kind: "typed_data_contract",
      edge_cases: [],
      typed_data_contract_spec: spec,
    };
    const result = await authorMultiFileProgrammingChange({
      files: [
        { path: "synthetic.ts", kind: "implementation", function_spec: funcSpec },
        { path: "synthetic.test.ts", kind: "test", function_spec: {
          function_name: "synth_shape_module",
          parameters: [{ name: "input", type: "string" }, { name: "n", type: "number" }],
          return_type: "string",
          algorithm_kind: "truncate_words",
          edge_cases: [
            { when: "trivial", input: ["", 0], expect: "" },
            { when: "single", input: ["a", 1], expect: "a" },
            { when: "multi", input: ["a b c", 2], expect: "a b" },
          ],
        }, test_imports_from_path: "synthetic.ts" },
      ],
      style: STYLE,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    const impl = result.files.find((f) => f.path === "synthetic.ts");
    expect(impl).toBeDefined();
    expect(impl!.content).toContain("export interface SyntheticShape");
    expect(impl!.content).toContain("§36-A · ROUTE-2");
  });

  it("I-2 · multi-file mission with typed_data_contract but missing spec is refused SPEC_VALIDATION_FAILED", async () => {
    const funcSpec: FunctionSpec = {
      function_name: "no_spec",
      parameters: [],
      return_type: "string",
      algorithm_kind: "typed_data_contract",
      edge_cases: [],
      // typed_data_contract_spec deliberately omitted
    };
    const result = await authorMultiFileProgrammingChange({
      files: [
        { path: "empty.ts", kind: "implementation", function_spec: funcSpec },
        { path: "empty.test.ts", kind: "test", function_spec: { ...funcSpec, algorithm_kind: "truncate_words", parameters: [{ name: "a", type: "string" }, { name: "b", type: "number" }], edge_cases: [{ when: "x", input: ["", 0], expect: "" }] }, test_imports_from_path: "empty.ts" },
      ],
      style: STYLE,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.reason_code).toBe("SPEC_VALIDATION_FAILED");
  });

  it("I-3 · multi-file mission with invalid TDC spec propagates refusal_code in reason", async () => {
    const funcSpec: FunctionSpec = {
      function_name: "invalid",
      parameters: [],
      return_type: "string",
      algorithm_kind: "typed_data_contract",
      edge_cases: [],
      typed_data_contract_spec: {
        contract_name: "Invalid",
        header_comment: "",
        type_only_imports: [],
        declarations: [{ declaration_kind: "numeric_range_constant", name: "R", min: 10, max: 5, exported: true }],
      },
    };
    const result = await authorMultiFileProgrammingChange({
      files: [
        { path: "bad.ts", kind: "implementation", function_spec: funcSpec },
        { path: "bad.test.ts", kind: "test", function_spec: { ...funcSpec, algorithm_kind: "truncate_words", parameters: [{ name: "a", type: "string" }, { name: "b", type: "number" }], edge_cases: [{ when: "x", input: ["", 0], expect: "" }] }, test_imports_from_path: "bad.ts" },
      ],
      style: STYLE,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.reason).toContain("TDC_INVALID_RANGE");
  });
});

// ── Group 8 · Regression · existing primitives untouched ───────────────

describe("§36-A · Route 2 · regression · existing primitives untouched", () => {
  it("R-1 · truncate_words still authors an implementation via the multi-file entry", async () => {
    const funcSpec: FunctionSpec = {
      function_name: "truncate_words",
      parameters: [{ name: "text", type: "string" }, { name: "max", type: "number" }],
      return_type: "string",
      algorithm_kind: "truncate_words",
      edge_cases: [
        { when: "empty", input: ["", 0], expect: "" },
        { when: "single", input: ["a", 1], expect: "a" },
        { when: "multi", input: ["a b c", 2], expect: "a b" },
      ],
    };
    const result = await authorMultiFileProgrammingChange({
      files: [
        { path: "impl.ts", kind: "implementation", function_spec: funcSpec },
        { path: "impl.test.ts", kind: "test", function_spec: funcSpec, test_imports_from_path: "impl.ts" },
      ],
      style: STYLE,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    const impl = result.files.find((f) => f.path === "impl.ts");
    expect(impl).toBeDefined();
    expect(impl!.content).toContain("algorithm_kind=truncate_words");
  });

  it("R-2 · unsupported algorithm_kind still returns UNSUPPORTED_ALGORITHM (not typed_data_contract by accident)", async () => {
    const funcSpec: FunctionSpec = {
      function_name: "ghost",
      parameters: [],
      return_type: "string",
      algorithm_kind: "unguided",  // valid in union but not directly supported by the multi-file impl dispatch
      edge_cases: [],
    };
    const result = await authorMultiFileProgrammingChange({
      files: [
        { path: "ghost.ts", kind: "implementation", function_spec: funcSpec },
        { path: "ghost.test.ts", kind: "test", function_spec: { ...funcSpec, algorithm_kind: "truncate_words", parameters: [{ name: "a", type: "string" }, { name: "b", type: "number" }], edge_cases: [{ when: "x", input: ["", 0], expect: "" }] }, test_imports_from_path: "ghost.ts" },
      ],
      style: STYLE,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.reason_code).toBe("UNSUPPORTED_ALGORITHM");
  });
});
