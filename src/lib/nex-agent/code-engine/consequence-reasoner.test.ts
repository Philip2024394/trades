// src/lib/nex-agent/code-engine/consequence-reasoner.test.ts

import { describe, expect, it } from "vitest";
import {
  parseTscOutput,
  extractMissingPropertyFindings,
  composeRepairDirective,
} from "./consequence-reasoner";

describe("consequence-reasoner · parseTscOutput", () => {
  it("parses a single-line error", () => {
    const text = `src/x.ts(10,3): error TS2322: Type 'A' is not assignable to type 'B'.`;
    const d = parseTscOutput(text);
    expect(d).toHaveLength(1);
    expect(d[0].file).toBe("src/x.ts");
    expect(d[0].line).toBe(10);
    expect(d[0].column).toBe(3);
    expect(d[0].code).toBe("TS2322");
  });

  it("groups continuation lines with the primary", () => {
    const text = [
      `src/x.ts(1,1): error TS2322: Type '{...}' is not assignable to type 'Y'.`,
      `  Type '{...}' is missing the following properties from type 'Y': foo, bar`,
    ].join("\n");
    const d = parseTscOutput(text);
    expect(d).toHaveLength(1);
    expect(d[0].continuation).toHaveLength(1);
    expect(d[0].continuation[0]).toContain("missing the following properties");
  });

  it("handles multiple diagnostics separated by blank lines", () => {
    const text = [
      `a.ts(1,1): error TS2322: fail one.`,
      ``,
      `b.ts(2,2): error TS2339: fail two.`,
    ].join("\n");
    const d = parseTscOutput(text);
    expect(d).toHaveLength(2);
    expect(d[0].file).toBe("a.ts");
    expect(d[1].file).toBe("b.ts");
  });
});

describe("consequence-reasoner · extractMissingPropertyFindings", () => {
  it("extracts a single missing property from TS2322 continuation", () => {
    const text = [
      `src/x.ts(20,5): error TS2322: Type '{ a: 1 }[]' is not assignable to type 'P[]'.`,
      `  Type '{ a: 1 }' is missing the following properties from type 'P': resolved_at`,
    ].join("\n");
    const d = parseTscOutput(text);
    const f = extractMissingPropertyFindings(d);
    expect(f).toHaveLength(1);
    expect(f[0].type_name).toBe("P");
    expect(f[0].missing_properties).toEqual(["resolved_at"]);
    expect(f[0].file).toBe("src/x.ts");
    expect(f[0].line).toBe(20);
  });

  it("extracts multiple missing properties", () => {
    const text = [
      `src/x.ts(1,1): error TS2739: Type '{}' is missing the following properties from type 'P': foo, bar, baz`,
    ].join("\n");
    const d = parseTscOutput(text);
    const f = extractMissingPropertyFindings(d);
    expect(f).toHaveLength(1);
    expect(f[0].missing_properties).toEqual(["foo", "bar", "baz"]);
  });

  it("ignores unrelated error codes", () => {
    const text = `src/x.ts(1,1): error TS9999: something else entirely`;
    const d = parseTscOutput(text);
    expect(extractMissingPropertyFindings(d)).toHaveLength(0);
  });
  it("extracts singular-form 'Property X is missing in type Y but required in type Z'", () => {
    const text = [
      `src/x.ts(1,1): error TS2741: Property 'resolved_at' is missing in type '{ a: 1; }' but required in type 'Nex1AttemptProvenance'.`,
    ].join("\n");
    const d = parseTscOutput(text);
    const f = extractMissingPropertyFindings(d);
    expect(f).toHaveLength(1);
    expect(f[0].type_name).toBe("Nex1AttemptProvenance");
    expect(f[0].missing_properties).toEqual(["resolved_at"]);
  });
  it("handles nested continuation with singular pattern (TS2322 with array)", () => {
    const text = [
      `src/x.ts(1,1): error TS2322: Type '{...}[]' is not assignable to type 'Y[]'.`,
      `  Type '{...}' is not assignable to type 'Y'.`,
      `    Property 'foo' is missing in type '{...}' but required in type 'Y'.`,
    ].join("\n");
    const d = parseTscOutput(text);
    const f = extractMissingPropertyFindings(d);
    expect(f).toHaveLength(1);
    expect(f[0].missing_properties).toContain("foo");
    expect(f[0].type_name).toBe("Y");
  });
});

describe("consequence-reasoner · composeRepairDirective", () => {
  it("uses null default for _at fields", () => {
    const dir = composeRepairDirective(
      { file: "x.ts", line: 1, column: 1, type_name: "P", missing_properties: ["resolved_at"] },
      "resolved_at",
    );
    expect(dir.kind).toBe("add_property_to_object_at_position");
    expect(dir.property_value).toBe("null");
  });
  it("uses empty-string default for id/hash/name", () => {
    expect(composeRepairDirective(
      { file: "x.ts", line: 1, column: 1, type_name: "P", missing_properties: ["task_id"] },
      "task_id",
    ).property_value).toBe('""');
    expect(composeRepairDirective(
      { file: "x.ts", line: 1, column: 1, type_name: "P", missing_properties: ["prompt_hash"] },
      "prompt_hash",
    ).property_value).toBe('""');
  });
  it("uses 0 for count/size/ms", () => {
    expect(composeRepairDirective(
      { file: "x.ts", line: 1, column: 1, type_name: "P", missing_properties: ["latency_ms"] },
      "latency_ms",
    ).property_value).toBe("0");
  });
  it("normalises backslash paths", () => {
    const dir = composeRepairDirective(
      { file: "src\\x.ts", line: 1, column: 1, type_name: "P", missing_properties: ["y"] },
      "y",
    );
    expect(dir.target_path).toBe("src/x.ts");
  });
});
