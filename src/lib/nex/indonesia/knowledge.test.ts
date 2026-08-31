// knowledge.test.ts · Indonesia knowledge retrieval + provenance.
//
// Ensures:
//   · The seed corpus loads and matches common Indonesia questions.
//   · Retrieval is deterministic (same input → same output).
//   · Records carry provenance we can gate on.
//   · Empty corpus / no-match returns [] rather than hallucinating.

import { describe, it, expect, beforeEach } from "vitest";
import {
  retrieveKnowledge,
  formatKnowledgeBlock,
  listAllRecords,
  entityToKnowledgeRecord,
  _resetKnowledgeCacheForTests,
} from "./knowledge";

beforeEach(() => { _resetKnowledgeCacheForTests(); });

describe("retrieveKnowledge · common tourist questions", () => {
  it("'capital of Indonesia' returns the capital record", () => {
    const hits = retrieveKnowledge("What is the capital of Indonesia?");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.topic).toBe("indonesia.capital");
    expect(hits[0]!.content).toMatch(/Jakarta/);
  });

  it("'time zones' returns the time-zone record", () => {
    const hits = retrieveKnowledge("How many time zones does Indonesia have?");
    expect(hits.some((h) => h.topic === "indonesia.time_zones")).toBe(true);
  });

  it("'nasi goreng' returns the dish record", () => {
    const hits = retrieveKnowledge("what is nasi goreng?");
    expect(hits[0]!.topic).toBe("food.nasi_goreng");
    expect(hits[0]!.content).toMatch(/fried rice/i);
  });

  it("'Ubud' returns the Bali tourism record with region signal", () => {
    const hits = retrieveKnowledge("what should I do in Ubud?");
    const bali = hits.find((h) => h.region === "Bali");
    expect(bali).toBeDefined();
  });

  it("'halal' returns the halal note", () => {
    const hits = retrieveKnowledge("Is Indonesian food halal?");
    expect(hits.some((h) => h.topic === "food.halal")).toBe(true);
  });

  it("nonsense query → empty result (no hallucination)", () => {
    const hits = retrieveKnowledge("xyzzyxyz absolutely nothing here");
    expect(hits).toEqual([]);
  });
});

describe("retrieveKnowledge · provenance + gating", () => {
  it("every seed record carries required provenance fields", () => {
    const all = listAllRecords();
    expect(all.length).toBeGreaterThan(0);
    for (const rec of all) {
      expect(rec.id).toMatch(/^[a-z0-9-]+$/);
      expect(rec.topic).toBeTruthy();
      expect(rec.region).toBeTruthy();
      expect(["stable", "seasonal", "time_sensitive", "live"]).toContain(rec.stability);
      expect(rec.confidence).toBeGreaterThanOrEqual(0);
      expect(rec.confidence).toBeLessThanOrEqual(1);
      expect(rec.source).toBeTruthy();
      expect(rec.last_verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(rec.content).toBeTruthy();
      expect(Array.isArray(rec.keywords)).toBe(true);
    }
  });

  it("minConfidence filter drops low-confidence hits", () => {
    const strict = retrieveKnowledge("bali", { minConfidence: 0.99 });
    const lenient = retrieveKnowledge("bali", { minConfidence: 0.0 });
    expect(strict.length).toBeLessThanOrEqual(lenient.length);
  });

  it("region filter narrows results", () => {
    const balined = retrieveKnowledge("hotel", { region: "Bali" });
    // Every hit is either regional match or the pan-Indonesia label.
    for (const h of balined) {
      expect(["Bali", "Indonesia"]).toContain(h.region);
    }
  });

  it("limit is honoured", () => {
    const hits = retrieveKnowledge("indonesia bali food ubud", { limit: 2 });
    expect(hits.length).toBeLessThanOrEqual(2);
  });
});

describe("formatKnowledgeBlock", () => {
  it("empty hits → empty string", () => {
    expect(formatKnowledgeBlock([])).toBe("");
  });

  it("non-empty hits include topic, region, stability, and verified date", () => {
    const hits = retrieveKnowledge("capital of Indonesia");
    const block = formatKnowledgeBlock(hits);
    expect(block).toMatch(/indonesia\.capital/);
    expect(block).toMatch(/Indonesia/);
    expect(block).toMatch(/stable/);
    expect(block).toMatch(/verified/);
  });
});

describe("legacy KnowledgeRecord store · unchanged", () => {
  it("listAllRecords() still returns the hand-curated seed/acquired corpus", () => {
    const all = listAllRecords();
    expect(all.length).toBeGreaterThan(0);
  });
});

describe("doctrine · retrieval reads canonical EntityRecord corpus", () => {
  it("seeded province (Bali) is retrievable via retrieveKnowledge", () => {
    const hits = retrieveKnowledge("province of bali");
    const bali = hits.find((h) => h.id === "place:province:bali");
    expect(bali).toBeTruthy();
    expect(bali?.region).toBe("Bali");
    expect(bali?.source).toMatch(/Geographic Registry/i);
  });

  it("seeded city (Denpasar) is retrievable via retrieveKnowledge", () => {
    const hits = retrieveKnowledge("denpasar city");
    const denpasar = hits.find((h) => h.id === "place:city:denpasar");
    expect(denpasar).toBeTruthy();
    expect(denpasar?.region).toBe("Bali");
  });

  it("seeded province in a previously-empty region (Papua) is retrievable", () => {
    // Papua had zero legacy KnowledgeRecords · proves the fix reaches beyond migrated data.
    const hits = retrieveKnowledge("papua province");
    const papua = hits.find((h) => h.id.startsWith("place:province:") && h.id.includes("papua"));
    expect(papua).toBeTruthy();
  });

  it("live EntityRecord tier is no longer hard-blocked from retrieval", () => {
    // Doctrine rule 4: live evidence retrievable through same interface.
    const adapted = entityToKnowledgeRecord({
      id: "test:live",
      kind: "government",
      category: "safety.earthquake",
      name: "Test earthquake",
      description: "Test description",
      keywords: ["earthquake", "test"],
      lifecycle: "PUBLISHED",
      lifecycleChangedAt: "2026-08-30T00:00:00Z",
      provenance: [{
        walkerId: "live.bmkg.earthquake", sourceKey: "bmkg.autogempa", sourceName: "BMKG",
        sourceTier: "A", firstDiscoveredAt: "2026-08-30T00:00:00Z",
        lastCheckedAt: "2026-08-30T00:00:00Z", lastChangedAt: "2026-08-30T00:00:00Z",
        observedAt: "2026-08-30T00:00:00Z",
      }],
      freshness: { policy: "live", lastVerifiedAt: "2026-08-30T00:00:00Z" },
      quality: { identity: 1, location: 1, contact: 0, sourceQuality: 1, freshness: 1, completeness: 0.9, verification: 1, conflict: 1, overall: 0.9 },
    });
    expect(adapted).toBeTruthy();
    expect(adapted!.stability).toBe("live");
  });
});
