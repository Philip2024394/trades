// Trade rules — deterministic rulebook lookup.

import { describe, it, expect } from "vitest";
import { findTradeRules, tradeRulesToConstraints } from "./trade-rules";

describe("Trade rules", () => {
  it("finds plumbing rulebook", () => {
    const rules = findTradeRules("plumbing");
    expect(rules).not.toBeNull();
    expect(rules?.slug).toBe("plumbing");
    expect(rules?.must_show.some((s) => s.includes("Gas Safe"))).toBe(true);
  });

  it("finds electrical rulebook", () => {
    const rules = findTradeRules("electrical");
    expect(rules?.slug).toBe("electrical");
    expect(rules?.never_show.some((s) => s.includes("lightning"))).toBe(true);
  });

  it("returns null for unknown trade", () => {
    expect(findTradeRules("astrophysics")).toBeNull();
  });

  it("maps rulebook to constraints", () => {
    const constraints = tradeRulesToConstraints("roofing");
    expect(constraints.length).toBeGreaterThan(0);
    const kinds = new Set(constraints.map((c) => c.kind));
    expect(kinds.has("require")).toBe(true);
    expect(kinds.has("forbid")).toBe(true);
    expect(constraints.every((c) => c.source === "trade-rules")).toBe(true);
  });

  it("returns empty constraints for unknown trade", () => {
    expect(tradeRulesToConstraints("bitcoin")).toHaveLength(0);
  });
});
