// src/lib/nex/master-ai/master-ai-yes-hunt.test.ts
//
// NEX Master AI · YES-Hunt Mission · Y-W4-11..14
// Contract tests · Philip 2026-09-07 · AUTHORIZE
//
// Covers:
//   · CANDIDATE_ARCHITECTURES frozen · 8 entries (A-H)
//   · Reservoir sweet-spot returns 9 points and an optimum
//   · Legal matrix has all 12 capability rows for a given jurisdiction
//   · Self-criticism REJECTS records missing any of 15 answers
//   · YES construction never returns UNKNOWN when the ledger has viable
//     partnership evidence AND the architecture depends only on things
//     that are ALLOWED_NOW / REQUIRES_PARTNERSHIP / UNKNOWN with named
//     evidence gaps (§12 anti-lazy-UNKNOWN)

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let tempDir = "";
let origMasterRoot: string | undefined;

beforeEach(() => {
  origMasterRoot = process.env.NEX_MASTER_AI_DATA_ROOT;
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-master-ai-yh-"));
  process.env.NEX_MASTER_AI_DATA_ROOT = path.join(tempDir, "master-ai");
});
afterEach(() => {
  if (origMasterRoot === undefined) delete process.env.NEX_MASTER_AI_DATA_ROOT;
  else process.env.NEX_MASTER_AI_DATA_ROOT = origMasterRoot;
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

describe("YES-Hunt · candidate architectures (§5)", () => {
  it("CANDIDATE_ARCHITECTURES is frozen and has 8 entries A-H", async () => {
    const { CANDIDATE_ARCHITECTURES, findCandidateArchitecture } = await import("./connectivity-yes-hunt");
    expect(Object.isFrozen(CANDIDATE_ARCHITECTURES)).toBe(true);
    expect(CANDIDATE_ARCHITECTURES.length).toBe(8);
    for (const c of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
      expect(findCandidateArchitecture(c)).not.toBeNull();
    }
  });
});

describe("YES-Hunt · reservoir sweet-spot (§6 · §W4-14)", () => {
  it("returns 9 points (0.0..0.8 by 0.1) with finite optimum", async () => {
    const { findReservoirSweetSpot } = await import("./connectivity-yes-hunt");
    const r = findReservoirSweetSpot({
      users: 10_000,
      monthly_fixed_cost_idr: 30_000_000,
      monthly_full_upstream_cost_idr: 100_000_000,
      reservoir_base_cost_idr: 3_000_000,
      reservoir_scale_coeff_idr: 30_000_000,
      provisioned_upstream_mbps: 4000,
      avg_bandwidth_per_active_user_mbps: 2,
      concurrent_active_pct: 0.3,
    });
    expect(r.points.length).toBe(9);
    expect(r.optimum_cache_hit_rate).toBeGreaterThanOrEqual(0);
    expect(r.optimum_cache_hit_rate).toBeLessThanOrEqual(0.8);
    expect(r.optimum_total_cost_idr).toBeGreaterThan(0);
    // The optimum should be the minimum total_cost across all 9 points
    const minCost = Math.min(...r.points.map((p) => p.monthly_total_cost_idr));
    expect(r.optimum_total_cost_idr).toBe(minCost);
  });

  it("higher scale_coeff shifts optimum toward lower cache rates", async () => {
    const { findReservoirSweetSpot } = await import("./connectivity-yes-hunt");
    const cheap = findReservoirSweetSpot({
      users: 10_000, monthly_fixed_cost_idr: 30_000_000,
      monthly_full_upstream_cost_idr: 100_000_000,
      reservoir_base_cost_idr: 3_000_000, reservoir_scale_coeff_idr: 10_000_000,
      provisioned_upstream_mbps: 4000, avg_bandwidth_per_active_user_mbps: 2, concurrent_active_pct: 0.3,
    });
    const expensive = findReservoirSweetSpot({
      users: 10_000, monthly_fixed_cost_idr: 30_000_000,
      monthly_full_upstream_cost_idr: 100_000_000,
      reservoir_base_cost_idr: 3_000_000, reservoir_scale_coeff_idr: 500_000_000,
      provisioned_upstream_mbps: 4000, avg_bandwidth_per_active_user_mbps: 2, concurrent_active_pct: 0.3,
    });
    expect(expensive.optimum_cache_hit_rate).toBeLessThanOrEqual(cheap.optimum_cache_hit_rate);
  });
});

describe("YES-Hunt · legal decision matrix (§11)", () => {
  it("has all 12 capability rows even for empty ledger", async () => {
    const { composeLegalMatrix, LEGAL_MATRIX_CAPABILITIES } = await import("./connectivity-yes-hunt");
    const m = composeLegalMatrix([], "ID");
    expect(m.length).toBe(12);
    expect(m.every((c) => c.category === "UNKNOWN")).toBe(true);
    expect(m.every((c) => c.confidence === "NONE")).toBe(true);
    expect(m.map((c) => c.capability)).toEqual([...LEGAL_MATRIX_CAPABILITIES]);
  });

  it("categorises based on evidence · REQUIRES_LICENSE finding wins for that capability", async () => {
    const { composeLegalMatrix } = await import("./connectivity-yes-hunt");
    const findings = [
      mkFinding({ jurisdiction: "ID", statement: "Indonesian ISPs require a telecommunications licence · wholesale market exists", category: "REQUIRES_LICENSE" }),
    ];
    const m = composeLegalMatrix(findings as any, "ID");
    const cell = m.find((c) => c.capability === "isp_partnership")!;
    expect(cell.category).toBe("REQUIRES_LICENSE");
    expect(cell.evidence_count).toBe(1);
  });
});

describe("YES-Hunt · self-criticism (§13)", () => {
  it("REJECTS records missing any of the 15 answers", async () => {
    const { recordSelfCriticism } = await import("./connectivity-yes-hunt");
    const full = mkChecklist();
    for (const k of Object.keys(full)) {
      const bad = { ...full, [k]: "" };
      expect(() => recordSelfCriticism({ mission_slug: "test", checklist: bad as any }))
        .toThrow(new RegExp(`incomplete_self_criticism:${k}`));
    }
  });
  it("ACCEPTS records with all 15 answers", async () => {
    const { recordSelfCriticism, readAllSelfCriticism } = await import("./connectivity-yes-hunt");
    const rec = recordSelfCriticism({ mission_slug: "test", checklist: mkChecklist() });
    expect(rec.checklist.q15_single_fact_that_invalidates_yes_case.length).toBeGreaterThan(3);
    expect(readAllSelfCriticism().length).toBe(1);
  });
});

describe("YES-Hunt · YES construction (§12 anti-lazy-UNKNOWN)", () => {
  it("returns YES_SUBJECT_TO (never UNKNOWN) when a partnership path exists · listing prerequisites", async () => {
    const { composeLegalMatrix, findReservoirSweetSpot, findCandidateArchitecture, constructYesCase, recordSelfCriticism } = await import("./connectivity-yes-hunt");
    // Seed a matrix where isp_partnership = REQUIRES_LICENSE (finite blocker)
    const matrix = composeLegalMatrix([
      mkFinding({ jurisdiction: "ID", category: "REQUIRES_LICENSE", statement: "Indonesian ISPs require a telecommunications licence" }),
    ] as any, "ID");
    const sweetSpot = findReservoirSweetSpot({
      users: 10_000, monthly_fixed_cost_idr: 30_000_000, monthly_full_upstream_cost_idr: 100_000_000,
      reservoir_base_cost_idr: 3_000_000, reservoir_scale_coeff_idr: 30_000_000,
      provisioned_upstream_mbps: 4000, avg_bandwidth_per_active_user_mbps: 2, concurrent_active_pct: 0.3,
    });
    const selfCrit = recordSelfCriticism({ mission_slug: "test", checklist: mkChecklist() });
    const verdict = constructYesCase({
      legal_matrix: matrix,
      sweet_spot: sweetSpot,
      chosen_architecture: findCandidateArchitecture("H")!,
      self_criticism: selfCrit,
    });
    expect(verdict.verdict).toBe("YES_SUBJECT_TO");
    expect(verdict.yes_prerequisites.length).toBeGreaterThan(0);
    expect(verdict.what_nex_cannot_do.length).toBeGreaterThan(0);   // must always warn about third-party
  });

  it("what_nex_cannot_do always includes third-party 'free' prohibition and DRM/ToS warning", async () => {
    const { composeLegalMatrix, findReservoirSweetSpot, findCandidateArchitecture, constructYesCase, recordSelfCriticism } = await import("./connectivity-yes-hunt");
    const matrix = composeLegalMatrix([] as any, "ID");
    const sweetSpot = findReservoirSweetSpot({
      users: 100, monthly_fixed_cost_idr: 5_000_000, monthly_full_upstream_cost_idr: 5_000_000,
      reservoir_base_cost_idr: 1_000_000, reservoir_scale_coeff_idr: 5_000_000,
      provisioned_upstream_mbps: 100, avg_bandwidth_per_active_user_mbps: 2, concurrent_active_pct: 0.3,
    });
    const selfCrit = recordSelfCriticism({ mission_slug: "test", checklist: mkChecklist() });
    const verdict = constructYesCase({
      legal_matrix: matrix, sweet_spot: sweetSpot,
      chosen_architecture: findCandidateArchitecture("A")!,
      self_criticism: selfCrit,
    });
    const notAllowed = verdict.what_nex_cannot_do.join(" · ").toLowerCase();
    expect(notAllowed).toContain("third-party");
    expect(notAllowed).toMatch(/drm|robots|rate limits|tos|paid access/);
  });
});

function mkFinding(o: Partial<any> = {}) {
  return {
    finding_id: "test-" + Math.random().toString(36).slice(2, 10),
    created_at_iso: new Date().toISOString(),
    jurisdiction: "ID",
    topic: "OTHER",
    band_slug: null, architecture_slug: null, business_model_slug: null,
    category: "UNKNOWN",
    authority_tier: "TIER_3",
    statement: "test statement",
    citation: "test",
    evidence_ref: null,
    uncertainty_note: "test",
    supersedes: null,
    created_by: "test",
    who_pays: "UNKNOWN",
    ...o,
  };
}
function mkChecklist() {
  return {
    q1_confused_free_spectrum_with_free_internet: "no · always kept separate",
    q2_confused_zero_user_price_with_zero_system_cost: "no · explicit user_direct vs system_cost fields",
    q3_relied_on_secondary_when_primary_existed: "partially · Wikipedia only · primary sources deferred to future auth",
    q4_assumed_indonesian_rule_could_not_verify: "yes · flagged as UNKNOWN in matrix",
    q5_assumed_third_party_content_can_be_cached: "no · explicitly prohibited in cannotDo",
    q6_assumed_device_ownership_creates_content_rights: "no · content rights are independent of hardware ownership",
    q7_underestimated_upstream_bandwidth: "unknown · assumed 2 Mbps/user avg · document as ASSUMPTION",
    q8_overestimated_cache_savings: "possible · 40% assumed · sweet-spot analysis added to test sensitivity",
    q9_ignored_redundancy: "yes · not modelled · flagged",
    q10_ignored_security: "partially · noted as future work",
    q11_ignored_certification: "no · SDPPI listed as prereq",
    q12_ignored_licensing: "no · ISP licensing modelled",
    q13_ignored_operational_labour: "partially · ops cost included as flat monthly line",
    q14_ignored_growth: "no · 100 to 100000 user ladder covers growth",
    q15_single_fact_that_invalidates_yes_case: "SDPPI equipment certification denial for AP hardware would prevent lawful operation of the local Wi-Fi layer",
  };
}
