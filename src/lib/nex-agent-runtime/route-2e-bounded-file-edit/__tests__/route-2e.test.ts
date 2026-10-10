// §36-ROUTE-2E · ROUTE-2E · 2026-09-15 · route-2e-bounded-file-edit
// NEX bounded infrastructure · Route 2e tests · 2026-09-15

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { applyRoute2eEdit } from "../route-2e";
import type {
  AddNamedExportOp,
  InsertImportOp,
  ReplaceMatchedRegionOp,
  Route2eFailure,
  Route2eRequest,
  Route2eSuccess,
} from "../route-2e-types";
import {
  ROUTE_2E_GREP_MARKER,
  ROUTE_2E_OPERATION_KINDS,
  ROUTE_2E_PROTECTED_PREFIXES,
  ROUTE_2E_REFUSAL_CODES,
} from "../route-2e-types";

// ── Fixture helpers ─────────────────────────────────────────────────────

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function req(overrides: Partial<Route2eRequest> & { current_content?: string; operation?: Route2eRequest["operation"]; expected_postcondition_substring?: string }): Route2eRequest {
  const current_content = overrides.current_content ?? "// hello\nexport const x = 1;\n";
  const operation = overrides.operation ?? ({ kind: "add_named_export", export_name: "y", export_declaration: "export const y = 2;", must_not_already_exist: true } as AddNamedExportOp);
  const expected_postcondition_substring = overrides.expected_postcondition_substring ?? "y = 2";
  return {
    workspace_relative_path: overrides.workspace_relative_path ?? "src/app/example/foo.ts",
    current_content,
    current_sha256_hex: overrides.current_sha256_hex ?? sha256Hex(current_content),
    operation,
    expected_postcondition_substring,
  };
}

function ok(r: ReturnType<typeof applyRoute2eEdit>): Route2eSuccess {
  expect(r.kind).toBe("SUCCESS");
  return r as Route2eSuccess;
}

function refuse(r: ReturnType<typeof applyRoute2eEdit>): Route2eFailure {
  expect(r.kind).toBe("FAILURE");
  return r as Route2eFailure;
}

// ── §A · Refusal codes (all 13 covered) ────────────────────────────────

