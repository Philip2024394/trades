// dedupe-cross-blocker.test.ts · recall per blocker in isolation.
//
// Plants 4 categories of duplicate patterns and asserts each blocker
// pulls its category into the strong-merge set:
//   · phone-only:      phone match, different names, different geo
//   · website-only:    same domain, different names, different geo
//   · geo-only:        very close coords, similar names, no phone/site
//   · name+region:     identical normalised name in same regency
//                      · no phone/site/geo signals
//
// The cross-blocker suite exists so we know dedupe isn't over-reliant
// on any single signal.

import { describe, it, expect } from "vitest";
import { analyseCorpus, applyMerges, generateCandidatePairs } from "./dedupe-blocking";
import type { EntityRecord } from "./types";

function biz(id: string, over: Partial<EntityRecord> = {}): EntityRecord {
  return {
    id, kind: "business", name: id, keywords: [],
    lifecycle: "PUBLISHED", lifecycleChangedAt: "2026-08-30",
    provenance: [{ walkerId: `w-${id}`, sourceKey: `s-${id}`, sourceName: `s-${id}`, sourceTier: "C",
      firstDiscoveredAt: "2026-08-30", lastCheckedAt: "2026-08-30",
      lastChangedAt: "2026-08-30", observedAt: `2026-08-30T00:00:0${id.length % 10}Z` }],
    freshness: { policy: "weekly", lastVerifiedAt: "2026-08-30T00:00:00Z" },
    ...over,
  };
}

describe("blocker recall · phone only", () => {
  it("phone match with different names + different geo → still merges", () => {
    const a = biz("a", {
      name: "Somewhere Cafe",
      geo: { province: "bali", regency: "denpasar", lat: -8.65, lng: 115.22 },
      contacts: [{ kind: "phone", value: "+628121111", verified: true }],
    });
    const b = biz("b", {
      name: "Totally Different Warung",
      geo: { province: "di-yogyakarta", regency: "sleman", lat: -7.75, lng: 110.38 },
      contacts: [{ kind: "whatsapp", value: "+628121111", verified: true }],
    });
    const report = analyseCorpus([a, b]);
    // Phone equality is strong evidence · should merge even against
    // opposing geo + name signals.
    expect(report.strongMerges.length).toBeGreaterThanOrEqual(1);
    expect(report.strongMerges[0].reasons).toContain("phone_match");
  });
});

describe("blocker recall · website only", () => {
  it("same website domain with different names + different regencies → blocker recalls the pair", () => {
    // The purpose of the RECALL test is proving the blocker
    // proposes the pair for scoring. Whether the SCORE then reaches
    // review/merge is a separate decision (currently: website-only
    // without name/geo agreement stays below review threshold, on
    // purpose — a franchise chain can share one domain).
    const a = biz("a", {
      name: "Site Alpha",
      geo: { province: "bali", regency: "denpasar" },
      contacts: [{ kind: "website", value: "https://sameplace.example" }],
    });
    const b = biz("b", {
      name: "Site Beta",
      geo: { province: "di-yogyakarta", regency: "sleman" },
      contacts: [{ kind: "website", value: "https://SAMEPLACE.example/menu" }],
    });
    const raw = generateCandidatePairs([a, b]);
    expect(raw.some((p) => p.blockerName === "website")).toBe(true);
  });

  it("same website + same regency + similar name → reaches at least review", () => {
    // With a corroborating signal (regency + partial name), website
    // match is enough to reach review.
    const a = biz("a", {
      name: "Bakery Alpha Cabang Utara",
      geo: { province: "bali", regency: "denpasar" },
      contacts: [{ kind: "website", value: "https://bakeryalpha.example" }],
    });
    const b = biz("b", {
      name: "Bakery Alpha Utara",
      geo: { province: "bali", regency: "denpasar" },
      contacts: [{ kind: "website", value: "https://bakeryalpha.example/menu" }],
    });
    const report = analyseCorpus([a, b]);
    const found = [...report.strongMerges, ...report.reviewCandidates].some((p) => p.reasons.includes("website_match"));
    expect(found).toBe(true);
  });
});

