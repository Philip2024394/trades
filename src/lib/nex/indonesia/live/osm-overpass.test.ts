// osm-overpass.test.ts · Stage 3 · locks the OSM accommodation
// connector invariants + integration with the workforce.
//
// Never hits real Overpass in tests · uses the connector's mock
// injection path (fetch({ mock })) same pattern as BMKG tests.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  parseOverpassAccommodation,
  createOsmAccommodationConnector,
  OSM_YOGYAKARTA_ACCOMMODATION_CONFIG,
} from "./osm-overpass";
import { WorkforceRegistry } from "../workforce/registry";
import { supervisorTick } from "../workforce/supervisor";
import { publishEnrichedRecords, publishEntitiesDirect } from "../workforce/publish-corpus";
import { createLiveSourceWorker, consumeLiveSourceEntities } from "../workforce/live-source-adapter";
import type { KnowledgeWalker } from "../walkers/types";

const OVERPASS_FIXTURE = {
  version: 0.6,
  generator: "Overpass API 0.7.62.4",
  osm3s: {
    timestamp_osm_base: "2026-08-30T00:00:00Z",
    copyright: "The data included in this document is from www.openstreetmap.org. The data is made available under ODbL.",
  },
  elements: [
    {
      type: "node", id: 448834550, lat: -7.7899, lon: 110.3651,
      timestamp: "2024-05-07T04:13:48Z", version: 3,
      tags: {
        tourism: "guest_house", name: "Lotus 2 GH",
        "addr:street": "Jalan Wongsodirjan", "addr:city": "Yogyakarta",
        "contact:phone": "+62-274-000000",
      },
    },
    {
      type: "node", id: 491103648, lat: -7.7920, lon: 110.3680,
      timestamp: "2024-01-15T10:00:00Z", version: 2,
      tags: { tourism: "hotel", name: "Hotel Trio", stars: "3" },
    },
    {
      type: "node", id: 999999998, lat: -7.7930, lon: 110.3690,
      timestamp: "2024-06-01T00:00:00Z", version: 1,
      tags: { tourism: "hostel" }, // no name → dropped
    },
    {
      type: "way", id: 111, center: { lat: -7.7940, lon: 110.3700 },
      timestamp: "2024-03-01T00:00:00Z", version: 5,
      tags: { tourism: "hotel", name: "Grand Melia Yogyakarta", stars: "5", "contact:website": "https://example.com" },
    },
  ],
};

let tmpDir: string;
let corpusFile: string;
beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "nex-osm-"));
  corpusFile = path.join(tmpDir, "knowledge-entities.json");
});
afterEach(() => { try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* */ } });

// ─── Parser ─────────────────────────────────────────────────────

describe("parseOverpassAccommodation · shape and provenance", () => {
  it("produces one EntityRecord per named element · drops unnamed", () => {
    const now = new Date("2026-08-31T12:00:00Z");
    const entities = parseOverpassAccommodation(OVERPASS_FIXTURE, now);
    expect(entities.length).toBe(3); // 4 elements · 1 unnamed dropped
  });

  it("every record carries market=ID + Tier=C + ODbL provenance", () => {
    const entities = parseOverpassAccommodation(OVERPASS_FIXTURE);
    for (const e of entities) {
      expect(e.provenance[0].market).toBe("ID");
      expect(e.provenance[0].sourceTier).toBe("C");
      expect(e.provenance[0].sourceName).toMatch(/OpenStreetMap/);
      expect(e.provenance[0].sourceUrl).toMatch(/^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/);
      expect(e.attributes?.osmLicence).toMatch(/ODbL/);
    }
  });

  it("preserves OSM element timestamp as freshness anchor · never fabricates", () => {
    const entities = parseOverpassAccommodation(OVERPASS_FIXTURE);
    const lotus = entities.find((e) => e.name === "Lotus 2 GH")!;
    expect(lotus.provenance[0].firstDiscoveredAt).toBe("2024-05-07T04:13:48.000Z");
    expect(lotus.provenance[0].observedAt).toBe("2024-05-07T04:13:48.000Z");
  });

  it("emits correct category per tourism type", () => {
    const entities = parseOverpassAccommodation(OVERPASS_FIXTURE);
    const byCat = new Map(entities.map((e) => [e.name, e.category]));
    expect(byCat.get("Lotus 2 GH")).toBe("accommodation.guesthouse");
    expect(byCat.get("Hotel Trio")).toBe("accommodation.hotel");
    expect(byCat.get("Grand Melia Yogyakarta")).toBe("accommodation.hotel");
  });

  it("preserves contact info when tags provide it · verified=false", () => {
    const entities = parseOverpassAccommodation(OVERPASS_FIXTURE);
    const lotus = entities.find((e) => e.name === "Lotus 2 GH")!;
    expect(lotus.contacts?.some((c) => c.kind === "phone" && c.value === "+62-274-000000" && c.verified === false)).toBe(true);
    const grand = entities.find((e) => e.name === "Grand Melia Yogyakarta")!;
    expect(grand.contacts?.some((c) => c.kind === "website" && c.verified === false)).toBe(true);
  });

  it("geo carries province slug + Java island for Yogyakarta records", () => {
    const entities = parseOverpassAccommodation(OVERPASS_FIXTURE);
    for (const e of entities) {
      expect(e.geo?.province).toBe("di-yogyakarta");
      expect(e.geo?.island).toBe("Java");
    }
  });

  it("deterministic id · re-parse produces identical id", () => {
    const a = parseOverpassAccommodation(OVERPASS_FIXTURE);
    const b = parseOverpassAccommodation(OVERPASS_FIXTURE);
    expect(a.map((e) => e.id).sort()).toEqual(b.map((e) => e.id).sort());
    expect(a[0].id).toMatch(/^place:accommodation:osm:(node|way|relation)_\d+$/);
  });
});

