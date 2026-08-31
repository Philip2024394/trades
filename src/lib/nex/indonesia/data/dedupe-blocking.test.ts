// dedupe-blocking.test.ts · blocking-based candidate generation.
//
// Proves that blocking reduces O(N²) to something tractable while
// preserving recall on real duplicate patterns.

import { describe, it, expect } from "vitest";
import { generateCandidatePairs, scoreCandidatePairs, analyseCorpus, applyMerges, DEFAULT_BLOCKERS } from "./dedupe-blocking";
import type { EntityRecord } from "./types";

function biz(id: string, over: Partial<EntityRecord> = {}): EntityRecord {
  return {
    id, kind: "business", name: id, keywords: [],
    lifecycle: "PUBLISHED", lifecycleChangedAt: "2026-08-30",
    provenance: [{ walkerId: "w", sourceKey: "s", sourceName: "s", sourceTier: "C",
      firstDiscoveredAt: "2026-08-30", lastCheckedAt: "2026-08-30",
      lastChangedAt: "2026-08-30", observedAt: "2026-08-30" }],
    freshness: { policy: "weekly", lastVerifiedAt: "2026-08-30T00:00:00Z" },
    ...over,
  };
}

describe("blocking · candidate generation", () => {
  it("empty corpus → zero pairs", () => {
    expect(generateCandidatePairs([])).toEqual([]);
  });

  it("single entity → zero pairs", () => {
    expect(generateCandidatePairs([biz("a")])).toEqual([]);
  });

  it("same phone → same phone bucket → candidate pair", () => {
    const a = biz("a", { contacts: [{ kind: "phone", value: "+62812111", verified: true }] });
    const b = biz("b", { contacts: [{ kind: "whatsapp", value: "+62812111", verified: true }] });
    const pairs = generateCandidatePairs([a, b]);
    expect(pairs.some((p) => (p.a.id === "a" && p.b.id === "b") || (p.a.id === "b" && p.b.id === "a"))).toBe(true);
    expect(pairs.some((p) => p.blockerName === "phone")).toBe(true);
  });

  it("nearby geo → same geo cell → candidate pair", () => {
    const a = biz("a", { geo: { lat: -8.65, lng: 115.22 } });
    const b = biz("b", { geo: { lat: -8.651, lng: 115.221 } });
    const pairs = generateCandidatePairs([a, b]);
    expect(pairs.some((p) => p.blockerName === "geo_cell")).toBe(true);
  });

  it("similar name in same region → name-prefix bucket → candidate pair", () => {
    const a = biz("a", { name: "Warung Bu Siti", geo: { province: "di-yogyakarta", regency: "sleman" } });
    const b = biz("b", { name: "Warung Bu Siti", geo: { province: "di-yogyakarta", regency: "sleman" } });
    const pairs = generateCandidatePairs([a, b]);
    expect(pairs.length).toBeGreaterThan(0);
  });

  it("no shared signal → no candidate pairs", () => {
    const a = biz("a", { name: "Alpha Cafe", geo: { lat: -8.65, lng: 115.22 } });
    const b = biz("b", { name: "Zebra Hotel", geo: { lat: 6.20, lng: 106.82 } }); // Jakarta vs Bali
    const pairs = generateCandidatePairs([a, b]);
    expect(pairs.length).toBe(0);
  });
});

describe("blocking · scoring + strong merges", () => {
  it("phone-match candidate reaches strong-merge score", () => {
    const a = biz("a", { contacts: [{ kind: "phone", value: "+62812111", verified: true }] });
    const b = biz("b", { contacts: [{ kind: "phone", value: "+62812111", verified: true }] });
    const pairs = generateCandidatePairs([a, b]);
    const scored = scoreCandidatePairs(pairs, 0.3);
    expect(scored[0].score).toBeGreaterThanOrEqual(0.5);
    expect(scored[0].reasons).toContain("phone_match");
  });
});

describe("blocking · applyMerges (union-find)", () => {
  it("three-way duplicate cluster collapses to one entity · unions distinct provenance", () => {
    // Three observations of the same restaurant from THREE distinct
    // walkers/sources (as would happen in real acquisition). Phone
    // links them.
    const distinctProv = (source: string) => ({
      walkerId: source, sourceKey: source, sourceName: source, sourceTier: "C" as const,
      firstDiscoveredAt: "2026-08-30", lastCheckedAt: "2026-08-30",
      lastChangedAt: "2026-08-30", observedAt: `2026-08-30T00:0${source.slice(-1)}:00Z`,
    });
    const a = { ...biz("a", { name: "Warung Bu Siti", contacts: [{ kind: "phone" as const, value: "+62812111", verified: true }] }), provenance: [distinctProv("google")] };
    const b = { ...biz("b", { name: "Warung Ibu Siti", contacts: [{ kind: "whatsapp" as const, value: "+62812111", verified: true }] }), provenance: [distinctProv("tripadvisor2")] };
    const c = { ...biz("c", { name: "Bu Siti Warung", contacts: [{ kind: "phone" as const, value: "+62812111", verified: true }] }), provenance: [distinctProv("osm3")] };
    const report = analyseCorpus([a, b, c]);
    expect(report.strongMerges.length).toBeGreaterThanOrEqual(1);
    const merged = applyMerges([a, b, c], report.strongMerges);
    expect(merged.length).toBe(1);
    const only = merged[0];
    // All three source observations preserved.
    expect(only.provenance.length).toBe(3);
    // Loser names preserved as aliases.
    expect((only.aliases ?? []).length).toBeGreaterThan(0);
  });

  it("distinct entities are not merged", () => {
    const a = biz("a", { contacts: [{ kind: "phone", value: "+62812111", verified: true }] });
    const b = biz("b", { contacts: [{ kind: "phone", value: "+62812222", verified: true }] });
    const report = analyseCorpus([a, b]);
    const merged = applyMerges([a, b], report.strongMerges);
    expect(merged.length).toBe(2);
  });
});

describe("blocking · scale tractability", () => {
  it("10,000 entities with sparse duplicates · analysed in < 3s", () => {
    const now = "2026-08-30T00:00:00Z";
    const entities: EntityRecord[] = [];
    // 10k unique entities, plus 100 duplicate-pairs sprinkled in
    // (200 records total for dupes).
    for (let i = 0; i < 10_000; i++) {
      entities.push(biz(`e-${i}`, {
        name: `Warung ${i}`,
        geo: { lat: -8 + (i % 100) * 0.02, lng: 115 + Math.floor(i / 100) * 0.02 },
      }));
    }
    for (let i = 0; i < 100; i++) {
      const phone = `+6281${String(1000000 + i).padStart(7, "0")}`;
      entities.push(biz(`dup-a-${i}`, { name: `Alpha ${i}`, contacts: [{ kind: "phone", value: phone, verified: true }] }));
      entities.push(biz(`dup-b-${i}`, { name: `Alpha ${i}`, contacts: [{ kind: "whatsapp", value: phone, verified: true }] }));
    }
    const t0 = performance.now();
    const report = analyseCorpus(entities);
    const wall = Math.round(performance.now() - t0);
    console.log(`  analyseCorpus 10,200 entities: wall=${wall}ms · candidate pairs=${report.candidatePairs} · strong merges=${report.strongMerges.length}`);
    expect(wall).toBeLessThan(3000);
    expect(report.strongMerges.length).toBeGreaterThanOrEqual(100);
  }, 30_000);
});
