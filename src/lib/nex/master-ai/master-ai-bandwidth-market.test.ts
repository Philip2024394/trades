// src/lib/nex/master-ai/master-ai-bandwidth-market.test.ts
//
// NEX Master AI · Bandwidth Market · contract tests
// Philip 2026-09-07 · AUTHORIZE

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let tempDir = "";
let origMasterRoot: string | undefined;

beforeEach(() => {
  origMasterRoot = process.env.NEX_MASTER_AI_DATA_ROOT;
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-master-ai-bm-"));
  process.env.NEX_MASTER_AI_DATA_ROOT = path.join(tempDir, "master-ai");
});
afterEach(() => {
  if (origMasterRoot === undefined) delete process.env.NEX_MASTER_AI_DATA_ROOT;
  else process.env.NEX_MASTER_AI_DATA_ROOT = origMasterRoot;
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

describe("Bandwidth market · provider catalogue", () => {
  it("BANDWIDTH_PROVIDERS is frozen and has 10+ entries including Telkom", async () => {
    const { BANDWIDTH_PROVIDERS, findProvider } = await import("./connectivity-bandwidth-market");
    expect(Object.isFrozen(BANDWIDTH_PROVIDERS)).toBe(true);
    expect(BANDWIDTH_PROVIDERS.length).toBeGreaterThanOrEqual(10);
    expect(findProvider("telkom_indonesia")?.legal_name).toContain("Telekomunikasi");
    expect(findProvider("moratelindo")?.legal_name).toContain("Mora Telematika");
  });

  it("CAPACITY_LADDER has exactly 4 tiers 1/10/100/1000 Gbps", async () => {
    const { CAPACITY_LADDER } = await import("./connectivity-bandwidth-market");
    expect(CAPACITY_LADDER.length).toBe(4);
    expect(CAPACITY_LADDER.map((t) => t.mbps)).toEqual([1000, 10_000, 100_000, 1_000_000]);
  });
});

describe("Bandwidth market · price ledger validation", () => {
  it("REJECTS unknown provider", async () => {
    const { recordPrice } = await import("./connectivity-bandwidth-market");
    expect(() => recordPrice({
      provider_slug: "made_up_provider",
      capacity_tier: "TIER_1_GBPS",
      contract_class: "WHOLESALE_IP_TRANSIT",
      rp_per_mbps_per_month_best: 20_000,
      rp_per_mbps_per_month_worst: 50_000,
      source: "ESTIMATE_FROM_ANALOGUE",
      citation: "test", note: "test",
    })).toThrow(/unknown_provider/);
  });

  it("REJECTS QUOTE_ONLY with non-null bounds (must be null)", async () => {
    const { recordPrice } = await import("./connectivity-bandwidth-market");
    expect(() => recordPrice({
      provider_slug: "telkom_indonesia",
      capacity_tier: "TIER_10_GBPS",
      contract_class: "WHOLESALE_IP_TRANSIT",
      rp_per_mbps_per_month_best: 20_000,
      rp_per_mbps_per_month_worst: 50_000,
      source: "QUOTE_ONLY",
      citation: "provider website says quote", note: "test",
    })).toThrow(/quote_only_or_unknown_requires_null_bounds/);
  });

  it("REJECTS best > worst", async () => {
    const { recordPrice } = await import("./connectivity-bandwidth-market");
    expect(() => recordPrice({
      provider_slug: "telkom_indonesia",
      capacity_tier: "TIER_1_GBPS",
      contract_class: "WHOLESALE_IP_TRANSIT",
      rp_per_mbps_per_month_best: 50_000,
      rp_per_mbps_per_month_worst: 20_000,
      source: "ESTIMATE_FROM_ANALOGUE",
      citation: "test", note: "test",
    })).toThrow(/best_greater_than_worst/);
  });

  it("REJECTS only-one-bound (must be range or neither)", async () => {
    const { recordPrice } = await import("./connectivity-bandwidth-market");
    expect(() => recordPrice({
      provider_slug: "telkom_indonesia",
      capacity_tier: "TIER_1_GBPS",
      contract_class: "WHOLESALE_IP_TRANSIT",
      rp_per_mbps_per_month_best: 20_000,
      rp_per_mbps_per_month_worst: null,
      source: "ESTIMATE_FROM_ANALOGUE",
      citation: "test", note: "test",
    })).toThrow(/both_bounds_or_neither/);
  });

  it("ACCEPTS QUOTE_ONLY with null bounds", async () => {
    const { recordPrice, currentPricesFor } = await import("./connectivity-bandwidth-market");
    const p = recordPrice({
      provider_slug: "telkom_indonesia",
      capacity_tier: "TIER_10_GBPS",
      contract_class: "WHOLESALE_IP_TRANSIT",
      rp_per_mbps_per_month_best: null,
      rp_per_mbps_per_month_worst: null,
      source: "QUOTE_ONLY",
      citation: "Telkom IP Transit product page", note: "no public pricing",
    });
    expect(p.price_id).toBeTruthy();
    expect(currentPricesFor("telkom_indonesia", "TIER_10_GBPS").length).toBe(1);
  });

  it("ACCEPTS ESTIMATE_FROM_ANALOGUE with a range", async () => {
    const { recordPrice } = await import("./connectivity-bandwidth-market");
    const p = recordPrice({
      provider_slug: "moratelindo",
      capacity_tier: "TIER_10_GBPS",
      contract_class: "WHOLESALE_IP_TRANSIT",
      rp_per_mbps_per_month_best: 15_000,
      rp_per_mbps_per_month_worst: 35_000,
      source: "ESTIMATE_FROM_ANALOGUE",
      citation: "global bulk IP transit market", note: "10 Gbps tier",
    });
    expect(p.rp_per_mbps_per_month_best).toBe(15_000);
    expect(p.rp_per_mbps_per_month_worst).toBe(35_000);
  });
});

describe("Bandwidth market · per-member cost computer", () => {
  it("computes supported members and per-member cost range", async () => {
    const { computePerMemberCost } = await import("./connectivity-bandwidth-market");
    const r = computePerMemberCost({
      provider_slug: "telkom_indonesia",
      capacity_tier: "TIER_10_GBPS",              // 10,000 Mbps
      rp_per_mbps_per_month_best: 15_000,
      rp_per_mbps_per_month_worst: 35_000,
      avg_bandwidth_per_active_user_mbps: 2,
      concurrent_active_pct: 0.3,
      cache_hit_rate: 0.4,
      fixed_monthly_ops_idr: 5_000_000,
    });
    // effective per-member Mbps = 2 × 0.3 × 0.6 = 0.36
    // supported members = 10000 / 0.36 = 27,777
    expect(r.supported_members_estimate).toBe(27_777);
    // bandwidth cost best = 15k × 10k = 150M · +5M ops = 155M · ÷ 27,777 = ~5,580
    expect(r.per_member_cost_idr_best).toBeGreaterThan(5_000);
    expect(r.per_member_cost_idr_best).toBeLessThan(6_000);
    // worst = 35k × 10k = 350M · +5M ops = 355M · ÷ 27,777 = ~12,780
    expect(r.per_member_cost_idr_worst).toBeGreaterThan(12_000);
    expect(r.per_member_cost_idr_worst).toBeLessThan(14_000);
  });

  it("returns null per-member cost when no pricing input", async () => {
    const { computePerMemberCost } = await import("./connectivity-bandwidth-market");
    const r = computePerMemberCost({
      provider_slug: "telkom_indonesia",
      capacity_tier: "TIER_100_GBPS",
      rp_per_mbps_per_month_best: null,
      rp_per_mbps_per_month_worst: null,
      avg_bandwidth_per_active_user_mbps: 2,
      concurrent_active_pct: 0.3,
      cache_hit_rate: 0.4,
      fixed_monthly_ops_idr: 20_000_000,
    });
    expect(r.per_member_cost_idr_best).toBeNull();
    expect(r.per_member_cost_idr_worst).toBeNull();
    // But supported members estimate can still be computed
    expect(r.supported_members_estimate).toBeGreaterThan(0);
  });

  it("higher cache_hit_rate produces more supported members", async () => {
    const { computePerMemberCost } = await import("./connectivity-bandwidth-market");
    const noCache = computePerMemberCost({
      provider_slug: "telkom_indonesia", capacity_tier: "TIER_10_GBPS",
      rp_per_mbps_per_month_best: null, rp_per_mbps_per_month_worst: null,
      avg_bandwidth_per_active_user_mbps: 2, concurrent_active_pct: 0.3,
      cache_hit_rate: 0, fixed_monthly_ops_idr: 0,
    });
    const cache60 = computePerMemberCost({
      provider_slug: "telkom_indonesia", capacity_tier: "TIER_10_GBPS",
      rp_per_mbps_per_month_best: null, rp_per_mbps_per_month_worst: null,
      avg_bandwidth_per_active_user_mbps: 2, concurrent_active_pct: 0.3,
      cache_hit_rate: 0.6, fixed_monthly_ops_idr: 0,
    });
    expect(cache60.supported_members_estimate).toBeGreaterThan(noCache.supported_members_estimate);
  });
});
