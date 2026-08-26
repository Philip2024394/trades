// src/lib/nex-hq/worker-config-resolver.test.ts

import { describe, it, expect } from "vitest";
import { resolveWorkerConfig, isAcquisitionWorkerConfig, ACQUISITION_CONFIG_SQL_LIKE } from "./worker-config-resolver";

describe("resolveWorkerConfig · every real worker_config format resolves", () => {
  // ── Market walker patterns ─────────────────────────────────────────
  it("market · slug-form city (kulon-progo → Kulon Progo)", () => {
    const r = resolveWorkerConfig("market:kulon-progo:nominatim");
    expect(r.resolved).toBe(true);
    if (r.resolved) { expect(r.city).toBe("Kulon Progo"); expect(r.category).toBe("market"); }
  });

  it("market · legacy 'yogyakarta-city' zone id → Yogyakarta", () => {
    const r = resolveWorkerConfig("market:yogyakarta-city:nominatim");
    expect(r.resolved).toBe(true);
    if (r.resolved) expect(r.city).toBe("Yogyakarta");
  });

  it("market · legacy 'central-java-{city}' zone id → canonical", () => {
    const r1 = resolveWorkerConfig("market:central-java-magelang:nominatim");
    const r2 = resolveWorkerConfig("market:central-java-klaten:nominatim");
    const r3 = resolveWorkerConfig("market:central-java-solo:nominatim");
    expect(r1.resolved && r1.city).toBe("Magelang");
    expect(r2.resolved && r2.city).toBe("Klaten");
    expect(r3.resolved && r3.city).toBe("Solo");
  });

  it("market · every tracked city resolves", () => {
    const cases = [
      ["market:yogyakarta-city:nominatim",     "Yogyakarta"],
      ["market:sleman:nominatim",              "Sleman"],
      ["market:bantul:nominatim",              "Bantul"],
      ["market:kulon-progo:nominatim",         "Kulon Progo"],
      ["market:gunungkidul:nominatim",         "Gunungkidul"],
      ["market:central-java-magelang:nominatim", "Magelang"],
      ["market:central-java-klaten:nominatim",  "Klaten"],
      ["market:central-java-solo:nominatim",    "Solo"],
    ] as const;
    for (const [cfg, city] of cases) {
      const r = resolveWorkerConfig(cfg);
      expect(r.resolved, `expected resolve for ${cfg}`).toBe(true);
      if (r.resolved) expect(r.city).toBe(city);
    }
  });

  // ── Food walker patterns ─────────────────────────────────────────
  it("food · Yogyakarta hand-tuned zone (food:Yogyakarta:sleman-north) resolves to Yogyakarta / food", () => {
    const r = resolveWorkerConfig("food:Yogyakarta:sleman-north");
    expect(r.resolved && r.city).toBe("Yogyakarta");
    if (r.resolved) expect(r.category).toBe("food");
  });

  it("food · Sleman factory config (food:Sleman:prambanan) resolves correctly", () => {
    const r = resolveWorkerConfig("food:Sleman:prambanan");
    expect(r.resolved && r.city).toBe("Sleman");
  });

  it("food · Kulon Progo (city with space) resolves correctly", () => {
    const r = resolveWorkerConfig("food:Kulon Progo:prambanan");
    expect(r.resolved && r.city).toBe("Kulon Progo");
    if (r.resolved) expect(r.category).toBe("food");
  });

  it("food · all 8 tracked cities resolve", () => {
    const cases = ["Yogyakarta", "Sleman", "Bantul", "Kulon Progo", "Gunungkidul", "Magelang", "Klaten", "Solo"];
    for (const city of cases) {
      const r = resolveWorkerConfig(`food:${city}:prambanan`);
      expect(r.resolved, `expected resolve for food:${city}:*`).toBe(true);
      if (r.resolved) { expect(r.city).toBe(city); expect(r.category).toBe("food"); }
    }
  });

  // ── Accommodation walker patterns ─────────────────────────────────
  it("accommodation · Yogyakarta hand-tuned zones (borobudur/kaliurang/malioboro/prawirotaman/yogya-wider)", () => {
    const zones = ["borobudur", "kaliurang", "malioboro", "prawirotaman", "yogya-wider"];
    for (const z of zones) {
      const r = resolveWorkerConfig(`accommodation:Yogyakarta:${z}`);
      expect(r.resolved && r.city).toBe("Yogyakarta");
    }
  });

  it("accommodation · non-Yogyakarta factory (accommodation:Klaten:prambanan)", () => {
    const r = resolveWorkerConfig("accommodation:Klaten:prambanan");
    expect(r.resolved && r.city).toBe("Klaten");
    if (r.resolved) expect(r.category).toBe("accommodation");
  });

  // ── Transport walker patterns ─────────────────────────────────────
  it("transport · Yogyakarta (transport:Yogyakarta:query-universe-v1)", () => {
    const r = resolveWorkerConfig("transport:Yogyakarta:query-universe-v1");
    expect(r.resolved && r.city).toBe("Yogyakarta");
    if (r.resolved) expect(r.category).toBe("transport");
  });

  it("transport · Sleman (transport:Sleman:query-universe-v1)", () => {
    const r = resolveWorkerConfig("transport:Sleman:query-universe-v1");
    expect(r.resolved && r.city).toBe("Sleman");
  });
});

