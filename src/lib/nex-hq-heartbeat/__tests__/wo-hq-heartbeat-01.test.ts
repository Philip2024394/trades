// WO-HQ-HEARTBEAT-01 · adversarial + property tests

import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";

import { deriveHeartbeatState, HEARTBEAT_THRESHOLDS } from "../state-derivation";
import { decideRecoveryAction, buildHealthCheck, ALLOWED_RECOVERY_ACTIONS } from "../recovery";
import { runHeartbeatTick } from "../monitor";
import type { AgentHeartbeat, HeartbeatState, LivenessSignal, ProgressSignal, DegradedIndicators, RecoveryAction } from "../types";
import { provenanceChainHash } from "@/lib/nex-intelligence/provenance";

const REPO_ROOT = process.cwd();

async function cleanCollections(): Promise<void> {
  const files = ["nex_hq_agent_heartbeats", "nex_hq_agent_progress_snapshots", "nex_hq_agent_health_checks"];
  const root = path.join(REPO_ROOT, "data", "nex-storage");
  for (const f of files) {
    try { await fs.unlink(path.join(root, `${f}.jsonl`)); } catch { /* ok */ }
  }
}

function liveness(alive: boolean, ageMs: number | null = null): LivenessSignal {
  return {
    is_alive: alive,
    last_evidence_at: ageMs !== null ? new Date(Date.now() - ageMs).toISOString() : null,
    age_ms: ageMs,
    threshold_ms: HEARTBEAT_THRESHOLDS.DEFAULT_LIVENESS_THRESHOLD_MS,
  };
}
function progress(hasMission: boolean, ageMs: number | null = null): ProgressSignal {
  return {
    has_active_mission: hasMission, mission_id: hasMission ? "m1" : null,
    items_processed: hasMission ? 5 : 0, items_expected: 10,
    evidence_records_produced: 3,
    last_progress_at: ageMs !== null ? new Date(Date.now() - ageMs).toISOString() : null,
    age_since_progress_ms: ageMs,
    stall_threshold_ms: HEARTBEAT_THRESHOLDS.DEFAULT_STALL_THRESHOLD_MS,
  };
}
function degraded(count = 0, pressure = false): DegradedIndicators {
  return { recent_failure_count: count, resource_pressure: pressure, fail_threshold: HEARTBEAT_THRESHOLDS.DEFAULT_DEGRADED_FAIL_THRESHOLD };
}

// ═════════════════════════════════════════════════════════════════════════
// POSITIVE / CONSTRUCTION
// ═════════════════════════════════════════════════════════════════════════

