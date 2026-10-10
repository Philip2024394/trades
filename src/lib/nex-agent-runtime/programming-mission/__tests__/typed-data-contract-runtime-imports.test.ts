// §36-B · ROUTE-2B · 2026-09-14 · runtime-imports infrastructure tests.
//
// Dedicated test file for the new `runtime_imports` field on
// TypedDataContractSpec. Does NOT modify the existing Route 2 test file
// (typed-data-contract.test.ts) — that file's SHA-256 must remain
// bit-perfect stable so the 50-test Route 2 regression baseline is
// preserved.
//
// Test groups:
//   1. Positive · valid runtime_imports render correctly (RI-P-*)
//   2. Determinism · byte-stable emission (RI-D-*)
//   3. Grammar rejection · every invalid runtime_import refused (RI-N-*)
//   4. Path security · traversal/absolute/protocol/etc refused (RI-PS-*)
//   5. Injection refusal (RI-S-*)
//   6. Integration · validator uses runtime-imported constants (RI-I-*)
//   7. Regression · Route 2 backward-compat (RI-R-*)

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

// ── Group 1 · Positive · valid runtime_imports render correctly ────────

describe("§36-B · Route 2b · positive · runtime_imports render", () => {
  it("RI-P-1 · numeric_range_constant runtime import emits `import { X } from ...`", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "V",
      header_comment: "",
      type_only_imports: [{ symbol: "MyType", from_specifier: "./types" }],
      runtime_imports: [{ kind: "numeric_range_constant", name: "MY_BOUNDS", from_specifier: "./bounds" }],
      declarations: [
        {
          declaration_kind: "refusal_reason_union",
          name: "R", exported: true, reasons: ["OUT_OF_RANGE"],
        },
        {
          declaration_kind: "validator_function",
          name: "check", exported: true,
          input_type_name: "MyType",
          refusal_union_name: "R",
          checks: [{ field_path: "value", check_kind: "range_within", reference_name: "MY_BOUNDS", refusal_reason_literal: "OUT_OF_RANGE" }],
        },
      ],
    };
    const r = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "v.ts" }));
    expect(r.content).toContain(`import { MY_BOUNDS } from "./bounds";`);
    expect(r.content).toContain(`import type { MyType } from "./types";`);
    expect(r.content).toContain(`v < MY_BOUNDS.min || v > MY_BOUNDS.max`);
  });

  it("RI-P-2 · literal_union runtime import emits `import { X, X_MEMBERS } from ...`", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "V",
      header_comment: "",
      type_only_imports: [{ symbol: "Shape", from_specifier: "./shape" }],
      runtime_imports: [{ kind: "literal_union", name: "Mode", from_specifier: "./modes" }],
      declarations: [
        { declaration_kind: "refusal_reason_union", name: "R", exported: true, reasons: ["UNKNOWN_MODE"] },
        {
          declaration_kind: "validator_function",
          name: "check", exported: true,
          input_type_name: "Shape",
          refusal_union_name: "R",
          checks: [{ field_path: "mode", check_kind: "literal_union_member", reference_name: "Mode", refusal_reason_literal: "UNKNOWN_MODE" }],
        },
      ],
    };
    const r = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "v.ts" }));
    expect(r.content).toContain(`import { Mode, Mode_MEMBERS } from "./modes";`);
    expect(r.content).toContain(`Mode_MEMBERS`);
  });

  it("RI-P-3 · multiple runtime_imports emit in specified order", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "V",
      header_comment: "",
      type_only_imports: [],
      runtime_imports: [
        { kind: "numeric_range_constant", name: "A", from_specifier: "./a" },
        { kind: "numeric_range_constant", name: "B", from_specifier: "./b" },
        { kind: "numeric_range_constant", name: "C", from_specifier: "./c" },
      ],
      declarations: [
        { declaration_kind: "numeric_range_constant", name: "D", min: 0, max: 1, exported: true },
      ],
    };
    const r = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "v.ts" }));
    const aIdx = r.content.indexOf(`import { A }`);
    const bIdx = r.content.indexOf(`import { B }`);
    const cIdx = r.content.indexOf(`import { C }`);
    expect(aIdx).toBeGreaterThan(-1);
    expect(bIdx).toBeGreaterThan(aIdx);
    expect(cIdx).toBeGreaterThan(bIdx);
  });

  it("RI-P-4 · absent runtime_imports behaves identically to Route 2 (backward-compat)", () => {
    const specWithout: TypedDataContractSpec = {
      contract_name: "T", header_comment: "", type_only_imports: [],
      declarations: [{ declaration_kind: "literal_union", name: "L", literals: ["a"], exported: true }],
    };
    const specWithoutExplicit: TypedDataContractSpec = { ...specWithout, runtime_imports: [] };
    const rA = asSuccess(authorTypedDataContract({ spec: specWithout, style: STYLE, target_path: "t.ts" }));
    const rB = asSuccess(authorTypedDataContract({ spec: specWithoutExplicit, style: STYLE, target_path: "t.ts" }));
    expect(sha(rA.content)).toBe(sha(rB.content));
    // And neither contains the runtime import line:
    expect(rA.content).not.toContain(`import { L } from`);
  });

  it("RI-P-5 · empty runtime_imports array behaves identically to absent field", () => {
    const specAbsent: TypedDataContractSpec = {
      contract_name: "T", header_comment: "", type_only_imports: [],
      declarations: [{ declaration_kind: "literal_union", name: "L", literals: ["a"], exported: true }],
    };
    const specEmpty: TypedDataContractSpec = { ...specAbsent, runtime_imports: [] };
    const a = asSuccess(authorTypedDataContract({ spec: specAbsent, style: STYLE, target_path: "t.ts" }));
    const b = asSuccess(authorTypedDataContract({ spec: specEmpty, style: STYLE, target_path: "t.ts" }));
    expect(a.content).toBe(b.content);
  });

  it("RI-P-6 · type_only_imports render before runtime_imports (order locked)", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "V",
      header_comment: "",
      type_only_imports: [{ symbol: "TypeA", from_specifier: "./a" }],
      runtime_imports: [{ kind: "numeric_range_constant", name: "BOUNDS", from_specifier: "./b" }],
      declarations: [
        { declaration_kind: "numeric_range_constant", name: "LOCAL", min: 0, max: 1, exported: true },
      ],
    };
    const r = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "v.ts" }));
    const typeIdx = r.content.indexOf(`import type { TypeA }`);
    const runtimeIdx = r.content.indexOf(`import { BOUNDS }`);
    expect(typeIdx).toBeGreaterThan(-1);
    expect(runtimeIdx).toBeGreaterThan(typeIdx);
  });
});

