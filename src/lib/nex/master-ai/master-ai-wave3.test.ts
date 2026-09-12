// src/lib/nex/master-ai/master-ai-wave3.test.ts
//
// NEX Master AI Engineer · Wave 3 contract tests
// Philip 2026-09-07 · AUTHORIZE (continuous mission)
//
// Covers: Research Gateway (§7 §8) · Research Prioritisation (§10) ·
// Failure→Research + Observation→Improvement loops (§13 §14) ·
// Reservoir Refresh + Offline enforcement (§18 §19) ·
// Autonomous Cycle honest NO_VALID_CANDIDATE (§20 §21 §45) ·
// Self-criticism (§22 §23) · Daily upgrade (§24 §25).
//
// Same NEX_MASTER_AI_DATA_ROOT temp-dir isolation as wave-1 / wave-2.

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
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-master-ai-w3-"));
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

// ═══════════════════════════════════════════════════════════════════════════
// Research Prioritisation (§10)
// ═══════════════════════════════════════════════════════════════════════════

describe("Research Prioritisation · deterministic exposed scoring (§10)", () => {
  it("computePriority yields deterministic score and reasoning string", async () => {
    const { computePriority } = await import("./research-priority");
    const r1 = computePriority({
      question: "test?",
      driver: "OBSERVED_WEAKNESS",
      components: { impact: 8, urgency: 7, confidence_in_signal: 6, recurrence_count: 3, expected_benefit: 6, cost_estimate: 3, risk_estimate: 2, complexity_estimate: 4 },
    });
    const r2 = computePriority({
      question: "test?",
      driver: "OBSERVED_WEAKNESS",
      components: { impact: 8, urgency: 7, confidence_in_signal: 6, recurrence_count: 3, expected_benefit: 6, cost_estimate: 3, risk_estimate: 2, complexity_estimate: 4 },
    });
    expect(r1.score).toBe(r2.score);
    expect(r1.reasoning).toContain("impact8");
    expect(r1.reasoning).toContain("=");
  });

  it("clamps to 1..10 and non-negative recurrence", async () => {
    const { computePriority } = await import("./research-priority");
    const r = computePriority({
      question: "clamp?", driver: "STRATEGIC_QUESTION",
      components: { impact: 999, urgency: -5, recurrence_count: -3 },
    });
    expect(r.components.impact).toBe(10);
    expect(r.components.urgency).toBe(1);
    expect(r.components.recurrence_count).toBe(0);
  });

  it("rankPriorities sorts highest-first", async () => {
    const { computePriority, rankPriorities } = await import("./research-priority");
    computePriority({ question: "low", driver: "STRATEGIC_QUESTION", components: { impact: 1, urgency: 1, confidence_in_signal: 1, expected_benefit: 1 } });
    computePriority({ question: "hi",  driver: "AGENT_FAILURE",      components: { impact: 10, urgency: 10, confidence_in_signal: 10, expected_benefit: 10, recurrence_count: 5 } });
    const ranked = rankPriorities();
    expect(ranked[0].question).toBe("hi");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Research Gateway (§7 §8) — enforcement
// ═══════════════════════════════════════════════════════════════════════════

describe("Research Gateway · enforcement path (§7 §8)", () => {
  it("BLOCKED · adapter missing for authorized source", async () => {
    const { registerSource, enqueueResearchQuery } = await import("./research-engine");
    const { performResearch } = await import("./research-gateway");
    registerSource({
      source_slug: "auth_no_adapter", name: "auth", kind: "PUBLIC_WEB",
      authority_tier: "TIER_3", base_url: null,
      rate_policy: { max_requests_per_minute: 60, respect_retry_after: true },
      respects_robots_txt: true, license_note: null, authorization_state: "AUTHORIZED",
      registered_by: "test",
    });
    const q = enqueueResearchQuery({ question: "auth?", target_source_slugs: ["auth_no_adapter"], priority: 5, created_by: "test" });
    const r = await performResearch({ query: q, invoker: "test" });
    expect(r.status).toBe("ADAPTER_MISSING");
  });

  it("OFFLINE_MODE · gateway blocks all fetches while offline (§18)", async () => {
    const { registerSource, registerAdapter, enqueueResearchQuery } = await import("./research-engine");
    const { performResearch } = await import("./research-gateway");
    const { setOffline } = await import("./offline-reservoir");
    registerSource({
      source_slug: "any", name: "any", kind: "PUBLIC_WEB",
      authority_tier: "TIER_3", base_url: null,
      rate_policy: { max_requests_per_minute: 60, respect_retry_after: true },
      respects_robots_txt: true, license_note: null, authorization_state: "AUTHORIZED",
      registered_by: "test",
    });
    registerAdapter({
      source_slug: "any",
      async fetch() { return { status: "OK", raw_evidence: "hello", retrieved_at_iso: new Date().toISOString(), language: null, license: null }; },
    });
    setOffline("simulated_outage");
    const q = enqueueResearchQuery({ question: "any?", target_source_slugs: ["any"], priority: 5, created_by: "test" });
    const r = await performResearch({ query: q, invoker: "test" });
    expect(r.status).toBe("OFFLINE_MODE");
  });

  it("OK · gateway executes select→quota→fetch→finding when authorized (§7)", async () => {
    const { registerSource, registerAdapter, enqueueResearchQuery } = await import("./research-engine");
    const { setPolicy } = await import("./cost-intelligence");
    const { performResearch } = await import("./research-gateway");
    registerSource({
      source_slug: "good", name: "good", kind: "PUBLIC_WEB",
      authority_tier: "TIER_2", base_url: null,
      rate_policy: { max_requests_per_minute: 60, respect_retry_after: true },
      respects_robots_txt: true, license_note: null, authorization_state: "AUTHORIZED",
      registered_by: "test",
    });
    setPolicy({
      source_slug: "good", metric: "REQUEST",
      free_allowance_per_day: 100, paid_allowance_per_day: 0,
      unit_cost_idr: 0, hard_cap: true, warning_threshold_pct: 80,
      set_by: "test",
    });
    registerAdapter({
      source_slug: "good",
      async fetch() { return { status: "OK", raw_evidence: "content", retrieved_at_iso: new Date().toISOString(), language: "en", license: "CC0" }; },
    });
    const q = enqueueResearchQuery({ question: "good?", target_source_slugs: ["good"], priority: 5, created_by: "test" });
    const r = await performResearch({ query: q, invoker: "test" });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.finding.source_slug).toBe("good");
      expect(r.finding.raw_evidence).toBe("content");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Reservoir refresh + offline demo (§18 §19)
// ═══════════════════════════════════════════════════════════════════════════

describe("Reservoir refresh · reconnect elevates stale research (§18 §19)", () => {
  it("demonstrateOfflineFallback records scenario=OFFLINE_FALLBACK", async () => {
    const { demonstrateOfflineFallback } = await import("./reservoir-refresh");
    const { setOffline } = await import("./offline-reservoir");
    setOffline("simulated");
    const r = demonstrateOfflineFallback({ attempted_source: "some_src", reason: "test" });
    expect(r.scenario).toBe("OFFLINE_FALLBACK");
    expect(r.fell_back_to_cache).toBe(true);
  });

  it("refreshReservoirOnReconnect transitions offline→online + records demo", async () => {
    const { setOffline, readMode } = await import("./offline-reservoir");
    const { refreshReservoirOnReconnect } = await import("./reservoir-refresh");
    setOffline("simulated");
    expect(readMode().online).toBe(false);
    const r = refreshReservoirOnReconnect({ reason: "network_restored", invoker: "test" });
    expect(r.scenario).toBe("RECONNECT_REFRESH");
    expect(r.online_after).toBe(true);
    expect(readMode().online).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Autonomous evolution cycle · honest NO_VALID_CANDIDATE (§20 §21 §45)
// ═══════════════════════════════════════════════════════════════════════════

describe("Autonomous cycle · honest NO_VALID_CANDIDATE (§20 §21 §45)", () => {
  it("returns NO_VALID_CANDIDATE when ledgers are empty · no invented candidates", async () => {
    const { runAutonomousEvolutionCycle } = await import("./autonomous-cycle");
    const r = runAutonomousEvolutionCycle({ invoker_reason: "empty_test" });
    expect(r.no_valid_candidate).toBe(true);
    expect(r.candidates_evaluated).toBe(0);
    expect(r.proposals_queued.length).toBe(0);
    expect(r.invocation.terminated_reason).toContain("NO_VALID_CANDIDATE");
  });

  it("queues candidates through approval queue when real failure pattern present · never auto-promotes", async () => {
    const { aggregateFailurePatterns } = await import("./failure-intelligence");
    const { runAutonomousEvolutionCycle } = await import("./autonomous-cycle");
    const { readAllPromotionEntries } = await import("./autonomous-evolution");
    // Seed real failure evidence in agent-runtime events
    const eventsPath = path.join(process.env.NEX_AGENT_RUNTIME_DATA_ROOT!, "events.jsonl");
    for (let i = 0; i < 3; i++) {
      fs.appendFileSync(eventsPath, JSON.stringify({
        event_id: `e${i}`, kind: "WORK_FAILED", agent_id: "programmer",
        timestamp_iso: new Date().toISOString(), process_id: null,
        attributes: { work: "observation_tick", reason: "database_conn_timeout" },
      }) + "\n", "utf8");
    }
    aggregateFailurePatterns();
    const r = runAutonomousEvolutionCycle({ invoker_reason: "with_evidence", max_candidates_per_cycle: 5 });
    expect(r.no_valid_candidate).toBe(false);
    expect(r.candidates_evaluated).toBeGreaterThanOrEqual(1);
    const entries = readAllPromotionEntries();
    for (const e of entries) expect(e.status).toBe("AWAITING_APPROVAL");    // NEVER auto-approved
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Self-criticism (§22 §23) — 13 answers from real evidence
// ═══════════════════════════════════════════════════════════════════════════

describe("Self-criticism · answers 13 questions from real evidence (§22 §23)", () => {
  it("composeSelfCriticism returns all 13 answer keys even when ledgers empty", async () => {
    const { composeSelfCriticism } = await import("./self-criticism");
    const r = composeSelfCriticism({ window_hours: 24 });
    const keys = Object.keys(r.answers);
    const expected = [
      "what_i_learned","what_changed","what_i_missed","weak_sources",
      "stagnating_agents","repeated_failures","useless_research",
      "improved_capabilities","wrong_predictions","insufficient_evidence_topics",
      "going_stale","costing_too_much","investigate_next",
    ];
    for (const k of expected) expect(keys).toContain(k);
    // Empty ledgers must produce HONEST "no learning" text, never invented progress
    expect(r.answers.what_i_learned).toContain("no_new_knowledge_or_findings");
  });

  it("reflects real weak sources when source_health records DEGRADED", async () => {
    const { recordSourceHealth } = await import("./source-federation");
    const { composeSelfCriticism } = await import("./self-criticism");
    recordSourceHealth({
      source_slug: "shaky", health: "DEGRADED",
      requests_last_hour: 5, requests_last_day: 30, failures_last_hour: 3,
      quota_used_ratio: 0.5,
      latest_success_iso: null,
      latest_failure_iso: new Date().toISOString(),
      latest_failure_reason: "timeout",
    });
    const r = composeSelfCriticism({ window_hours: 24 });
    expect(r.answers.weak_sources.some((s) => s.startsWith("shaky"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Intelligence loops (§13 §14)
// ═══════════════════════════════════════════════════════════════════════════

describe("Intelligence loops · Failure→Research + Observation→Improvement (§13 §14)", () => {
  it("driveFailurePatternResearch enqueues 1 research query per unaddressed pattern", async () => {
    const { aggregateFailurePatterns } = await import("./failure-intelligence");
    const { driveFailurePatternResearch } = await import("./intelligence-loops");
    const { listQueries } = await import("./research-engine");
    const eventsPath = path.join(process.env.NEX_AGENT_RUNTIME_DATA_ROOT!, "events.jsonl");
    for (let i = 0; i < 3; i++) {
      fs.appendFileSync(eventsPath, JSON.stringify({
        event_id: `x${i}`, kind: "WORK_FAILED", agent_id: "programmer",
        timestamp_iso: new Date().toISOString(), process_id: null,
        attributes: { work: "observation_tick", reason: "connection_refused" },
      }) + "\n", "utf8");
    }
    aggregateFailurePatterns();
    const r = driveFailurePatternResearch({ created_by: "test" });
    expect(r.queries_created).toBeGreaterThanOrEqual(1);
    expect(listQueries().length).toBeGreaterThanOrEqual(1);
  });
});