// ─── Connector ──────────────────────────────────────────────────

describe("createOsmAccommodationConnector · mock path", () => {
  it("returns LiveObservation with entities from mock fixture", async () => {
    const c = createOsmAccommodationConnector();
    const r = await c.fetch({ mock: OVERPASS_FIXTURE });
    expect("error" in r).toBe(false);
    if ("error" in r) throw new Error("unexpected");
    expect(r.live).toBe(false);
    expect(r.entities.length).toBe(3);
  });

  it("config declares market-agnostic acquisition metadata", () => {
    expect(OSM_YOGYAKARTA_ACCOMMODATION_CONFIG.kind).toBe("osm_overpass");
    expect(OSM_YOGYAKARTA_ACCOMMODATION_CONFIG.freshnessPolicy).toBe("monthly");
    expect(OSM_YOGYAKARTA_ACCOMMODATION_CONFIG.pollIntervalMs).toBe(86_400_000);
  });
});

describe("createOsmAccommodationConnector · failure path", () => {
  it("all endpoints failing → LiveFetchError · never throws", async () => {
    const alwaysFailFetch = (async () => ({
      ok: false, status: 503,
      text: async () => "upstream",
    })) as unknown as typeof fetch;
    const c = createOsmAccommodationConnector({ __fetch: alwaysFailFetch });
    const r = await c.fetch();
    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.reason).toBe("http_status");
  });

  it("all endpoints throwing → LiveFetchError · never throws", async () => {
    const throwingFetch = (async () => { throw new Error("network unreachable"); }) as unknown as typeof fetch;
    const c = createOsmAccommodationConnector({ __fetch: throwingFetch });
    const r = await c.fetch();
    expect("error" in r).toBe(true);
    if ("error" in r) expect(["network", "timeout"]).toContain(r.reason);
  });
});

// ─── End-to-end workforce integration ───────────────────────────