// ── Group 2 · Determinism · byte-stable emission ───────────────────────

describe("§36-B · Route 2b · determinism", () => {
  const spec: TypedDataContractSpec = {
    contract_name: "D",
    header_comment: "",
    type_only_imports: [{ symbol: "T", from_specifier: "./t" }],
    runtime_imports: [
      { kind: "numeric_range_constant", name: "R1", from_specifier: "./r1" },
      { kind: "literal_union", name: "U1", from_specifier: "./u1" },
    ],
    declarations: [
      { declaration_kind: "refusal_reason_union", name: "R", exported: true, reasons: ["FAIL"] },
      {
        declaration_kind: "validator_function", name: "check", exported: true,
        input_type_name: "T", refusal_union_name: "R",
        checks: [{ field_path: "x", check_kind: "range_within", reference_name: "R1", refusal_reason_literal: "FAIL" }],
      },
    ],
  };

  it("RI-D-1 · identical spec twice → byte-identical output", () => {
    const a = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "d.ts" }));
    const b = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "d.ts" }));
    expect(sha(a.content)).toBe(sha(b.content));
  });

  it("RI-D-2 · runtime_imports order preserved across runs", () => {
    const a = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "d.ts" }));
    const r1Idx = a.content.indexOf(`import { R1 }`);
    const u1Idx = a.content.indexOf(`import { U1, U1_MEMBERS }`);
    expect(r1Idx).toBeGreaterThan(-1);
    expect(u1Idx).toBeGreaterThan(r1Idx);
  });

  it("RI-D-3 · mixed type+runtime import output is byte-stable", () => {
    const runs = [
      asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "d.ts" })).content,
      asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "d.ts" })).content,
      asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "d.ts" })).content,
    ];
    expect(runs[0]).toBe(runs[1]);
    expect(runs[1]).toBe(runs[2]);
  });
});

// ── Group 3 · Grammar rejection ────────────────────────────────────────