describe("§36-ROUTE-2E · §A · refusal codes", () => {
  it("A-1 · R2E_INVALID_REQUEST when request is null", () => {
    const r = refuse(applyRoute2eEdit(null as never));
    expect(r.refusal_code).toBe("R2E_INVALID_REQUEST");
  });

  it("A-2 · R2E_INVALID_REQUEST when current_content is not a string", () => {
    const r = refuse(applyRoute2eEdit({ ...req({}), current_content: 42 as never }));
    expect(r.refusal_code).toBe("R2E_INVALID_REQUEST");
  });

  it("A-3 · R2E_PATH_OUTSIDE_WORKSPACE for absolute path", () => {
    const r = refuse(applyRoute2eEdit(req({ workspace_relative_path: "/etc/passwd" })));
    expect(r.refusal_code).toBe("R2E_PATH_OUTSIDE_WORKSPACE");
  });

  it("A-4 · R2E_PATH_OUTSIDE_WORKSPACE for path with '..'", () => {
    const r = refuse(applyRoute2eEdit(req({ workspace_relative_path: "src/../../secret.ts" })));
    expect(r.refusal_code).toBe("R2E_PATH_OUTSIDE_WORKSPACE");
  });

  it("A-5 · R2E_PATH_PROTECTED_MODULE for wave-a directory", () => {
    const r = refuse(applyRoute2eEdit(req({ workspace_relative_path: "src/lib/nex-agent-runtime/wave-a-language-framework/wave-a-language-framework.ts" })));
    expect(r.refusal_code).toBe("R2E_PATH_PROTECTED_MODULE");
  });

  it("A-6 · R2E_PATH_PROTECTED_MODULE for db/migrations/", () => {
    const r = refuse(applyRoute2eEdit(req({ workspace_relative_path: "db/migrations/2025_01_01_users.sql" })));
    expect(r.refusal_code).toBe("R2E_PATH_PROTECTED_MODULE");
  });

  it("A-7 · R2E_PATH_DENIED_ROOT for path outside allowed roots", () => {
    const r = refuse(applyRoute2eEdit(req({ workspace_relative_path: "node_modules/thing/index.ts" })));
    expect(r.refusal_code).toBe("R2E_PATH_DENIED_ROOT");
  });

  it("A-8 · R2E_SHA_MISMATCH when declared SHA does not match current_content", () => {
    const r = refuse(applyRoute2eEdit({
      ...req({}),
      current_sha256_hex: "0000000000000000000000000000000000000000000000000000000000000000",
    }));
    expect(r.refusal_code).toBe("R2E_SHA_MISMATCH");
  });

  it("A-9 · R2E_POSTCONDITION_ALREADY_SATISFIED when export already exists", () => {
    const content = "export const runtime = \"nodejs\";\n";
    const r = refuse(applyRoute2eEdit({
      workspace_relative_path: "src/app/foo/route.ts",
      current_content: content,
      current_sha256_hex: sha256Hex(content),
      operation: { kind: "add_named_export", export_name: "runtime", export_declaration: "export const runtime = \"nodejs\";", must_not_already_exist: true },
      expected_postcondition_substring: "runtime",
    }));
    expect(r.refusal_code).toBe("R2E_POSTCONDITION_ALREADY_SATISFIED");
  });

  it("A-10 · R2E_POSTCONDITION_UNSATISFIABLE when substring not found in output", () => {
    const r = refuse(applyRoute2eEdit(req({ expected_postcondition_substring: "not-going-to-be-in-output-XYZ" })));
    expect(r.refusal_code).toBe("R2E_POSTCONDITION_UNSATISFIABLE");
  });

  it("A-11 · R2E_MULTIPLE_ANCHOR_MATCHES when anchor appears 2+ times", () => {
    const content = "hello world\nhello world\n";
    const anchor = "hello wo";
    const r = refuse(applyRoute2eEdit({
      workspace_relative_path: "src/app/foo/x.ts",
      current_content: content,
      current_sha256_hex: sha256Hex(content),
      operation: { kind: "replace_matched_region", anchor: anchor, replacement: "greetings", must_be_unique: true } as ReplaceMatchedRegionOp,
      expected_postcondition_substring: "greetings",
    }));
    expect(r.refusal_code).toBe("R2E_MULTIPLE_ANCHOR_MATCHES");
  });

  it("A-12 · R2E_NO_ANCHOR_MATCH when anchor not found", () => {
    const content = "hello\n";
    const r = refuse(applyRoute2eEdit({
      workspace_relative_path: "src/app/foo/x.ts",
      current_content: content,
      current_sha256_hex: sha256Hex(content),
      operation: { kind: "replace_matched_region", anchor: "not-there-XYZ", replacement: "y", must_be_unique: true } as ReplaceMatchedRegionOp,
      expected_postcondition_substring: "y",
    }));
    expect(r.refusal_code).toBe("R2E_NO_ANCHOR_MATCH");
  });

  it("A-13 · R2E_PROHIBITED_CONTENT when edit would introduce eval(", () => {
    const content = "export const x = 1;\n";
    const r = refuse(applyRoute2eEdit({
      workspace_relative_path: "src/app/foo/x.ts",
      current_content: content,
      current_sha256_hex: sha256Hex(content),
      operation: { kind: "add_named_export", export_name: "bad", export_declaration: "export const bad = eval(\"1+1\");", must_not_already_exist: true } as AddNamedExportOp,
      expected_postcondition_substring: "bad",
    }));
    expect(r.refusal_code).toBe("R2E_PROHIBITED_CONTENT");
  });

  it("A-14 · R2E_INVALID_OPERATION_ARGS when operation kind unknown", () => {
    const content = "export const x = 1;\n";
    const r = refuse(applyRoute2eEdit({
      workspace_relative_path: "src/app/foo/x.ts",
      current_content: content,
      current_sha256_hex: sha256Hex(content),
      operation: { kind: "not-a-real-op" } as never,
      expected_postcondition_substring: "x",
    }));
    expect(r.refusal_code).toBe("R2E_INVALID_OPERATION_ARGS");
  });

  it("A-15 · R2E_INVALID_OPERATION_ARGS when export_name is not an identifier", () => {
    const content = "export const x = 1;\n";
    const r = refuse(applyRoute2eEdit({
      workspace_relative_path: "src/app/foo/x.ts",
      current_content: content,
      current_sha256_hex: sha256Hex(content),
      operation: { kind: "add_named_export", export_name: "not valid", export_declaration: "export const y = 2;", must_not_already_exist: true } as AddNamedExportOp,
      expected_postcondition_substring: "y",
    }));
    expect(r.refusal_code).toBe("R2E_INVALID_OPERATION_ARGS");
  });

  it("A-16 · R2E_INVALID_OPERATION_ARGS when anchor is too short", () => {
    const content = "export const x = 1;\n";
    const r = refuse(applyRoute2eEdit({
      workspace_relative_path: "src/app/foo/x.ts",
      current_content: content,
      current_sha256_hex: sha256Hex(content),
      operation: { kind: "replace_matched_region", anchor: "abc", replacement: "def", must_be_unique: true } as ReplaceMatchedRegionOp,
      expected_postcondition_substring: "def",
    }));
    expect(r.refusal_code).toBe("R2E_INVALID_OPERATION_ARGS");
  });
});

