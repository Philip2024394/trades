// src/lib/nex/master-ai/master-ai-world-first.test.ts
//
// NEX Master AI · World-First Capability · contract tests
// Philip 2026-09-07 · AUTHORIZE

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
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-master-ai-wf-"));
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
// Task complexity classification
// ═══════════════════════════════════════════════════════════════════

describe("Task complexity classification", () => {
  it("returns UNKNOWN when <3 dimensions have evidence", async () => {
    const { classifyTask, unknownDim, withEvidence } = await import("./task-complexity-classification");
    const c = classifyTask({
      task_slug: "test_task_slug",
      task_description: "Test description longer than ten characters",
      dimensions: {
        novelty: withEvidence(5, "evidence provided"),
        dependencies: withEvidence(3, "evidence provided"),
        risk: unknownDim(), required_knowledge: unknownDim(), time_estimate: unknownDim(),
        scale: unknownDim(), reversibility: unknownDim(), verification_difficulty: unknownDim(),
      },
    });
    expect(c.verdict).toBe("UNKNOWN");
  });

  it("returns EXTREME when high-risk + high-reversibility + high-scale", async () => {
    const { classifyTask, withEvidence } = await import("./task-complexity-classification");
    const c = classifyTask({
      task_slug: "extreme_task",
      task_description: "High-risk high-scale irreversible test task",
      dimensions: {
        novelty: withEvidence(9, "new territory"),
        dependencies: withEvidence(8, "many upstream systems"),
        risk: withEvidence(10, "catastrophic blast radius"),
        required_knowledge: withEvidence(9, "expert-only"),
        time_estimate: withEvidence(10, "weeks-long"),
        scale: withEvidence(10, "millions of users"),
        reversibility: withEvidence(10, "irreversible"),
        verification_difficulty: withEvidence(9, "hard to verify"),
      },
    });
    expect(c.verdict).toBe("EXTREME");
    expect(c.requires_founder_approval).toBe(true);
    expect(c.requires_pre_benchmark).toBe(true);
  });

  it("recommended bounds scale with verdict", async () => {
    const { classifyTask, withEvidence } = await import("./task-complexity-classification");
    const trivial = classifyTask({
      task_slug: "trivial_task",
      task_description: "Simple trivial test task with sufficient detail",
      dimensions: {
        novelty: withEvidence(1, "well-known technique"), dependencies: withEvidence(1, "minimal upstream"),
        risk: withEvidence(1, "low risk scope"), required_knowledge: withEvidence(1, "basic knowledge only"),
        time_estimate: withEvidence(1, "minutes to complete"), scale: withEvidence(1, "single user impact"),
        reversibility: withEvidence(1, "trivial revert possible"), verification_difficulty: withEvidence(1, "obvious verification"),
      },
    });
    expect(trivial.verdict).toBe("TRIVIAL");
    expect(trivial.recommended_max_iterations).toBe(2);
    expect(trivial.recommended_max_files_changed).toBe(4);
  });

  it("REJECTS unknown_evidence dimension without UNKNOWN rationale", async () => {
    const { classifyTask } = await import("./task-complexity-classification");
    expect(() => classifyTask({
      task_slug: "bad_task",
      task_description: "Bad dimension test task with sufficient detail",
      dimensions: {
        novelty: { score: 5, rationale: "invalid combo", evidence_present: false } as any,
        dependencies: { score: 0, rationale: "UNKNOWN", evidence_present: false },
        risk: { score: 0, rationale: "UNKNOWN", evidence_present: false },
        required_knowledge: { score: 0, rationale: "UNKNOWN", evidence_present: false },
        time_estimate: { score: 0, rationale: "UNKNOWN", evidence_present: false },
        scale: { score: 0, rationale: "UNKNOWN", evidence_present: false },
        reversibility: { score: 0, rationale: "UNKNOWN", evidence_present: false },
        verification_difficulty: { score: 0, rationale: "UNKNOWN", evidence_present: false },
      },
    })).toThrow(/no_evidence_requires_UNKNOWN_rationale/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Error detection engine
// ═══════════════════════════════════════════════════════════════════

describe("Error detection engine", () => {
  it("dedups errors by (kind × signature)", async () => {
    const { recordError, readAllErrors } = await import("./error-detection-engine");
    recordError({ kind: "TYPE_ERROR", source_ledger: "test", source_ref: null, message: "duplicate error message here", agent_id: null });
    recordError({ kind: "TYPE_ERROR", source_ledger: "test", source_ref: null, message: "duplicate error message here", agent_id: null });
    const all = readAllErrors();
    // Both records persisted (append-only) but latest per signature is dedup'd
    expect(all.length).toBe(2);
    const { latestBySignature } = await import("./error-detection-engine");
    const latest = latestBySignature();
    expect(latest.size).toBe(1);
    expect(Array.from(latest.values())[0].occurrences).toBe(2);
  });

  it("assigns CRITICAL severity to LEDGER_CORRUPTION and REGRESSION", async () => {
    const { recordError } = await import("./error-detection-engine");
    const corruption = recordError({ kind: "LEDGER_CORRUPTION", source_ledger: "test", source_ref: null, message: "corrupted row detected", agent_id: null });
    const regression = recordError({ kind: "REGRESSION", source_ledger: "test", source_ref: null, message: "previously green test now failing", agent_id: null });
    expect(corruption.severity_hint).toBe("CRITICAL");
    expect(regression.severity_hint).toBe("CRITICAL");
  });

  it("scans runtime events for WORK_FAILED", async () => {
    const { scanRuntimeEventsForErrors, readAllErrors } = await import("./error-detection-engine");
    const eventsPath = path.join(process.env.NEX_AGENT_RUNTIME_DATA_ROOT!, "events.jsonl");
    fs.writeFileSync(eventsPath,
      JSON.stringify({ event_id: "e1", kind: "WORK_FAILED", agent_id: "programmer", timestamp_iso: new Date().toISOString(), attributes: { error: "connection refused test error message" } }) + "\n" +
      JSON.stringify({ event_id: "e2", kind: "WORK_COMPLETED", agent_id: "programmer", timestamp_iso: new Date().toISOString(), attributes: {} }) + "\n",
      "utf8");
    const count = scanRuntimeEventsForErrors();
    expect(count).toBe(1);
    expect(readAllErrors().length).toBe(1);
  });

  it("markResolved appends new record with resolved=true", async () => {
    const { recordError, markResolved, latestBySignature } = await import("./error-detection-engine");
    const e = recordError({ kind: "RUNTIME_ERROR", source_ledger: "test", source_ref: null, message: "test error that will be resolved", agent_id: null });
    markResolved({ error_id: e.error_id, note: "fixed by X" });
    const latest = latestBySignature();
    expect(latest.get(e.signature_hash)?.resolved).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Auto-repair proposer
// ═══════════════════════════════════════════════════════════════════

describe("Auto-repair proposer", () => {
  it("proposes ADD_TIMEOUT_HANDLING for RUNTIME_ERROR containing 'timeout'", async () => {
    const { proposeRepairFor } = await import("./auto-repair-proposer");
    const { recordError } = await import("./error-detection-engine");
    const e = recordError({ kind: "RUNTIME_ERROR", source_ledger: "test", source_ref: null, message: "database connection timeout after 30 seconds", agent_id: "programmer" });
    const p = proposeRepairFor({ error: e, invoker: "test" });
    expect(p.strategy).toBe("ADD_TIMEOUT_HANDLING");
    expect(p.status).toBe("DELEGATED");
    expect(p.delegation_id).not.toBeNull();
  });

  it("SKIPS proposals for REGRESSION (requires_human_investigation)", async () => {
    const { proposeRepairFor } = await import("./auto-repair-proposer");
    const { recordError } = await import("./error-detection-engine");
    const e = recordError({ kind: "REGRESSION", source_ledger: "test", source_ref: null, message: "previously-passing test now fails", agent_id: null });
    const p = proposeRepairFor({ error: e, invoker: "test" });
    expect(p.strategy).toBe("INVESTIGATE_MANUALLY");
    expect(p.status).toBe("SKIPPED");
  });

  it("dedup · repeated proposeRepairFor on same error returns SKIPPED already_proposed", async () => {
    const { proposeRepairFor } = await import("./auto-repair-proposer");
    const { recordError } = await import("./error-detection-engine");
    const e = recordError({ kind: "RUNTIME_ERROR", source_ledger: "test", source_ref: null, message: "connection refused test error", agent_id: null });
    const first = proposeRepairFor({ error: e, invoker: "test" });
    expect(first.status).toBe("DELEGATED");
    const second = proposeRepairFor({ error: e, invoker: "test" });
    expect(second.status).toBe("SKIPPED");
    expect(second.skip_reason).toBe("already_proposed");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Self-improvement scheduler
// ═══════════════════════════════════════════════════════════════════

describe("Self-improvement scheduler", () => {
  it("candidates always start AWAITING_APPROVAL · never auto-approved", async () => {
    const { recordCandidate } = await import("./self-improvement-scheduler");
    const c = recordCandidate({
      kind: "MISSING_TEST", target_module: "test_module",
      candidate_slug: "missing_test_test_module",
      detection_reasoning: "module has no test coverage which is a real gap",
      evidence_refs: [], proposed_change: "-", expected_benefit: "-",
      estimated_effort: "MODERATE", requires_founder_approval: false,
    });
    expect(c.authorization_state).toBe("AWAITING_APPROVAL");
  });

  it("dedup by candidate_slug", async () => {
    const { recordCandidate, currentCandidates } = await import("./self-improvement-scheduler");
    recordCandidate({
      kind: "MISSING_TEST", target_module: "m", candidate_slug: "dedup_test",
      detection_reasoning: "reasoning long enough for validation",
      evidence_refs: [], proposed_change: "-", expected_benefit: "-",
      estimated_effort: "MODERATE", requires_founder_approval: false,
    });
    recordCandidate({
      kind: "MISSING_TEST", target_module: "m", candidate_slug: "dedup_test",
      detection_reasoning: "reasoning long enough for validation",
      evidence_refs: [], proposed_change: "-", expected_benefit: "-",
      estimated_effort: "MODERATE", requires_founder_approval: false,
    });
    expect(currentCandidates().length).toBe(1);
  });

  it("scanForSelfImprovements surfaces MISSING_ROTATION when ledger exceeds cap", async () => {
    const { scanForSelfImprovements } = await import("./self-improvement-scheduler");
    const candidates = scanForSelfImprovements({
      module_name: "test-mod",
      contract_test_files_count: 5,
      ledger_row_counts: { "big_ledger.jsonl": 30_000 },
      ledger_soft_cap: 20_000,
      stale_knowledge_count: 0,
      low_confidence_output_ratio: 0.1,
      cadence_ms_observed: 1000, cadence_ms_target: 1000,
      invoker: "test",
    });
    const rot = candidates.find((c) => c.kind === "MISSING_ROTATION");
    expect(rot).toBeDefined();
    expect(rot?.authorization_state).toBe("AWAITING_APPROVAL");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Offline resilience manager
// ═══════════════════════════════════════════════════════════════════

describe("Offline resilience manager", () => {
  it("REFUSE_ACTION for irreversible action requiring current info while offline", async () => {
    const { pickOfflineMode } = await import("./offline-resilience-manager");
    const r = pickOfflineMode({
      cached_tier_1_available: true, cached_any_available: true,
      action_requires_current_info: true,
      action_reversibility: "IRREVERSIBLE",
    });
    expect(r.mode).toBe("REFUSE_ACTION");
  });

  it("PREFER_CACHED_TIER_1 when tier1 available and action not irreversible", async () => {
    const { pickOfflineMode } = await import("./offline-resilience-manager");
    const r = pickOfflineMode({
      cached_tier_1_available: true, cached_any_available: true,
      action_requires_current_info: false,
      action_reversibility: "REVERSIBLE",
    });
    expect(r.mode).toBe("PREFER_CACHED_TIER_1");
  });

  it("OBSERVE_ONLY when no cache available", async () => {
    const { pickOfflineMode } = await import("./offline-resilience-manager");
    const r = pickOfflineMode({
      cached_tier_1_available: false, cached_any_available: false,
      action_requires_current_info: false,
      action_reversibility: "REVERSIBLE",
    });
    expect(r.mode).toBe("OBSERVE_ONLY");
  });

  it("assessCachedFreshness FRESH within TTL · REFUSED beyond stale_but_usable when refuse_beyond_ttl=true", async () => {
    const { assessCachedFreshness } = await import("./offline-resilience-manager");
    const nowMs = Date.now();
    const freshCached = new Date(nowMs - 1 * 60 * 60 * 1000).toISOString();       // 1 hour ago
    const staleUsable = new Date(nowMs - 45 * 24 * 60 * 60 * 1000).toISOString(); // 45 days ago (within 90-day stale_but_usable)
    const tooStale = new Date(nowMs - 400 * 24 * 60 * 60 * 1000).toISOString();   // 400 days ago
    expect(assessCachedFreshness({ category: "regulation", cached_iso: freshCached, now: nowMs })).toBe("FRESH");
    expect(assessCachedFreshness({ category: "regulation", cached_iso: staleUsable, now: nowMs })).toBe("STALE_BUT_USABLE");
    expect(assessCachedFreshness({ category: "regulation", cached_iso: tooStale, now: nowMs })).toBe("REFUSED_TOO_STALE");
  });

  it("OFFLINE_CAPABLE_SUBSYSTEMS lists ≥10 subsystems", async () => {
    const { OFFLINE_CAPABLE_SUBSYSTEMS } = await import("./offline-resilience-manager");
    expect(OFFLINE_CAPABLE_SUBSYSTEMS.length).toBeGreaterThanOrEqual(10);
  });
});
