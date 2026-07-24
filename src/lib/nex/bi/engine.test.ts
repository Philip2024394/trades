// Engine — aggregation, caching, per-adapter error isolation.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the registry BEFORE importing the engine so it picks up the fakes.
vi.mock("./registry", () => {
  const okAdapter = {
    domain: "projects", label: "Projects", weight: 2,
    async run() {
      return {
        domain: "projects", label: "Projects", sub_score: 80, weight: 2,
        metrics: [], observations: [
          { key: "up",   domain: "projects", severity: "info",    headline: "All good.",   evidence: { source: "t", tables: [], computed_at: "x" } },
          { key: "bad",  domain: "projects", severity: "warning", headline: "Watch this.", evidence: { source: "t", tables: [], computed_at: "x" } }
        ]
      };
    }
  };
  const nullAdapter = {
    domain: "reviews", label: "Reviews", weight: 1,
    async run() {
      return {
        domain: "reviews", label: "Reviews", sub_score: null, weight: 1,
        metrics: [], observations: []
      };
    }
  };
  const throwingAdapter = {
    domain: "invoices", label: "Invoices", weight: 3,
    async run() { throw new Error("db exploded"); }
  };
  return {
    ADAPTERS: [okAdapter, nullAdapter, throwingAdapter],
    adapterByDomain: (d: string) => [okAdapter, nullAdapter, throwingAdapter].find((a) => a.domain === d) ?? null
  };
});

import { buildBusinessSnapshot, _clearBiCache } from "./engine";

beforeEach(() => _clearBiCache());

describe("buildBusinessSnapshot", () => {
  it("aggregates domains + skips null-scored ones", async () => {
    const s = await buildBusinessSnapshot({ merchantSlug: "m1" });
    // Only the projects adapter has a real sub_score (80, weight 2).
    // reviews returned null → excluded. invoices threw → excluded.
    expect(s.score).toBe(80);
    expect(s.band).toBe("healthy");
  });

  it("reports adapter errors on the snapshot", async () => {
    const s = await buildBusinessSnapshot({ merchantSlug: "m2" });
    expect(s.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ domain: "invoices", error: expect.stringContaining("db exploded") })
    ]));
  });

  it("sorts observations by severity (warning before info)", async () => {
    const s = await buildBusinessSnapshot({ merchantSlug: "m3" });
    expect(s.observations[0].severity).toBe("warning");
    expect(s.observations[1].severity).toBe("info");
  });

  it("sorts domains by weight desc", async () => {
    const s = await buildBusinessSnapshot({ merchantSlug: "m4" });
    // invoices weight 3 > projects 2 > reviews 1
    expect(s.domains[0].domain).toBe("invoices");
    expect(s.domains[1].domain).toBe("projects");
    expect(s.domains[2].domain).toBe("reviews");
  });

  it("caches snapshots per (merchant, hour) — second call skips adapters", async () => {
    const now = new Date("2026-07-23T09:15:00Z");
    const s1 = await buildBusinessSnapshot({ merchantSlug: "m-cache", now });
    const s2 = await buildBusinessSnapshot({ merchantSlug: "m-cache", now });
    expect(s1).toBe(s2);   // same reference — cache hit
  });

  it("refresh:true bypasses cache", async () => {
    const now = new Date("2026-07-23T09:15:00Z");
    const s1 = await buildBusinessSnapshot({ merchantSlug: "m-refresh", now });
    const s2 = await buildBusinessSnapshot({ merchantSlug: "m-refresh", now, refresh: true });
    expect(s1).not.toBe(s2);   // different object even though content equal
  });
});