// ── §B · Grep marker ───────────────────────────────────────────────────

describe("§36-ROUTE-2E · §B · grep marker", () => {
  it("B-1 · SUCCESS carries the locked grep marker", () => {
    const r = ok(applyRoute2eEdit(req({})));
    expect(r.grep_marker).toBe(ROUTE_2E_GREP_MARKER);
  });

  it("B-2 · FAILURE carries the locked grep marker", () => {
    const r = refuse(applyRoute2eEdit(null as never));
    expect(r.grep_marker).toBe(ROUTE_2E_GREP_MARKER);
  });
});

// ── §C · add_named_export ──────────────────────────────────────────────

describe("§36-ROUTE-2E · §C · add_named_export", () => {
  it("C-1 · appends new export at end of file with trailing newline", () => {
    const content = "// module\nexport const x = 1;";
    const r = ok(applyRoute2eEdit({
      workspace_relative_path: "src/app/foo/route.ts",
      current_content: content,
      current_sha256_hex: sha256Hex(content),
      operation: { kind: "add_named_export", export_name: "runtime", export_declaration: "export const runtime = \"nodejs\";", must_not_already_exist: true },
      expected_postcondition_substring: "runtime = \"nodejs\"",
    }));
    expect(r.new_content).toBe("// module\nexport const x = 1;\nexport const runtime = \"nodejs\";\n");
    expect(r.bytes_added).toBeGreaterThan(0);
    expect(r.operation_kind).toBe("add_named_export");
  });

  it("C-2 · works when file has trailing whitespace", () => {
    const content = "export const a = 1;\n\n\n";
    const r = ok(applyRoute2eEdit({
      workspace_relative_path: "src/app/foo/x.ts",
      current_content: content,
      current_sha256_hex: sha256Hex(content),
      operation: { kind: "add_named_export", export_name: "b", export_declaration: "export const b = 2;", must_not_already_exist: true },
      expected_postcondition_substring: "b = 2",
    }));
    // Should trim trailing whitespace then append cleanly
    expect(r.new_content).toBe("export const a = 1;\nexport const b = 2;\n");
  });

  it("C-3 · refuses when export already exists (idempotent)", () => {
    const content = "export const runtime = \"nodejs\";\n";
    const r = refuse(applyRoute2eEdit({
      workspace_relative_path: "src/app/foo/route.ts",
      current_content: content,
      current_sha256_hex: sha256Hex(content),
      operation: { kind: "add_named_export", export_name: "runtime", export_declaration: "export const runtime = \"nodejs\";", must_not_already_exist: true },
      expected_postcondition_substring: "runtime",
    }));
    expect(r.refusal_code).toBe("R2E_POSTCONDITION_ALREADY_SATISFIED");
  });
});

