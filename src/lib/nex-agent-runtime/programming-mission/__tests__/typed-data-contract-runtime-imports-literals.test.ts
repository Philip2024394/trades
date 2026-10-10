// §36-C · ROUTE-2C · 2026-09-14 · runtime-import literals tests.
//
// Dedicated test file for the optional `literals` field on TDCRuntimeImport.
// Does NOT modify the existing Route 2 test file (`typed-data-contract.test.ts`)
// or the Route 2b test file (`typed-data-contract-runtime-imports.test.ts`).
// Both file SHA-256s must remain bit-perfect stable.

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  authorTypedDataContract,
  type TypedDataContractAuthoringFailure,
  type TypedDataContractAuthoringSuccess,
} from "../typed-data-contract-authoring";
import type {
  StyleProfile,
  TypedDataContractSpec,
  TDCRuntimeImport,
} from "../types";

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

// ── Group 1 · Positive · validator resolves via runtime-imported refusal-union ──

describe("§36-C · Route 2c · positive · runtime-imported refusal-union", () => {
  it("RIL-P-1 · validator refusal_union_name resolves via runtime_import when literals supplied", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "V",
      header_comment: "",
      type_only_imports: [{ symbol: "MyInput", from_specifier: "./input" }],
      runtime_imports: [
        {
          kind: "literal_union",
          name: "MyRefusalReason",
          from_specifier: "./refusal",
          literals: ["MISSING", "OUT_OF_RANGE"],
        },
      ],
      declarations: [
        {
          declaration_kind: "validator_function",
          name: "validate", exported: true,
          input_type_name: "MyInput",
          refusal_union_name: "MyRefusalReason",
          checks: [
            { field_path: "f", check_kind: "required_present", refusal_reason_literal: "MISSING" },
          ],
        },
      ],
    };
    const r = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "v.ts" }));
    expect(r.content).toContain(`import type { MyInput } from "./input";`);
    expect(r.content).toContain(`import { MyRefusalReason, MyRefusalReason_MEMBERS } from "./refusal";`);
    expect(r.content).toContain(`readonly reason: MyRefusalReason`);
    expect(r.content).toContain(`return { ok: false, reason: "MISSING" }`);
  });

  it("RIL-P-2 · every check refusal_reason_literal is validated against supplied literals", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "V",
      header_comment: "",
      type_only_imports: [{ symbol: "MyInput", from_specifier: "./input" }],
      runtime_imports: [
        {
          kind: "literal_union",
          name: "MyRefusalReason",
          from_specifier: "./refusal",
          literals: ["A", "B", "C"],
        },
      ],
      declarations: [
        {
          declaration_kind: "validator_function",
          name: "check", exported: true,
          input_type_name: "MyInput",
          refusal_union_name: "MyRefusalReason",
          checks: [
            { field_path: "x", check_kind: "required_present", refusal_reason_literal: "A" },
            { field_path: "y", check_kind: "required_present", refusal_reason_literal: "B" },
            { field_path: "z", check_kind: "required_present", refusal_reason_literal: "C" },
          ],
        },
      ],
    };
    const r = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "v.ts" }));
    expect(r.content).toContain(`return { ok: false, reason: "A" }`);
    expect(r.content).toContain(`return { ok: false, reason: "B" }`);
    expect(r.content).toContain(`return { ok: false, reason: "C" }`);
  });

  it("RIL-P-3 · runtime-imported refusal-union works alongside runtime range imports", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "V",
      header_comment: "",
      type_only_imports: [{ symbol: "MyInput", from_specifier: "./input" }],
      runtime_imports: [
        { kind: "numeric_range_constant", name: "MY_RANGE", from_specifier: "./ranges" },
        {
          kind: "literal_union",
          name: "MyRefusalReason",
          from_specifier: "./refusal",
          literals: ["OUT_OF_RANGE"],
        },
      ],
      declarations: [
        {
          declaration_kind: "validator_function",
          name: "check", exported: true,
          input_type_name: "MyInput",
          refusal_union_name: "MyRefusalReason",
          checks: [
            { field_path: "amount", check_kind: "range_within", reference_name: "MY_RANGE", refusal_reason_literal: "OUT_OF_RANGE" },
          ],
        },
      ],
    };
    const r = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "v.ts" }));
    expect(r.content).toContain(`import { MY_RANGE } from "./ranges";`);
    expect(r.content).toContain(`import { MyRefusalReason, MyRefusalReason_MEMBERS } from "./refusal";`);
    expect(r.content).toContain(`v < MY_RANGE.min || v > MY_RANGE.max`);
    expect(r.content).toContain(`return { ok: false, reason: "OUT_OF_RANGE" }`);
  });
});