describe("§36-B · Route 2b · grammar rejection", () => {
  const baseDecls: TypedDataContractSpec["declarations"] = [
    { declaration_kind: "literal_union", name: "X", literals: ["a"], exported: true },
  ];

  function withRuntime(imp: unknown): TypedDataContractSpec {
    return {
      contract_name: "T", header_comment: "", type_only_imports: [],
      runtime_imports: [imp as TDCRuntimeImport],
      declarations: baseDecls,
    };
  }

  it("RI-N-1 · invalid kind refused with TDC_RUNTIME_IMPORT_INVALID_KIND", () => {
    const r = asFailure(authorTypedDataContract({ spec: withRuntime({ kind: "interface", name: "X", from_specifier: "./x" }), style: STYLE, target_path: "t.ts" }));
    expect(r.refusal_code).toBe("TDC_RUNTIME_IMPORT_INVALID_KIND");
  });

  it("RI-N-2 · kind='type_alias' refused", () => {
    const r = asFailure(authorTypedDataContract({ spec: withRuntime({ kind: "type_alias", name: "X", from_specifier: "./x" }), style: STYLE, target_path: "t.ts" }));
    expect(r.refusal_code).toBe("TDC_RUNTIME_IMPORT_INVALID_KIND");
  });

  it("RI-N-3 · kind='validator_function' refused", () => {
    const r = asFailure(authorTypedDataContract({ spec: withRuntime({ kind: "validator_function", name: "X", from_specifier: "./x" }), style: STYLE, target_path: "t.ts" }));
    expect(r.refusal_code).toBe("TDC_RUNTIME_IMPORT_INVALID_KIND");
  });

  it("RI-N-4 · invalid identifier name refused", () => {
    const r = asFailure(authorTypedDataContract({ spec: withRuntime({ kind: "numeric_range_constant", name: "1bad", from_specifier: "./x" }), style: STYLE, target_path: "t.ts" }));
    expect(r.refusal_code).toBe("TDC_INVALID_IDENTIFIER");
  });

  it("RI-N-5 · duplicate runtime_import symbol refused", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "T", header_comment: "", type_only_imports: [],
      runtime_imports: [
        { kind: "numeric_range_constant", name: "SAME", from_specifier: "./a" },
        { kind: "numeric_range_constant", name: "SAME", from_specifier: "./b" },
      ],
      declarations: baseDecls,
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "t.ts" }));
    expect(r.refusal_code).toBe("TDC_RUNTIME_IMPORT_COLLISION");
  });

  it("RI-N-6 · collision with local declaration refused", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "T", header_comment: "", type_only_imports: [],
      runtime_imports: [{ kind: "numeric_range_constant", name: "X", from_specifier: "./x" }],
      declarations: baseDecls,  // has local literal_union named "X"
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "t.ts" }));
    expect(r.refusal_code).toBe("TDC_RUNTIME_IMPORT_COLLISION");
  });

  it("RI-N-7 · collision with type_only_imports refused", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "T", header_comment: "",
      type_only_imports: [{ symbol: "SAME", from_specifier: "./type" }],
      runtime_imports: [{ kind: "numeric_range_constant", name: "SAME", from_specifier: "./runtime" }],
      declarations: baseDecls,
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "t.ts" }));
    expect(r.refusal_code).toBe("TDC_RUNTIME_IMPORT_COLLISION");
  });

  it("RI-N-8 · literal_union _MEMBERS collision refused", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "T", header_comment: "",
      type_only_imports: [{ symbol: "MyUnion_MEMBERS", from_specifier: "./type" }],
      runtime_imports: [{ kind: "literal_union", name: "MyUnion", from_specifier: "./runtime" }],
      declarations: baseDecls,
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "t.ts" }));
    expect(r.refusal_code).toBe("TDC_RUNTIME_IMPORT_COLLISION");
  });

  it("RI-N-9 · non-array runtime_imports refused", () => {
    const spec = {
      contract_name: "T", header_comment: "", type_only_imports: [],
      runtime_imports: "not-an-array",
      declarations: baseDecls,
    } as unknown as TypedDataContractSpec;
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "t.ts" }));
    expect(r.refusal_code).toBe("TDC_EMPTY_SPEC");
  });

  it("RI-N-10 · runtime_import entry is not an object refused", () => {
    const spec = {
      contract_name: "T", header_comment: "", type_only_imports: [],
      runtime_imports: ["oops"],
      declarations: baseDecls,
    } as unknown as TypedDataContractSpec;
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "t.ts" }));
    expect(r.refusal_code).toBe("TDC_RUNTIME_IMPORT_INVALID_KIND");
  });
});

// ── Group 4 · Path security ────────────────────────────────────────────