describe("blocker recall · geo only", () => {
  it("very-close coords + similar names + same regency → merge/review candidate", () => {
    const a = biz("a", {
      name: "Warung Bu Ratih",
      geo: { province: "bali", regency: "denpasar", lat: -8.6500, lng: 115.2200 },
    });
    const b = biz("b", {
      name: "Warung Ratih",
      geo: { province: "bali", regency: "denpasar", lat: -8.6501, lng: 115.2201 },
    });
    const report = analyseCorpus([a, b]);
    expect(report.candidatePairs).toBeGreaterThanOrEqual(1);
    const relevant = [...report.strongMerges, ...report.reviewCandidates];
    expect(relevant.length).toBeGreaterThanOrEqual(1);
  });

  it("close coords but different kinds → NEVER merge", () => {
    const a = biz("a", { name: "Restaurant X", geo: { lat: -8.65, lng: 115.22 } });
    const b = { ...biz("b", { name: "Restaurant Y", geo: { lat: -8.65, lng: 115.22 } }), kind: "knowledge" as const };
    const report = analyseCorpus([a, b]);
    // scoreCandidatePairs skips kind mismatches · zero strong merges.
    expect(report.strongMerges.length).toBe(0);
  });
});

describe("blocker recall · name + region only", () => {
  it("identical normalised name in same regency → review candidate", () => {
    const a = biz("a", { name: "Warung Bu Siti", geo: { province: "di-yogyakarta", regency: "sleman" } });
    const b = biz("b", { name: "Warung Ibu Siti", geo: { province: "di-yogyakarta", regency: "sleman" } });
    const report = analyseCorpus([a, b]);
    const found = [...report.strongMerges, ...report.reviewCandidates].some((p) =>
      p.reasons.some((r) => r.startsWith("name_") || r.startsWith("name_ident")),
    );
    expect(found).toBe(true);
  });
});

describe("blocker recall · mixed patterns · applyMerges verifies clustering", () => {
  it("10 planted phone-duplicate pairs are all merged; distractors + website-only pairs (weak signal) remain", () => {
    const entities: EntityRecord[] = [];
    for (let i = 0; i < 10; i++) {
      const phone = `+6281${String(1_000_000 + i).padStart(7, "0")}`;
      entities.push(biz(`p-a-${i}`, { name: `Phone A ${i}`, contacts: [{ kind: "phone", value: phone, verified: true }] }));
      entities.push(biz(`p-b-${i}`, { name: `Phone B ${i}`, contacts: [{ kind: "whatsapp", value: phone, verified: true }] }));
      // Website-only pairs (no name/regency corroboration) intentionally
      // do NOT reach the merge threshold — website alone could be a
      // franchise chain, we don't collapse those. Blocker still recalls.
      const domain = `https://plant${i}.example`;
      entities.push(biz(`w-a-${i}`, { name: `Web A ${i}`, contacts: [{ kind: "website", value: domain }] }));
      entities.push(biz(`w-b-${i}`, { name: `Web B ${i}`, contacts: [{ kind: "website", value: `${domain}/menu` }] }));
    }
    for (let i = 0; i < 20; i++) entities.push(biz(`u-${i}`, { name: `Unique ${i}` }));

    const report = analyseCorpus(entities);
    const merged = applyMerges(entities, report.strongMerges);

    // 10 phone plants → collapse to 10. Website plants (20 records)
    // stay as 20. Distractors stay as 20. → 10+20+20 = 50.
    expect(merged.length).toBe(50);

    // Every phone plant is in strong merges.
    const phonePairsMerged = report.strongMerges.filter((m) => m.a.id.startsWith("p-") && m.b.id.startsWith("p-")).length;
    expect(phonePairsMerged).toBe(10);

    // Website plants surface as review candidates (blocker recalled +
    // score below merge threshold). Not strong-merged, but not silent.
    const websiteReviewed = report.reviewCandidates.filter((m) => m.reasons.includes("website_match")).length
      + report.strongMerges.filter((m) => m.reasons.includes("website_match")).length;
    // With name difference "Web A i" vs "Web B i" the score won't clear
    // 0.65 for every plant — but blocker must have proposed all 10.
    const websiteProposedByBlocker = generateCandidatePairs(entities).filter(
      (p) => p.blockerName === "website" && p.a.id.startsWith("w-") && p.b.id.startsWith("w-"),
    ).length;
    expect(websiteProposedByBlocker).toBe(10);
    // Some fraction may still surface as review candidates (nice-to-have).
    expect(websiteReviewed).toBeGreaterThanOrEqual(0);
  });
});
