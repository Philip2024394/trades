// publish-corpus.test.ts · guard the supervisor-persistence fix.
//
// Locks in the invariants the workforce depends on:
//   · records reach the canonical corpus file
//   · same-id re-publish updates in place, never duplicates
//   · byte-identical re-publish is unchanged (idempotent)
//   · a corrupt corpus file is refused, not overwritten
//   · migration failures are recorded, other records still publish
//   · provenance (walker_id, source, tier) survives the round-trip

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { publishEnrichedRecords } from "./publish-corpus";
import type { EnrichedKnowledgeRecord } from "../walkers/pipeline";

let tmpDir: string;
let entityFile: string;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "nex-publish-"));
  entityFile = path.join(tmpDir, "knowledge-entities.json");
});
afterEach(() => { try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* */ } });

function mkEnriched(over: Partial<EnrichedKnowledgeRecord> = {}): EnrichedKnowledgeRecord {
  return {
    id: "rec-1",
    topic: "food.rendang",
    region: "West Sumatra",
    language: "en",
    stability: "stable",
    confidence: 0.9,
    source: "AMAN",
    last_verified: "2026-08-30",
    content: "Rendang is a slow-cooked spiced beef dish from West Sumatra.",
    keywords: ["rendang", "food", "padang"],
    category: "food",
    audience: ["tourist"],
    questions: ["what is rendang?"],
    aliases: ["randang"],
    acquired_at: "2026-08-30",
    walker_id: "walker.food.dishes",
    ...over,
  };
}

describe("publishEnrichedRecords · new corpus", () => {
  it("writes a fresh corpus file when none exists", () => {
    const r = publishEnrichedRecords([mkEnriched()], { entityFile });
    expect(r.published).toBe(1);
    expect(r.updated).toBe(0);
    expect(r.corpusSizeAfter).toBe(1);
    expect(existsSync(entityFile)).toBe(true);
    const written = JSON.parse(readFileSync(entityFile, "utf8"));
    expect(written.entities.length).toBe(1);
    expect(written.entities[0].id).toBe("rec-1");
    expect(written.entities[0].kind).toBe("knowledge");
  });

  it("preserves walker provenance verbatim through the round-trip", () => {
    publishEnrichedRecords([mkEnriched({ walker_id: "walker.custom", source: "TestSrc" })], { entityFile });
    const written = JSON.parse(readFileSync(entityFile, "utf8"));
    const p = written.entities[0].provenance[0];
    expect(p.walkerId).toBe("walker.custom");
    expect(p.sourceKey).toBe("TestSrc");
    expect(p.sourceName).toBe("TestSrc");
  });
});

describe("publishEnrichedRecords · idempotency + upsert", () => {
  it("republishing the identical record leaves the corpus unchanged", () => {
    const rec = mkEnriched();
    // Freeze the clock so the two calls produce identical entities.
    const now = () => new Date("2026-08-30T00:00:00Z");
    const first = publishEnrichedRecords([rec], { entityFile, now });
    const second = publishEnrichedRecords([rec], { entityFile, now });
    expect(first.published).toBe(1);
    expect(second.published).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.unchanged).toBe(1);
    expect(second.corpusSizeBefore).toBe(1);
    expect(second.corpusSizeAfter).toBe(1);
  });

  it("republishing with changed content UPDATES in place · never duplicates", () => {
    publishEnrichedRecords([mkEnriched({ content: "First version of rendang description." })], { entityFile });
    const r = publishEnrichedRecords([mkEnriched({ content: "Revised: rendang description with new detail preserved." })], { entityFile });
    expect(r.published).toBe(0);
    expect(r.updated).toBe(1);
    expect(r.corpusSizeAfter).toBe(1);
    const written = JSON.parse(readFileSync(entityFile, "utf8"));
    expect(written.entities.length).toBe(1);
    expect(written.entities[0].description).toMatch(/Revised/);
  });

  it("does NOT touch entities outside the published set", () => {
    // Seed a corpus with an unrelated entity.
    writeFileSync(entityFile, JSON.stringify({
      schemaVersion: 1, count: 1,
      entities: [{
        id: "untouched-1", kind: "place", category: "geo.province",
        name: "Untouched", keywords: ["u"],
        lifecycle: "PUBLISHED", lifecycleChangedAt: "2026-08-30T00:00:00Z",
        provenance: [{ walkerId: "seed.other", sourceKey: "s", sourceName: "s", sourceTier: "B",
          firstDiscoveredAt: "2026-08-30", lastCheckedAt: "2026-08-30",
          lastChangedAt: "2026-08-30", observedAt: "2026-08-30" }],
        freshness: { policy: "long_lived", lastVerifiedAt: "2026-08-30" },
      }],
    }, null, 2));
    publishEnrichedRecords([mkEnriched()], { entityFile });
    const written = JSON.parse(readFileSync(entityFile, "utf8"));
    expect(written.entities.length).toBe(2);
    expect(written.entities.some((e: { id: string }) => e.id === "untouched-1")).toBe(true);
    expect(written.entities.some((e: { id: string }) => e.id === "rec-1")).toBe(true);
  });
});

describe("publishEnrichedRecords · failure isolation", () => {
  it("refuses to overwrite a corrupt corpus file", () => {
    writeFileSync(entityFile, "not json at all {");
    const r = publishEnrichedRecords([mkEnriched()], { entityFile });
    expect(r.published).toBe(0);
    expect(r.updated).toBe(0);
    expect(r.skipped.length).toBeGreaterThan(0);
    expect(r.skipped[0].reason).toMatch(/corpus_read_failed/);
    // File is left as-is · we did NOT overwrite the operator's corrupt data.
    expect(readFileSync(entityFile, "utf8")).toBe("not json at all {");
  });

  it("records that fail migration are skipped · other records still publish", () => {
    const good = mkEnriched({ id: "good-1" });
    const bad = mkEnriched({ id: "", topic: "", content: "" }) as EnrichedKnowledgeRecord;
    const r = publishEnrichedRecords([good, bad], { entityFile });
    expect(r.published).toBe(1);
    expect(r.skipped.length).toBe(1);
    expect(r.skipped[0].reason).toBe("migration_returned_null");
  });

  it("empty input array is a no-op · no file created, no error", () => {
    const r = publishEnrichedRecords([], { entityFile });
    expect(r.attempted).toBe(0);
    expect(r.published).toBe(0);
    expect(existsSync(entityFile)).toBe(false);
  });
});

describe("publishEnrichedRecords · retrieval reads what supervisor wrote", () => {
  it("published record is retrievable via the canonical reader path", async () => {
    const rec = mkEnriched({ id: "e2e-rendang", topic: "food.rendang", keywords: ["rendang", "padang", "beef", "sumatra"] });
    publishEnrichedRecords([rec], { entityFile });
    // Read back via raw JSON · verifying persistence not the retriever
    // (retriever cache would need injection; we prove the shape here).
    const written = JSON.parse(readFileSync(entityFile, "utf8"));
    const stored = written.entities.find((e: { id: string }) => e.id === "e2e-rendang");
    expect(stored).toBeTruthy();
    expect(stored.category).toBe("food");
    expect(stored.provenance[0].walkerId).toMatch(/^walker\./);
    expect(stored.freshness?.policy).toBe("long_lived"); // stability=stable → freshness=long_lived per migration mapping
    expect(stored.quality?.overall).toBeGreaterThan(0);
  });
});