describe("OSM connector via workforce · end-to-end", () => {
  it("Stage 3 fidelity · direct publish preserves geo + category + real name (not mangled by pipeline)", async () => {
    const connector = createOsmAccommodationConnector();
    const wrapped = {
      config: connector.config,
      async fetch() { return connector.fetch({ mock: OVERPASS_FIXTURE }); },
    };
    const walker = createLiveSourceWorker(wrapped, { walkerId: "walker.travel.accommodation", domain: "landmark" });
    const registry = new WorkforceRegistry({ inMemoryOnly: true });
    const walkers = new Map<string, KnowledgeWalker>([[walker.id, walker]]);
    registry.registerWorker({ id: `w:${walker.id}`, walkerId: walker.id });
    registry.enqueueJob({
      id: `j:${walker.id}:fidelity`, walkerId: walker.id, region: "national", priority: 2,
      scheduledFor: new Date(Date.now() - 1000).toISOString(), sourceKey: walker.id,
    });
    const publish = async (wid: string, r: Parameters<typeof publishEnrichedRecords>[0]) => {
      const liveEntities = consumeLiveSourceEntities(wid);
      if (liveEntities.length > 0) publishEntitiesDirect(liveEntities, { entityFile: corpusFile });
      else publishEnrichedRecords(r, { entityFile: corpusFile });
    };

    await supervisorTick({ registry, walkers, onPublish: publish });
    const corpus = JSON.parse(readFileSync(corpusFile, "utf8"));
    const grand = corpus.entities.find((e: { name: string }) => e.name === "Grand Melia Yogyakarta");
    expect(grand).toBeTruthy();
    expect(grand.category).toBe("accommodation.hotel");
    expect(grand.geo?.lat).toBeCloseTo(-7.7940);
    expect(grand.geo?.lng).toBeCloseTo(110.3700);
    expect(grand.provenance[0].sourceUrl).toMatch(/^https:\/\/www\.openstreetmap\.org\/way\/111$/);
    expect(grand.attributes?.stars).toBe("5");
  });

  it("records reach the canonical corpus with Tier=C + market=ID", async () => {
    const connector = createOsmAccommodationConnector();
    // Wrap connector so workforce path uses mock (no network).
    const wrapped = {
      config: connector.config,
      async fetch() { return connector.fetch({ mock: OVERPASS_FIXTURE }); },
    };
    const walker = createLiveSourceWorker(wrapped, { walkerId: "walker.travel.accommodation", domain: "landmark" });
    const registry = new WorkforceRegistry({ inMemoryOnly: true });
    const walkers = new Map<string, KnowledgeWalker>([[walker.id, walker]]);
    registry.registerWorker({ id: `w:${walker.id}`, walkerId: walker.id });
    registry.enqueueJob({
      id: `j:${walker.id}:e2e`, walkerId: walker.id, region: "national", priority: 2,
      scheduledFor: new Date(Date.now() - 1000).toISOString(), sourceKey: walker.id,
    });
    // Stage 3 fidelity fix · live-source adapters use publishEntitiesDirect
    // to preserve geo/category/name through publishing.
    const onPublish = async (wid: string, records: Parameters<typeof publishEnrichedRecords>[0]) => {
      const liveEntities = consumeLiveSourceEntities(wid);
      if (liveEntities.length > 0) publishEntitiesDirect(liveEntities, { entityFile: corpusFile });
      else publishEnrichedRecords(records, { entityFile: corpusFile });
    };

    const report = await supervisorTick({ registry, walkers, onPublish });
    expect(report.publishedRecordsThisTick).toBeGreaterThan(0);
    expect(existsSync(corpusFile)).toBe(true);

    const corpus = JSON.parse(readFileSync(corpusFile, "utf8"));
    expect(corpus.entities.length).toBeGreaterThan(0);
    // Every OSM-published entity must carry Tier=C + market=ID.
    for (const e of corpus.entities) {
      expect(e.provenance[0].sourceTier).toBe("C");
      expect(e.provenance[0].market).toBe("ID");
      expect(e.provenance[0].walkerId).toBe("walker.travel.accommodation");
    }
  });

  it("republishing the same OSM response · no duplicates · same ids", async () => {
    const connector = createOsmAccommodationConnector();
    const wrapped = {
      config: connector.config,
      async fetch() { return connector.fetch({ mock: OVERPASS_FIXTURE }); },
    };
    const walker = createLiveSourceWorker(wrapped, { walkerId: "walker.travel.accommodation", domain: "landmark" });
    const registry = new WorkforceRegistry({ inMemoryOnly: true });
    const walkers = new Map<string, KnowledgeWalker>([[walker.id, walker]]);
    registry.registerWorker({ id: `w:${walker.id}`, walkerId: walker.id });
    registry.enqueueJob({
      id: `j:${walker.id}:t1`, walkerId: walker.id, region: "national", priority: 2,
      scheduledFor: new Date(Date.now() - 1000).toISOString(), sourceKey: walker.id,
    });
    const publish = async (wid: string, r: Parameters<typeof publishEnrichedRecords>[0]) => {
      const liveEntities = consumeLiveSourceEntities(wid);
      if (liveEntities.length > 0) publishEntitiesDirect(liveEntities, { entityFile: corpusFile });
      else publishEnrichedRecords(r, { entityFile: corpusFile });
    };

    await supervisorTick({ registry, walkers, onPublish: publish });
    const first = JSON.parse(readFileSync(corpusFile, "utf8"));

    registry.enqueueJob({
      id: `j:${walker.id}:t2`, walkerId: walker.id, region: "national", priority: 2,
      scheduledFor: new Date(Date.now() - 500).toISOString(), sourceKey: walker.id,
    });
    await supervisorTick({ registry, walkers, onPublish: publish });
    const second = JSON.parse(readFileSync(corpusFile, "utf8"));

    expect(second.entities.length).toBe(first.entities.length);
    expect(new Set(second.entities.map((e: { id: string }) => e.id))).toEqual(new Set(first.entities.map((e: { id: string }) => e.id)));
  });
});
