// Regression tests for the Job Registry loader.
// Locks in validation contracts so a bad JSON edit fails loudly.

import { describe, it, expect, beforeEach } from "vitest";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadJobRegistry,
  allJobs,
  jobBySlug,
  jobById,
  jobCategorySlugs,
  _resetCache,
} from "./_job-registry.mjs";

const goodRegistry = {
  jobs: [
    {
      id: "01",
      name: "Restaurants",
      emoji: "🍜",
      category_slug: "restaurants",
      target_table: "nex.food_business",
      strategies: [
        { provider: "overpass", query_kind: "tag", params: { amenity: "restaurant" } },
      ],
      geographic_scope: "indonesia-all",
    },
    {
      id: "09",
      name: "Gyms",
      emoji: "🏋️",
      category_slug: "gyms",
      target_table: "nex.service_business",
      strategies: [
        { provider: "overpass", query_kind: "tag", params: { leisure: "fitness_centre" } },
      ],
      geographic_scope: "indonesia-all",
    },
  ],
};

function writeTempRegistry(obj) {
  const dir = mkdtempSync(join(tmpdir(), "job-reg-"));
  const path = join(dir, "reg.json");
  writeFileSync(path, JSON.stringify(obj), "utf8");
  return path;
}

describe("Job Registry loader · validation", () => {
  beforeEach(() => _resetCache());

  it("loads and validates a well-formed registry", () => {
    const path = writeTempRegistry(goodRegistry);
    const reg = loadJobRegistry({ force: true, path });
    expect(reg.jobs).toHaveLength(2);
    expect(reg.jobs[0].category_slug).toBe("restaurants");
  });

  it("freezes jobs to prevent mutation at runtime", () => {
    const path = writeTempRegistry(goodRegistry);
    const reg = loadJobRegistry({ force: true, path });
    expect(Object.isFrozen(reg.jobs)).toBe(true);
    expect(Object.isFrozen(reg.jobs[0])).toBe(true);
  });

  it("rejects duplicate category_slug", () => {
    const bad = { jobs: [goodRegistry.jobs[0], { ...goodRegistry.jobs[0], id: "02" }] };
    const path = writeTempRegistry(bad);
    expect(() => loadJobRegistry({ force: true, path })).toThrow(/duplicate category_slug/);
  });

  it("rejects duplicate id", () => {
    const bad = { jobs: [goodRegistry.jobs[0], { ...goodRegistry.jobs[1], id: "01" }] };
    const path = writeTempRegistry(bad);
    expect(() => loadJobRegistry({ force: true, path })).toThrow(/duplicate id/);
  });

  it("rejects non-2-digit id", () => {
    const bad = { jobs: [{ ...goodRegistry.jobs[0], id: "1" }] };
    const path = writeTempRegistry(bad);
    expect(() => loadJobRegistry({ force: true, path })).toThrow(/id must be a 2-digit/);
  });

  it("rejects invalid category_slug format", () => {
    const bad = { jobs: [{ ...goodRegistry.jobs[0], category_slug: "Bad Slug" }] };
    const path = writeTempRegistry(bad);
    expect(() => loadJobRegistry({ force: true, path })).toThrow(/lowercase-hyphenated/);
  });

  it("rejects unknown target_table", () => {
    const bad = { jobs: [{ ...goodRegistry.jobs[0], target_table: "nex.random_table" }] };
    const path = writeTempRegistry(bad);
    expect(() => loadJobRegistry({ force: true, path })).toThrow(/target_table must be one of/);
  });

  it("rejects unknown provider", () => {
    const bad = {
      jobs: [{
        ...goodRegistry.jobs[0],
        strategies: [{ provider: "google-maps", query_kind: "tag", params: {} }],
      }],
    };
    const path = writeTempRegistry(bad);
    expect(() => loadJobRegistry({ force: true, path })).toThrow(/provider must be one of/);
  });

  it("rejects unknown query_kind", () => {
    const bad = {
      jobs: [{
        ...goodRegistry.jobs[0],
        strategies: [{ provider: "overpass", query_kind: "sql", params: {} }],
      }],
    };
    const path = writeTempRegistry(bad);
    expect(() => loadJobRegistry({ force: true, path })).toThrow(/query_kind must be one of/);
  });

  it("rejects empty strategies array", () => {
    const bad = { jobs: [{ ...goodRegistry.jobs[0], strategies: [] }] };
    const path = writeTempRegistry(bad);
    expect(() => loadJobRegistry({ force: true, path })).toThrow(/non-empty array/);
  });
});

describe("Job Registry accessors", () => {
  beforeEach(() => _resetCache());

  it("jobBySlug returns the matching job", () => {
    const path = writeTempRegistry(goodRegistry);
    loadJobRegistry({ force: true, path });
    expect(jobBySlug("gyms").id).toBe("09");
  });

  it("jobBySlug throws for unknown slug", () => {
    const path = writeTempRegistry(goodRegistry);
    loadJobRegistry({ force: true, path });
    expect(() => jobBySlug("nonexistent")).toThrow(/no job with category_slug/);
  });

  it("jobById returns the matching job", () => {
    const path = writeTempRegistry(goodRegistry);
    loadJobRegistry({ force: true, path });
    expect(jobById("01").name).toBe("Restaurants");
  });

  it("jobCategorySlugs returns all slugs in registry order", () => {
    const path = writeTempRegistry(goodRegistry);
    loadJobRegistry({ force: true, path });
    expect(jobCategorySlugs()).toEqual(["restaurants", "gyms"]);
  });
});

describe("Actual production registry", () => {
  beforeEach(() => _resetCache());

  it("data/nex-job-registry.json loads and validates", () => {
    const reg = loadJobRegistry({ force: true });
    expect(reg.jobs.length).toBeGreaterThanOrEqual(10);
    const slugs = new Set(reg.jobs.map((j) => j.category_slug));
    // Philip's Phase 1 spec: 10 specific categories.
    for (const required of [
      "restaurants", "cafes", "hotels", "guesthouses", "gyms",
      "salons", "dentists", "opticians", "pharmacies", "car-repair",
    ]) {
      expect(slugs.has(required), `Phase 1 requires "${required}" job`).toBe(true);
    }
  });

  it("target_tables are legal (Phase 1 · food/accom/service · Phase 2 · mp_seller)", () => {
    const reg = loadJobRegistry({ force: true });
    const legal = new Set([
      "nex.food_business", "nex.accommodation_business", "nex.service_business",
      "nex.mp_seller",   // Phase 2 marketplace · Philip 2026-08-27
    ]);
    for (const j of reg.jobs) {
      expect(legal.has(j.target_table), `job ${j.id} target_table`).toBe(true);
    }
  });

  it("all Phase 1 strategies use registered providers", () => {
    const reg = loadJobRegistry({ force: true });
    const legal = new Set(["overpass", "nominatim", "own-website", "wikipedia"]);
    for (const j of reg.jobs) {
      for (const s of j.strategies) {
        expect(legal.has(s.provider), `job ${j.id} provider "${s.provider}"`).toBe(true);
      }
    }
  });
});
