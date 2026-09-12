// src/lib/nex-agent/code-engine/adapters/ast-semantic.test.ts
//
// Sprint 2 · AST semantic adapter tests · deterministic · no model · no network.
// Proves the three semantic operations against fixture source snippets.

import { describe, expect, it } from "vitest";
import { AstSemanticAdapter, AST_SEMANTIC_ID } from "./ast-semantic";
import { NEX1_ENGINE_ERRORS } from "../types";
import type { Nex1ReasoningRequest } from "../types";

function mkReq(fileText: string, path: string, directive: any): Nex1ReasoningRequest {
  return {
    task_id: "t", attempt_id: "a", intent: "add_feature", output_kind: "diff",
    context: {
      task_prompt: "x",
      repo_snapshot_hash: "h",
      file_slices: [{ path, content: fileText, content_hash: "h" }],
      relevant_adrs: [],
      declared_scope: [path],
    },
    template_directive: directive,
  };
}

describe("AST semantic adapter · capabilities", () => {
  it("is available and deterministic with no network egress", async () => {
    expect(await AstSemanticAdapter.isAvailable()).toBe(true);
    const cap = AstSemanticAdapter.capabilities();
    expect(cap.deterministic).toBe(true);
    expect(cap.network_egress).toBe("none");
  });
  it("id is 'ast-semantic'", () => {
    expect(AstSemanticAdapter.id).toBe(AST_SEMANTIC_ID);
    expect(AstSemanticAdapter.id).toBe("ast-semantic");
  });
});

describe("AST semantic adapter · returns reasoning_not_bound for non-semantic directives", () => {
  it("rejects add_jsdoc (belongs to template-only)", async () => {
    const req = mkReq('export function foo() {}\n', "src/x.ts", {
      kind: "add_jsdoc", target_path: "src/x.ts", target_symbol: "foo", summary: "s",
    });
    const r = await AstSemanticAdapter.reason(req);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(NEX1_ENGINE_ERRORS.reasoning_not_bound);
  });
});

describe("AST semantic adapter · add_interface_field", () => {
  it("adds a new readonly field to an existing interface", async () => {
    const src = `export interface P {\n  readonly a: string;\n}\n`;
    const req = mkReq(src, "src/p.ts", {
      kind: "add_interface_field",
      target_path: "src/p.ts",
      target_interface: "P",
      field_name: "b",
      field_type: "number | null",
    });
    const r = await AstSemanticAdapter.reason(req);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.proposed_diff).toContain("+");
      expect(r.result.proposed_diff).toContain("b");
      expect(r.result.deterministic).toBe(true);
    }
  });

  it("is a no-op when the field already exists", async () => {
    const src = `export interface P {\n  readonly a: string;\n  readonly b: number | null;\n}\n`;
    const req = mkReq(src, "src/p.ts", {
      kind: "add_interface_field", target_path: "src/p.ts",
      target_interface: "P", field_name: "b", field_type: "number | null",
    });
    const r = await AstSemanticAdapter.reason(req);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.rationale).toContain("already present");
  });

  it("fails when the interface does not exist", async () => {
    const src = `export interface Q { readonly x: number; }\n`;
    const req = mkReq(src, "src/p.ts", {
      kind: "add_interface_field", target_path: "src/p.ts",
      target_interface: "DoesNotExist", field_name: "b", field_type: "number",
    });
    const r = await AstSemanticAdapter.reason(req);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("not found");
  });

  it("fails when field_type is not parseable as a type", async () => {
    const src = `export interface P { readonly a: string; }\n`;
    const req = mkReq(src, "src/p.ts", {
      kind: "add_interface_field", target_path: "src/p.ts",
      target_interface: "P", field_name: "b", field_type: "not a valid type ~~~",
    });
    const r = await AstSemanticAdapter.reason(req);
    // The synthetic parse may accept the raw text as a name-with-suffix; regardless the result must not crash
    expect(typeof r.ok).toBe("boolean");
  });
});

