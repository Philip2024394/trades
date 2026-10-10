// src/lib/nex/capability-runtime/discovery-lanes.test.ts
//
// Stage 12 acceptance · discovery lane separation catalogue.
// §18 no-fake-completeness: every LaneModule.module_path must exist on disk.
// The DELIBERATELY ABSENT lanes must remain absent from the KNOWN taxonomy.

import { describe, it, expect } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  KNOWN_DISCOVERY_LANES,
  HONESTLY_ABSENT_LANES,
  LANE_MODULES,
  modulesInLane,
  lanesForModule,
  abstractionsInLane,
  concreteImplementationsInLane,
  type DiscoveryLane,
} from "./discovery-lanes";

const ROOT = process.cwd();

describe("Discovery lane taxonomy · Stage 12", () => {
  it("KNOWN_DISCOVERY_LANES has exactly 8 lanes", () => {
    expect(KNOWN_DISCOVERY_LANES.length).toBe(8);
  });

  it("HONESTLY_ABSENT_LANES lists the 4 lanes NEX deliberately does NOT model", () => {
    expect([...HONESTLY_ABSENT_LANES].sort()).toEqual([
      "browser_headless",
      "maps_standalone",
      "search_engine",
      "social_discovery",
    ]);
  });

  it("absent lanes are NOT accidentally present in KNOWN_DISCOVERY_LANES", () => {
    for (const absent of HONESTLY_ABSENT_LANES) {
      expect(
        (KNOWN_DISCOVERY_LANES as readonly string[]).includes(absent),
        `${absent} must not appear in KNOWN_DISCOVERY_LANES`,
      ).toBe(false);
    }
  });

  it("every lane in KNOWN_DISCOVERY_LANES has at least one implementing module", () => {
    for (const lane of KNOWN_DISCOVERY_LANES) {
      const modules = modulesInLane(lane);
      expect(modules.length, `lane ${lane} has no implementing modules`).toBeGreaterThan(0);
    }
  });
});

describe("Lane module catalogue · Stage 12 (§18 · no fake completeness)", () => {
  it("catalogue is non-empty and every entry has a valid lane", () => {
    expect(LANE_MODULES.length).toBeGreaterThan(0);
    for (const m of LANE_MODULES) {
      expect(KNOWN_DISCOVERY_LANES).toContain(m.lane);
    }
  });

  it("ANTI-INVENTION: every LaneModule.module_path exists on disk", async () => {
    for (const m of LANE_MODULES) {
      const abs = path.join(ROOT, m.module_path);
      let stat;
      try { stat = await fs.stat(abs); } catch { stat = null; }
      expect(
        stat,
        `${m.lane} cites ${m.module_path} — must exist`,
      ).not.toBeNull();
      expect(stat!.isFile()).toBe(true);
    }
  });

  it("every LaneModule has a non-trivial role description", () => {
    for (const m of LANE_MODULES) {
      expect(m.role.length).toBeGreaterThan(20);
    }
  });

  it("is_abstraction flag is a boolean", () => {
    for (const m of LANE_MODULES) {
      expect(typeof m.is_abstraction).toBe("boolean");
    }
  });

  it("website_acquisition lane has BOTH an abstraction and concrete implementations", () => {
    const abstractions = abstractionsInLane("website_acquisition");
    const concretes = concreteImplementationsInLane("website_acquisition");
    expect(abstractions.length).toBeGreaterThan(0);
    expect(concretes.length).toBeGreaterThan(0);
    // Abstraction: page-fetcher.ts (NULL_FETCHER default)
    expect(abstractions[0].module_path).toContain("page-fetcher.ts");
  });

  it("discovery lane surfaces the 4 known adapters", () => {
    const modules = modulesInLane("discovery").map((m) => m.module_path);
    expect(modules).toContain("src/lib/nex/aof/adapters/nominatim-adapter.ts");
    expect(modules).toContain("src/lib/nex/harvest/production-overpass-adapter.ts");
    expect(modules).toContain("src/lib/nex/aof/adapters/wikidata-adapter.ts");
    expect(modules).toContain("src/lib/nex/aof/adapters/companies-house-uk.ts");
  });

  it("extraction / classification / entity_resolution / evidence_recording each surface their canonical module", () => {
    expect(modulesInLane("extraction").map((m) => m.module_path))
      .toContain("src/lib/nex/discovery-world/email-extractor.ts");
    expect(modulesInLane("classification").map((m) => m.module_path))
      .toContain("src/lib/nex/discovery-world/email-classifier.ts");
    expect(modulesInLane("entity_resolution").map((m) => m.module_path))
      .toContain("src/lib/nex/discovery-world/entity-resolution.ts");
    expect(modulesInLane("evidence_recording").map((m) => m.module_path))
      .toContain("src/lib/nex/discovery-world/business-evidence.ts");
  });

  it("website_walking includes both walker and executor", () => {
    const modules = modulesInLane("website_walking").map((m) => m.module_path);
    expect(modules).toContain("src/lib/nex/discovery-world/website-walker.ts");
    expect(modules).toContain("src/lib/nex/harvest/website-walk-executor.ts");
  });

  it("website_resolution is currently embedded in discovery adapters (no standalone module yet)", () => {
    const modules = modulesInLane("website_resolution").map((m) => m.module_path);
    // Honest: NEX does not have a separate resolver · resolution comes from
    // OSM/Wikidata tags returned by the discovery adapters themselves.
    // Every website_resolution module must be an adapter file (name contains "adapter").
    for (const p of modules) {
      expect(p, `${p} should be an adapter file`).toMatch(/adapter/i);
    }
  });

  it("lanesForModule returns all lanes that reference a given module", () => {
    // production-overpass-adapter appears in both discovery AND website_resolution
    const overpassLanes = lanesForModule("src/lib/nex/harvest/production-overpass-adapter.ts");
    expect([...overpassLanes].sort()).toEqual(["discovery", "website_resolution"]);
  });

  it("lanesForModule returns empty for unknown module", () => {
    expect(lanesForModule("src/does/not/exist.ts")).toEqual([]);
  });
});

describe("Stage 12 · anti-pattern surface", () => {
  it("module exports NO write/dispatch/execute/create FUNCTIONS", async () => {
    const mod: Record<string, unknown> = await import("./discovery-lanes");
    for (const key of Object.keys(mod)) {
      if (typeof mod[key] !== "function") continue;
      expect(key.toLowerCase()).not.toMatch(
        /^(write|dispatch|execute|create|update|delete|mutate|persist|store|save|enqueue|spawn|start|stop)/,
      );
    }
  });

  it("discovery-lanes.ts source contains no SQL writes and no writer imports", async () => {
    const src = await fs.readFile(
      path.join(ROOT, "src/lib/nex/capability-runtime/discovery-lanes.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/\bINSERT\b|\bUPDATE\b|\bDELETE\b/);
    // Zero imports from any authoritative writer
    expect(src).not.toMatch(/from ["'].*aof\/|from ["'].*harvest\/|from ["'].*discovery-world\//);
  });
});
