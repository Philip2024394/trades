// supervisor-e2e.test.ts · locks the Stage-A guarantee.
//
// Runs the FULL chain in-process, without touching any real registry
// or corpus file, so we can prove the invariant that Stage A shipped:
//
//   supervisor tick
//        → runOneCycle
//        → walker.acquire()
//        → runWalker pipeline (validate + dedupe + Q&A enrich)
//        → onPublish
//        → publishEnrichedRecords
//        → EntityRecord in canonical corpus file
//
// If any step of that chain silently drops records, this suite will
// fail. Mirrors the actual scripts/walkers/run-supervisor.mjs wiring.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { WorkforceRegistry } from "./registry";
import { supervisorTick } from "./supervisor";
import { publishEnrichedRecords } from "./publish-corpus";
import type { KnowledgeWalker, RawFactChunk } from "../walkers/types";

let tmpDir: string;
let corpusFile: string;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "nex-supervisor-e2e-"));
  corpusFile = path.join(tmpDir, "knowledge-entities.json");
});
afterEach(() => { try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* */ } });

function mockWalker(id: string, chunks: RawFactChunk[]): KnowledgeWalker {
  return {
    id,
    domain: "food",
    defaultStability: "stable",
    description: `mock walker for ${id}`,
    refreshCadenceDays: 30,
    async acquire() { return chunks; },
  };
}

function chunk(id: string, over: Partial<RawFactChunk> = {}): RawFactChunk {
  return {
    externalId: id,
    domain: "food",
    topic: `food.${id}`,
    region: "Indonesia",
    language: "en",
    stability: "stable",
    confidence: 0.9,
    source: "TestSource",
    observedAt: "2026-08-30",
    content: `A test record about ${id}. Long enough content to pass the pipeline validator threshold.`,
    keywords: [id, "test", "food"],
    ...over,
  };
}

function wireSupervisor(walker: KnowledgeWalker) {
  const registry = new WorkforceRegistry({ inMemoryOnly: true });
  const walkers = new Map([[walker.id, walker]]);
  const workerId = `worker:${walker.id}:test`;
  registry.registerWorker({ id: workerId, walkerId: walker.id });
  registry.enqueueJob({
    id: `job:${walker.id}:test`,
    walkerId: walker.id,
    region: "test",
    priority: 1,
    scheduledFor: new Date(Date.now() - 1000).toISOString(),
    sourceKey: walker.id,
  });
  const onPublish = async (_wid: string, records: Parameters<typeof publishEnrichedRecords>[0]) => {
    publishEnrichedRecords(records, { entityFile: corpusFile });
  };
  return { registry, walkers, onPublish };
}

