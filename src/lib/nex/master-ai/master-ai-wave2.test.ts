// src/lib/nex/master-ai/master-ai-wave2.test.ts
//
// NEX Master AI Engineer · Wave 2 contract tests
// Philip 2026-09-07 · AUTHORIZE (continuous mission)
//
// Covers: Observatory · Cost Intelligence · Source Federation ·
// Reconciliation · Failure Intelligence · Experiment Engine ·
// Statistics · Daily Intelligence.
//
// Same NEX_MASTER_AI_DATA_ROOT temp-dir isolation as wave-1.

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
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-master-ai-w2-"));
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

// Helpers
function writeHeartbeat(agent: "programmer" | "accommodation", staleMs: number, pid = 1234) {
  const hbPath = path.join(process.env.NEX_AGENT_RUNTIME_DATA_ROOT!, `heartbeat-${agent}.json`);
  const iso = new Date(Date.now() - staleMs).toISOString();
  const hb = {
    agent_id: agent, run_id: "test-run", process_id: pid, timestamp_iso: iso,
    status: "RUNNING", current_task: "idle", last_success_iso: iso,
    last_failure_iso: null, internet_state: "UNKNOWN", runtime_version: "0.1.0",
  };
  fs.mkdirSync(path.dirname(hbPath), { recursive: true });
  fs.writeFileSync(hbPath, JSON.stringify(hb), "utf8");
}
function writeRuntimeEvent(kind: string, agent_id: string, attributes: Record<string, unknown> = {}) {
  const eventsPath = path.join(process.env.NEX_AGENT_RUNTIME_DATA_ROOT!, "events.jsonl");
  fs.mkdirSync(path.dirname(eventsPath), { recursive: true });
  fs.appendFileSync(eventsPath, JSON.stringify({
    event_id: `evt-${Math.random()}`, kind, agent_id,
    timestamp_iso: new Date().toISOString(),
    process_id: null, attributes,
  }) + "\n", "utf8");
}

// ═══════════════════════════════════════════════════════════════════════════
// Observatory
// ═══════════════════════════════════════════════════════════════════════════

