// src/lib/nex/master-ai/master-ai-wave4.test.ts
//
// NEX Master AI Engineer · Wave 4 contract tests
// Philip 2026-09-07 · AUTHORIZE (Wave-4 continuous mission)
//
// Covers:
//   W4-A · Live Wikipedia adapter (uses injected stub fetch)
//   W4-B · NEX Connectivity Intelligence domain + regulation ledger
//   W4-C · Programmer delegation
//   W4-D · First real learning cycle
//   W4-E · Connectivity economics simulator determinism

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let tempDir = "";
let origMasterRoot: string | undefined;
let origRuntimeRoot: string | undefined;

beforeEach(() => {
  origMasterRoot = process.env.NEX_MASTER_AI_DATA_ROOT;
  origRuntimeRoot = process.env.NEX_AGENT_RUNTIME_DATA_ROOT;
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-master-ai-w4-"));
  process.env.NEX_MASTER_AI_DATA_ROOT = path.join(tempDir, "master-ai");
  process.env.NEX_AGENT_RUNTIME_DATA_ROOT = path.join(tempDir, "agent-runtime");
  fs.mkdirSync(process.env.NEX_AGENT_RUNTIME_DATA_ROOT, { recursive: true });
});

afterEach(() => {
  if (origMasterRoot === undefined) delete process.env.NEX_MASTER_AI_DATA_ROOT;
  else process.env.NEX_MASTER_AI_DATA_ROOT = origMasterRoot;
  if (origRuntimeRoot === undefined) delete process.env.NEX_AGENT_RUNTIME_DATA_ROOT;
  else process.env.NEX_AGENT_RUNTIME_DATA_ROOT = origRuntimeRoot;
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

// ═══════════════════════════════════════════════════════════════════
// W4-A · Wikipedia adapter through the enforced gateway
// ═══════════════════════════════════════════════════════════════════

describe("W4-A · Wikipedia adapter (§7 §8)", () => {
  it("extractTitleFromQuery: quoted phrase wins", async () => {
    const { extractTitleFromQuery } = await import("./live-adapter-wikipedia");
    expect(extractTitleFromQuery('What is "Point-to-multipoint wireless"?')).toBe("Point-to-multipoint wireless");
    expect(extractTitleFromQuery("Point-to-multipoint")).toBe("Point-to-multipoint");
  });

  it("registerWikipediaLiveSource is idempotent and creates policy + adapter", async () => {
    const { registerWikipediaLiveSource, WIKIPEDIA_SOURCE_SLUG } = await import("./live-adapter-wikipedia");
    const { getSource, getAdapter } = await import("./research-engine");
    const { currentPolicy } = await import("./cost-intelligence");
    const r1 = registerWikipediaLiveSource({ registered_by: "test" });
    expect(r1.already_present).toBe(false);
    expect(getSource(WIKIPEDIA_SOURCE_SLUG)).not.toBeNull();
    expect(getAdapter(WIKIPEDIA_SOURCE_SLUG)).not.toBeNull();
    expect(currentPolicy(WIKIPEDIA_SOURCE_SLUG, "REQUEST")).not.toBeNull();
    const r2 = registerWikipediaLiveSource({ registered_by: "test" });
    expect(r2.already_present).toBe(true);                        // idempotent
  });

  it("OK · gateway routes through injected stub fetch and records finding", async () => {
    const { registerWikipediaLiveSource, WIKIPEDIA_SOURCE_SLUG, createWikipediaAdapter } = await import("./live-adapter-wikipedia");
    const { enqueueResearchQuery, readAllFindings } = await import("./research-engine");
    const { performResearch } = await import("./research-gateway");
    const stub: typeof fetch = async () => new Response(
      JSON.stringify({ title: "Wi-Fi", extract: "Wi-Fi is a family of wireless network protocols..." }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
    registerWikipediaLiveSource({
      registered_by: "test",
      adapter: createWikipediaAdapter({ fetch_impl: stub }),
    });
    const q = enqueueResearchQuery({
      question: "Wi-Fi",
      target_source_slugs: [WIKIPEDIA_SOURCE_SLUG],
      priority: 5, created_by: "test",
    });
    const r = await performResearch({ query: q, invoker: "test" });
    expect(r.status).toBe("OK");
    const findings = readAllFindings();
    expect(findings.length).toBe(1);
    expect(findings[0].license).toBe("CC-BY-SA-3.0");
  });

  it("BLOCKED · 429 rate limit surfaces through gateway", async () => {
    const { registerWikipediaLiveSource, WIKIPEDIA_SOURCE_SLUG, createWikipediaAdapter } = await import("./live-adapter-wikipedia");
    const { enqueueResearchQuery } = await import("./research-engine");
    const { performResearch } = await import("./research-gateway");
    const stub: typeof fetch = async () => new Response("rate limited", { status: 429 });
    registerWikipediaLiveSource({ registered_by: "test", adapter: createWikipediaAdapter({ fetch_impl: stub }) });
    const q = enqueueResearchQuery({ question: "Wi-Fi", target_source_slugs: [WIKIPEDIA_SOURCE_SLUG], priority: 5, created_by: "test" });
    const r = await performResearch({ query: q, invoker: "test" });
    expect(r.status).toBe("BLOCKED");
  });
});

// ═══════════════════════════════════════════════════════════════════
// W4-B · Connectivity Intelligence domain + regulation ledger
// ═══════════════════════════════════════════════════════════════════

describe("W4-B · NEX Connectivity Intelligence (§B mission)", () => {
  it("SPECTRUM_CATALOGUE is frozen and includes 60 GHz and 2.4 GHz", async () => {
    const { SPECTRUM_CATALOGUE } = await import("./connectivity-domain");
    expect(Object.isFrozen(SPECTRUM_CATALOGUE)).toBe(true);
    const slugs = SPECTRUM_CATALOGUE.map((b) => b.band_slug);
    expect(slugs).toContain("2_4ghz_isb");
    expect(slugs).toContain("60ghz_mmw");
  });

  it("recordConnectivityFinding REJECTS UNKNOWN without uncertainty_note", async () => {
    const { recordConnectivityFinding } = await import("./connectivity-regulation");
    expect(() => recordConnectivityFinding({
      jurisdiction: "ID", topic: "SPECTRUM", band_slug: "2_4ghz_isb",
      architecture_slug: null, business_model_slug: null,
      category: "UNKNOWN", authority_tier: "TIER_4",
      statement: "Unknown status of 2.4 GHz outdoor use in Indonesia",
      citation: "", evidence_ref: null, uncertainty_note: null,
      supersedes: null, created_by: "test",
    })).toThrow(/uncertainty_note_required_for_unknown/);
  });

  it("categorisationSummary counts findings per bucket", async () => {
    const { recordConnectivityFinding, categorisationSummary } = await import("./connectivity-regulation");
    recordConnectivityFinding({
      jurisdiction: "ID", topic: "SPECTRUM", band_slug: "2_4ghz_isb",
      architecture_slug: null, business_model_slug: null,
      category: "ALLOWED_NOW", authority_tier: "TIER_2",
      statement: "2.4 GHz class-licensed for indoor use", citation: "regulator_x",
      evidence_ref: null, uncertainty_note: null, supersedes: null, created_by: "test",
    });
    recordConnectivityFinding({
      jurisdiction: "ID", topic: "LICENSING", band_slug: null,
      architecture_slug: null, business_model_slug: "own_isp_licensed",
      category: "REQUIRES_LICENSE", authority_tier: "TIER_2",
      statement: "ISP licence required for public internet service", citation: "regulator_x",
      evidence_ref: null, uncertainty_note: null, supersedes: null, created_by: "test",
    });
    const s = categorisationSummary("ID");
    expect(s.ALLOWED_NOW).toBe(1);
    expect(s.REQUIRES_LICENSE).toBe(1);
    expect(s.UNKNOWN).toBe(0);
  });

  it("empty ledger produces zero-counted summary · never invents", async () => {
    const { categorisationSummary } = await import("./connectivity-regulation");
    const s = categorisationSummary("ID");
    expect(s.ALLOWED_NOW).toBe(0);
    expect(s.REQUIRES_LICENSE).toBe(0);
    expect(s.REQUIRES_PARTNERSHIP).toBe(0);
    expect(s.POSSIBLE_PILOT).toBe(0);
    expect(s.UNKNOWN).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// W4-C · Delegation
// ═══════════════════════════════════════════════════════════════════

describe("W4-C · Programmer delegation", () => {
  it("delegateTask REJECTS self-delegation", async () => {
    const { delegateTask } = await import("./delegation");
    expect(() => delegateTask({
      source_agent_id: "master_ai", target_agent_id: "master_ai",
      task_slug: "self_task", task_description: "self target attempt",
      bounds: { max_iterations: 4, max_runtime_ms: 5000, max_files_changed: 8 },
      reason: "test",
    })).toThrow(/self_delegation_not_allowed/);
  });

  it("delegateTask validates bounds against Phase G contract", async () => {
    const { delegateTask } = await import("./delegation");
    expect(() => delegateTask({
      source_agent_id: "master_ai", target_agent_id: "programmer",
      task_slug: "bad_bounds", task_description: "bad bounds test",
      bounds: { max_iterations: 0, max_runtime_ms: 5000, max_files_changed: 8 },
      reason: "test",
    })).toThrow(/bounds_violation/);
  });

  it("delegateTask → PENDING → outcome COMPLETED · never auto-transitioned", async () => {
    const { delegateTask, recordDelegationOutcome, getDelegation } = await import("./delegation");
    const d = delegateTask({
      source_agent_id: "master_ai", target_agent_id: "programmer",
      task_slug: "connectivity_econ_model", task_description: "Build economics simulator inputs",
      bounds: { max_iterations: 4, max_runtime_ms: 5000, max_files_changed: 8 },
      reason: "wave4_test",
    });
    expect(d.status).toBe("PENDING");
    const outcome = recordDelegationOutcome({
      delegation_id: d.delegation_id, recipient: "programmer",
      status: "COMPLETED", outcome_notes: "modeled",
    });
    expect(outcome.status).toBe("COMPLETED");
    expect(getDelegation(d.delegation_id)?.status).toBe("COMPLETED");
  });
});

// ═══════════════════════════════════════════════════════════════════
// W4-D · Learning cycle end-to-end
// ═══════════════════════════════════════════════════════════════════

describe("W4-D · First real learning cycle", () => {
  it("runs OBSERVE + PROPOSE even when no investigation supplied · honest skip", async () => {
    const { runLearningCycle } = await import("./learning-cycle");
    const { ensureRuntimeAgentsRegistered } = await import("./agent-registry");
    // Seed a fresh heartbeat so observatoryTick produces a report
    const hbPath = path.join(process.env.NEX_AGENT_RUNTIME_DATA_ROOT!, "heartbeat-programmer.json");
    const iso = new Date().toISOString();
    fs.writeFileSync(hbPath, JSON.stringify({
      agent_id: "programmer", run_id: "test", process_id: 1, timestamp_iso: iso,
      status: "RUNNING", current_task: "idle", last_success_iso: iso,
      last_failure_iso: null, internet_state: "UNKNOWN", runtime_version: "0.1.0",
    }), "utf8");
    ensureRuntimeAgentsRegistered({ registered_by: "test" });
    const r = await runLearningCycle({ invoker_reason: "skip_test" });
    expect(r.phases_completed).toContain("OBSERVE");
    expect(r.phases_completed).toContain("PROPOSE");
    expect(r.phases_skipped).toContain("RESEARCH");
    expect(r.phases_skipped).toContain("DELEGATE");
    expect(r.research_status).toBe("NO_INVESTIGATION");
  });

  it("runs full cycle with investigation + gateway + delegation", async () => {
    const { runLearningCycle } = await import("./learning-cycle");
    const { registerWikipediaLiveSource, WIKIPEDIA_SOURCE_SLUG, createWikipediaAdapter } = await import("./live-adapter-wikipedia");
    const { ensureRuntimeAgentsRegistered } = await import("./agent-registry");
    const hbPath = path.join(process.env.NEX_AGENT_RUNTIME_DATA_ROOT!, "heartbeat-programmer.json");
    const iso = new Date().toISOString();
    fs.writeFileSync(hbPath, JSON.stringify({
      agent_id: "programmer", run_id: "test", process_id: 1, timestamp_iso: iso,
      status: "RUNNING", current_task: "idle", last_success_iso: iso,
      last_failure_iso: null, internet_state: "UNKNOWN", runtime_version: "0.1.0",
    }), "utf8");
    ensureRuntimeAgentsRegistered({ registered_by: "test" });
    const stub: typeof fetch = async () => new Response(
      JSON.stringify({ title: "Radio spectrum", extract: "..." }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
    registerWikipediaLiveSource({ registered_by: "test", adapter: createWikipediaAdapter({ fetch_impl: stub }) });

    const r = await runLearningCycle({
      invoker_reason: "full_cycle_test",
      investigation_question: "Radio spectrum",
      investigation_jurisdiction: "ID",
      target_source_slugs: [WIKIPEDIA_SOURCE_SLUG],
      delegation_target_agent_id: "programmer",
      delegation_task_slug: "connectivity_analysis",
      delegation_task_description: "Analyse the radio spectrum finding",
      delegation_bounds: { max_iterations: 4, max_runtime_ms: 5000, max_files_changed: 8 },
    });
    expect(r.research_status).toBe("OK");
    expect(r.finding_id).not.toBeNull();
    expect(r.delegation_status).toBe("PENDING");
    expect(r.delegation_id).not.toBeNull();
    expect(r.investigation_id).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// W4-E · Economics simulator
// ═══════════════════════════════════════════════════════════════════

describe("W4-E · Connectivity economics simulator determinism", () => {
  it("same inputs → identical outputs (excluding UUID/timestamp)", async () => {
    const { runEconomicsScenario } = await import("./connectivity-economics");
    const template = mkTemplate();
    const a = runEconomicsScenario({ ...template, users_count: 500 });
    const b = runEconomicsScenario({ ...template, users_count: 500 });
    expect(a.peak_demand_mbps).toBe(b.peak_demand_mbps);
    expect(a.monthly_total_cost_idr).toBe(b.monthly_total_cost_idr);
    expect(a.cost_per_user_month_idr).toBe(b.cost_per_user_month_idr);
    expect(a.saving_vs_baseline_pct).toBe(b.saving_vs_baseline_pct);
  });

  it("under-provisioned upstream produces warning · never silently accepts", async () => {
    const { runEconomicsScenario } = await import("./connectivity-economics");
    const template = mkTemplate();
    const r = runEconomicsScenario({ ...template, users_count: 10000, upstream_mbps: { value: 10, source: "ASSUMPTION", note: "tiny" } });
    expect(r.warnings.some((w) => w.startsWith("upstream_undersized"))).toBe(true);
  });

  it("regulatory status field reports NO_FINDING_YET when no evidence recorded", async () => {
    const { runEconomicsScenario } = await import("./connectivity-economics");
    const r = runEconomicsScenario({ ...mkTemplate(), users_count: 100 });
    expect(r.regulatory_status_for_band).toBe("NO_FINDING_YET");
    expect(r.regulatory_status_for_business_model).toBe("NO_FINDING_YET");
    expect(r.warnings.some((w) => w.startsWith("no_regulation_finding_for_band"))).toBe(true);
  });

  it("runUserLadder produces 5 tier results by default", async () => {
    const { runUserLadder } = await import("./connectivity-economics");
    const template = mkTemplate();
    const out = runUserLadder(template);
    expect(out.length).toBe(5);
    expect(out.map((r) => r.inputs.users_count)).toEqual([50, 100, 500, 1000, 10000]);
  });
});

// Helper: a stable template so tests read cleanly
function mkTemplate() {
  return {
    scenario_slug: "test",
    jurisdiction: "ID",
    spectrum_band_slug: "5ghz_unii",
    architecture_slug: "single_hub_wifi",
    business_model_slug: "partnership_with_licensed_isp",
    hardware_capex_idr: { value: 20_000_000, source: "ASSUMPTION" as const, note: "hub bom" },
    hardware_amortization_months: { value: 36, source: "ASSUMPTION" as const, note: "3y" },
    upstream_mbps: { value: 200, source: "ASSUMPTION" as const, note: "provisioned" },
    upstream_cost_per_mbps_month_idr: { value: 25_000, source: "ASSUMPTION" as const, note: "wholesale" },
    avg_bandwidth_per_active_user_mbps: { value: 2, source: "ASSUMPTION" as const, note: "mixed use" },
    concurrent_active_pct: { value: 0.3, source: "ASSUMPTION" as const, note: "peak" },
    cache_hit_rate: { value: 0.15, source: "ASSUMPTION" as const, note: "nex reservoir" },
    video_pct: { value: 0.5, source: "ASSUMPTION" as const, note: "half video" },
    overhead_pct: { value: 0.1, source: "ASSUMPTION" as const, note: "protocol" },
    monthly_ops_cost_idr: { value: 2_000_000, source: "ASSUMPTION" as const, note: "power+site" },
    baseline_user_monthly_cost_idr: { value: 100_000, source: "CITED" as const, note: "typical Rp100k plan" },
    performed_by: "test",
  };
}