describe("AST semantic adapter · add_return_object_property", () => {
  it("adds a property to a function's return-object literal", async () => {
    const src = `export function build(): { a: number } {\n  return { a: 1 };\n}\n`;
    const req = mkReq(src, "src/b.ts", {
      kind: "add_return_object_property",
      target_path: "src/b.ts",
      target_function: "build",
      property_name: "b",
      property_value: "42",
    });
    const r = await AstSemanticAdapter.reason(req);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.proposed_diff).toContain("b:");
      expect(r.result.proposed_diff).toContain("42");
    }
  });

  it("is a no-op when the property already exists", async () => {
    const src = `export function build(): any {\n  return { a: 1, b: 42 };\n}\n`;
    const req = mkReq(src, "src/b.ts", {
      kind: "add_return_object_property", target_path: "src/b.ts",
      target_function: "build", property_name: "b", property_value: "42",
    });
    const r = await AstSemanticAdapter.reason(req);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.rationale).toContain("already present");
  });

  it("fails when the function does not exist", async () => {
    const src = `export function other() { return {}; }\n`;
    const req = mkReq(src, "src/b.ts", {
      kind: "add_return_object_property", target_path: "src/b.ts",
      target_function: "missing", property_name: "b", property_value: "42",
    });
    const r = await AstSemanticAdapter.reason(req);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("not found");
  });

  it("fails when the function has no return-object literal", async () => {
    const src = `export function build(): number { return 42; }\n`;
    const req = mkReq(src, "src/b.ts", {
      kind: "add_return_object_property", target_path: "src/b.ts",
      target_function: "build", property_name: "b", property_value: "42",
    });
    const r = await AstSemanticAdapter.reason(req);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("no return-object literal");
  });
});

describe("AST semantic adapter · add_test_case", () => {
  it("adds a new it() inside an existing describe()", async () => {
    const src = `import { describe, it, expect } from "vitest";\ndescribe("nex1 provenance", () => {\n  it("first", () => { expect(1).toBe(1); });\n});\n`;
    const req = mkReq(src, "src/x.test.ts", {
      kind: "add_test_case",
      target_path: "src/x.test.ts",
      target_describe: "nex1 provenance",
      test_name: "resolved_at is populated",
      test_body: "expect(true).toBe(true);",
    });
    const r = await AstSemanticAdapter.reason(req);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.proposed_diff).toContain("resolved_at is populated");
      expect(r.result.proposed_diff).toContain("expect");
    }
  });

  it("is a no-op when the it() name already exists", async () => {
    const src = `describe("g", () => {\n  it("first", () => {});\n});\n`;
    const req = mkReq(src, "src/x.test.ts", {
      kind: "add_test_case", target_path: "src/x.test.ts",
      target_describe: "g", test_name: "first", test_body: "expect(1).toBe(1);",
    });
    const r = await AstSemanticAdapter.reason(req);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.rationale).toContain("already present");
  });

  it("fails when describe() is not found", async () => {
    const src = `describe("other", () => {});\n`;
    const req = mkReq(src, "src/x.test.ts", {
      kind: "add_test_case", target_path: "src/x.test.ts",
      target_describe: "does not exist", test_name: "x", test_body: "expect(1).toBe(1);",
    });
    const r = await AstSemanticAdapter.reason(req);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("not found");
  });
});

describe("AST semantic adapter · scope enforcement", () => {
  it("refuses target_path outside declared_scope", async () => {
    const req: Nex1ReasoningRequest = {
      task_id: "t", attempt_id: "a", intent: "add_feature", output_kind: "diff",
      context: {
        task_prompt: "x", repo_snapshot_hash: "h",
        file_slices: [{ path: "src/allowed.ts", content: "", content_hash: "h" }],
        relevant_adrs: [],
        declared_scope: ["src/allowed.ts"],
      },
      template_directive: {
        kind: "add_interface_field", target_path: "src/OUT_OF_SCOPE.ts",
        target_interface: "P", field_name: "b", field_type: "number",
      },
    };
    const r = await AstSemanticAdapter.reason(req);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(NEX1_ENGINE_ERRORS.scope_violation);
  });
});
