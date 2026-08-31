// gaps.test.ts · knowledge-gap loop unit coverage.

import { describe, it, expect } from "vitest";
import { GapRegistry, normaliseQuery } from "./gap-registry";
import { detectGap } from "./gap-detector";
import type { KnowledgeHit } from "../knowledge";

function fakeHit(over: Partial<KnowledgeHit> = {}): KnowledgeHit {
  return {
    id: "h1", topic: "test.a", region: "Bali", language: "en",
    stability: "stable", confidence: 0.9, source: "test",
    last_verified: "2026-08-30", content: "x", keywords: [], score: 1,
    ...over,
  };
}

describe("normaliseQuery · clustering", () => {
  it("same query with different casing / stopwords produces same key", () => {
    const a = normaliseQuery("What is Nasi Goreng?");
    const b = normaliseQuery("nasi goreng please");
    expect(a).toBe(b);
  });

  it("scope is included in the key so Bali vs Yogya cluster separately", () => {
    const a = normaliseQuery("halal restaurant", "bali");
    const b = normaliseQuery("halal restaurant", "yogyakarta");
    expect(a).not.toBe(b);
  });
});

describe("detectGap · retrieval outcomes", () => {
  it("no hits → no_hits reason", () => {
    const g = detectGap({ intent: "food", rawQuery: "obscure dish", hits: [] });
    expect(g?.reason).toBe("no_hits");
  });

  it("high-confidence hit → no gap", () => {
    const g = detectGap({ intent: "food", rawQuery: "nasi goreng", hits: [fakeHit({ confidence: 0.95 })] });
    expect(g).toBeNull();
  });

  it("low-confidence top hit → low_confidence reason", () => {
    const g = detectGap({ intent: "food", rawQuery: "obscure", hits: [fakeHit({ confidence: 0.5 })] });
    expect(g?.reason).toBe("low_confidence");
  });

  it("requiresLive flag → requires_live reason (bypasses hits check)", () => {
    const g = detectGap({ intent: "weather", rawQuery: "is it raining", hits: [fakeHit({ confidence: 0.99 })], requiresLive: true });
    expect(g?.reason).toBe("requires_live");
  });
});

describe("GapRegistry · observe + priority", () => {
  it("same query observed twice bumps frequency, doesn't duplicate", () => {
    const r = new GapRegistry({ inMemoryOnly: true });
    const g1 = r.observe({ intent: "food", rawQuery: "gudeg late night jogja", reason: "no_hits" });
    const g2 = r.observe({ intent: "food", rawQuery: "GUDEG late night jogja", reason: "no_hits" });
    expect(g1.id).toBe(g2.id);
    expect(g2.frequency).toBe(2);
    expect(r.getSnapshot().gaps.length).toBe(1);
  });

  it("priority increases with frequency", () => {
    const r = new GapRegistry({ inMemoryOnly: true });
    const first = r.observe({ intent: "x", rawQuery: "q1", reason: "no_hits" });
    const initialPriority = first.priority; // capture value, not reference
    r.observe({ intent: "x", rawQuery: "q1", reason: "no_hits" });
    r.observe({ intent: "x", rawQuery: "q1", reason: "no_hits" });
    const bumped = r.getSnapshot().gaps.find((g) => g.id === first.id)!;
    expect(bumped.priority).toBeGreaterThan(initialPriority);
    expect(bumped.frequency).toBe(3);
  });

  it("topOpenGaps returns highest-priority first", () => {
    const r = new GapRegistry({ inMemoryOnly: true });
    r.observe({ intent: "a", rawQuery: "obscure a", reason: "low_confidence" });
    // Hit q2 many times → higher priority.
    for (let i = 0; i < 5; i++) r.observe({ intent: "a", rawQuery: "high demand b", reason: "requires_live" });
    const top = r.topOpenGaps(2);
    expect(top[0].normalisedQuery).toContain("demand");
  });

  it("setStatus moves gap to RESOLVED and records evidenceRef", () => {
    const r = new GapRegistry({ inMemoryOnly: true });
    const g = r.observe({ intent: "food", rawQuery: "rendang recipe traditional", reason: "no_hits" });
    r.setStatus(g.id, "RESOLVED", "walker.food.dishes:rendang:v2");
    const stored = r.getSnapshot().gaps.find((x) => x.id === g.id)!;
    expect(stored.status).toBe("RESOLVED");
    expect(stored.evidenceRefs).toContain("walker.food.dishes:rendang:v2");
  });

  it("summary returns byStatus + byIntent counts", () => {
    const r = new GapRegistry({ inMemoryOnly: true });
    r.observe({ intent: "food", rawQuery: "a", reason: "no_hits" });
    r.observe({ intent: "food", rawQuery: "b", reason: "no_hits" });
    r.observe({ intent: "tourism", rawQuery: "c", reason: "low_confidence" });
    const s = r.summary();
    expect(s.total).toBe(3);
    expect(s.byStatus.OPEN).toBe(3);
    expect(s.byIntent.food).toBe(2);
    expect(s.byIntent.tourism).toBe(1);
  });
});