describe("resolveWorkerConfig · non-acquisition configs return unresolved (NEVER unknown/unknown)", () => {
  it("'comms' returns unresolved with raw config preserved", () => {
    const r = resolveWorkerConfig("comms");
    expect(r.resolved).toBe(false);
    expect(r.rawConfig).toBe("comms");
  });

  it("'staircase' (CLE worker) returns unresolved", () => {
    const r = resolveWorkerConfig("staircase");
    expect(r.resolved).toBe(false);
  });

  it("hypothetical 'brain:some-worker' returns unresolved", () => {
    const r = resolveWorkerConfig("brain:image-analyst");
    expect(r.resolved).toBe(false);
  });

  it("empty string returns unresolved with empty rawConfig", () => {
    const r = resolveWorkerConfig("");
    expect(r.resolved).toBe(false);
  });

  it("null returns unresolved (no crash)", () => {
    const r = resolveWorkerConfig(null);
    expect(r.resolved).toBe(false);
  });

  it("undefined returns unresolved (no crash)", () => {
    const r = resolveWorkerConfig(undefined);
    expect(r.resolved).toBe(false);
  });

  it("garbage input returns unresolved · NEVER a fake city/category", () => {
    const cases = ["random-string", "market:", "food", "accommodation:", "market:unknown-city:foo", ":::", "market::"];
    for (const c of cases) {
      const r = resolveWorkerConfig(c);
      expect(r.resolved, `expected unresolved for "${c}"`).toBe(false);
    }
  });
});

describe("isAcquisitionWorkerConfig", () => {
  it("returns true for all 4 real acquisition patterns", () => {
    expect(isAcquisitionWorkerConfig("food:Sleman:prambanan")).toBe(true);
    expect(isAcquisitionWorkerConfig("accommodation:Klaten:prambanan")).toBe(true);
    expect(isAcquisitionWorkerConfig("market:sleman:nominatim")).toBe(true);
    expect(isAcquisitionWorkerConfig("transport:Sleman:query-universe-v1")).toBe(true);
  });

  it("returns false for background workers", () => {
    expect(isAcquisitionWorkerConfig("comms")).toBe(false);
    expect(isAcquisitionWorkerConfig("staircase")).toBe(false);
    expect(isAcquisitionWorkerConfig("brain:knowledge-context")).toBe(false);
  });
});

describe("ACQUISITION_CONFIG_SQL_LIKE · used in Recently Completed SQL filter", () => {
  it("contains one LIKE pattern per WALKED_CATEGORIES entry", () => {
    expect(ACQUISITION_CONFIG_SQL_LIKE.length).toBe(4);
    expect(ACQUISITION_CONFIG_SQL_LIKE).toEqual(expect.arrayContaining(["food:%", "accommodation:%", "market:%", "transport:%"]));
  });
});