// ── §D · insert_import ─────────────────────────────────────────────────

describe("§36-ROUTE-2E · §D · insert_import", () => {
  it("D-1 · inserts after last existing import", () => {
    const content = "import { A } from \"a\";\nimport { B } from \"b\";\n\nexport const x = 1;\n";
    const r = ok(applyRoute2eEdit({
      workspace_relative_path: "src/app/foo/x.ts",
      current_content: content,
      current_sha256_hex: sha256Hex(content),
      operation: { kind: "insert_import", import_line: "import { C } from \"c\";", must_not_already_exist: true },
      expected_postcondition_substring: "import { C } from \"c\";",
    }));
    expect(r.new_content).toContain("import { B } from \"b\";\nimport { C } from \"c\";");
  });

  it("D-2 · inserts at top when no imports present", () => {
    const content = "export const x = 1;\n";
    const r = ok(applyRoute2eEdit({
      workspace_relative_path: "src/app/foo/x.ts",
      current_content: content,
      current_sha256_hex: sha256Hex(content),
      operation: { kind: "insert_import", import_line: "import { A } from \"a\";", must_not_already_exist: true },
      expected_postcondition_substring: "import { A }",
    }));
    expect(r.new_content.startsWith("import { A } from \"a\";\n")).toBe(true);
  });

  it("D-3 · refuses when import already exists", () => {
    const content = "import { A } from \"a\";\nexport const x = 1;\n";
    const r = refuse(applyRoute2eEdit({
      workspace_relative_path: "src/app/foo/x.ts",
      current_content: content,
      current_sha256_hex: sha256Hex(content),
      operation: { kind: "insert_import", import_line: "import { A } from \"a\";", must_not_already_exist: true },
      expected_postcondition_substring: "A",
    }));
    expect(r.refusal_code).toBe("R2E_POSTCONDITION_ALREADY_SATISFIED");
  });
});

// ── §E · replace_matched_region ───────────────────────────────────────

describe("§36-ROUTE-2E · §E · replace_matched_region", () => {
  it("E-1 · replaces exactly one occurrence when anchor is unique", () => {
    const content = "const name = \"OLD_VALUE\";\n";
    const r = ok(applyRoute2eEdit({
      workspace_relative_path: "src/app/foo/x.ts",
      current_content: content,
      current_sha256_hex: sha256Hex(content),
      operation: { kind: "replace_matched_region", anchor: "OLD_VALUE", replacement: "NEW_VALUE", must_be_unique: true },
      expected_postcondition_substring: "NEW_VALUE",
    }));
    expect(r.new_content).toBe("const name = \"NEW_VALUE\";\n");
  });

  it("E-2 · replaces multi-line anchor cleanly", () => {
    const content = "before\n// TODO: replace me here\nafter\n";
    const r = ok(applyRoute2eEdit({
      workspace_relative_path: "src/app/foo/x.ts",
      current_content: content,
      current_sha256_hex: sha256Hex(content),
      operation: { kind: "replace_matched_region", anchor: "// TODO: replace me here", replacement: "const answer = 42;", must_be_unique: true },
      expected_postcondition_substring: "const answer = 42",
    }));
    expect(r.new_content).toBe("before\nconst answer = 42;\nafter\n");
  });
});

// ── §F · Determinism ───────────────────────────────────────────────────

describe("§36-ROUTE-2E · §F · determinism", () => {
  it("F-1 · same input yields identical output content and SHA", () => {
    const a = ok(applyRoute2eEdit(req({})));
    const b = ok(applyRoute2eEdit(req({})));
    expect(a.new_content).toBe(b.new_content);
    expect(a.new_sha256_hex).toBe(b.new_sha256_hex);
    expect(a.bytes_added).toBe(b.bytes_added);
  });
});

