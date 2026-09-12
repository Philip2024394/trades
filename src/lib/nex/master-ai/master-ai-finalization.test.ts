// src/lib/nex/master-ai/master-ai-finalization.test.ts
//
// NEX Master AI · F-Wave Finalization · contract tests
// Philip 2026-09-07 · AUTHORIZE
//
// Covers the 6 new F-Wave modules:
//   · multilingual-intelligence      (§16)
//   · decision-intelligence          (§21)
//   · failure-trajectory             (§6)
//   · agent-capability-profile       (§7)
//   · storage-rotation               (§20)
//   · integrated-intelligence-loop   (§30)

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
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-master-ai-fw-"));
  process.env.NEX_MASTER_AI_DATA_ROOT = path.join(tempDir, "master-ai");
  process.env.NEX_AGENT_RUNTIME_DATA_ROOT = path.join(tempDir, "agent-runtime");
  fs.mkdirSync(process.env.NEX_MASTER_AI_DATA_ROOT, { recursive: true });
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
// §16 · Multilingual intelligence
// ═══════════════════════════════════════════════════════════════════

describe("Multilingual intelligence (§16)", () => {
  it("first-class languages are en · id · ja · unknown", async () => {
    const { FIRST_CLASS_LANGUAGES, isFirstClassLanguage } = await import("./multilingual-intelligence");
    expect(FIRST_CLASS_LANGUAGES).toEqual(["en", "id", "ja", "unknown"]);
    expect(isFirstClassLanguage("fr")).toBe(false);
    expect(isFirstClassLanguage("id")).toBe(true);
  });

  it("REJECTS translation with target_language but null translated_text unless AUTO_DETECT_ONLY", async () => {
    const { recordTranslation } = await import("./multilingual-intelligence");
    expect(() => recordTranslation({
      original_text: "Halo dunia", original_language: "id",
      translated_text: null, target_language: null,
      method: "HUMAN", method_ref: "test", confidence: "MEDIUM",
      provenance_note: "test note", evidence_ref: null,
    })).toThrow(/null_translated_text_requires_AUTO_DETECT_ONLY_method/);
  });

  it("PRESERVES original text · never overwrites with translation", async () => {
    const { recordTranslation, readAllTranslations } = await import("./multilingual-intelligence");
    const original = "Peraturan Pemerintah Nomor 52 Tahun 2000";
    recordTranslation({
      original_text: original, original_language: "id",
      translated_text: "Government Regulation No. 52 of 2000",
      target_language: "en",
      method: "AI_MODEL", method_ref: "claude-opus-4-6", confidence: "MEDIUM",
      provenance_note: "test translation preserving original",
      evidence_ref: null,
    });
    expect(readAllTranslations()[0].original_text).toBe(original);
  });

  it("detectLanguage identifies Bahasa Indonesia keywords", async () => {
    const { detectLanguage } = await import("./multilingual-intelligence");
    expect(detectLanguage("penyelenggara jasa telekomunikasi yang dan untuk").language).toBe("id");
  });

  it("detectLanguage identifies Japanese scripts", async () => {
    const { detectLanguage } = await import("./multilingual-intelligence");
    expect(detectLanguage("これはテストです").language).toBe("ja");
  });
});

// ═══════════════════════════════════════════════════════════════════
// §21 · Decision intelligence
// ═══════════════════════════════════════════════════════════════════