// ── Group 2 · Backward-compat · Route 2b preserved ─────────────────────

describe("§36-C · Route 2c · backward-compat with Route 2b", () => {
  it("RIL-C-1 · runtime_import without literals still works exactly as Route 2b", () => {
    const specWithoutLiterals: TypedDataContractSpec = {
      contract_name: "Old", header_comment: "",
      type_only_imports: [{ symbol: "MyInput", from_specifier: "./input" }],
      runtime_imports: [
        { kind: "numeric_range_constant", name: "R1", from_specifier: "./r1" },
        { kind: "literal_union", name: "U1", from_specifier: "./u1" },  // no literals field
      ],
      declarations: [
        { declaration_kind: "refusal_reason_union", name: "LocalR", exported: true, reasons: ["FAIL"] },
        {
          declaration_kind: "validator_function", name: "check", exported: true,
          input_type_name: "MyInput", refusal_union_name: "LocalR",
          checks: [
            { field_path: "a", check_kind: "range_within", reference_name: "R1", refusal_reason_literal: "FAIL" },
            { field_path: "b", check_kind: "literal_union_member", reference_name: "U1", refusal_reason_literal: "FAIL" },
          ],
        },
      ],
    };
    const r = asSuccess(authorTypedDataContract({ spec: specWithoutLiterals, style: STYLE, target_path: "old.ts" }));
    // literal_union runtime_import emits the members array reference as before
    expect(r.content).toContain(`import { U1, U1_MEMBERS } from "./u1";`);
    expect(r.content).toContain(`allowed: readonly string[] = U1_MEMBERS`);
  });

  it("RIL-C-2 · literals field absent → byte-identical to same spec without literals field", () => {
    const specNoField: TypedDataContractSpec = {
      contract_name: "X", header_comment: "",
      type_only_imports: [],
      runtime_imports: [{ kind: "literal_union", name: "U", from_specifier: "./u" }],
      declarations: [{ declaration_kind: "literal_union", name: "L", literals: ["a"], exported: true }],
    };
    const runtimeImp: TDCRuntimeImport = { kind: "literal_union", name: "U", from_specifier: "./u" };
    const specWithUndefined: TypedDataContractSpec = { ...specNoField, runtime_imports: [runtimeImp] };
    const a = asSuccess(authorTypedDataContract({ spec: specNoField, style: STYLE, target_path: "x.ts" }));
    const b = asSuccess(authorTypedDataContract({ spec: specWithUndefined, style: STYLE, target_path: "x.ts" }));
    expect(sha(a.content)).toBe(sha(b.content));
  });

  it("RIL-C-3 · local refusal_reason_union still works (existing behaviour preserved)", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "V", header_comment: "",
      type_only_imports: [{ symbol: "MyInput", from_specifier: "./input" }],
      declarations: [
        { declaration_kind: "refusal_reason_union", name: "LocalR", exported: true, reasons: ["FAIL"] },
        {
          declaration_kind: "validator_function", name: "check", exported: true,
          input_type_name: "MyInput", refusal_union_name: "LocalR",
          checks: [
            { field_path: "a", check_kind: "required_present", refusal_reason_literal: "FAIL" },
          ],
        },
      ],
    };
    const r = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "v.ts" }));
    expect(r.content).toContain(`export type LocalR =`);
    expect(r.content).toContain(`readonly reason: LocalR`);
    expect(r.content).toContain(`return { ok: false, reason: "FAIL" }`);
  });
});

// ── Group 3 · Determinism ──────────────────────────────────────────────