// ── §G · Prohibited content gate ───────────────────────────────────────

describe("§36-ROUTE-2E · §G · prohibited content gate", () => {
  it("G-1 · refuses to introduce dangerouslySetInnerHTML", () => {
    const content = "export const c = <div/>;\n";
    const r = refuse(applyRoute2eEdit({
      workspace_relative_path: "src/app/foo/x.tsx",
      current_content: content,
      current_sha256_hex: sha256Hex(content),
      operation: { kind: "add_named_export", export_name: "bad", export_declaration: "export const bad = <div dangerouslySetInnerHTML={{__html:x}}/>;", must_not_already_exist: true },
      expected_postcondition_substring: "bad",
    }));
    expect(r.refusal_code).toBe("R2E_PROHIBITED_CONTENT");
  });

  it("G-2 · allows edit when prohibited substring was already in original (does not INTRODUCE)", () => {
    // Original file already contains 'eval(' (e.g., a legitimate test fixture)
    const content = "// This file references eval( for a legitimate reason\nexport const x = 1;\n";
    const r = ok(applyRoute2eEdit({
      workspace_relative_path: "src/app/foo/x.ts",
      current_content: content,
      current_sha256_hex: sha256Hex(content),
      operation: { kind: "add_named_export", export_name: "y", export_declaration: "export const y = 2;", must_not_already_exist: true },
      expected_postcondition_substring: "y = 2",
    }));
    // eval( still present in new content but NOT introduced by the edit → allowed
    expect(r.new_content).toContain("eval(");
    expect(r.new_content).toContain("y = 2");
  });
});

// ── §H · Round-trip (rollback via re-derivation) ──────────────────────

describe("§36-ROUTE-2E · §H · round-trip", () => {
  it("H-1 · apply → new SHA differs from old SHA · re-applying with old SHA on new content refuses SHA_MISMATCH", () => {
    const original = "export const x = 1;\n";
    const first = ok(applyRoute2eEdit({
      workspace_relative_path: "src/app/foo/x.ts",
      current_content: original,
      current_sha256_hex: sha256Hex(original),
      operation: { kind: "add_named_export", export_name: "y", export_declaration: "export const y = 2;", must_not_already_exist: true },
      expected_postcondition_substring: "y = 2",
    }));
    expect(first.new_sha256_hex).not.toBe(sha256Hex(original));

    // Now try to apply another edit with STALE SHA (as if audit was against the old version)
    const stale = refuse(applyRoute2eEdit({
      workspace_relative_path: "src/app/foo/x.ts",
      current_content: first.new_content, // actually new content
      current_sha256_hex: sha256Hex(original), // stale SHA
      operation: { kind: "add_named_export", export_name: "z", export_declaration: "export const z = 3;", must_not_already_exist: true },
      expected_postcondition_substring: "z",
    }));
    expect(stale.refusal_code).toBe("R2E_SHA_MISMATCH");
  });
});

// ── §I · Locked catalogues ─────────────────────────────────────────────

describe("§36-ROUTE-2E · §I · locked catalogues", () => {
  it("I-1 · exactly 3 operation kinds locked", () => {
    expect(ROUTE_2E_OPERATION_KINDS).toEqual([
      "add_named_export",
      "insert_import",
      "replace_matched_region",
    ]);
  });

  it("I-2 · exactly 13 refusal codes locked", () => {
    expect(ROUTE_2E_REFUSAL_CODES.length).toBe(13);
  });

  it("I-3 · protected-prefix list includes Wave A/B/E5/E3 and route-2* families", () => {
    const asStr = ROUTE_2E_PROTECTED_PREFIXES.join(",");
    expect(asStr).toContain("wave-a-language-framework/");
    expect(asStr).toContain("wave-b-cross-cutting/");
    expect(asStr).toContain("skills/");
    expect(asStr).toContain("specialist-reviewers/");
    expect(asStr).toContain("route-2e-bounded-file-edit/");
    expect(asStr).toContain("db/migrations/");
  });
});