describe("WO-HQ-HEARTBEAT-01 · state derivation", () => {
  it("no liveness + active mission → FAILED (mission dispatched but agent lost signal)", () => {
    const r = deriveHeartbeatState({
      liveness_signal: liveness(false),
      progress_signal: progress(true, 5000),   // has active mission
      scheduler_examined_workload: true,
      degraded_indicators: degraded(),
    });
    expect(r.state).toBe("FAILED");
  });

  it("liveness expired + active mission → FAILED", () => {
    const r = deriveHeartbeatState({
      liveness_signal: liveness(true, HEARTBEAT_THRESHOLDS.DEFAULT_LIVENESS_THRESHOLD_MS + 1000),
      progress_signal: progress(true, 5000),   // has active mission
      scheduler_examined_workload: true,
      degraded_indicators: degraded(),
    });
    expect(r.state).toBe("FAILED");
  });

  it("no liveness · NO active mission → WAITING (invocation-triggered agents are not FAILED just because idle)", () => {
    const r = deriveHeartbeatState({
      liveness_signal: liveness(false),
      progress_signal: progress(false),   // no active mission
      scheduler_examined_workload: true,
      degraded_indicators: degraded(),
    });
    expect(r.state).toBe("WAITING");
  });

  it("liveness + mission + fresh progress → WORKING", () => {
    const r = deriveHeartbeatState({
      liveness_signal: liveness(true, 1000),
      progress_signal: progress(true, 5000),
      scheduler_examined_workload: true,
      degraded_indicators: degraded(),
    });
    expect(r.state).toBe("WORKING");
  });

  it("liveness + mission + stale progress → STALLED", () => {
    const r = deriveHeartbeatState({
      liveness_signal: liveness(true, 5000),
      progress_signal: progress(true, HEARTBEAT_THRESHOLDS.DEFAULT_STALL_THRESHOLD_MS + 30_000),
      scheduler_examined_workload: true,
      degraded_indicators: degraded(),
    });
    expect(r.state).toBe("STALLED");
  });

  it("liveness · no mission · scheduler examined → WAITING", () => {
    const r = deriveHeartbeatState({
      liveness_signal: liveness(true, 5000),
      progress_signal: progress(false),
      scheduler_examined_workload: true,
      degraded_indicators: degraded(),
    });
    expect(r.state).toBe("WAITING");
  });

  it("liveness · no mission · scheduler NOT examined → ALIVE", () => {
    const r = deriveHeartbeatState({
      liveness_signal: liveness(true, 5000),
      progress_signal: progress(false),
      scheduler_examined_workload: false,
      degraded_indicators: degraded(),
    });
    expect(r.state).toBe("ALIVE");
  });

  it("liveness + recent failures ≥ threshold → DEGRADED (not WORKING)", () => {
    const r = deriveHeartbeatState({
      liveness_signal: liveness(true, 1000),
      progress_signal: progress(true, 5000),   // fresh progress
      scheduler_examined_workload: true,
      degraded_indicators: degraded(5, false),   // above threshold
    });
    expect(r.state).toBe("DEGRADED");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// ADVERSARIAL (14 · §10)
// ═════════════════════════════════════════════════════════════════════════

describe("WO-HQ-HEARTBEAT-01 · adversarial", () => {
  afterEach(cleanCollections);

  it("A-1 · heartbeat modules never import orchestrator/dispatch helpers", async () => {
    const files = [
      "src/lib/nex-hq-heartbeat/types.ts",
      "src/lib/nex-hq-heartbeat/state-derivation.ts",
      "src/lib/nex-hq-heartbeat/recovery.ts",
      "src/lib/nex-hq-heartbeat/monitor.ts",
    ];
    for (const f of files) {
      const src = await fs.readFile(path.join(REPO_ROOT, f), "utf8");
      // Monitor does NOT import mission dispatch or dispatcher
      expect(src).not.toMatch(/dispatchMission/);
      expect(src).not.toMatch(/createMission/);
      expect(src).not.toMatch(/runOrchestrator/);
    }
  });

  it("A-2 · state derivation is pure (100 runs identical)", () => {
    const inp = {
      liveness_signal: liveness(true, 5000),
      progress_signal: progress(true, 5000),
      scheduler_examined_workload: true,
      degraded_indicators: degraded(),
    };
    const first = deriveHeartbeatState(inp);
    for (let i = 0; i < 100; i++) expect(deriveHeartbeatState(inp)).toEqual(first);
  });

  it("A-3 · WORKING requires BOTH signals · alive without mission ≠ WORKING", () => {
    // Alive · no mission · scheduler not examined = ALIVE
    const a = deriveHeartbeatState({
      liveness_signal: liveness(true, 1000),
      progress_signal: progress(false),   // no mission
      scheduler_examined_workload: false,
      degraded_indicators: degraded(),
    });
    expect(a.state).not.toBe("WORKING");
    // Alive · mission · stale progress = STALLED (not WORKING)
    const b = deriveHeartbeatState({
      liveness_signal: liveness(true, 1000),
      progress_signal: progress(true, HEARTBEAT_THRESHOLDS.DEFAULT_STALL_THRESHOLD_MS + 30_000),
      scheduler_examined_workload: true,
      degraded_indicators: degraded(),
    });
    expect(b.state).not.toBe("WORKING");
  });

  it("A-4 · agent with prior activity but no CURRENT progress on active mission = STALLED", () => {
    const r = deriveHeartbeatState({
      liveness_signal: liveness(true, 1000),                     // has recent liveness
      progress_signal: progress(true, HEARTBEAT_THRESHOLDS.DEFAULT_STALL_THRESHOLD_MS + 60_000),
      scheduler_examined_workload: true,
      degraded_indicators: degraded(),
    });
    expect(r.state).toBe("STALLED");
  });

  it("A-5 · no liveness + active mission → FAILED (dispatched but lost signal)", () => {
    const r = deriveHeartbeatState({
      liveness_signal: liveness(true, HEARTBEAT_THRESHOLDS.DEFAULT_LIVENESS_THRESHOLD_MS + 1),
      progress_signal: progress(true, 1000),                     // active mission
      scheduler_examined_workload: true,
      degraded_indicators: degraded(),
    });
    expect(r.state).toBe("FAILED");
  });

  it("A-6 · heartbeat modules never sign any authorisation", async () => {
    const files = [
      "src/lib/nex-hq-heartbeat/types.ts",
      "src/lib/nex-hq-heartbeat/state-derivation.ts",
      "src/lib/nex-hq-heartbeat/recovery.ts",
      "src/lib/nex-hq-heartbeat/monitor.ts",
    ];
    for (const f of files) {
      const src = await fs.readFile(path.join(REPO_ROOT, f), "utf8");
      expect(src).not.toMatch(/signAuthorization/);
      expect(src).not.toMatch(/signFounderKeyManifest/);
      expect(src).not.toMatch(/signCrawlerManifest/);
    }
  });

  it("A-7 · heartbeat modules never expand any mandate or manifest", async () => {
    const files = [
      "src/lib/nex-hq-heartbeat/monitor.ts",
      "src/lib/nex-hq-heartbeat/recovery.ts",
    ];
    for (const f of files) {
      const src = await fs.readFile(path.join(REPO_ROOT, f), "utf8");
      expect(src).not.toMatch(/CrawlerManifestEntry\s*=/);
      expect(src).not.toMatch(/OperatingMandate\s*=/);
    }
  });

  it("A-8 · zero external LLM SDK imports in nex-hq-heartbeat", async () => {
    const walk = async (d: string): Promise<string[]> => {
      const out: string[] = [];
      for (const e of await fs.readdir(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) out.push(...await walk(p));
        else if (e.isFile() && /\.(ts|tsx|mjs|mts|js)$/.test(e.name)) out.push(p);
      }
      return out;
    };
    const files = await walk(path.join(REPO_ROOT, "src/lib/nex-hq-heartbeat"));
    const forbidden = /from\s+["'](openai|@anthropic-ai\/sdk|@anthropic\/sdk|@google\/generative-ai|@google-ai|cohere|@cohere-ai|mistral|@mistralai|@aws-sdk\/client-bedrock)/;
    for (const f of files) expect(await fs.readFile(f, "utf8")).not.toMatch(forbidden);
  });

  it("A-9 · buildHealthCheck REFUSES actions outside the allowlist", () => {
    const fakeAction = "GRANT_AUTHORITY" as unknown as RecoveryAction;
    expect(ALLOWED_RECOVERY_ACTIONS).not.toContain(fakeAction);
    const heartbeat = makeHeartbeat("WORKING");
    expect(() => buildHealthCheck({
      agent_id: "a1", heartbeat, previous_state: null,
      action: fakeAction, action_evidence_pointer: null,
      reason: "attacker attempt", antecedent_provenance_hashes: [],
    })).toThrow(/refused/);
  });

  it("A-10 · provenance chain covers heartbeat fields · tamper detected", () => {
    const hb = makeHeartbeat("WORKING");
    // Tamper: change derived_state after hash was computed
    const tampered = { ...hb, derived_state: "FAILED" as HeartbeatState };
    const stripped = { ...tampered };
    delete (stripped as { provenance_chain_hash?: string }).provenance_chain_hash;
    const recomputed = provenanceChainHash(stripped as Record<string, unknown>, []);
    expect(recomputed).not.toBe(hb.provenance_chain_hash);
  });

  it("A-11 · heartbeat modules never modify WO-13 substrate scope", async () => {
    const files = [
      "src/lib/nex-hq-heartbeat/monitor.ts",
      "src/lib/nex-hq-heartbeat/recovery.ts",
    ];
    for (const f of files) {
      const src = await fs.readFile(path.join(REPO_ROOT, f), "utf8");
      expect(src).not.toMatch(/from\s+["']@\/lib\/nex1-orchestrator\/wo4-executor/);
      expect(src).not.toMatch(/executeAuthorisedDiffBundle/);
    }
  });

  it("A-12 · WAITING requires scheduler_examined_workload=true", () => {
    const r = deriveHeartbeatState({
      liveness_signal: liveness(true, 5000),
      progress_signal: progress(false),
      scheduler_examined_workload: false,    // NOT examined
      degraded_indicators: degraded(),
    });
    expect(r.state).not.toBe("WAITING");
    expect(r.state).toBe("ALIVE");
  });

  it("A-13 · anti-fake-activity: injecting fabricated 'active' input still returns honest state", () => {
    // Attacker attempts to fake WORKING by claiming a mission with no real progress
    const r = deriveHeartbeatState({
      liveness_signal: liveness(true, 1000),
      progress_signal: {
        has_active_mission: true, mission_id: "fake",
        items_processed: 999, items_expected: 999,
        evidence_records_produced: 999,
        last_progress_at: null,             // no real timestamp
        age_since_progress_ms: null,        // no progress signal
        stall_threshold_ms: HEARTBEAT_THRESHOLDS.DEFAULT_STALL_THRESHOLD_MS,
      },
      scheduler_examined_workload: true,
      degraded_indicators: degraded(),
    });
    // Without age_since_progress_ms, rule 4 doesn't fire; rule 2 STALLED requires an age;
    // agent has an active mission but no progress signal — this should NOT be WORKING
    expect(r.state).not.toBe("WORKING");
  });

  it("A-14 · recovery policy always returns an ALLOWED action", () => {
    for (const state of ["ALIVE", "WORKING", "WAITING", "STALLED", "FAILED", "DEGRADED"] as const) {
      for (let count = 0; count < 5; count++) {
        const r = decideRecoveryAction({
          current_state: state,
          previous_state: null,
          failed_history_count_24h: count,
        });
        expect(ALLOWED_RECOVERY_ACTIONS).toContain(r.action);
      }
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════
// PROPERTY
// ═════════════════════════════════════════════════════════════════════════

describe("WO-HQ-HEARTBEAT-01 · property", () => {
  afterEach(cleanCollections);

  it("P-1 · state derivation deterministic across 50 random-shape inputs", () => {
    for (let i = 0; i < 50; i++) {
      const inp = {
        liveness_signal: liveness((i % 2) === 0, (i * 7) % 400_000),
        progress_signal: progress((i % 3) === 0, (i * 5) % 300_000),
        scheduler_examined_workload: (i % 2) === 1,
        degraded_indicators: degraded(i % 6, (i % 4) === 0),
      };
      const a = deriveHeartbeatState(inp);
      const b = deriveHeartbeatState(inp);
      expect(a).toEqual(b);
    }
  });

  it("P-2 · all 6 states reachable", () => {
    const cases: Array<{ label: HeartbeatState; input: Parameters<typeof deriveHeartbeatState>[0] }> = [
      { label: "FAILED", input: { liveness_signal: liveness(false), progress_signal: progress(true, 5000), scheduler_examined_workload: true, degraded_indicators: degraded() } },
      { label: "STALLED", input: { liveness_signal: liveness(true, 1000), progress_signal: progress(true, 400_000), scheduler_examined_workload: true, degraded_indicators: degraded() } },
      { label: "DEGRADED", input: { liveness_signal: liveness(true, 1000), progress_signal: progress(true, 5000), scheduler_examined_workload: true, degraded_indicators: degraded(5, false) } },
      { label: "WORKING", input: { liveness_signal: liveness(true, 1000), progress_signal: progress(true, 5000), scheduler_examined_workload: true, degraded_indicators: degraded() } },
      { label: "ALIVE", input: { liveness_signal: liveness(true, 1000), progress_signal: progress(false), scheduler_examined_workload: false, degraded_indicators: degraded() } },
      { label: "WAITING", input: { liveness_signal: liveness(true, 1000), progress_signal: progress(false), scheduler_examined_workload: true, degraded_indicators: degraded() } },
    ];
    for (const c of cases) {
      expect(deriveHeartbeatState(c.input).state).toBe(c.label);
    }
  });

  it("P-3 · runHeartbeatTick observes all 14 agents and produces a tick result", async () => {
    const result = await runHeartbeatTick({ scheduler_examined_workload: false });
    expect(result.agents_observed).toBe(14);
    const total = result.by_state.ALIVE + result.by_state.WORKING + result.by_state.WAITING + result.by_state.STALLED + result.by_state.FAILED + result.by_state.DEGRADED;
    expect(total).toBe(14);
  }, 30_000);
});

// ── Helpers ─────────────────────────────────────────────────────────────

function makeHeartbeat(state: HeartbeatState): AgentHeartbeat {
  const base = {
    record_type: "NEX_HQ_AGENT_HEARTBEAT" as const,
    heartbeat_id: "hb-test",
    agent_id: "a-test",
    observed_at: "2026-09-13T00:00:00Z",
    liveness_signal: liveness(true, 1000),
    progress_signal: progress(true, 5000),
    scheduler_examined_workload: true,
    derived_state: state,
    derivation_reason: "test",
  };
  return { ...base, provenance_chain_hash: provenanceChainHash(base, []) };
}