describe("§36-C · Route 2c · determinism", () => {
  const spec: TypedDataContractSpec = {
    contract_name: "D", header_comment: "",
    type_only_imports: [{ symbol: "MyInput", from_specifier: "./i" }],
    runtime_imports: [
      {
        kind: "literal_union", name: "MyR", from_specifier: "./r",
        literals: ["A", "B"],
      },
    ],
    declarations: [
      {
        declaration_kind: "validator_function", name: "chk", exported: true,
        input_type_name: "MyInput", refusal_union_name: "MyR",
        checks: [
          { field_path: "x", check_kind: "required_present", refusal_reason_literal: "A" },
        ],
      },
    ],
  };

  it("RIL-D-1 · identical spec twice → byte-identical output", () => {
    const a = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "d.ts" }));
    const b = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "d.ts" }));
    expect(sha(a.content)).toBe(sha(b.content));
  });

  it("RIL-D-2 · literals order does not affect byte-stability of same-content spec", () => {
    // Same literal SET but supplied in different order: still valid (unique members)
    // but the emitted output MUST be deterministic from the spec's own ordering.
    // Same-order spec twice: byte-identical. Different-order spec: DIFFERENT SHA-256
    // (because we don't sort literals · we respect spec order for determinism).
    const specOrderAB: TypedDataContractSpec = {
      ...spec,
      runtime_imports: [{
        kind: "literal_union", name: "MyR", from_specifier: "./r",
        literals: ["A", "B"],
      }],
    };
    const specOrderBA: TypedDataContractSpec = {
      ...spec,
      runtime_imports: [{
        kind: "literal_union", name: "MyR", from_specifier: "./r",
        literals: ["B", "A"],
      }],
    };
    // Both authored twice: within each, same-order → same SHA-256
    const ab1 = asSuccess(authorTypedDataContract({ spec: specOrderAB, style: STYLE, target_path: "d.ts" }));
    const ab2 = asSuccess(authorTypedDataContract({ spec: specOrderAB, style: STYLE, target_path: "d.ts" }));
    expect(sha(ab1.content)).toBe(sha(ab2.content));
    const ba1 = asSuccess(authorTypedDataContract({ spec: specOrderBA, style: STYLE, target_path: "d.ts" }));
    const ba2 = asSuccess(authorTypedDataContract({ spec: specOrderBA, style: STYLE, target_path: "d.ts" }));
    expect(sha(ba1.content)).toBe(sha(ba2.content));
    // Both orderings produce IDENTICAL emitted bytes because literals only affect
    // author-time validation · they do NOT appear in the emitted output (the
    // emitted output only contains `import { MyR, MyR_MEMBERS } from "./r";`).
    expect(sha(ab1.content)).toBe(sha(ba1.content));
  });
});

// ── Group 4 · Grammar rejection ────────────────────────────────────────

describe("§36-C · Route 2c · grammar rejection", () => {
  function makeSpecWithRuntimeImport(imp: unknown): TypedDataContractSpec {
    return {
      contract_name: "X", header_comment: "", type_only_imports: [],
      runtime_imports: [imp as TDCRuntimeImport],
      declarations: [{ declaration_kind: "literal_union", name: "L", literals: ["a"], exported: true }],
    };
  }

  it("RIL-N-1 · literals on kind='numeric_range_constant' refused", () => {
    const r = asFailure(authorTypedDataContract({
      spec: makeSpecWithRuntimeImport({ kind: "numeric_range_constant", name: "R", from_specifier: "./r", literals: ["oops"] }),
      style: STYLE, target_path: "x.ts",
    }));
    expect(r.refusal_code).toBe("TDC_RUNTIME_IMPORT_LITERALS_ON_WRONG_KIND");
  });

  it("RIL-N-2 · literals as empty array refused", () => {
    const r = asFailure(authorTypedDataContract({
      spec: makeSpecWithRuntimeImport({ kind: "literal_union", name: "U", from_specifier: "./u", literals: [] }),
      style: STYLE, target_path: "x.ts",
    }));
    expect(r.refusal_code).toBe("TDC_RUNTIME_IMPORT_LITERALS_EMPTY");
  });

  it("RIL-N-3 · literals as non-array refused", () => {
    const r = asFailure(authorTypedDataContract({
      spec: makeSpecWithRuntimeImport({ kind: "literal_union", name: "U", from_specifier: "./u", literals: "not-array" }),
      style: STYLE, target_path: "x.ts",
    }));
    expect(r.refusal_code).toBe("TDC_RUNTIME_IMPORT_LITERALS_EMPTY");
  });

  it("RIL-N-4 · duplicate literals refused", () => {
    const r = asFailure(authorTypedDataContract({
      spec: makeSpecWithRuntimeImport({ kind: "literal_union", name: "U", from_specifier: "./u", literals: ["A", "B", "A"] }),
      style: STYLE, target_path: "x.ts",
    }));
    expect(r.refusal_code).toBe("TDC_RUNTIME_IMPORT_LITERALS_DUPLICATE");
  });

  it("RIL-N-5 · literal containing newline refused", () => {
    const r = asFailure(authorTypedDataContract({
      spec: makeSpecWithRuntimeImport({ kind: "literal_union", name: "U", from_specifier: "./u", literals: ["bad\nliteral"] }),
      style: STYLE, target_path: "x.ts",
    }));
    expect(r.refusal_code).toBe("TDC_RUNTIME_IMPORT_LITERAL_INVALID");
  });

  it("RIL-N-6 · literal containing eval( refused as invalid literal", () => {
    const r = asFailure(authorTypedDataContract({
      spec: makeSpecWithRuntimeImport({ kind: "literal_union", name: "U", from_specifier: "./u", literals: ["safe", "bad_eval(x)"] }),
      style: STYLE, target_path: "x.ts",
    }));
    expect(r.refusal_code).toBe("TDC_RUNTIME_IMPORT_LITERAL_INVALID");
  });

  it("RIL-N-7 · non-string literal refused", () => {
    const r = asFailure(authorTypedDataContract({
      spec: makeSpecWithRuntimeImport({ kind: "literal_union", name: "U", from_specifier: "./u", literals: ["A", 42] }),
      style: STYLE, target_path: "x.ts",
    }));
    expect(r.refusal_code).toBe("TDC_RUNTIME_IMPORT_LITERAL_INVALID");
  });
});

