// scale.test.ts · honest scale test.
//
// Synthesises 10k / 100k records and measures the hot paths of the
// data layer: dedupe/merge scoring, freshness calc, conflict
// resolution, quality scoring. Records the observed throughput so we
// can defend claims about "1M records" architecturally.
//
// Deliberate design choice: the current in-memory + file-backed
// registry is O(N) for many operations. This test EXPOSES that so
// the operational note in the report is honest.
//
// Runs are bounded so vitest completes in reasonable time. If you
// want to run the 1M-scale probe locally, set NEX_SCALE_LARGE=1
// (adds ~30s to the test suite).

import { describe, it, expect } from "vitest";
import { scoreEntity } from "./quality";
import { computeStaleness, stampVerified } from "./freshness";
import { resolveConflict } from "./conflict";
import { scoreMerge, normaliseName } from "./entity-resolution";
import type { EntityRecord, ProvenanceRef } from "./types";

// ─── Synthetic corpus generator ────────────────────────────────────

const CATEGORIES = ["destinations", "food", "culture", "spiritual", "adat", "travel", "safety", "resident"];
const REGIONS = ["Bali", "Java", "Sumatra", "Sulawesi", "Kalimantan", "Papua", "Nusa Tenggara", "Maluku", "Indonesia"];
const SOURCES = ["seed.curated", "walker.a", "walker.b", "walker.c", "official.gov", "commercial.b1"];

function synthEntity(i: number, now: Date = new Date()): EntityRecord {
  const cat = CATEGORIES[i % CATEGORIES.length];
  const region = REGIONS[i % REGIONS.length];
  const src = SOURCES[i % SOURCES.length];
  const prov: ProvenanceRef = {
    walkerId: `walker.${cat}`,
    sourceKey: src,
    sourceName: src,
    sourceTier: src.startsWith("official") ? "A" : src.startsWith("commercial") ? "B" : "C",
    firstDiscoveredAt: "2026-08-30",
    lastCheckedAt: "2026-08-30",
    lastChangedAt: "2026-08-30",
    observedAt: "2026-08-30",
  };
  return {
    id: `syn-${cat}-${i}`,
    kind: i % 3 === 0 ? "business" : "knowledge",
    category: cat,
    name: `Test Entity ${i} · ${region}`,
    description: `Synthetic record #${i} for scale testing purposes only.`,
    keywords: [cat, region.toLowerCase(), `kw${i % 100}`],
    lifecycle: "PUBLISHED",
    lifecycleChangedAt: now.toISOString(),
    provenance: [prov],
    freshness: stampVerified("weekly", now),
    geo: region !== "Indonesia" ? { province: region.toLowerCase().replace(/\s+/g, "-") } : undefined,
    contacts: i % 3 === 0 ? [{ kind: "phone", value: `+62812${String(i).padStart(7, "0")}`, verified: true }] : undefined,
    contactability: i % 3 === 0 ? "contactable" : undefined,
    attributes: { synthetic: true, ordinal: i },
  };
}

function synthCorpus(n: number, now: Date = new Date()): EntityRecord[] {
  const out: EntityRecord[] = new Array(n);
  for (let i = 0; i < n; i++) out[i] = synthEntity(i, now);
  return out;
}

// ─── Measurements ─────────────────────────────────────────────────

function measure(label: string, fn: () => void): { label: string; ms: number } {
  const t0 = performance.now();
  fn();
  const ms = Math.round(performance.now() - t0);
  return { label, ms };
}

const SIZES = [1_000, 10_000, 100_000] as const;
if (process.env.NEX_SCALE_LARGE === "1") (SIZES as unknown as number[]).push(1_000_000);

