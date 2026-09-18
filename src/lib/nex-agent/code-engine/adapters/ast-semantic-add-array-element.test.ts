// NEX1 · Rung-3 · add_array_element operator tests · deterministic · zero LLM.
// Founder-authorised 2026-09-15 · covers all 10 required cases:
//   (1) successful insertion
//   (2) correct array identification
//   (3) correct element structure
//   (4) preservation of existing elements
//   (5) duplicate prevention
//   (6) malformed / unsupported array structures
//   (7) wrong symbol
//   (8) ambiguous target
//   (9) unsafe target (protected file guard is caller-side; operator refuses
//       cleanly on unsupported initializer forms which covers our safety net)
//  (10) formatting / parse validity of the mutated source
//
// The operator MUST NOT be modified to make these tests pass by cheating.
// Truth-only: if a test fails, that failure IS the report.

import { describe, it, expect } from "vitest";
import ts from "typescript";
import { applyAddArrayElement } from "./ast-semantic";

// A canonical registry source that closely mirrors src/lib/nex-hq-agents/registry.ts
const REGISTRY_SOURCE = `import { COLLECTIONS } from "@/lib/nex/storage/types";
import type { AgentDescriptor } from "./types";

export const AGENT_REGISTRY: readonly AgentDescriptor[] = Object.freeze([
  {
    id: "alpha",
    name: "Alpha Agent",
    kind: "orchestrator",
    lane: "orchestrator",
    source_collection: COLLECTIONS.some_thing,
    wire_downstream: ["beta"],
  },
  {
    id: "beta",
    name: "Beta Agent",
    kind: "author-stage",
    lane: "orchestrator",
    source_collection: COLLECTIONS.some_thing,
    wire_downstream: [],
  },
]);
`;

const PEER_ELEMENT = `{
    id: "alpha",
    name: "Alpha Agent",
    kind: "orchestrator",
    lane: "orchestrator",
    source_collection: COLLECTIONS.some_thing,
    wire_downstream: ["beta"],
  }`;

