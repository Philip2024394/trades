// Agent validator tests · every one of the 15 agents must load, parse, and
// satisfy the required frontmatter schema. If ANY agent is malformed the
// health endpoint reports it and this test fails loudly.

import { describe, it, expect } from "vitest";
import { validateAllAgents, parseSimpleYaml } from "../agent-validator";
import { ALL_AGENT_IDS } from "../types";

describe("agent-validator · all 15 agents load and validate", () => {
  const report = validateAllAgents();

  it("finds all 15 canonical agents", () => {
    expect(report.agents_expected).toBe(15);
    expect(report.agents_found).toBe(15);
  });

  it("reports zero issues", () => {
    expect(report.issues).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("every canonical agent id has a definition", () => {
    const ids = new Set(report.definitions.map((d) => d.agent_id));
    for (const id of ALL_AGENT_IDS) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("every definition has the required frontmatter fields", () => {
    const required = ["agent_id", "name", "title", "pipeline_stage", "kind", "reads", "writes", "touches_code", "permissions", "stop_conditions"];
    for (const def of report.definitions) {
      for (const field of required) {
        expect(def.frontmatter[field]).toBeDefined();
      }
    }
  });

  it("every definition body has a ## Purpose section", () => {
    for (const def of report.definitions) {
      expect(def.body).toContain("## Purpose");
    }
  });
});

describe("parseSimpleYaml · handles our frontmatter shapes", () => {
  it("parses key: value", () => {
    const r = parseSimpleYaml("name: Ada");
    expect(r.name).toBe("Ada");
  });

  it("parses key: [a, b, c]", () => {
    const r = parseSimpleYaml("reads: [foo, bar, baz]");
    expect(r.reads).toEqual(["foo", "bar", "baz"]);
  });

  it("parses key: []", () => {
    const r = parseSimpleYaml("stop_conditions: []");
    expect(r.stop_conditions).toEqual([]);
  });

  it("parses integers and booleans", () => {
    const r = parseSimpleYaml("stage: 3\ntouches: true\nignored: false");
    expect(r.stage).toBe(3);
    expect(r.touches).toBe(true);
    expect(r.ignored).toBe(false);
  });

  it("preserves trailing text on non-standard boolean values as strings", () => {
    // e.g. "touches_code: false (only git operations)" in integrator frontmatter.
    const r = parseSimpleYaml("touches_code: false (only git operations)");
    expect(r.touches_code).toBe("false (only git operations)");
  });

  it("skips comment lines", () => {
    const r = parseSimpleYaml("# just a comment\nkey: value");
    expect(r.key).toBe("value");
    expect(Object.keys(r)).toEqual(["key"]);
  });
});