describe("Observatory · derived health (§6)", () => {
  it("STOPPED when no heartbeat file exists", async () => {
    const { deriveAgentHealth } = await import("./observatory");
    const r = deriveAgentHealth("programmer");
    expect(r.derived_health).toBe("STOPPED");
    expect(r.running).toBe(false);
    expect(r.useful).toBe(false);
  });

  it("IDLE when heartbeat fresh but no WORK_COMPLETED events", async () => {
    writeHeartbeat("programmer", 2000);
    const { deriveAgentHealth } = await import("./observatory");
    const r = deriveAgentHealth("programmer");
    expect(r.derived_health).toBe("IDLE");
    expect(r.running).toBe(true);
    expect(r.useful).toBe(false);
  });

  it("HEALTHY when heartbeat fresh AND WORK_COMPLETED events present", async () => {
    writeHeartbeat("programmer", 2000);
    writeRuntimeEvent("WORK_COMPLETED", "programmer", { work: "observation_tick", observed_count: 3 });
    const { deriveAgentHealth } = await import("./observatory");
    const r = deriveAgentHealth("programmer");
    expect(r.derived_health).toBe("HEALTHY");
    expect(r.useful).toBe(true);
    expect(r.work_completed_since_last_report).toBe(1);
  });

  it("DEGRADED when heartbeat stale between 15-60s", async () => {
    writeHeartbeat("programmer", 30_000);
    const { deriveAgentHealth } = await import("./observatory");
    const r = deriveAgentHealth("programmer");
    expect(r.derived_health).toBe("DEGRADED");
  });

  it("CRASHED when heartbeat stale beyond 60s", async () => {
    writeHeartbeat("programmer", 120_000);
    const { deriveAgentHealth } = await import("./observatory");
    const r = deriveAgentHealth("programmer");
    expect(r.derived_health).toBe("CRASHED");
  });

  it("observatoryTick derives for every registered agent", async () => {
    writeHeartbeat("programmer", 2000);
    writeHeartbeat("accommodation", 2000);
    const { ensureRuntimeAgentsRegistered } = await import("./agent-registry");
    const { observatoryTick } = await import("./observatory");
    ensureRuntimeAgentsRegistered({ registered_by: "test" });
    const reports = observatoryTick();
    expect(reports.length).toBeGreaterThanOrEqual(2);
    const byAgent = new Map(reports.map((r) => [r.agent_id, r]));
    expect(byAgent.get("programmer")).toBeDefined();
    expect(byAgent.get("accommodation")).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Cost Intelligence
// ═══════════════════════════════════════════════════════════════════════════

describe("Cost Intelligence · quota fail-closed (§25 §44)", () => {
  it("checkQuota REJECTS unregistered source", async () => {
    const { checkQuota } = await import("./cost-intelligence");
    const r = checkQuota({ source_slug: "ghost", metric: "REQUEST", units: 1 });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("SOURCE_UNAUTHORIZED");
  });

  it("checkQuota REJECTS unauthorized source", async () => {
    const { registerSource } = await import("./research-engine");
    const { checkQuota } = await import("./cost-intelligence");
    registerSource({
      source_slug: "pending_src", name: "pending", kind: "PUBLIC_WEB",
      authority_tier: "TIER_3", base_url: null,
      rate_policy: { max_requests_per_minute: 60, respect_retry_after: true },
      respects_robots_txt: true, license_note: null, authorization_state: "PENDING",
      registered_by: "test",
    });
    const r = checkQuota({ source_slug: "pending_src", metric: "REQUEST", units: 1 });
    expect(r.allowed).toBe(false);
  });

  it("checkQuota allows when within free allowance", async () => {
    const { registerSource } = await import("./research-engine");
    const { setPolicy, checkQuota } = await import("./cost-intelligence");
    registerSource({
      source_slug: "src1", name: "s", kind: "PUBLIC_WEB",
      authority_tier: "TIER_3", base_url: null,
      rate_policy: { max_requests_per_minute: 60, respect_retry_after: true },
      respects_robots_txt: true, license_note: null, authorization_state: "AUTHORIZED",
      registered_by: "test",
    });
    setPolicy({
      source_slug: "src1", metric: "REQUEST",
      free_allowance_per_day: 1000, paid_allowance_per_day: 0, hard_daily_limit: null,
      cost_per_unit_paid_idr: null,
    });
    const r = checkQuota({ source_slug: "src1", metric: "REQUEST", units: 10 });
    expect(r.allowed).toBe(true);
  });

  it("tryConsume records OK inside quota, then REJECTED_QUOTA when exceeded", async () => {
    const { registerSource } = await import("./research-engine");
    const { setPolicy, tryConsume, readAllUsage } = await import("./cost-intelligence");
    registerSource({
      source_slug: "src2", name: "s", kind: "PUBLIC_WEB",
      authority_tier: "TIER_3", base_url: null,
      rate_policy: { max_requests_per_minute: 60, respect_retry_after: true },
      respects_robots_txt: true, license_note: null, authorization_state: "AUTHORIZED",
      registered_by: "test",
    });
    setPolicy({
      source_slug: "src2", metric: "REQUEST",
      free_allowance_per_day: 5, paid_allowance_per_day: 0, hard_daily_limit: null,
      cost_per_unit_paid_idr: null,
    });
    tryConsume({ source_slug: "src2", metric: "REQUEST", units: 3, invoker: "test" });
    tryConsume({ source_slug: "src2", metric: "REQUEST", units: 2, invoker: "test" });
    const rejected = tryConsume({ source_slug: "src2", metric: "REQUEST", units: 1, invoker: "test" });
    expect(rejected.status).toBe("REJECTED_QUOTA");
    const okEvents = readAllUsage().filter((u) => u.status === "OK");
    expect(okEvents.length).toBe(2);
  });

  it("hard_daily_limit takes precedence over allowances", async () => {
    const { registerSource } = await import("./research-engine");
    const { setPolicy, tryConsume } = await import("./cost-intelligence");
    registerSource({
      source_slug: "src3", name: "s", kind: "PUBLIC_WEB",
      authority_tier: "TIER_3", base_url: null,
      rate_policy: { max_requests_per_minute: 60, respect_retry_after: true },
      respects_robots_txt: true, license_note: null, authorization_state: "AUTHORIZED",
      registered_by: "test",
    });
    setPolicy({
      source_slug: "src3", metric: "REQUEST",
      free_allowance_per_day: 100000, paid_allowance_per_day: 100000, hard_daily_limit: 5,
      cost_per_unit_paid_idr: null,
    });
    tryConsume({ source_slug: "src3", metric: "REQUEST", units: 3, invoker: "test" });
    const rejected = tryConsume({ source_slug: "src3", metric: "REQUEST", units: 4, invoker: "test" });
    expect(rejected.status).toBe("REJECTED_LIMIT");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Source Federation
// ═══════════════════════════════════════════════════════════════════════════

describe("Source Federation · A→B→C selection (§7)", () => {
  it("returns null (offline) when no candidates registered", async () => {
    const { selectSource } = await import("./source-federation");
    const r = selectSource({ candidate_slugs: ["a", "b"], metric: "REQUEST", units_required: 1 });
    expect(r.chosen).toBeNull();
    expect(r.alternatives_skipped).toHaveLength(2);
  });

  it("picks first HEALTHY source in preference order", async () => {
    const { registerSource } = await import("./research-engine");
    const { recordSourceHealth, selectSource } = await import("./source-federation");
    for (const slug of ["A", "B"]) {
      registerSource({
        source_slug: slug, name: slug, kind: "PUBLIC_WEB",
        authority_tier: "TIER_3", base_url: null,
        rate_policy: { max_requests_per_minute: 60, respect_retry_after: true },
        respects_robots_txt: true, license_note: null, authorization_state: "AUTHORIZED",
        registered_by: "test",
      });
      recordSourceHealth({
        source_slug: slug, health: "HEALTHY",
        requests_last_hour: 1, requests_last_day: 1, failures_last_hour: 0,
        quota_used_ratio: 0.1, latest_success_iso: new Date().toISOString(),
        latest_failure_iso: null, latest_failure_reason: null,
      });
    }
    const r = selectSource({ candidate_slugs: ["A", "B"], metric: "REQUEST", units_required: 1 });
    expect(r.chosen).toBe("A");
  });

  it("falls through to B when A is QUOTA_EXHAUSTED, then to offline when B unavailable", async () => {
    const { registerSource } = await import("./research-engine");
    const { recordSourceHealth, selectSource } = await import("./source-federation");
    for (const slug of ["A", "B"]) {
      registerSource({
        source_slug: slug, name: slug, kind: "PUBLIC_WEB",
        authority_tier: "TIER_3", base_url: null,
        rate_policy: { max_requests_per_minute: 60, respect_retry_after: true },
        respects_robots_txt: true, license_note: null, authorization_state: "AUTHORIZED",
        registered_by: "test",
      });
    }
    recordSourceHealth({
      source_slug: "A", health: "QUOTA_EXHAUSTED",
      requests_last_hour: 100, requests_last_day: 100000, failures_last_hour: 0,
      quota_used_ratio: 1, latest_success_iso: null,
      latest_failure_iso: null, latest_failure_reason: "quota",
    });
    recordSourceHealth({
      source_slug: "B", health: "UNAVAILABLE",
      requests_last_hour: 0, requests_last_day: 0, failures_last_hour: 5,
      quota_used_ratio: 0, latest_success_iso: null,
      latest_failure_iso: new Date().toISOString(), latest_failure_reason: "5xx",
    });
    const r = selectSource({ candidate_slugs: ["A", "B"], metric: "REQUEST", units_required: 1 });
    expect(r.chosen).toBeNull();
    expect(r.reason).toContain("offline_reservoir");
    expect(r.alternatives_skipped.map((s) => s.source_slug)).toEqual(["A", "B"]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Reconciliation
// ═══════════════════════════════════════════════════════════════════════════

describe("Reconciliation (§9)", () => {
  it("AGREED when all sources give same value", async () => {
    const { reconcile } = await import("./reconciliation");
    const r = reconcile({
      subject_key: "hotel:xyz:phone",
      claims: [
        { source_slug: "A", authority_tier: "TIER_3", raw_value: "+62 274 555 1234",
          normalized_value: "+62 274 555 1234", observed_at_iso: new Date().toISOString() },
        { source_slug: "B", authority_tier: "TIER_2", raw_value: "+62 274 555 1234",
          normalized_value: "+62 274 555 1234", observed_at_iso: new Date().toISOString() },
      ],
    });
    expect(r.verdict).toBe("AGREED");
  });

  it("UNVERIFIED when only one source", async () => {
    const { reconcile } = await import("./reconciliation");
    const r = reconcile({
      subject_key: "hotel:xyz:phone",
      claims: [
        { source_slug: "A", authority_tier: "TIER_3", raw_value: "+62",
          normalized_value: "+62", observed_at_iso: new Date().toISOString() },
      ],
    });
    expect(r.verdict).toBe("UNVERIFIED");
    expect(r.canonical_value).toBe("+62");
  });

  it("MOST_LIKELY when authority tier breaks a tie", async () => {
    const { reconcile } = await import("./reconciliation");
    const r = reconcile({
      subject_key: "villa:abc:pool",
      claims: [
        { source_slug: "A", authority_tier: "TIER_1", raw_value: "yes",
          normalized_value: "yes", observed_at_iso: new Date().toISOString() },
        { source_slug: "B", authority_tier: "TIER_4", raw_value: "no",
          normalized_value: "no", observed_at_iso: new Date().toISOString() },
      ],
    });
    expect(r.verdict).toBe("MOST_LIKELY");
    expect(r.canonical_value).toBe("yes");
    expect(r.preserved_conflicts.length).toBe(1);
    expect(r.preserved_conflicts[0].normalized_value).toBe("no");
  });

  it("CONFLICTED when sources at equal top authority disagree", async () => {
    const { reconcile } = await import("./reconciliation");
    const r = reconcile({
      subject_key: "kos:xyz:price",
      claims: [
        { source_slug: "A", authority_tier: "TIER_2", raw_value: "1500000",
          normalized_value: "1500000", observed_at_iso: new Date().toISOString() },
        { source_slug: "B", authority_tier: "TIER_2", raw_value: "1800000",
          normalized_value: "1800000", observed_at_iso: new Date().toISOString() },
      ],
    });
    expect(r.verdict).toBe("CONFLICTED");
    expect(r.canonical_value).toBeNull();
    expect(r.preserved_conflicts).toHaveLength(2);
  });

  it("UNKNOWN with no claims", async () => {
    const { reconcile } = await import("./reconciliation");
    const r = reconcile({ subject_key: "x", claims: [] });
    expect(r.verdict).toBe("UNKNOWN");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Failure Intelligence
// ═══════════════════════════════════════════════════════════════════════════

describe("Failure Intelligence (§18)", () => {
  it("aggregates WORK_FAILED patterns and folds noisy variants", async () => {
    // Two failures with different UUIDs but same underlying reason
    writeRuntimeEvent("WORK_FAILED", "programmer", {
      error: "Error: EPERM rename tmp-1a2b3c4d-5678-4444-8888-abcdefabcdef.json → target.json",
    });
    writeRuntimeEvent("WORK_FAILED", "programmer", {
      error: "Error: EPERM rename tmp-9999aaaa-bbbb-4444-cccc-ddddeeeeffff.json → target.json",
    });
    writeRuntimeEvent("WORK_FAILED", "accommodation", {
      error: "Error: EPERM rename tmp-8888aaaa-bbbb-4444-cccc-ffffffffffff.json → target.json",
    });
    const { aggregateFailurePatterns, listCurrentPatterns } = await import("./failure-intelligence");
    aggregateFailurePatterns();
    const patterns = listCurrentPatterns();
    // All three should fold into ONE pattern (UUIDs canonicalized).
    expect(patterns.length).toBe(1);
    expect(patterns[0].affected_agents.sort()).toEqual(["accommodation", "programmer"]);
  });

  it("linkPatternToImprovement attaches candidate slug", async () => {
    writeRuntimeEvent("WORK_FAILED", "programmer", { error: "test failure" });
    const { aggregateFailurePatterns, linkPatternToImprovement, listCurrentPatterns } = await import("./failure-intelligence");
    aggregateFailurePatterns();
    const before = listCurrentPatterns()[0];
    linkPatternToImprovement({ pattern_key: before.pattern_key, candidate_improvement_slug: "retry_on_eperm" });
    const after = listCurrentPatterns()[0];
    expect(after.candidate_improvement_slug).toBe("retry_on_eperm");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Experiment Engine
// ═══════════════════════════════════════════════════════════════════════════

describe("Experiment Engine (§16)", () => {
  it("SUPERIOR when candidate beats current by >2pp with sufficient cases", async () => {
    const { registerCorpus, recordRun } = await import("./benchmark-engine");
    const { compareCandidateAgainstCurrent } = await import("./experiment-engine");
    const cases = Array.from({ length: 30 }, (_, i) => ({ case_id: `c${i}`, input: i, expected: i, metadata: {} }));
    const corpus = registerCorpus({ agent_id: "programmer", version: "v1", cases });
    const current = recordRun({
      corpus_id: corpus.corpus_id, capability_id: "cap-v1",
      case_count: 30, pass_count: 20, fail_count: 10, per_class_metrics: {},
      compared_against_run_id: null, attribution: null,
    });
    const candidate = recordRun({
      corpus_id: corpus.corpus_id, capability_id: "cap-v2",
      case_count: 30, pass_count: 28, fail_count: 2, per_class_metrics: {},
      compared_against_run_id: current.run_id, attribution: null,
    });
    const cmp = compareCandidateAgainstCurrent({
      candidate_run_id: candidate.run_id, current_capability_id: "cap-v1",
    });
    expect(cmp.verdict).toBe("SUPERIOR");
  });

  it("INFERIOR when candidate loses by >2pp", async () => {
    const { registerCorpus, recordRun } = await import("./benchmark-engine");
    const { compareCandidateAgainstCurrent } = await import("./experiment-engine");
    const cases = Array.from({ length: 30 }, (_, i) => ({ case_id: `c${i}`, input: i, expected: i, metadata: {} }));
    const corpus = registerCorpus({ agent_id: "programmer", version: "v1", cases });
    recordRun({
      corpus_id: corpus.corpus_id, capability_id: "cap-v1",
      case_count: 30, pass_count: 28, fail_count: 2, per_class_metrics: {},
      compared_against_run_id: null, attribution: null,
    });
    const bad = recordRun({
      corpus_id: corpus.corpus_id, capability_id: "cap-v2",
      case_count: 30, pass_count: 15, fail_count: 15, per_class_metrics: {},
      compared_against_run_id: null, attribution: null,
    });
    const cmp = compareCandidateAgainstCurrent({
      candidate_run_id: bad.run_id, current_capability_id: "cap-v1",
    });
    expect(cmp.verdict).toBe("INFERIOR");
  });

  it("INSUFFICIENT_EVIDENCE when candidate ran fewer than 20 cases", async () => {
    const { registerCorpus, recordRun } = await import("./benchmark-engine");
    const { compareCandidateAgainstCurrent } = await import("./experiment-engine");
    const cases = Array.from({ length: 5 }, (_, i) => ({ case_id: `c${i}`, input: i, expected: i, metadata: {} }));
    const corpus = registerCorpus({ agent_id: "programmer", version: "v1", cases });
    const cand = recordRun({
      corpus_id: corpus.corpus_id, capability_id: "cap-v2",
      case_count: 5, pass_count: 5, fail_count: 0, per_class_metrics: {},
      compared_against_run_id: null, attribution: null,
    });
    const cmp = compareCandidateAgainstCurrent({
      candidate_run_id: cand.run_id, current_capability_id: null,
    });
    expect(cmp.verdict).toBe("INSUFFICIENT_EVIDENCE");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Statistics / Trend
// ═══════════════════════════════════════════════════════════════════════════

describe("Statistics / Trend (§20)", () => {
  it("STABLE when values barely change", async () => {
    const { analyzeTimeSeries } = await import("./statistics");
    const points = Array.from({ length: 10 }, (_, i) => ({
      at_iso: new Date(Date.now() + i * 3600_000).toISOString(),
      value: 100 + (i % 2 === 0 ? 0.1 : -0.1),
    }));
    const r = analyzeTimeSeries({ metric_key: "test", points });
    expect(r.direction).toBe("STABLE");
  });

  it("INCREASING when linear positive growth", async () => {
    const { analyzeTimeSeries } = await import("./statistics");
    const points = Array.from({ length: 10 }, (_, i) => ({
      at_iso: new Date(Date.now() + i * 3600_000).toISOString(),
      value: 100 + i * 5,
    }));
    const r = analyzeTimeSeries({ metric_key: "test", points });
    expect(r.direction).toBe("INCREASING");
    expect(r.slope_per_hour).toBeGreaterThan(0);
  });

  it("DECREASING when negative slope", async () => {
    const { analyzeTimeSeries } = await import("./statistics");
    const points = Array.from({ length: 10 }, (_, i) => ({
      at_iso: new Date(Date.now() + i * 3600_000).toISOString(),
      value: 100 - i * 5,
    }));
    const r = analyzeTimeSeries({ metric_key: "test", points });
    expect(r.direction).toBe("DECREASING");
    expect(r.slope_per_hour).toBeLessThan(0);
  });

  it("INSUFFICIENT_DATA when fewer than 3 points", async () => {
    const { analyzeTimeSeries } = await import("./statistics");
    const r = analyzeTimeSeries({
      metric_key: "test",
      points: [
        { at_iso: new Date().toISOString(), value: 1 },
        { at_iso: new Date().toISOString(), value: 2 },
      ],
    });
    expect(r.direction).toBe("INSUFFICIENT_DATA");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Daily Intelligence
// ═══════════════════════════════════════════════════════════════════════════

describe("Daily Intelligence roll-up (§39)", () => {
  it("composes a report with 24h window", async () => {
    const { ensureRuntimeAgentsRegistered } = await import("./agent-registry");
    const { composeDaily } = await import("./daily-intelligence");
    ensureRuntimeAgentsRegistered({ registered_by: "test" });
    const r = composeDaily();
    expect(r.system_status.agents_monitored).toBeGreaterThanOrEqual(3); // programmer + accommodation + master_ai
    expect(r.window_start_iso).toBeTruthy();
    expect(r.window_end_iso).toBeTruthy();
    expect(r.next_research_targets.length).toBeGreaterThan(0);
  });

  it("flags weakness when observatory reports IDLE agent", async () => {
    const { ensureRuntimeAgentsRegistered } = await import("./agent-registry");
    const { observatoryTick } = await import("./observatory");
    const { composeDaily } = await import("./daily-intelligence");
    writeHeartbeat("programmer", 2000);       // fresh but no work events → IDLE
    writeHeartbeat("accommodation", 2000);
    ensureRuntimeAgentsRegistered({ registered_by: "test" });
    observatoryTick();
    const r = composeDaily();
    expect(r.system_status.agents_idle).toBeGreaterThanOrEqual(1);
    expect(r.agent_weaknesses.some((w) => w.reason.includes("idle"))).toBe(true);
  });

  it("aggregates cost intelligence + flags sources over 50% quota", async () => {
    const { registerSource } = await import("./research-engine");
    const { setPolicy, tryConsume } = await import("./cost-intelligence");
    const { ensureRuntimeAgentsRegistered } = await import("./agent-registry");
    const { composeDaily } = await import("./daily-intelligence");
    ensureRuntimeAgentsRegistered({ registered_by: "test" });
    registerSource({
      source_slug: "big_src", name: "Big", kind: "PUBLIC_WEB",
      authority_tier: "TIER_3", base_url: null,
      rate_policy: { max_requests_per_minute: 60, respect_retry_after: true },
      respects_robots_txt: true, license_note: null, authorization_state: "AUTHORIZED",
      registered_by: "test",
    });
    setPolicy({
      source_slug: "big_src", metric: "REQUEST",
      free_allowance_per_day: 10, paid_allowance_per_day: 0, hard_daily_limit: null,
      cost_per_unit_paid_idr: null,
    });
    tryConsume({ source_slug: "big_src", metric: "REQUEST", units: 6, invoker: "test" }); // 60% of free
    const r = composeDaily();
    expect(r.cost_intelligence.sources_over_50_pct_quota).toContain("big_src");
    expect(r.risks.some((s) => s.includes("50pct_quota"))).toBe(true);
  });
});
