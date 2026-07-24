import { describe, expect, it } from "vitest";
import { loadStaircaseScenarios } from "./loader";

describe("Staircase scenario file", () => {
  const loaded = loadStaircaseScenarios();

  it("has exactly 100 scenarios", () => {
    expect(loaded.scenarios.length).toBe(100);
  });

  it("meets each category's target count", () => {
    expect(loaded.countsByCategory.identification).toBe(20);
    expect(loaded.countsByCategory.materials).toBe(15);
    expect(loaded.countsByCategory.defects).toBe(25);
    expect(loaded.countsByCategory.estimation).toBe(15);
    expect(loaded.countsByCategory.regulations).toBe(15);
    expect(loaded.countsByCategory.workflow).toBe(10);
  });

  it("has unique scenario ids", () => {
    const ids = loaded.scenarios.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all scenarios are still pending author (no invented answers)", () => {
    expect(loaded.authorPending).toBe(100);
  });

  it("every scenario has at least one acceptance criterion", () => {
    for (const s of loaded.scenarios) {
      expect(s.acceptance_criteria.length).toBeGreaterThan(0);
    }
  });

  it("every scenario has a subject in scope", () => {
    for (const s of loaded.scenarios) {
      expect(typeof s.scope.subject).toBe("string");
    }
  });
});
