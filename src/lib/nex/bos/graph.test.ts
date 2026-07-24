// Knowledge graph — trade lookup.

import { describe, it, expect } from "vitest";
import { findTradesMatching, getTradeNode, knownTrades } from "./graph";

describe("getTradeNode", () => {
  it("returns node for a known trade slug", () => {
    const n = getTradeNode("plumbing")!;
    expect(n.label).toBe("Plumbing");
    expect(n.regulations.some((r) => /Part G/.test(r))).toBe(true);
    expect(n.evidence.source).toContain("plumbing");
  });

  it("returns node for label match", () => {
    const n = getTradeNode("Electrical")!;
    expect(n.trade).toBe("electrical");
  });

  it("returns null for unknown", () => {
    expect(getTradeNode("interstellar-pipe-fitting")).toBeNull();
  });

  it("every seeded node has evidence + non-empty fields", () => {
    for (const slug of knownTrades()) {
      const n = getTradeNode(slug)!;
      expect(n.tools.length).toBeGreaterThan(0);
      expect(n.materials.length).toBeGreaterThan(0);
      expect(n.regulations.length).toBeGreaterThan(0);
      expect(n.evidence).toBeDefined();
    }
  });
});

describe("findTradesMatching", () => {
  it("partial match returns hits", () => {
    const hits = findTradesMatching("plumb");
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits.some((n) => n.trade === "plumbing")).toBe(true);
  });
  it("empty query returns nothing", () => {
    expect(findTradesMatching("")).toEqual([]);
  });
});