// ── Group 5 · Validator refusal-union resolution failure paths ─────────

describe("§36-C · Route 2c · validator refusal-union resolution failure paths", () => {
  it("RIL-VF-1 · runtime-imported literal_union WITHOUT literals cannot serve as refusal_union_name", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "V", header_comment: "",
      type_only_imports: [{ symbol: "MyInput", from_specifier: "./i" }],
      runtime_imports: [{ kind: "literal_union", name: "MyR", from_specifier: "./r" }],  // no literals
      declarations: [
        {
          declaration_kind: "validator_function", name: "chk", exported: true,
          input_type_name: "MyInput", refusal_union_name: "MyR",  // tries to use runtime-imported
          checks: [{ field_path: "x", check_kind: "required_present", refusal_reason_literal: "MISSING" }],
        },
      ],
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "v.ts" }));
    expect(r.refusal_code).toBe("TDC_VALIDATOR_MISSING_REFUSAL_UNION");
    expect(r.reason).toContain("does not supply the required literals field");
  });

  it("RIL-VF-2 · refusal_reason_literal not in supplied literals refused", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "V", header_comment: "",
      type_only_imports: [{ symbol: "MyInput", from_specifier: "./i" }],
      runtime_imports: [
        {
          kind: "literal_union", name: "MyR", from_specifier: "./r",
          literals: ["ALLOWED_A", "ALLOWED_B"],
        },
      ],
      declarations: [
        {
          declaration_kind: "validator_function", name: "chk", exported: true,
          input_type_name: "MyInput", refusal_union_name: "MyR",
          checks: [{ field_path: "x", check_kind: "required_present", refusal_reason_literal: "NOT_A_MEMBER" }],
        },
      ],
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "v.ts" }));
    expect(r.refusal_code).toBe("TDC_VALIDATOR_UNKNOWN_REFUSAL");
  });

  it("RIL-VF-3 · refusal_union_name that is neither local nor runtime-imported refused", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "V", header_comment: "",
      type_only_imports: [{ symbol: "MyInput", from_specifier: "./i" }],
      declarations: [
        {
          declaration_kind: "validator_function", name: "chk", exported: true,
          input_type_name: "MyInput", refusal_union_name: "DoesNotExist",
          checks: [{ field_path: "x", check_kind: "required_present", refusal_reason_literal: "MISSING" }],
        },
      ],
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "v.ts" }));
    expect(r.refusal_code).toBe("TDC_VALIDATOR_MISSING_REFUSAL_UNION");
    expect(r.reason).toContain("not found (neither local nor runtime_imports with literals)");
  });
});

// ── Group 6 · Integration · C1-shape · full cross-file refusal ─────────

