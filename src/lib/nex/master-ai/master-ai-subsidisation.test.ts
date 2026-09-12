// src/lib/nex/master-ai/master-ai-subsidisation.test.ts
//
// NEX Master AI · Deep Feasibility Mission · contract tests
// Philip 2026-09-07 · AUTHORIZE
//
// Covers:
//   · 10-question ArchitectureAssessment schema: every answer mandatory
//   · UNKNOWN is a legal answer · never rejected
//   · Marginal cost math: adding a user costs the variable share only
//   · User direct cost = per-user × (1 - subsidy_pct)
//   · Economics simulator surfaces user_direct_cost_month_idr and
//     marginal_cost_per_user_idr fields · backward-compatible

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let tempDir = "";
let origMasterRoot: string | undefined;

beforeEach(() => {
  origMasterRoot = process.env.NEX_MASTER_AI_DATA_ROOT;
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-master-ai-sub-"));
  process.env.NEX_MASTER_AI_DATA_ROOT = path.join(tempDir, "master-ai");
});

afterEach(() => {
  if (origMasterRoot === undefined) delete process.env.NEX_MASTER_AI_DATA_ROOT;
  else process.env.NEX_MASTER_AI_DATA_ROOT = origMasterRoot;
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

// ═══════════════════════════════════════════════════════════════════
// 10-question assessment schema
// ═══════════════════════════════════════════════════════════════════

describe("ArchitectureAssessment · 10 mandatory questions (§5)", () => {
  it("REJECTS assessment missing any of the 10 answers", async () => {
    const { recordArchitectureAssessment } = await import("./connectivity-subsidisation");
    const answers: Record<string, any> = mkAnswers();
    for (const key of Object.keys(answers)) {
      const bad = { ...answers, [key]: "" };
      expect(() => recordArchitectureAssessment({
        architecture_slug: "single_hub_wifi",
        business_model_slug: "partnership_with_licensed_isp",
        jurisdiction: "ID",
        ten_answers: bad as any,
        overall_category: "UNKNOWN",
        overall_verdict: "UNKNOWN",
        evidence_ref_ids: [],
        economics_simulation_ref: null,
        supersedes: null,
        created_by: "test",
      })).toThrow(new RegExp(`ten_answer_missing:${key}`));
    }
  });

  it("ACCEPTS UNKNOWN as a valid answer for every question", async () => {
    const { recordArchitectureAssessment, currentAssessments } = await import("./connectivity-subsidisation");
    const rec = recordArchitectureAssessment({
      architecture_slug: "single_hub_wifi",
      business_model_slug: null,
      jurisdiction: "ID",
      ten_answers: {
        who_pays: "UNKNOWN",
        who_owns_network: "UNKNOWN",
        who_provides_upstream: "UNKNOWN",
        spectrum_used: "UNKNOWN",
        license_required: "UNKNOWN",
        equipment_certification_required: "UNKNOWN",
        can_nex_operate_in_indonesia: "UNKNOWN",
        can_nex_subsidise_user_to_zero: "UNKNOWN",
        cost_at_scale_reference: "UNKNOWN",
        cheapest_lawful_notes: "UNKNOWN",
      },
      overall_category: "UNKNOWN",
      overall_verdict: "UNKNOWN",
      evidence_ref_ids: [],
      economics_simulation_ref: null,
      supersedes: null,
      created_by: "test",
    });
    expect(rec.overall_verdict).toBe("UNKNOWN");
    expect(currentAssessments({ jurisdiction: "ID" }).length).toBe(1);
  });

  it("supersedes chain returns only the current assessment", async () => {
    const { recordArchitectureAssessment, currentAssessments } = await import("./connectivity-subsidisation");
    const a = recordArchitectureAssessment(mkAssessment({ overall_verdict: "PROMISING" }));
    const b = recordArchitectureAssessment(mkAssessment({ overall_verdict: "CONSTRAINED", supersedes: a.assessment_id }));
    const current = currentAssessments({ jurisdiction: "ID" });
    expect(current.length).toBe(1);
    expect(current[0].assessment_id).toBe(b.assessment_id);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Marginal cost math
// ═══════════════════════════════════════════════════════════════════

describe("Marginal cost per user · pure arithmetic", () => {
  it("returns zero across the board when users = 0", async () => {
    const { computeMarginalCostPerUser } = await import("./connectivity-subsidisation");
    const r = computeMarginalCostPerUser({
      monthly_fixed_cost_idr: 1_000_000,
      monthly_upstream_cost_idr: 500_000,
      provisioned_upstream_mbps: 100,
      avg_bandwidth_per_active_user_mbps: 2,
      concurrent_active_pct: 0.3,
      cache_hit_rate: 0.2,
      users: 0,
    });
    expect(r.average_cost_per_user_idr).toBe(0);
    expect(r.marginal_cost_per_next_user_idr).toBe(0);
  });

  it("marginal ≤ average · fixed cost amortises but marginal is variable-only", async () => {
    const { computeMarginalCostPerUser } = await import("./connectivity-subsidisation");
    const r = computeMarginalCostPerUser({
      monthly_fixed_cost_idr: 5_000_000,
      monthly_upstream_cost_idr: 2_000_000,
      provisioned_upstream_mbps: 200,
      avg_bandwidth_per_active_user_mbps: 2,
      concurrent_active_pct: 0.3,
      cache_hit_rate: 0.2,
      users: 100,
    });
    expect(r.marginal_cost_per_next_user_idr).toBeLessThanOrEqual(r.average_cost_per_user_idr);
    expect(r.fixed_cost_amortisation_per_user_idr).toBe(50_000);      // 5M / 100
  });

  it("caching reduces marginal cost proportionally", async () => {
    const { computeMarginalCostPerUser } = await import("./connectivity-subsidisation");
    const noCache = computeMarginalCostPerUser({
      monthly_fixed_cost_idr: 0, monthly_upstream_cost_idr: 1_000_000,
      provisioned_upstream_mbps: 200,
      avg_bandwidth_per_active_user_mbps: 2, concurrent_active_pct: 0.5,
      cache_hit_rate: 0, users: 1000,
    });
    const halfCache = computeMarginalCostPerUser({
      monthly_fixed_cost_idr: 0, monthly_upstream_cost_idr: 1_000_000,
      provisioned_upstream_mbps: 200,
      avg_bandwidth_per_active_user_mbps: 2, concurrent_active_pct: 0.5,
      cache_hit_rate: 0.5, users: 1000,
    });
    expect(halfCache.marginal_cost_per_next_user_idr).toBeLessThan(noCache.marginal_cost_per_next_user_idr);
    // Half-cache should be roughly half of no-cache marginal
    expect(halfCache.marginal_cost_per_next_user_idr).toBeCloseTo(noCache.marginal_cost_per_next_user_idr * 0.5, -2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// User direct cost at NEX subsidy
// ═══════════════════════════════════════════════════════════════════

describe("User direct cost at NEX subsidy", () => {
  it("100% subsidy → user pays 0", async () => {
    const { computeUserDirectCostAtSubsidy } = await import("./connectivity-subsidisation");
    expect(computeUserDirectCostAtSubsidy({ monthly_total_cost_idr: 5_000_000, users: 500, nex_subsidy_pct: 1 })).toBe(0);
  });

  it("0% subsidy → user pays full per-user share", async () => {
    const { computeUserDirectCostAtSubsidy } = await import("./connectivity-subsidisation");
    expect(computeUserDirectCostAtSubsidy({ monthly_total_cost_idr: 5_000_000, users: 500, nex_subsidy_pct: 0 })).toBe(10_000);
  });

  it("clamps subsidy_pct to [0,1]", async () => {
    const { computeUserDirectCostAtSubsidy } = await import("./connectivity-subsidisation");
    expect(computeUserDirectCostAtSubsidy({ monthly_total_cost_idr: 1_000_000, users: 100, nex_subsidy_pct: 1.5 })).toBe(0);
    expect(computeUserDirectCostAtSubsidy({ monthly_total_cost_idr: 1_000_000, users: 100, nex_subsidy_pct: -0.5 })).toBe(10_000);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Economics simulator emits new subsidy fields
// ═══════════════════════════════════════════════════════════════════

describe("Economics simulator · Deep-Feasibility extension", () => {
  it("populates nex_subsidy_pct_applied · defaults to 0 when input absent", async () => {
    const { runEconomicsScenario } = await import("./connectivity-economics");
    const r = runEconomicsScenario(mkEconomicsTemplate());
    expect(r.nex_subsidy_pct_applied).toBe(0);
    expect(r.user_direct_cost_month_idr).toBe(r.cost_per_user_month_idr);
    expect(r.marginal_cost_per_user_idr).toBeGreaterThanOrEqual(0);
  });

  it("with nex_subsidy_pct=1.0 · user_direct_cost_month_idr=0", async () => {
    const { runEconomicsScenario } = await import("./connectivity-economics");
    const t = mkEconomicsTemplate();
    const r = runEconomicsScenario({
      ...t, nex_subsidy_pct: { value: 1.0, source: "ASSUMPTION", note: "full nex subsidy" } as any,
    });
    expect(r.nex_subsidy_pct_applied).toBe(1);
    expect(r.user_direct_cost_month_idr).toBe(0);
  });
});

// ─── helpers ────────────────────────────────────────────────────────

function mkAnswers() {
  return {
    who_pays: "SELF_PAY" as any,
    who_owns_network: "NEX",
    who_provides_upstream: "licensed Indonesian ISP",
    spectrum_used: "2.4 GHz Wi-Fi class-licence subject to verification",
    license_required: "UNKNOWN" as const,
    equipment_certification_required: "UNKNOWN" as const,
    can_nex_operate_in_indonesia: "UNKNOWN" as const,
    can_nex_subsidise_user_to_zero: "PARTIALLY" as const,
    cost_at_scale_reference: "sim_ref_placeholder",
    cheapest_lawful_notes: "requires primary regulator evidence to confirm",
  };
}
function mkAssessment(overrides: Partial<any> = {}) {
  return {
    architecture_slug: "single_hub_wifi",
    business_model_slug: null,
    jurisdiction: "ID",
    ten_answers: mkAnswers(),
    overall_category: "UNKNOWN" as any,
    overall_verdict: "UNKNOWN" as any,
    evidence_ref_ids: [],
    economics_simulation_ref: null,
    supersedes: null,
    created_by: "test",
    ...overrides,
  };
}
function mkEconomicsTemplate() {
  return {
    scenario_slug: "sub-test",
    jurisdiction: "ID",
    users_count: 500,
    spectrum_band_slug: "5ghz_unii",
    architecture_slug: "single_hub_wifi",
    business_model_slug: "partnership_with_licensed_isp",
    hardware_capex_idr: { value: 20_000_000, source: "ASSUMPTION" as const, note: "" },
    hardware_amortization_months: { value: 36, source: "ASSUMPTION" as const, note: "" },
    upstream_mbps: { value: 200, source: "ASSUMPTION" as const, note: "" },
    upstream_cost_per_mbps_month_idr: { value: 25_000, source: "ASSUMPTION" as const, note: "" },
    avg_bandwidth_per_active_user_mbps: { value: 2, source: "ASSUMPTION" as const, note: "" },
    concurrent_active_pct: { value: 0.3, source: "ASSUMPTION" as const, note: "" },
    cache_hit_rate: { value: 0.15, source: "ASSUMPTION" as const, note: "" },
    video_pct: { value: 0.5, source: "ASSUMPTION" as const, note: "" },
    overhead_pct: { value: 0.1, source: "ASSUMPTION" as const, note: "" },
    monthly_ops_cost_idr: { value: 2_000_000, source: "ASSUMPTION" as const, note: "" },
    baseline_user_monthly_cost_idr: { value: 100_000, source: "CITED" as const, note: "" },
    performed_by: "test",
  };
}
