// src/lib/nex/master-ai/master-ai-provider-comparison.test.ts
//
// NEX Master AI · Wholesale/Satellite Provider Comparison · contract tests
// Philip 2026-09-07 · AUTHORIZE

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let tempDir = "";
let origMasterRoot: string | undefined;

beforeEach(() => {
  origMasterRoot = process.env.NEX_MASTER_AI_DATA_ROOT;
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-master-ai-pc-"));
  process.env.NEX_MASTER_AI_DATA_ROOT = path.join(tempDir, "master-ai");
});
afterEach(() => {
  if (origMasterRoot === undefined) delete process.env.NEX_MASTER_AI_DATA_ROOT;
  else process.env.NEX_MASTER_AI_DATA_ROOT = origMasterRoot;
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

describe("Provider comparison · route catalogue", () => {
  it("WHOLESALE_ROUTES is frozen and has exactly 4 entries", async () => {
    const { WHOLESALE_ROUTES } = await import("./connectivity-provider-comparison");
    expect(Object.isFrozen(WHOLESALE_ROUTES)).toBe(true);
    expect(WHOLESALE_ROUTES.length).toBe(4);
    const codes = WHOLESALE_ROUTES.map((r) => r.route_code);
    expect(codes).toEqual(["R1_FIBRE_ISP", "R2_MOBILE_MVNO", "R3_STARLINK_DTC", "R4_AST_SPACEMOBILE"]);
  });

  it("findRoute returns the correct route or null", async () => {
    const { findRoute } = await import("./connectivity-provider-comparison");
    expect(findRoute("R1_FIBRE_ISP")?.name).toContain("Fibre / ISP");
    expect(findRoute("R4_AST_SPACEMOBILE")?.name).toContain("AST SpaceMobile");
    expect(findRoute("R99_MADE_UP" as any)).toBeNull();
  });
});

describe("Provider comparison · membership feasibility gate", () => {
  it("returns UNKNOWN when per_user_wholesale_cost is null", async () => {
    const { evaluateRoute } = await import("./connectivity-provider-comparison");
    const r = evaluateRoute({
      route_code: "R3_STARLINK_DTC", users: 10_000,
      membership_price_idr_month: 25_000,
      per_user_wholesale_cost_idr_month: null,
      fixed_monthly_operational_cost_idr: 5_000_000,
      cache_hit_rate: 0, cost_source_label: "UNKNOWN",
      note: "no pricing yet",
    });
    expect(r.membership_fit).toBe("UNKNOWN");
    expect(r.per_user_effective_cost_idr_month).toBeNull();
    expect(r.headroom_idr_per_user_per_month).toBeNull();
  });

  it("FITS_IN_MEMBERSHIP when effective cost is ≤ 50% of membership price", async () => {
    const { evaluateRoute } = await import("./connectivity-provider-comparison");
    const r = evaluateRoute({
      route_code: "R1_FIBRE_ISP", users: 10_000,
      membership_price_idr_month: 25_000,
      per_user_wholesale_cost_idr_month: 10_000,
      fixed_monthly_operational_cost_idr: 0,
      cache_hit_rate: 0.5,     // R1 gets cache credit · effective = 5000
      cost_source_label: "PUBLIC_LIST_PRICE",
      note: "test",
    });
    expect(r.membership_fit).toBe("FITS_IN_MEMBERSHIP");
    expect(r.per_user_effective_cost_idr_month).toBe(5000);
    expect(r.headroom_idr_per_user_per_month).toBe(20_000);
  });

  it("TIGHT when 50-100% of membership", async () => {
    const { evaluateRoute } = await import("./connectivity-provider-comparison");
    const r = evaluateRoute({
      route_code: "R2_MOBILE_MVNO", users: 10_000,
      membership_price_idr_month: 25_000,
      per_user_wholesale_cost_idr_month: 20_000,
      fixed_monthly_operational_cost_idr: 0,
      cache_hit_rate: 0.5,     // R2 does not get cache credit
      cost_source_label: "ASSUMPTION",
      note: "test",
    });
    expect(r.per_user_effective_cost_idr_month).toBe(20_000);
    expect(r.membership_fit).toBe("TIGHT");
  });

  it("DOES_NOT_FIT when effective cost > membership price", async () => {
    const { evaluateRoute } = await import("./connectivity-provider-comparison");
    const r = evaluateRoute({
      route_code: "R3_STARLINK_DTC", users: 10_000,
      membership_price_idr_month: 25_000,
      per_user_wholesale_cost_idr_month: 100_000,
      fixed_monthly_operational_cost_idr: 0,
      cache_hit_rate: 0, cost_source_label: "ASSUMPTION",
      note: "test",
    });
    expect(r.membership_fit).toBe("DOES_NOT_FIT");
    expect(r.headroom_idr_per_user_per_month).toBeLessThan(0);
  });

  it("cache_hit_rate only applies to R1_FIBRE_ISP", async () => {
    const { evaluateRoute } = await import("./connectivity-provider-comparison");
    const r1 = evaluateRoute({
      route_code: "R1_FIBRE_ISP", users: 10_000,
      membership_price_idr_month: 25_000,
      per_user_wholesale_cost_idr_month: 10_000,
      fixed_monthly_operational_cost_idr: 0,
      cache_hit_rate: 0.4, cost_source_label: "ASSUMPTION", note: "cache test",
    });
    const r2 = evaluateRoute({
      route_code: "R2_MOBILE_MVNO", users: 10_000,
      membership_price_idr_month: 25_000,
      per_user_wholesale_cost_idr_month: 10_000,
      fixed_monthly_operational_cost_idr: 0,
      cache_hit_rate: 0.4, cost_source_label: "ASSUMPTION", note: "cache test",
    });
    expect(r1.per_user_effective_cost_idr_month).toBe(6000);        // 10000 × (1 - 0.4)
    expect(r2.per_user_effective_cost_idr_month).toBe(10_000);      // cache doesn't help mobile wholesale
  });
});

describe("Provider comparison · cost assumption ledger", () => {
  it("records cost assumption with all traceable fields", async () => {
    const { recordCostAssumption, readAllCostAssumptions } = await import("./connectivity-provider-comparison");
    const a = recordCostAssumption({
      route_code: "R1_FIBRE_ISP",
      attribute: "wholesale_ip_transit_rp_per_mbps_per_month",
      value: 25000, unit: "IDR/Mbps/month",
      source: "ESTIMATE_FROM_ANALOGUE",
      citation: "estimate from ballpark global transit pricing",
      note: "placeholder pending primary Telkom IP Transit quote",
    });
    expect(a.assumption_id).toBeTruthy();
    expect(readAllCostAssumptions().length).toBe(1);
  });
});

describe("Provider comparison · cross-route summary", () => {
  it("summariseRoutes returns 4 entries with best_fit derived from ledger", async () => {
    const { evaluateRoute, summariseRoutes } = await import("./connectivity-provider-comparison");
    // Record some evaluations
    evaluateRoute({ route_code: "R1_FIBRE_ISP", users: 10_000, membership_price_idr_month: 25_000, per_user_wholesale_cost_idr_month: 8_000, fixed_monthly_operational_cost_idr: 0, cache_hit_rate: 0.5, cost_source_label: "ASSUMPTION", note: "R1 test" });
    evaluateRoute({ route_code: "R3_STARLINK_DTC", users: 10_000, membership_price_idr_month: 25_000, per_user_wholesale_cost_idr_month: 500_000, fixed_monthly_operational_cost_idr: 0, cache_hit_rate: 0, cost_source_label: "ASSUMPTION", note: "R3 test" });
    const summary = await summariseRoutes();
    expect(summary.length).toBe(4);
    const r1 = summary.find((s) => s.route_code === "R1_FIBRE_ISP")!;
    const r3 = summary.find((s) => s.route_code === "R3_STARLINK_DTC")!;
    expect(r1.best_fit_at_any_scale).toBe("FITS_IN_MEMBERSHIP");
    expect(r3.best_fit_at_any_scale).toBe("DOES_NOT_FIT");
    // Routes with no evaluations remain UNKNOWN
    const r2 = summary.find((s) => s.route_code === "R2_MOBILE_MVNO")!;
    expect(r2.best_fit_at_any_scale).toBe("UNKNOWN");
  });
});
