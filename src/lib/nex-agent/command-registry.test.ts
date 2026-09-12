// src/lib/nex-agent/command-registry.test.ts

import { describe, it, expect } from "vitest";
import { BASE_COMMANDS, searchCommands } from "./command-registry";

describe("BASE_COMMANDS", () => {
  it("has every essential action", () => {
    const ids = BASE_COMMANDS.map((c) => c.id);
    expect(ids).toContain("focus-prompt");
    expect(ids).toContain("submit-prompt");
    expect(ids).toContain("stop-task");
    expect(ids).toContain("reload-preview");
    expect(ids).toContain("viewport-mobile");
    expect(ids).toContain("zoom-in");
    expect(ids).toContain("zoom-out");
    expect(ids).toContain("zen-mode");
  });

  it("every command has label + section", () => {
    for (const c of BASE_COMMANDS) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.section).toMatch(/actions|navigation|preview|phone|founder|system/);
    }
  });
});

describe("searchCommands · fuzzy match", () => {
  it("empty query returns all", () => {
    const r = searchCommands("", BASE_COMMANDS);
    expect(r.length).toBe(BASE_COMMANDS.length);
  });

  it("prefix match ranks first", () => {
    const r = searchCommands("zen", BASE_COMMANDS);
    expect(r[0].id).toBe("zen-mode");
  });

  it("keyword match works", () => {
    const r = searchCommands("phone", BASE_COMMANDS);
    expect(r.map((c) => c.id)).toContain("viewport-mobile");
    expect(r.map((c) => c.id)).toContain("bezel-toggle");
  });

  it("substring match works", () => {
    const r = searchCommands("stop", BASE_COMMANDS);
    expect(r[0].id).toBe("stop-task");
  });

  it("subsequence match works", () => {
    const r = searchCommands("zm", BASE_COMMANDS);
    // "zen-mode" contains z...e...n...m... subsequence
    expect(r.map((c) => c.id)).toContain("zen-mode");
  });

  it("case-insensitive", () => {
    const r1 = searchCommands("ZOOM", BASE_COMMANDS);
    const r2 = searchCommands("zoom", BASE_COMMANDS);
    expect(r1.map((c) => c.id)).toEqual(r2.map((c) => c.id));
  });
});