describe("§36-B · Route 2b · path security", () => {
  const baseDecls: TypedDataContractSpec["declarations"] = [
    { declaration_kind: "literal_union", name: "L", literals: ["a"], exported: true },
  ];

  function withSpec(from_specifier: string): TypedDataContractSpec {
    return {
      contract_name: "T", header_comment: "", type_only_imports: [],
      runtime_imports: [{ kind: "numeric_range_constant", name: "X", from_specifier }],
      declarations: baseDecls,
    };
  }

  it("RI-PS-1 · '../' path traversal refused", () => {
    const r = asFailure(authorTypedDataContract({ spec: withSpec("../escape"), style: STYLE, target_path: "t.ts" }));
    expect(r.refusal_code).toBe("TDC_RUNTIME_IMPORT_INVALID_SPECIFIER");
  });

  it("RI-PS-2 · absolute Unix path refused", () => {
    const r = asFailure(authorTypedDataContract({ spec: withSpec("/etc/passwd"), style: STYLE, target_path: "t.ts" }));
    expect(r.refusal_code).toBe("TDC_RUNTIME_IMPORT_INVALID_SPECIFIER");
  });

  it("RI-PS-3 · Windows drive path refused", () => {
    const r = asFailure(authorTypedDataContract({ spec: withSpec("C:/Windows"), style: STYLE, target_path: "t.ts" }));
    expect(r.refusal_code).toBe("TDC_RUNTIME_IMPORT_INVALID_SPECIFIER");
  });

  it("RI-PS-4 · backslash separator refused", () => {
    const r = asFailure(authorTypedDataContract({ spec: withSpec(".\\bad"), style: STYLE, target_path: "t.ts" }));
    expect(r.refusal_code).toBe("TDC_RUNTIME_IMPORT_INVALID_SPECIFIER");
  });

  it("RI-PS-5 · null-byte injection refused", () => {
    const r = asFailure(authorTypedDataContract({ spec: withSpec("./safe\0evil"), style: STYLE, target_path: "t.ts" }));
    expect(r.refusal_code).toBe("TDC_RUNTIME_IMPORT_INVALID_SPECIFIER");
  });

  it("RI-PS-6 · Node built-in refused with TDC_RUNTIME_IMPORT_NODE_BUILTIN", () => {
    const r = asFailure(authorTypedDataContract({ spec: withSpec("node:fs"), style: STYLE, target_path: "t.ts" }));
    expect(r.refusal_code).toBe("TDC_RUNTIME_IMPORT_NODE_BUILTIN");
  });

  it("RI-PS-7 · http:// scheme refused with TDC_RUNTIME_IMPORT_PROTOCOL_SCHEME", () => {
    const r = asFailure(authorTypedDataContract({ spec: withSpec("http://evil.example/mod"), style: STYLE, target_path: "t.ts" }));
    expect(r.refusal_code).toBe("TDC_RUNTIME_IMPORT_PROTOCOL_SCHEME");
  });

  it("RI-PS-8 · bare package specifier refused with TDC_RUNTIME_IMPORT_PACKAGE_SPECIFIER", () => {
    const r = asFailure(authorTypedDataContract({ spec: withSpec("react"), style: STYLE, target_path: "t.ts" }));
    expect(r.refusal_code).toBe("TDC_RUNTIME_IMPORT_PACKAGE_SPECIFIER");
  });

  it("RI-PS-9 · specifier with query string refused", () => {
    const r = asFailure(authorTypedDataContract({ spec: withSpec("./ranges?evil"), style: STYLE, target_path: "t.ts" }));
    expect(r.refusal_code).toBe("TDC_RUNTIME_IMPORT_INVALID_SPECIFIER");
  });

  it("RI-PS-10 · specifier with fragment refused", () => {
    const r = asFailure(authorTypedDataContract({ spec: withSpec("./ranges#hash"), style: STYLE, target_path: "t.ts" }));
    expect(r.refusal_code).toBe("TDC_RUNTIME_IMPORT_INVALID_SPECIFIER");
  });
});

// ── Group 5 · Injection refusal ────────────────────────────────────────

describe("§36-B · Route 2b · injection refusal", () => {
  const baseDecls: TypedDataContractSpec["declarations"] = [
    { declaration_kind: "literal_union", name: "L", literals: ["a"], exported: true },
  ];

  it("RI-S-1 · specifier containing 'eval(' refused as prohibited content", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "T", header_comment: "", type_only_imports: [],
      runtime_imports: [{ kind: "numeric_range_constant", name: "X", from_specifier: "./eval(x)" }],
      declarations: baseDecls,
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "t.ts" }));
    expect(r.refusal_code).toBe("TDC_PROHIBITED_STRING_CONTENT");
  });

  it("RI-S-2 · specifier containing 'require(' refused as prohibited content", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "T", header_comment: "", type_only_imports: [],
      runtime_imports: [{ kind: "numeric_range_constant", name: "X", from_specifier: "./require(x)" }],
      declarations: baseDecls,
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "t.ts" }));
    expect(r.refusal_code).toBe("TDC_PROHIBITED_STRING_CONTENT");
  });

  it("RI-S-3 · '<script>' in specifier refused", () => {
    const spec: TypedDataContractSpec = {
      contract_name: "T", header_comment: "", type_only_imports: [],
      runtime_imports: [{ kind: "numeric_range_constant", name: "X", from_specifier: "./<script>" }],
      declarations: baseDecls,
    };
    const r = asFailure(authorTypedDataContract({ spec, style: STYLE, target_path: "t.ts" }));
    expect(r.refusal_code).toBe("TDC_PROHIBITED_STRING_CONTENT");
  });
});