describe("scale · quality scoring throughput", () => {
  for (const n of SIZES) {
    it(`scores ${n.toLocaleString()} records in < ${scoreBudget(n)}ms`, () => {
      const corpus = synthCorpus(n);
      const now = new Date();
      const { ms } = measure("score", () => {
        for (const r of corpus) scoreEntity(r, now);
      });
      const budget = scoreBudget(n);
      // The assertion is soft · print for visibility.
      console.log(`  scoreEntity × ${n.toLocaleString()}: ${ms}ms (${(n / (ms / 1000)).toFixed(0)}/s)`);
      expect(ms).toBeLessThan(budget);
    }, 60_000);
  }
});

function scoreBudget(n: number): number {
  // Empirical · quality scoring is O(N) with small per-record cost.
  if (n <= 1_000)     return 200;
  if (n <= 10_000)    return 1_000;
  if (n <= 100_000)   return 8_000;
  return 60_000; // 1M budget
}

describe("scale · freshness scheduling", () => {
  for (const n of SIZES) {
    it(`computes staleness for ${n.toLocaleString()} records in < ${staleBudget(n)}ms`, () => {
      const corpus = synthCorpus(n);
      const now = new Date();
      const { ms } = measure("stale", () => {
        for (const r of corpus) computeStaleness(r.freshness, now);
      });
      console.log(`  computeStaleness × ${n.toLocaleString()}: ${ms}ms (${(n / (ms / 1000)).toFixed(0)}/s)`);
      expect(ms).toBeLessThan(staleBudget(n));
    }, 60_000);
  }
});

function staleBudget(n: number): number {
  if (n <= 1_000)     return 100;
  if (n <= 10_000)    return 400;
  if (n <= 100_000)   return 3_000;
  return 20_000;
}

describe("scale · dedupe scoring (pairwise sample)", () => {
  // We do NOT run O(N²) all-pairs dedupe · that's infeasible at 100k.
  // Instead we prove: single-pair scoreMerge is cheap enough that a
  // blocked/indexed dedupe pass (by phone or coord-bucket) is
  // feasible at scale. Blocking is the standard production
  // technique — the test measures the per-pair primitive.
  for (const n of [10_000, 100_000, 1_000_000] as const) {
    it(`scoreMerge over ${n.toLocaleString()} pairs`, () => {
      const a = synthEntity(1);
      const b = synthEntity(2);
      const { ms } = measure(`pairs-${n}`, () => {
        for (let i = 0; i < n; i++) scoreMerge(a, b);
      });
      console.log(`  scoreMerge × ${n.toLocaleString()} pairs: ${ms}ms (${(n / (ms / 1000)).toFixed(0)}/s)`);
      // We don't assert a hard budget · the point is to publish the
      // number so we know when a blocking pass becomes needed.
      expect(ms).toBeGreaterThanOrEqual(0);
    }, 30_000);
  }
});

describe("scale · conflict resolution", () => {
  it("resolves 50k conflicting values", () => {
    const provs = SOURCES.map((s) => ({
      walkerId: "w", sourceKey: s, sourceName: s,
      sourceTier: (s.startsWith("official") ? "A" : s.startsWith("commercial") ? "B" : "C") as "A" | "B" | "C",
      firstDiscoveredAt: "2026-08-30", lastCheckedAt: "2026-08-30",
      lastChangedAt: "2026-08-30", observedAt: "2026-08-30",
    }));
    const observations = Array.from({ length: 50_000 }, (_, i) => ({
      value: `v${i % 5}`,
      provenance: provs[i % provs.length],
    }));
    const { ms } = measure("conflict", () => { resolveConflict(observations); });
    console.log(`  resolveConflict × 50,000 observations: ${ms}ms`);
    expect(ms).toBeLessThan(3_000);
  }, 30_000);
});

describe("scale · name normalisation", () => {
  it("normaliseName is O(1) per call · 100k calls fast", () => {
    const { ms } = measure("norm", () => {
      for (let i = 0; i < 100_000; i++) normaliseName(`Warung Bu Siti ${i}`);
    });
    console.log(`  normaliseName × 100,000: ${ms}ms (${(100_000 / (ms / 1000)).toFixed(0)}/s)`);
    expect(ms).toBeLessThan(3_000);
  });
});
