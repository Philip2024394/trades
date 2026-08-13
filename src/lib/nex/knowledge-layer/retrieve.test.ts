// Smoke tests for Knowledge Layer retrieval.
// Runs against the legacy fallback (knowledge/staircase.json + nex-image-manifest.json)
// until Staircase is migrated to data/nex-knowledge/staircase/.

import { describe, it, expect } from "vitest";
import { retrieve } from "./retrieve";

describe("retrieve · Knowledge Layer", () => {
  it("returns FAQ results for a staircase query (legacy fallback)", () => {
    const r = retrieve({
      domain: "staircase",
      query: "vertical tongue and groove sheeting panel",
      limit: 5,
      min_relevance: 0.1,
    });
    expect(r.domain).toBe("staircase");
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.sources.length).toBeGreaterThan(0);
  });

  it("filters by a_plus_only", () => {
    const r = retrieve({
      domain: "staircase",
      query: "modern contemporary staircase",
      filters: { a_plus_only: true, item_types: ["image"] },
      limit: 10,
      min_relevance: 0.05,
    });
    for (const item of r.items) {
      expect(item.a_plus).toBe(true);
    }
  });

  it("returns needs_clarification=true for a query with no matches", () => {
    const r = retrieve({
      domain: "staircase",
      query: "xyz qwerty foobar plumbus grimble",
      limit: 5,
    });
    expect(r.needs_clarification).toBe(true);
    expect(r.overall_confidence).toBe(0);
  });

  it("returns empty result for a domain that doesn't exist", () => {
    const r = retrieve({
      domain: "nonexistent_domain_12345",
      query: "anything",
      limit: 5,
    });
    expect(r.items.length).toBe(0);
    expect(r.overall_confidence).toBe(0);
    expect(r.needs_clarification).toBe(true);
  });

  it("handles empty query safely", () => {
    const r = retrieve({
      domain: "staircase",
      query: "",
      limit: 5,
    });
    expect(r.items.length).toBe(0);
    expect(r.trace_reason).toContain("empty");
  });

  it("respects item_types filter", () => {
    const r = retrieve({
      domain: "staircase",
      query: "oak staircase design newel post",
      filters: { item_types: ["faq"] },
      limit: 10,
      min_relevance: 0.05,
    });
    for (const item of r.items) {
      expect(item.type).toBe("faq");
    }
  });

  it("populates trace_reason for Router Trace", () => {
    const r = retrieve({
      domain: "staircase",
      query: "oak newel post",
      limit: 5,
      min_relevance: 0.05,
    });
    expect(r.trace_reason.length).toBeGreaterThan(10);
  });
});