describe("Decision intelligence (§21 · know when not to act)", () => {
  it("returns ASK_FOUNDER when authority_required=FOUNDER_APPROVAL", async () => {
    const { decide } = await import("./decision-intelligence");
    const d = decide({
      situation: "Sign a wholesale ISP contract",
      evidence_refs: ["e1"], hard_safety_boundaries_touched: [],
      authority_required: "FOUNDER_APPROVAL",
      evidence_confidence: "HIGH", in_flight_research_query_ids: [],
      external_dependencies_pending: [], supports_action: "YES",
    });
    expect(d.outcome).toBe("ASK_FOUNDER");
  });

  it("returns DO_NOT_ACT when hard safety boundaries touched", async () => {
    const { decide } = await import("./decision-intelligence");
    const d = decide({
      situation: "Purchase radio equipment",
      evidence_refs: ["e1"], hard_safety_boundaries_touched: ["no_hardware_purchase"],
      authority_required: "MASTER_AI_AUTONOMOUS",
      evidence_confidence: "HIGH", in_flight_research_query_ids: [],
      external_dependencies_pending: [], supports_action: "YES",
    });
    expect(d.outcome).toBe("DO_NOT_ACT");
    expect(d.rationale).toContain("no_hardware_purchase");
  });

  it("returns WAIT_FOR_EVIDENCE when research is in flight and confidence is LOW", async () => {
    const { decide } = await import("./decision-intelligence");
    const d = decide({
      situation: "Choose upstream provider for pilot",
      evidence_refs: ["e1"], hard_safety_boundaries_touched: [],
      authority_required: "MASTER_AI_AUTONOMOUS",
      evidence_confidence: "LOW", in_flight_research_query_ids: ["q1", "q2"],
      external_dependencies_pending: [], supports_action: "UNKNOWN",
    });
    expect(d.outcome).toBe("WAIT_FOR_EVIDENCE");
  });

  it("returns ACT_NOW only with MEDIUM+ confidence AND supports_action YES AND no blockers", async () => {
    const { decide } = await import("./decision-intelligence");
    const d = decide({
      situation: "Add a new authorised source to the research gateway",
      evidence_refs: ["e1", "e2"], hard_safety_boundaries_touched: [],
      authority_required: "MASTER_AI_AUTONOMOUS",
      evidence_confidence: "MEDIUM", in_flight_research_query_ids: [],
      external_dependencies_pending: [], supports_action: "YES",
    });
    expect(d.outcome).toBe("ACT_NOW");
  });

  it("returns UNKNOWN when no evidence at all", async () => {
    const { decide } = await import("./decision-intelligence");
    const d = decide({
      situation: "Some open question with no evidence yet",
      evidence_refs: [], hard_safety_boundaries_touched: [],
      authority_required: "MASTER_AI_AUTONOMOUS",
      evidence_confidence: "NONE", in_flight_research_query_ids: [],
      external_dependencies_pending: [], supports_action: "UNKNOWN",
    });
    expect(d.outcome).toBe("UNKNOWN");
  });

  it("recordDecision persists rationale ≥20 chars", async () => {
    const { recordDecision, readAllDecisions } = await import("./decision-intelligence");
    const rec = recordDecision({
      situation: "Register a new adapter for Wikipedia (id)",
      evidence_refs: ["e1"], hard_safety_boundaries_touched: [],
      authority_required: "MASTER_AI_AUTONOMOUS",
      evidence_confidence: "MEDIUM", in_flight_research_query_ids: [],
      external_dependencies_pending: [], supports_action: "YES",
    });
    expect(rec.rationale.length).toBeGreaterThanOrEqual(20);
    expect(readAllDecisions().length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// §7 · Agent capability profile
// ═══════════════════════════════════════════════════════════════════

describe("Agent capability profile (§7)", () => {
  it("REJECTS profile with mission shorter than 10 chars", async () => {
    const { recordCapabilityProfile } = await import("./agent-capability-profile");
    expect(() => recordCapabilityProfile({
      agent_id: "test", mission: "short",
      domains: [], skills: [], evidence_refs: [],
      benchmark_performance_summary: "-", known_weaknesses: [],
      reliability: "MEDIUM", recent_failure_refs: [],
      learning_trajectory: "STABLE", knowledge_dependencies: [],
      current_state: "REGISTERED",
      resource_cost_profile: { approximate_monthly_compute_hours: null, approximate_monthly_storage_mb: null, approximate_monthly_research_requests: null, approximate_monthly_cost_idr: null },
      supersedes: null, created_by: "test",
    })).toThrow(/mission_too_short/);
  });

  it("supersedes chain returns only current profile per agent", async () => {
    const { recordCapabilityProfile, currentProfiles } = await import("./agent-capability-profile");
    const a = recordCapabilityProfile({
      agent_id: "programmer", mission: "Engineering execution + skill promotion",
      domains: ["typescript"], skills: [], evidence_refs: [],
      benchmark_performance_summary: "no benchmarks yet", known_weaknesses: [],
      reliability: "HIGH", recent_failure_refs: [],
      learning_trajectory: "IMPROVING", knowledge_dependencies: [],
      current_state: "ACTIVE",
      resource_cost_profile: { approximate_monthly_compute_hours: null, approximate_monthly_storage_mb: null, approximate_monthly_research_requests: null, approximate_monthly_cost_idr: null },
      supersedes: null, created_by: "test",
    });
    recordCapabilityProfile({
      agent_id: "programmer", mission: "Engineering execution + skill promotion + reliability improvements",
      domains: ["typescript", "react"], skills: [], evidence_refs: [],
      benchmark_performance_summary: "-", known_weaknesses: [],
      reliability: "HIGH", recent_failure_refs: [],
      learning_trajectory: "STABLE", knowledge_dependencies: [],
      current_state: "ACTIVE",
      resource_cost_profile: { approximate_monthly_compute_hours: null, approximate_monthly_storage_mb: null, approximate_monthly_research_requests: null, approximate_monthly_cost_idr: null },
      supersedes: a.profile_id, created_by: "test",
    });
    const current = currentProfiles();
    expect(current.length).toBe(1);
    expect(current[0].domains).toEqual(["typescript", "react"]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// §20 · Storage rotation
// ═══════════════════════════════════════════════════════════════════

describe("Storage rotation (§20)", () => {
  it("no rotation needed for small file", async () => {
    const { rotateLedgerIfNeeded, DEFAULT_POLICY } = await import("./storage-rotation");
    const p = path.join(process.env.NEX_MASTER_AI_DATA_ROOT!, "small_ledger.jsonl");
    fs.writeFileSync(p, JSON.stringify({ a: 1 }) + "\n", "utf8");
    const r = rotateLedgerIfNeeded(p, DEFAULT_POLICY);
    expect(r).toBeNull();
  });

  it("rotates when row cap exceeded · keeps recent rows · archives rest", async () => {
    const { rotateLedgerIfNeeded } = await import("./storage-rotation");
    const p = path.join(process.env.NEX_MASTER_AI_DATA_ROOT!, "big_ledger.jsonl");
    // Write 100 lines, cap at 50, keep last 30
    const lines = Array.from({ length: 100 }, (_, i) => JSON.stringify({ i, payload: "x".repeat(50) }));
    fs.writeFileSync(p, lines.join("\n") + "\n", "utf8");
    const r = rotateLedgerIfNeeded(p, { size_cap_bytes: Infinity, row_cap_rows: 50, keep_recent_rows: 30 });
    expect(r).not.toBeNull();
    expect(r!.rows_before).toBe(100);
    expect(r!.rows_after).toBe(30);
    expect(r!.rows_archived).toBe(70);
    expect(r!.archived_path).toContain("archive-");
    expect(fs.existsSync(r!.archived_path!)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// §6 · Failure trajectory
// ═══════════════════════════════════════════════════════════════════

describe("Failure trajectory (§6)", () => {
  it("returns empty when no current patterns", async () => {
    const { composeFailureTrajectories } = await import("./failure-trajectory");
    const t = composeFailureTrajectories();
    expect(t.length).toBe(0);
  });

  it("clusterPatterns groups patterns sharing ≥3 tokens", async () => {
    const { clusterPatterns } = await import("./failure-trajectory");
    const patterns = [
      { pattern_key: "p1", representative_reason: "database connection timeout error", occurrence_count: 3, affected_agents: ["a"], candidate_improvement_slug: null } as any,
      { pattern_key: "p2", representative_reason: "database timeout connection failure", occurrence_count: 2, affected_agents: ["a"], candidate_improvement_slug: null } as any,
      { pattern_key: "p3", representative_reason: "network interface degraded state", occurrence_count: 1, affected_agents: ["a"], candidate_improvement_slug: null } as any,
    ];
    const clusters = clusterPatterns(patterns);
    expect(clusters.get("p1")).toBe(clusters.get("p2"));
    expect(clusters.get("p3")).not.toBe(clusters.get("p1"));
  });

  it("detects EMERGING when no prior record exists", async () => {
    // seed a failure via the ledger-writing path
    const { composeFailureTrajectories } = await import("./failure-trajectory");
    const { aggregateFailurePatterns } = await import("./failure-intelligence");
    const eventsPath = path.join(process.env.NEX_AGENT_RUNTIME_DATA_ROOT!, "events.jsonl");
    fs.mkdirSync(path.dirname(eventsPath), { recursive: true });
    for (let i = 0; i < 3; i++) {
      fs.appendFileSync(eventsPath, JSON.stringify({
        event_id: `e${i}`, kind: "WORK_FAILED", agent_id: "programmer",
        timestamp_iso: new Date().toISOString(), process_id: null,
        attributes: { work: "observation_tick", reason: "trajectory_test_reason" },
      }) + "\n", "utf8");
    }
    aggregateFailurePatterns();
    const trajectories = composeFailureTrajectories();
    expect(trajectories.length).toBeGreaterThan(0);
    expect(trajectories[0].direction).toBe("EMERGING");
  });
});

// ═══════════════════════════════════════════════════════════════════
// §30 · Integrated intelligence loop
// ═══════════════════════════════════════════════════════════════════

describe("Integrated intelligence loop (§30)", () => {
  it("runs a full tick end-to-end · records phase results · honestly reports empty state", async () => {
    const { runIntegratedTick, readAllTicks } = await import("./integrated-intelligence-loop");
    const { ensureRuntimeAgentsRegistered } = await import("./agent-registry");
    // Seed heartbeat so observatory produces a report
    const hbPath = path.join(process.env.NEX_AGENT_RUNTIME_DATA_ROOT!, "heartbeat-programmer.json");
    const iso = new Date().toISOString();
    fs.writeFileSync(hbPath, JSON.stringify({
      agent_id: "programmer", run_id: "test", process_id: 1, timestamp_iso: iso,
      status: "RUNNING", current_task: "idle", last_success_iso: iso,
      last_failure_iso: null, internet_state: "UNKNOWN", runtime_version: "0.1.0",
    }), "utf8");
    ensureRuntimeAgentsRegistered({ registered_by: "test" });
    const tick = await runIntegratedTick({ invoker: "test_tick" });
    expect(tick.tick_id).toBeTruthy();
    expect(tick.phase_results.observation.reports_produced).toBeGreaterThan(0);
    // Empty ledgers → no_valid_candidate should be true
    expect(tick.no_valid_candidate_detected).toBe(true);
    expect(readAllTicks().length).toBe(1);
  });

  it("bounded_max_new_research_queries defaults to 3 · does not explode", async () => {
    const { runIntegratedTick } = await import("./integrated-intelligence-loop");
    const { ensureRuntimeAgentsRegistered } = await import("./agent-registry");
    const hbPath = path.join(process.env.NEX_AGENT_RUNTIME_DATA_ROOT!, "heartbeat-programmer.json");
    fs.writeFileSync(hbPath, JSON.stringify({
      agent_id: "programmer", run_id: "test", process_id: 1, timestamp_iso: new Date().toISOString(),
      status: "RUNNING", current_task: "idle", last_success_iso: new Date().toISOString(),
      last_failure_iso: null, internet_state: "UNKNOWN", runtime_version: "0.1.0",
    }), "utf8");
    ensureRuntimeAgentsRegistered({ registered_by: "test" });
    const tick = await runIntegratedTick({ invoker: "bound_test" });
    expect(tick.bounded_max_new_research_queries).toBe(3);
    expect(tick.bounded_max_delegations).toBe(1);
  });
});
