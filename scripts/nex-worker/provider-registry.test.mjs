// Regression tests for scripts/nex-worker/provider-registry.mjs
// Philip 2026-08-26 · Discovery Fabric P8 · Foundation A.

import { describe, it, expect } from "vitest";
import {
  getProvider,
  listProviders,
  listHealthyProviders,
  updateHealth,
} from "./provider-registry.mjs";

function makeMockPool(script) {
  const remaining = [...script];
  return {
    query: async (sql, params) => {
      const idx = remaining.findIndex(([re]) => re.test(sql));
      if (idx === -1) throw new Error(`mock pool: unmatched SQL: ${sql}`);
      const [, response] = remaining.splice(idx, 1)[0];
      return typeof response === "function" ? response(sql, params) : response;
    },
    _remaining: remaining,
  };
}

const ROW_NOMINATIM = {
  provider_id: "nominatim-public",
  name: "OSM Nominatim (public)",
  kind: "geocoding",
  capabilities: ["geocode", "reverse-geocode", "places-lookup"],
  current_health_state: "green",
  reliability_score: 60,
  cost_per_request_usd: "0.000000",
};
const ROW_OVERPASS = {
  provider_id: "overpass-public-de",
  kind: "dataset",
  capabilities: ["places-lookup", "business-search"],
  current_health_state: "yellow",
  reliability_score: 40,
};
const ROW_NOM_SELF = {
  provider_id: "nominatim-self",
  kind: "self-hosted",
  capabilities: ["geocode", "reverse-geocode", "places-lookup"],
  current_health_state: "disabled",
  reliability_score: 50,
};
const ROW_GOOGLE = {
  provider_id: "google-places",
  kind: "search",
  capabilities: ["business-search", "places-lookup"],
  current_health_state: "disabled",
  reliability_score: 70,
};

describe("getProvider", () => {
  it("returns row for known id", async () => {
    const pool = makeMockPool([
      [/FROM nex\.provider_registry WHERE provider_id/,
        { rows: [ROW_NOMINATIM], rowCount: 1 }],
    ]);
    const p = await getProvider(pool, "nominatim-public");
    expect(p).not.toBeNull();
    expect(p.provider_id).toBe("nominatim-public");
    expect(p.capabilities).toContain("geocode");
  });

  it("returns null for unknown id", async () => {
    const pool = makeMockPool([
      [/FROM nex\.provider_registry WHERE provider_id/,
        { rows: [], rowCount: 0 }],
    ]);
    const p = await getProvider(pool, "nope");
    expect(p).toBeNull();
  });
});

describe("listProviders", () => {
  it("no filter returns all rows ordered by reliability", async () => {
    const pool = makeMockPool([
      [/SELECT \* FROM nex\.provider_registry\s+ORDER BY reliability_score DESC/,
        { rows: [ROW_GOOGLE, ROW_NOMINATIM, ROW_NOM_SELF, ROW_OVERPASS], rowCount: 4 }],
    ]);
    const rows = await listProviders(pool);
    expect(rows.length).toBe(4);
    expect(rows[0].provider_id).toBe("google-places");
  });

  it("filters by capability using @> containment", async () => {
    let capturedSql = "";
    let capturedParams = null;
    const pool = makeMockPool([
      [/capabilities @>/,
        (sql, params) => {
          capturedSql = sql;
          capturedParams = params;
          return { rows: [ROW_NOMINATIM, ROW_NOM_SELF], rowCount: 2 };
        }],
    ]);
    const rows = await listProviders(pool, { capability: "geocode" });
    expect(rows.length).toBe(2);
    expect(capturedSql).toContain("capabilities @>");
    expect(capturedParams).toEqual([["geocode"]]);
  });

  it("filters by healthState", async () => {
    let capturedParams = null;
    const pool = makeMockPool([
      [/current_health_state = \$1/,
        (sql, params) => {
          capturedParams = params;
          return { rows: [ROW_OVERPASS], rowCount: 1 };
        }],
    ]);
    const rows = await listProviders(pool, { healthState: "yellow" });
    expect(rows[0].provider_id).toBe("overpass-public-de");
    expect(capturedParams).toEqual(["yellow"]);
  });

  it("throws on unknown healthState", async () => {
    const pool = makeMockPool([]);
    await expect(listProviders(pool, { healthState: "sparkly" })).rejects.toThrow(/unknown healthState/);
  });
});

describe("listHealthyProviders", () => {
  it("excludes disabled, red, and circuit-open providers", async () => {
    let capturedParams = null;
    const pool = makeMockPool([
      [/current_health_state = ANY\(\$1::text\[\]\)/,
        (sql, params) => {
          capturedParams = params;
          // Simulate DB returning only rows matching ANY(green,yellow).
          return { rows: [ROW_NOMINATIM, ROW_OVERPASS], rowCount: 2 };
        }],
    ]);
    const rows = await listHealthyProviders(pool);
    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.provider_id).sort()).toEqual(["nominatim-public", "overpass-public-de"]);
    expect(capturedParams).toBeDefined();
    // Only green + yellow are healthy.
    expect(capturedParams[0].sort()).toEqual(["green", "yellow"]);
  });
});

describe("updateHealth", () => {
  it("writes healthState + reliability_score and touches updated_at", async () => {
    let capturedSql = "";
    let capturedParams = null;
    const pool = makeMockPool([
      [/UPDATE nex\.provider_registry\s+SET.*RETURNING/s,
        (sql, params) => {
          capturedSql = sql;
          capturedParams = params;
          return { rows: [{ ...ROW_OVERPASS, current_health_state: "red", reliability_score: 12 }], rowCount: 1 };
        }],
    ]);
    const updated = await updateHealth(pool, "overpass-public-de", {
      healthState: "red",
      reliabilityScore: 12,
      source: "probe-2026-08-26",
    });
    expect(updated.current_health_state).toBe("red");
    expect(updated.reliability_score).toBe(12);
    expect(capturedSql).toContain("current_health_state = $1");
    expect(capturedSql).toContain("reliability_score = $2");
    expect(capturedSql).toContain("updated_at = now()");
    expect(capturedParams).toEqual(["red", 12, "overpass-public-de"]);
  });

  it("returns null for unknown providerId", async () => {
    const pool = makeMockPool([
      [/UPDATE nex\.provider_registry/,
        { rows: [], rowCount: 0 }],
    ]);
    const r = await updateHealth(pool, "nope", { healthState: "red" });
    expect(r).toBeNull();
  });

  it("throws on out-of-range reliability_score", async () => {
    const pool = makeMockPool([]);
    await expect(updateHealth(pool, "any", { reliabilityScore: 999 })).rejects.toThrow(/must be 0..100/);
  });

  it("throws on unknown healthState", async () => {
    const pool = makeMockPool([]);
    await expect(updateHealth(pool, "any", { healthState: "sparkly" })).rejects.toThrow(/unknown healthState/);
  });

  it("no-op when only source is supplied · returns existing row via getProvider", async () => {
    const pool = makeMockPool([
      [/FROM nex\.provider_registry WHERE provider_id/,
        { rows: [ROW_NOMINATIM], rowCount: 1 }],
    ]);
    const r = await updateHealth(pool, "nominatim-public", { source: "probe-x" });
    expect(r.provider_id).toBe("nominatim-public");
  });
});