function parseValid(source: string): number {
  const sf = ts.createSourceFile("__t.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  return (sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics?.length ?? 0;
}

describe("Rung-3 · applyAddArrayElement · deterministic AST operator · zero LLM", () => {
  // (1) successful insertion
  it("case 1 · successful insertion of one new element", () => {
    const result = applyAddArrayElement(REGISTRY_SOURCE, {
      array_symbol: "AGENT_REGISTRY",
      missing_ids: ["gamma"],
      peer_element_source: PEER_ELEMENT,
      id_field: "id",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.inserted_ids).toEqual(["gamma"]);
    expect(result.skipped_already_present_ids).toEqual([]);
    expect(result.next).toContain(`id: "gamma"`);
  });

  // (2) correct array identification (must find AGENT_REGISTRY specifically,
  //     not any other array in the file)
  it("case 2 · correctly identifies the named array symbol", () => {
    const multiSource = `export const OTHER_ARRAY = [1, 2, 3];\n` + REGISTRY_SOURCE;
    const result = applyAddArrayElement(multiSource, {
      array_symbol: "AGENT_REGISTRY",
      missing_ids: ["gamma"],
      peer_element_source: PEER_ELEMENT,
      id_field: "id",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The mutation must land inside AGENT_REGISTRY, not the numeric array
    expect(result.next).toContain(`OTHER_ARRAY = [1, 2, 3]`);
    expect(result.next).toContain(`id: "gamma"`);
  });

  // (3) correct element structure (all peer fields preserved, id substituted)
  it("case 3 · new element has correct structure derived from peer", () => {
    const result = applyAddArrayElement(REGISTRY_SOURCE, {
      array_symbol: "AGENT_REGISTRY",
      missing_ids: ["gamma"],
      peer_element_source: PEER_ELEMENT,
      id_field: "id",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The new element MUST contain the substituted id
    expect(result.next).toContain(`id: "gamma"`);
    // And it MUST have preserved the peer's non-id fields verbatim
    // (name, kind, lane, source_collection, wire_downstream all present in
    // the inserted block · counted below by string match)
    // Find the inserted element bounds: locate `id: "gamma"` and the next `}`
    const gammaIdx = result.next.indexOf(`id: "gamma"`);
    expect(gammaIdx).toBeGreaterThan(0);
    const closeIdx = result.next.indexOf("}", gammaIdx);
    const insertedBlock = result.next.slice(gammaIdx, closeIdx);
    expect(insertedBlock).toContain(`name: "Alpha Agent"`);
    expect(insertedBlock).toContain(`kind: "orchestrator"`);
    expect(insertedBlock).toContain(`lane: "orchestrator"`);
    expect(insertedBlock).toContain(`source_collection: COLLECTIONS.some_thing`);
    expect(insertedBlock).toContain(`wire_downstream: ["beta"]`);
  });

  // (4) preservation of existing elements
  it("case 4 · preserves every existing element verbatim", () => {
    const result = applyAddArrayElement(REGISTRY_SOURCE, {
      array_symbol: "AGENT_REGISTRY",
      missing_ids: ["gamma"],
      peer_element_source: PEER_ELEMENT,
      id_field: "id",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Every original id still exists after mutation
    expect(result.next).toContain(`id: "alpha"`);
    expect(result.next).toContain(`id: "beta"`);
    // Original count of each existing id line is unchanged (still exactly 1)
    const countAlpha = result.next.match(/id: "alpha"/g)?.length ?? 0;
    const countBeta = result.next.match(/id: "beta"/g)?.length ?? 0;
    expect(countAlpha).toBe(1);
    expect(countBeta).toBe(1);
  });

  // (5) duplicate prevention
  it("case 5 · refuses to insert an id that already exists · treats as skipped", () => {
    const result = applyAddArrayElement(REGISTRY_SOURCE, {
      array_symbol: "AGENT_REGISTRY",
      missing_ids: ["alpha"], // alpha already exists
      peer_element_source: PEER_ELEMENT,
      id_field: "id",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.inserted_ids).toEqual([]);
    expect(result.skipped_already_present_ids).toEqual(["alpha"]);
    expect(result.next).toBe(REGISTRY_SOURCE); // no mutation
  });

  it("case 5b · mixed input · inserts new · skips duplicates · no double-insertion", () => {
    const result = applyAddArrayElement(REGISTRY_SOURCE, {
      array_symbol: "AGENT_REGISTRY",
      missing_ids: ["alpha", "delta"],
      peer_element_source: PEER_ELEMENT,
      id_field: "id",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.inserted_ids).toEqual(["delta"]);
    expect(result.skipped_already_present_ids).toEqual(["alpha"]);
    // alpha still exactly once (not duplicated by mutation)
    const countAlpha = (result.next.match(/id: "alpha"/g) ?? []).length;
    expect(countAlpha).toBe(1);
    // delta present exactly once (inserted)
    const countDelta = (result.next.match(/id: "delta"/g) ?? []).length;
    expect(countDelta).toBe(1);
  });

  // (6) malformed / unsupported array structures
  it("case 6a · refuses when initializer is not an array literal", () => {
    const badSource = `export const AGENT_REGISTRY = 42;\n`;
    const result = applyAddArrayElement(badSource, {
      array_symbol: "AGENT_REGISTRY",
      missing_ids: ["gamma"],
      peer_element_source: PEER_ELEMENT,
      id_field: "id",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal).toBe("initializer_not_supported_form");
  });

  it("case 6b · refuses when peer_element_source is empty", () => {
    const result = applyAddArrayElement(REGISTRY_SOURCE, {
      array_symbol: "AGENT_REGISTRY",
      missing_ids: ["gamma"],
      peer_element_source: "",
      id_field: "id",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal).toBe("input_empty_peer");
  });

  it("case 6c · refuses when peer_element_source is not a valid object literal", () => {
    const result = applyAddArrayElement(REGISTRY_SOURCE, {
      array_symbol: "AGENT_REGISTRY",
      missing_ids: ["gamma"],
      peer_element_source: "not a valid object",
      id_field: "id",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal).toBe("peer_unparseable");
  });

  it("case 6d · refuses when peer has no id_field property", () => {
    const result = applyAddArrayElement(REGISTRY_SOURCE, {
      array_symbol: "AGENT_REGISTRY",
      missing_ids: ["gamma"],
      peer_element_source: `{ name: "no id here" }`,
      id_field: "id",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal).toBe("peer_missing_id_field");
  });

  it("case 6e · refuses when peer id_field value is not a string literal", () => {
    const result = applyAddArrayElement(REGISTRY_SOURCE, {
      array_symbol: "AGENT_REGISTRY",
      missing_ids: ["gamma"],
      peer_element_source: `{ id: 42 }`,
      id_field: "id",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal).toBe("peer_id_field_not_string_literal");
  });

  // (7) wrong symbol
  it("case 7 · refuses when the named symbol does not exist", () => {
    const result = applyAddArrayElement(REGISTRY_SOURCE, {
      array_symbol: "NONEXISTENT_REGISTRY",
      missing_ids: ["gamma"],
      peer_element_source: PEER_ELEMENT,
      id_field: "id",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal).toBe("symbol_not_found");
  });

  // (8) ambiguous target
  it("case 8 · refuses when multiple top-level declarations share the symbol name", () => {
    const ambiguous = `export const DUP = [{ id: "a" }];\nexport const DUP = [{ id: "b" }];\n`;
    const result = applyAddArrayElement(ambiguous, {
      array_symbol: "DUP",
      missing_ids: ["c"],
      peer_element_source: `{ id: "a" }`,
      id_field: "id",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal).toBe("symbol_ambiguous_multiple_declarations");
  });

  // (9) unsafe / empty input guards (operator-side safety · path safety is caller-side)
  it("case 9a · refuses when array_symbol is empty", () => {
    const result = applyAddArrayElement(REGISTRY_SOURCE, {
      array_symbol: "",
      missing_ids: ["gamma"],
      peer_element_source: PEER_ELEMENT,
      id_field: "id",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal).toBe("input_empty_array_symbol");
  });

  it("case 9b · refuses when missing_ids is empty (nothing to add)", () => {
    const result = applyAddArrayElement(REGISTRY_SOURCE, {
      array_symbol: "AGENT_REGISTRY",
      missing_ids: [],
      peer_element_source: PEER_ELEMENT,
      id_field: "id",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal).toBe("input_no_missing_ids");
  });

  // (10) formatting / parse validity of the mutated source
  it("case 10 · mutated source parses as valid TypeScript with zero diagnostics", () => {
    const result = applyAddArrayElement(REGISTRY_SOURCE, {
      array_symbol: "AGENT_REGISTRY",
      missing_ids: ["gamma", "epsilon"],
      peer_element_source: PEER_ELEMENT,
      id_field: "id",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const diagCount = parseValid(result.next);
    expect(diagCount).toBe(0);
    // And every new id is present exactly once
    expect((result.next.match(/id: "gamma"/g) ?? []).length).toBe(1);
    expect((result.next.match(/id: "epsilon"/g) ?? []).length).toBe(1);
    // Element indentation preserved · the inserted element starts at column 2
    // like the peer element
    const idx = result.next.indexOf(`{\n    id: "gamma"`);
    expect(idx).toBeGreaterThan(0);
    // Character immediately before the `{` should be 2 spaces (matching peer indent)
    expect(result.next.slice(idx - 2, idx)).toBe("  ");
  });

  // Bonus · works with bare array literal (no Object.freeze wrapper)
  it("case bonus · works when the array is bare (no Object.freeze)", () => {
    const bareSource = `export const X: readonly { id: string }[] = [
  { id: "a" },
  { id: "b" },
];
`;
    const result = applyAddArrayElement(bareSource, {
      array_symbol: "X",
      missing_ids: ["c"],
      peer_element_source: `{ id: "a" }`,
      id_field: "id",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next).toContain(`id: "c"`);
    expect(parseValid(result.next)).toBe(0);
  });
});