describe("supervisor end-to-end · worker → pipeline → publisher → corpus", () => {
  it("happy path · one tick puts records into a previously-empty corpus", async () => {
    const walker = mockWalker("walker.e2e.happy", [
      chunk("rendang-1", { topic: "food.rendang" }),
      chunk("sate-1", { topic: "food.sate" }),
    ]);
    const { registry, walkers, onPublish } = wireSupervisor(walker);

    expect(existsSync(corpusFile)).toBe(false);
    const report = await supervisorTick({ registry, walkers, onPublish });

    expect(report.workersCycled).toBe(1);
    expect(report.publishedRecordsThisTick).toBe(2);
    expect(existsSync(corpusFile)).toBe(true);

    const corpus = JSON.parse(readFileSync(corpusFile, "utf8"));
    expect(corpus.entities.length).toBe(2);
    for (const e of corpus.entities) {
      expect(e.provenance[0].walkerId).toBe("walker.e2e.happy");
      expect(e.provenance[0].sourceName).toBe("TestSource");
      expect(e.category).toBe("food");
      expect(e.quality?.overall).toBeGreaterThan(0);
    }
  });

  it("idempotent · running twice with the same walker output produces no drift", async () => {
    const walker = mockWalker("walker.e2e.idem", [chunk("rendang-1")]);
    const now = () => new Date("2026-08-30T00:00:00Z");
    const { registry, walkers, onPublish } = wireSupervisor(walker);
    // Freeze the publisher's clock so identical-content re-publishes are byte-identical.
    const frozenPublish = async (_wid: string, records: Parameters<typeof publishEnrichedRecords>[0]) => {
      publishEnrichedRecords(records, { entityFile: corpusFile, now });
    };

    await supervisorTick({ registry, walkers, onPublish: frozenPublish, now });
    const after1 = readFileSync(corpusFile, "utf8");

    // Re-enqueue (the first tick rescheduled the job for +cadence days).
    registry.enqueueJob({
      id: `job:${walker.id}:test-2`,
      walkerId: walker.id, region: "test", priority: 1,
      scheduledFor: new Date(Date.now() - 500).toISOString(),
      sourceKey: walker.id,
    });
    await supervisorTick({ registry, walkers, onPublish: frozenPublish, now });
    const after2 = readFileSync(corpusFile, "utf8");

    expect(after1).toEqual(after2);
    const corpus = JSON.parse(after2);
    expect(corpus.entities.length).toBe(1);
  });

  it("update in place · changed content replaces the record · corpus size stable", async () => {
    const walker1 = mockWalker("walker.e2e.upd", [chunk("rendang-1", { content: "Original content · long enough to pass validator." })]);
    const now = () => new Date("2026-08-30T00:00:00Z");
    let capture: KnowledgeWalker = walker1;
    const walkers = new Map<string, KnowledgeWalker>([[walker1.id, walker1]]);
    const registry = new WorkforceRegistry({ inMemoryOnly: true });
    const workerId = `worker:${walker1.id}:test`;
    registry.registerWorker({ id: workerId, walkerId: walker1.id });
    registry.enqueueJob({ id: `job:${walker1.id}:v1`, walkerId: walker1.id, region: "test", priority: 1, scheduledFor: new Date(Date.now() - 1000).toISOString(), sourceKey: walker1.id });
    const publish = async (_w: string, r: Parameters<typeof publishEnrichedRecords>[0]) => {
      publishEnrichedRecords(r, { entityFile: corpusFile, now });
    };

    await supervisorTick({ registry, walkers, onPublish: publish, now });
    const first = JSON.parse(readFileSync(corpusFile, "utf8"));
    expect(first.entities.length).toBe(1);
    expect(first.entities[0].description).toMatch(/Original content/);

    // Swap in a new walker version with different content · same externalId.
    const walker2 = mockWalker("walker.e2e.upd", [chunk("rendang-1", { content: "REVISED content with the changed detail preserved for the round-trip." })]);
    walkers.set(walker2.id, walker2);
    registry.enqueueJob({ id: `job:${walker1.id}:v2`, walkerId: walker1.id, region: "test", priority: 1, scheduledFor: new Date(Date.now() - 500).toISOString(), sourceKey: walker1.id });
    await supervisorTick({ registry, walkers, onPublish: publish, now });

    const second = JSON.parse(readFileSync(corpusFile, "utf8"));
    expect(second.entities.length).toBe(1); // NO duplicate
    expect(second.entities[0].description).toMatch(/REVISED/);
    expect(second.entities[0].id).toBe(first.entities[0].id);
  });

  it("no due jobs · tick cycles workers but publishes nothing · corpus untouched", async () => {
    const walker = mockWalker("walker.e2e.notdue", [chunk("x-1")]);
    const registry = new WorkforceRegistry({ inMemoryOnly: true });
    const walkers = new Map([[walker.id, walker]]);
    registry.registerWorker({ id: `worker:${walker.id}:test`, walkerId: walker.id });
    // Job scheduled 24h in the future.
    registry.enqueueJob({
      id: `job:${walker.id}:future`,
      walkerId: walker.id, region: "test", priority: 1,
      scheduledFor: new Date(Date.now() + 86_400_000).toISOString(),
      sourceKey: walker.id,
    });
    const publish = async (_w: string, r: Parameters<typeof publishEnrichedRecords>[0]) => {
      publishEnrichedRecords(r, { entityFile: corpusFile });
    };

    const report = await supervisorTick({ registry, walkers, onPublish: publish });
    expect(report.publishedRecordsThisTick).toBe(0);
    expect(existsSync(corpusFile)).toBe(false); // publisher was never called with records
  });

  it("failure isolation · a throwing walker doesn't stop a good walker's publish", async () => {
    const good = mockWalker("walker.e2e.good", [chunk("good-1", { topic: "food.good_one" })]);
    const bad: KnowledgeWalker = {
      id: "walker.e2e.bad",
      domain: "food", defaultStability: "stable",
      description: "throws", refreshCadenceDays: 30,
      async acquire() { throw new Error("simulated_source_outage"); },
    };
    const registry = new WorkforceRegistry({ inMemoryOnly: true });
    const walkers = new Map([[good.id, good], [bad.id, bad]]);
    for (const w of [good, bad]) {
      registry.registerWorker({ id: `worker:${w.id}:test`, walkerId: w.id });
      registry.enqueueJob({ id: `job:${w.id}:test`, walkerId: w.id, region: "test", priority: 1, scheduledFor: new Date(Date.now() - 1000).toISOString(), sourceKey: w.id });
    }
    const publish = async (_w: string, r: Parameters<typeof publishEnrichedRecords>[0]) => {
      publishEnrichedRecords(r, { entityFile: corpusFile });
    };

    const report = await supervisorTick({ registry, walkers, onPublish: publish });
    // Bad walker's failure must not block the good walker's publish.
    expect(report.publishedRecordsThisTick).toBe(1);
    const corpus = JSON.parse(readFileSync(corpusFile, "utf8"));
    expect(corpus.entities.length).toBe(1);
    expect(corpus.entities[0].provenance[0].walkerId).toBe("walker.e2e.good");
  });

  it("walker returns empty · counts as failure · no bogus record enters corpus", async () => {
    const empty = mockWalker("walker.e2e.empty", []);
    const registry = new WorkforceRegistry({ inMemoryOnly: true });
    const walkers = new Map([[empty.id, empty]]);
    registry.registerWorker({ id: `worker:${empty.id}:test`, walkerId: empty.id });
    registry.enqueueJob({ id: `job:${empty.id}:test`, walkerId: empty.id, region: "test", priority: 1, scheduledFor: new Date(Date.now() - 1000).toISOString(), sourceKey: empty.id });
    const publish = async (_w: string, r: Parameters<typeof publishEnrichedRecords>[0]) => {
      publishEnrichedRecords(r, { entityFile: corpusFile });
    };

    const report = await supervisorTick({ registry, walkers, onPublish: publish });
    expect(report.publishedRecordsThisTick).toBe(0);
    expect(existsSync(corpusFile)).toBe(false); // never wrote a bogus record
  });

  it("pipeline validation drops junk chunks · corpus only receives valid records", async () => {
    const walker = mockWalker("walker.e2e.mixed", [
      chunk("valid-1", { topic: "food.valid" }),
      chunk("invalid-1", { content: "too short", keywords: [] }), // fails validator
      chunk("valid-2", { topic: "food.also_valid" }),
    ]);
    const { registry, walkers, onPublish } = wireSupervisor(walker);

    await supervisorTick({ registry, walkers, onPublish });
    const corpus = JSON.parse(readFileSync(corpusFile, "utf8"));
    expect(corpus.entities.length).toBe(2);
    for (const e of corpus.entities) {
      expect(e.description.length).toBeGreaterThan(40);
    }
  });
});