describe("§36-C · Route 2c · integration · C1-shape validator", () => {
  it("RIL-I-1 · validator.ts spec resolves ranges, viseme literal_union AND refusal_reason_union all cross-file", () => {
    // Mirrors the C1 pattern that Route 2c was designed to unblock:
    //   - type_only_imports: FacialState from ./facial-state
    //   - runtime_imports (kind=numeric_range_constant): 3 range constants from ./ranges
    //   - runtime_imports (kind=literal_union, WITHOUT literals): Viseme from ./facial-state
    //   - runtime_imports (kind=literal_union, WITH literals): FacialStateRefusalReason from ./refusal
    //   - validator.refusal_union_name resolves via the last runtime_import
    const spec: TypedDataContractSpec = {
      contract_name: "FacialValidator",
      header_comment: "Route 2c integration · synthetic C1-shape validator",
      type_only_imports: [{ symbol: "Facial", from_specifier: "./facial-state" }],
      runtime_imports: [
        { kind: "numeric_range_constant", name: "PITCH_BOUNDS", from_specifier: "./ranges" },
        { kind: "literal_union", name: "Viseme", from_specifier: "./facial-state" },
        {
          kind: "literal_union",
          name: "FacialStateRefusalReason",
          from_specifier: "./refusal",
          literals: [
            "HEAD_TRANSFORM_OUT_OF_RANGE",
            "UNKNOWN_VISEME",
            "MISSING_REQUIRED_FIELD",
          ],
        },
      ],
      declarations: [
        {
          declaration_kind: "validator_function",
          name: "validate_facial", exported: true,
          input_type_name: "Facial",
          refusal_union_name: "FacialStateRefusalReason",
          checks: [
            { field_path: "head.pitch", check_kind: "range_within", reference_name: "PITCH_BOUNDS", refusal_reason_literal: "HEAD_TRANSFORM_OUT_OF_RANGE" },
            { field_path: "mouth.viseme", check_kind: "literal_union_member", reference_name: "Viseme", refusal_reason_literal: "UNKNOWN_VISEME" },
            { field_path: "head", check_kind: "required_present", refusal_reason_literal: "MISSING_REQUIRED_FIELD" },
          ],
        },
      ],
    };
    const r = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "validator.ts" }));
    // All three imports present
    expect(r.content).toContain(`import type { Facial } from "./facial-state";`);
    expect(r.content).toContain(`import { PITCH_BOUNDS } from "./ranges";`);
    expect(r.content).toContain(`import { Viseme, Viseme_MEMBERS } from "./facial-state";`);
    expect(r.content).toContain(`import { FacialStateRefusalReason, FacialStateRefusalReason_MEMBERS } from "./refusal";`);
    // Validator uses cross-file refusal-union as its return type
    expect(r.content).toContain(`readonly reason: FacialStateRefusalReason`);
    // All three refusal_reason_literal values render into the body
    expect(r.content).toContain(`return { ok: false, reason: "HEAD_TRANSFORM_OUT_OF_RANGE" }`);
    expect(r.content).toContain(`return { ok: false, reason: "UNKNOWN_VISEME" }`);
    expect(r.content).toContain(`return { ok: false, reason: "MISSING_REQUIRED_FIELD" }`);
    // Body references cross-file constants correctly
    expect(r.content).toContain(`v < PITCH_BOUNDS.min || v > PITCH_BOUNDS.max`);
    expect(r.content).toContain(`allowed: readonly string[] = Viseme_MEMBERS`);
  });
});

// ── Group 7 · Route 2 + Route 2b test-file untouched (regression sanity) ─

describe("§36-C · Route 2c · Route 2 and Route 2b test-file preservation", () => {
  it("RIL-R-1 · sanity: pre-Route-2c specs without literals still author identically", () => {
    // A spec that could have been written pre-Route-2c: uses local refusal_reason_union,
    // no literals field on any runtime_import. Output must be byte-identical to Route 2b
    // era behaviour.
    const spec: TypedDataContractSpec = {
      contract_name: "PreR2c", header_comment: "",
      type_only_imports: [{ symbol: "In", from_specifier: "./in" }],
      runtime_imports: [
        { kind: "numeric_range_constant", name: "R", from_specifier: "./r" },
      ],
      declarations: [
        { declaration_kind: "refusal_reason_union", name: "LocalR", exported: true, reasons: ["FAIL"] },
        {
          declaration_kind: "validator_function", name: "chk", exported: true,
          input_type_name: "In", refusal_union_name: "LocalR",
          checks: [
            { field_path: "x", check_kind: "range_within", reference_name: "R", refusal_reason_literal: "FAIL" },
          ],
        },
      ],
    };
    const r = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "pre.ts" }));
    // Existing Route 2b behaviours preserved
    expect(r.content).toContain(`import { R } from "./r";`);
    expect(r.content).toContain(`export type LocalR =`);
    expect(r.content).toContain(`v < R.min || v > R.max`);
    expect(r.content).toContain(`return { ok: false, reason: "FAIL" }`);
  });
});
