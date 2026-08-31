// pipeline.test.ts · walker pipeline unit coverage.
//
// Proves the single-funnel guarantees:
//   · Missing provenance rejects
//   · Too-short content rejects
//   · Too-few keywords rejects
//   · Low confidence rejects
//   · Duplicate topic/region merges instead of duplicating
//   · Deterministic IDs across runs
//   · Every published record carries generated Q&A variants

import { describe, it, expect } from "vitest";
import { runWalker } from "./pipeline";
import type { KnowledgeWalker, RawFactChunk } from "./types";

function fakeWalker(chunks: RawFactChunk[]): KnowledgeWalker {
  return {
    id: "fake:test",
    domain: "practical",
    defaultStability: "stable",
    description: "test walker",
    refreshCadenceDays: 30,
    async acquire() { return chunks; },
  };
}

const BASE: RawFactChunk = {
  externalId: "test-01",
  domain: "landmark",
  topic: "landmark.borobudur",
  region: "Central Java",
  content: "Borobudur is a 9th-century Buddhist temple complex in Central Java. It is the world's largest Buddhist temple and a UNESCO World Heritage site.",
  keywords: ["borobudur", "temple", "unesco"],
  audience: ["tourist", "family"],
  language: "en",
  observedAt: "2026-08-30",
  source: "test:seed",
  confidence: 0.95,
};

describe("pipeline · validation gates", () => {
  it("rejects a chunk with no source", async () => {
    const { records, report } = await runWalker(fakeWalker([{ ...BASE, source: "" }]));
    expect(records).toHaveLength(0);
    expect(report.rejected[0]?.reason).toBe("missing_source");
  });

  it("rejects a chunk with too-short content", async () => {
    const { records, report } = await runWalker(fakeWalker([{ ...BASE, content: "short" }]));
    expect(records).toHaveLength(0);
    expect(report.rejected[0]?.reason).toMatch(/content_too_short/);
  });

  it("rejects a chunk with too few keywords", async () => {
    const { records, report } = await runWalker(fakeWalker([{ ...BASE, keywords: ["only"] }]));
    expect(records).toHaveLength(0);
    expect(report.rejected[0]?.reason).toMatch(/too_few_keywords/);
  });

  it("rejects a chunk below minimum confidence", async () => {
    const { records, report } = await runWalker(fakeWalker([{ ...BASE, confidence: 0.4 }]));
    expect(records).toHaveLength(0);
    expect(report.rejected[0]?.reason).toMatch(/low_confidence/);
  });
});

describe("pipeline · dedupe on topic+region", () => {
  it("merges two chunks with same topic and region, keeping higher confidence + union keywords", async () => {
    const a = { ...BASE, externalId: "a", confidence: 0.85, keywords: ["borobudur", "temple", "unesco"] };
    const b = { ...BASE, externalId: "b", confidence: 0.95, keywords: ["borobudur", "central java", "buddhist"] };
    const { records, report } = await runWalker(fakeWalker([a, b]));
    expect(records).toHaveLength(1);
    expect(report.deduped[0]).toMatchObject({ externalId: "a", mergedInto: "b" });
    expect(records[0]!.keywords).toEqual(expect.arrayContaining(["borobudur", "temple", "unesco", "central java", "buddhist"]));
    expect(records[0]!.confidence).toBe(0.95);
  });
});

describe("pipeline · enrichment + determinism", () => {
  it("attaches Q&A variants, category, audience, and a walker_id", async () => {
    const { records } = await runWalker(fakeWalker([BASE]));
    expect(records).toHaveLength(1);
    const r = records[0]!;
    expect(r.category).toBe("landmark");
    expect(r.audience).toEqual(["tourist", "family"]);
    expect(r.walker_id).toBe("fake:test");
    expect(r.questions?.length).toBeGreaterThan(0);
    expect(r.questions?.some((q) => /what is borobudur/i.test(q))).toBe(true);
    expect(r.aliases?.some((a) => /borobudur/i.test(a))).toBe(true);
  });

  it("produces identical IDs on re-runs (idempotent index)", async () => {
    const r1 = await runWalker(fakeWalker([BASE]));
    const r2 = await runWalker(fakeWalker([BASE]));
    expect(r1.records[0]!.id).toBe(r2.records[0]!.id);
  });

  it("assigns a refresh_after date for non-live records", async () => {
    const { records } = await runWalker(fakeWalker([BASE]));
    expect(records[0]!.refresh_after).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("does NOT set refresh_after for live-tier chunks (live never in corpus)", async () => {
    const { records } = await runWalker(fakeWalker([{ ...BASE, stability: "live" }]));
    // The chunk itself is rejected before reaching corpus? No — pipeline
    // allows it but marks refresh_after=undefined. The retrieval gate
    // (Task 32) enforces live-tier separation.
    expect(records[0]!.refresh_after).toBeUndefined();
  });
});