// ── Group 6 · Integration · validator uses runtime-imported constants ──

describe("§36-B · Route 2b · integration", () => {
  it("RI-I-1 · end-to-end validator authoring with cross-file runtime constants", () => {
    // Emulates C1's validator.ts: type-imports FacialState + refusal union,
    // runtime-imports range constants + viseme union, validator checks resolve.
    const spec: TypedDataContractSpec = {
      contract_name: "FacialValidator",
      header_comment: "Route 2b integration test · synthetic C1-shaped validator",
      type_only_imports: [
        { symbol: "Facial", from_specifier: "./facial" },
      ],
      runtime_imports: [
        { kind: "numeric_range_constant", name: "PITCH_BOUNDS", from_specifier: "./ranges" },
        { kind: "literal_union", name: "Viseme", from_specifier: "./facial" },
      ],
      declarations: [
        {
          declaration_kind: "refusal_reason_union",
          name: "FacialRefusal", exported: true,
          reasons: ["OUT_OF_RANGE_PITCH", "UNKNOWN_VISEME"],
        },
        {
          declaration_kind: "validator_function",
          name: "validate_facial", exported: true,
          input_type_name: "Facial",
          refusal_union_name: "FacialRefusal",
          checks: [
            { field_path: "pitch", check_kind: "range_within", reference_name: "PITCH_BOUNDS", refusal_reason_literal: "OUT_OF_RANGE_PITCH" },
            { field_path: "viseme", check_kind: "literal_union_member", reference_name: "Viseme", refusal_reason_literal: "UNKNOWN_VISEME" },
          ],
        },
      ],
    };
    const r = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "validator.ts" }));
    // Both imports present
    expect(r.content).toContain(`import type { Facial } from "./facial";`);
    expect(r.content).toContain(`import { PITCH_BOUNDS } from "./ranges";`);
    expect(r.content).toContain(`import { Viseme, Viseme_MEMBERS } from "./facial";`);
    // Validator body references the runtime constants
    expect(r.content).toContain(`v < PITCH_BOUNDS.min || v > PITCH_BOUNDS.max`);
    expect(r.content).toContain(`allowed: readonly string[] = Viseme_MEMBERS`);
    // Refusal reasons still checked
    expect(r.content).toContain(`return { ok: false, reason: "OUT_OF_RANGE_PITCH" };`);
    expect(r.content).toContain(`return { ok: false, reason: "UNKNOWN_VISEME" };`);
  });
});

// ── Group 7 · Regression · Route 2 backward-compat ─────────────────────

describe("§36-B · Route 2b · regression · Route 2 backward-compat", () => {
  it("RI-R-1 · Route-2-era spec renders identically without runtime_imports field", () => {
    // A Route 2 spec (no runtime_imports field): output must contain no
    // extra imports and must not fail because runtime_imports is absent.
    const spec: TypedDataContractSpec = {
      contract_name: "Legacy",
      header_comment: "Route 2 legacy shape",
      type_only_imports: [{ symbol: "TypeOnly", from_specifier: "./type" }],
      declarations: [
        { declaration_kind: "numeric_range_constant", name: "R", min: 0, max: 1, exported: true },
        { declaration_kind: "literal_union", name: "L", literals: ["a", "b"], exported: true },
      ],
    };
    const r = asSuccess(authorTypedDataContract({ spec, style: STYLE, target_path: "legacy.ts" }));
    // No runtime import statement emitted (no `import { R }` at file level)
    // - We look for the specific runtime pattern: `\nimport { ` (not preceded by "type")
    const lines = r.content.split("\n");
    const runtimeImportLines = lines.filter((l) => /^import \{ [^}]+ \} from /.test(l));
    expect(runtimeImportLines.length).toBe(0);
    // type_only_imports still emit
    expect(r.content).toContain(`import type { TypeOnly } from "./type";`);
    // Both declarations still render
    expect(r.content).toContain("export const R:");
    expect(r.content).toContain("export type L =");
  });
});
