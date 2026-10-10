import { describe, it, expect } from "vitest";
import {
  opCreateFile,
  opModifyReturn,
  opAddExport,
  opUpdateImport,
  opReplaceExpression,
  opAddObjectProperty,
  opModifyComponentPropDefault,
  listOperators,
  CODE_OPERATOR_LIBRARY_VERSION,
} from "./capability-code-operator-library";

describe("expanded operator library · 7 real primitives (§12)", () => {
  describe("create_file", () => {
    it("emits new-file content with hash", () => {
      const r = opCreateFile({ path: "src/foo.ts", content: "export const foo = 1;\n" });
      expect(r.ok).toBe(true);
      expect(r.content_hash.length).toBe(16);
    });
    it("refuses path traversal", () => {
      const r = opCreateFile({ path: "../../etc/passwd", content: "x" });
      expect(r.ok).toBe(false);
      expect(r.refusal_reason).toBe("path_traversal_refused");
    });
    it("refuses empty path", () => {
      const r = opCreateFile({ path: "", content: "x" });
      expect(r.ok).toBe(false);
    });
    it("refuses TS content with unbalanced braces", () => {
      const r = opCreateFile({ path: "src/foo.ts", content: "export function x() { return { a: 1 }" });
      expect(r.ok).toBe(false);
      expect(r.refusal_reason).toBe("unbalanced_braces_in_generated_content");
    });
  });

  describe("modify_return", () => {
    it("changes the return of a named function", () => {
      const src = "export function classify(): number { return 40; }";
      const r = opModifyReturn({ content: src, function_name: "classify", new_return_expression: "30" });
      expect(r.ok).toBe(true);
      expect(r.new_content).toContain("return 30;");
      expect(r.new_content).not.toContain("return 40;");
    });
    it("refuses when function not found", () => {
      const src = "export function foo() { return 1; }";
      const r = opModifyReturn({ content: src, function_name: "bar", new_return_expression: "2" });
      expect(r.ok).toBe(false);
      expect(r.refusal_reason).toContain("function_not_found");
    });
    it("only changes the first return in the target function", () => {
      const src = "export function a() { return 1; }\nexport function b() { return 2; }";
      const r = opModifyReturn({ content: src, function_name: "a", new_return_expression: "9" });
      expect(r.new_content).toContain("function a() { return 9;");
      expect(r.new_content).toContain("function b() { return 2;");
    });
  });

  describe("add_export", () => {
    it("prefixes a declaration with export", () => {
      const src = "const Button = () => null;";
      const r = opAddExport({ content: src, symbol: "Button", export_mode: "convert_declaration" });
      expect(r.ok).toBe(true);
      expect(r.new_content).toContain("export const Button");
    });
    it("refuses when already exported", () => {
      const src = "export const Button = () => null;";
      const r = opAddExport({ content: src, symbol: "Button", export_mode: "convert_declaration" });
      expect(r.ok).toBe(false);
      expect(r.refusal_reason).toBe("already_exported");
    });
    it("appends a reexport statement", () => {
      const src = "export const A = 1;\n";
      const r = opAddExport({ content: src, symbol: "B", export_mode: "reexport", from_module: "./b" });
      expect(r.ok).toBe(true);
      expect(r.new_content).toContain(`export { B } from "./b";`);
    });
    it("refuses reexport without from_module", () => {
      const r = opAddExport({ content: "", symbol: "x", export_mode: "reexport" });
      expect(r.ok).toBe(false);
      expect(r.refusal_reason).toBe("missing_from_module_for_reexport");
    });
  });

  describe("update_import", () => {
    it("changes the module path of an existing named import", () => {
      const src = `import { Button } from "./old-path";\n`;
      const r = opUpdateImport({ content: src, current_module: "./old-path", new_module: "./new-path" });
      expect(r.ok).toBe(true);
      expect(r.new_content).toContain(`"./new-path"`);
      expect(r.new_content).not.toContain(`"./old-path"`);
    });
    it("adds a name to an existing named import list", () => {
      const src = `import { Button } from "./ui";\n`;
      const r = opUpdateImport({ content: src, current_module: "./ui", add_named: ["Card"] });
      expect(r.ok).toBe(true);
      expect(r.new_content).toContain("{ Button, Card }");
    });
    it("removes a name from a named import list", () => {
      const src = `import { Button, Card, Nav } from "./ui";\n`;
      const r = opUpdateImport({ content: src, current_module: "./ui", remove_named: ["Card"] });
      expect(r.ok).toBe(true);
      expect(r.new_content).not.toContain("Card");
    });
    it("refuses when import not found", () => {
      const r = opUpdateImport({ content: "", current_module: "./nowhere", new_module: "./somewhere" });
      expect(r.ok).toBe(false);
    });
  });

  describe("replace_expression", () => {
    it("replaces exact substring when unambiguous", () => {
      const src = "const x = 42;";
      const r = opReplaceExpression({ content: src, target: "42", replacement: "100" });
      expect(r.ok).toBe(true);
      expect(r.new_content).toBe("const x = 100;");
    });
    it("refuses on ambiguous match (default max=1)", () => {
      const src = "const a = 42; const b = 42;";
      const r = opReplaceExpression({ content: src, target: "42", replacement: "0" });
      expect(r.ok).toBe(false);
      expect(r.refusal_reason).toContain("ambiguous_match");
    });
    it("allows multiple replacements when max_occurrences permits", () => {
      const src = "const a = 42; const b = 42;";
      const r = opReplaceExpression({ content: src, target: "42", replacement: "0", max_occurrences: 2 });
      expect(r.ok).toBe(true);
      expect(r.new_content).toBe("const a = 0; const b = 0;");
    });
  });

  describe("add_object_property", () => {
    it("adds a key:value to an anchored object", () => {
      const src = "const config = {\n  theme: 'light',\n};\n";
      const r = opAddObjectProperty({ content: src, anchor_symbol: "const config", key: "compact", value: "true" });
      expect(r.ok).toBe(true);
      expect(r.new_content).toContain("compact: true");
    });
    it("refuses when key already exists", () => {
      const src = "const config = {\n  compact: false,\n};\n";
      const r = opAddObjectProperty({ content: src, anchor_symbol: "const config", key: "compact", value: "true" });
      expect(r.ok).toBe(false);
      expect(r.refusal_reason).toBe("key_already_present");
    });
    it("refuses when anchor not found", () => {
      const r = opAddObjectProperty({ content: "", anchor_symbol: "const nope", key: "x", value: "1" });
      expect(r.ok).toBe(false);
    });
  });

  describe("modify_component_prop_default", () => {
    it("changes a prop default in a React component", () => {
      const src = `export function Button({ color = "blue", size = "md" }: Props) { return <div />; }`;
      const r = opModifyComponentPropDefault({
        content: src,
        component_name: "Button",
        prop_name: "color",
        new_default_value: `"orange"`,
      });
      expect(r.ok).toBe(true);
      expect(r.new_content).toContain(`color = "orange"`);
      expect(r.new_content).not.toContain(`color = "blue"`);
    });
    it("refuses when component signature not matched", () => {
      const src = `const notAComponent = 5;`;
      const r = opModifyComponentPropDefault({ content: src, component_name: "Nope", prop_name: "x", new_default_value: "1" });
      expect(r.ok).toBe(false);
    });
  });

  describe("invariants", () => {
    it("every operator declares zero_llm + ledger=B", () => {
      const r = opCreateFile({ path: "a.ts", content: "export const x = 1;\n" });
      expect(r.zero_llm).toBe(true);
      expect(r.ledger).toBe("B");
    });
    it("listOperators returns 7 operators with metadata", () => {
      const ops = listOperators();
      expect(ops.length).toBe(7);
      const ids = ops.map((o) => o.operator_id);
      expect(ids).toContain("create_file");
      expect(ids).toContain("modify_return");
      expect(ids).toContain("add_export");
      expect(ids).toContain("update_import");
      expect(ids).toContain("replace_expression");
      expect(ids).toContain("add_object_property");
      expect(ids).toContain("modify_component_prop_default");
    });
    it("canonical version", () => {
      expect(CODE_OPERATOR_LIBRARY_VERSION).toBe("code-operator-library.v1.2026-09-19");
    });
  });

  describe("post-transform safety", () => {
    it("returns hash of new content · deterministic", () => {
      const r1 = opModifyReturn({ content: "function f() { return 1; }", function_name: "f", new_return_expression: "2" });
      const r2 = opModifyReturn({ content: "function f() { return 1; }", function_name: "f", new_return_expression: "2" });
      expect(r1.output_hash).toBe(r2.output_hash);
    });
  });
});
