// WO-NEX-RUNTIME-01 · lifecycle state derivation tests.
//
// Founder-locked 2026-09-13:
//   "Heartbeat proves liveness, not useful work."
//   WORKING requires mission + fresh heartbeat + progress + evidence.
//   No heartbeat-only green.

import { describe, it, expect } from "vitest";
import { deriveExternalState, canTransition } from "../lifecycle";
import type { AgentRuntimeHeartbeat } from "../types";

function fixture(overrides: Partial<AgentRuntimeHeartbeat>): AgentRuntimeHeartbeat {
  return {
    record_type: "NEX_AGENT_RUNTIME_HEARTBEAT",
    heartbeat_id: "hb-fixture",
    agent_id: "test",
    instance_id: "inst-1",
    pid: 1000,
    emitted_at: new Date().toISOString(),
    mission_id: null,
    progress_counter: 0,
    evidence_refs: [],
    lifecycle_state: "ALIVE_IDLE",
    signature_hex: "00",
    ...overrides,
  };
}

const NOW = Date.now();
const INTERVAL = 5_000;

describe("WO-NEX-RUNTIME-01 · state derivation · dual-signal doctrine", () => {
  it("L-1 · null heartbeat → UNVERIFIED", () => {
    const r = deriveExternalState({ newest_heartbeat: null, now_ms: NOW, heartbeat_interval_ms: INTERVAL });
    expect(r.state).toBe("UNVERIFIED");
  });

  it("L-2 · fresh heartbeat + no mission → ALIVE_IDLE (not WORKING)", () => {
    const hb = fixture({ emitted_at: new Date(NOW - 1_000).toISOString(), mission_id: null });
    const r = deriveExternalState({ newest_heartbeat: hb, now_ms: NOW, heartbeat_interval_ms: INTERVAL });
    expect(r.state).toBe("ALIVE_IDLE");
    expect(r.reason).toMatch(/liveness only/);
  });

  it("L-3 · fresh heartbeat + mission + no progress → MISSION_ASSIGNED (not WORKING)", () => {
    const hb = fixture({
      emitted_at: new Date(NOW - 1_000).toISOString(),
      mission_id: "mission-1", progress_counter: 0, evidence_refs: [],
    });
    const r = deriveExternalState({ newest_heartbeat: hb, now_ms: NOW, heartbeat_interval_ms: INTERVAL });
    expect(r.state).toBe("MISSION_ASSIGNED");
    expect(r.state).not.toBe("WORKING");
  });

  it("L-4 · fresh heartbeat + mission + progress + evidence → WORKING (all four)", () => {
    const hb = fixture({
      emitted_at: new Date(NOW - 1_000).toISOString(),
      mission_id: "mission-1", progress_counter: 3, evidence_refs: ["ev-1"],
    });
    const r = deriveExternalState({ newest_heartbeat: hb, now_ms: NOW, heartbeat_interval_ms: INTERVAL });
    expect(r.state).toBe("WORKING");
    expect(r.reason).toMatch(/all four/);
  });

  it("L-5 · fresh heartbeat + mission + progress but NO evidence → still MISSION_ASSIGNED (not WORKING)", () => {
    const hb = fixture({
      emitted_at: new Date(NOW - 1_000).toISOString(),
      mission_id: "mission-1", progress_counter: 5, evidence_refs: [],
    });
    const r = deriveExternalState({ newest_heartbeat: hb, now_ms: NOW, heartbeat_interval_ms: INTERVAL });
    expect(r.state).toBe("MISSION_ASSIGNED");
    expect(r.reason).toMatch(/no persisted evidence/);
  });

  it("L-6 · stale heartbeat → FAILED", () => {
    const hb = fixture({
      emitted_at: new Date(NOW - INTERVAL * 10).toISOString(),
    });
    const r = deriveExternalState({ newest_heartbeat: hb, now_ms: NOW, heartbeat_interval_ms: INTERVAL });
    expect(r.state).toBe("FAILED");
    expect(r.reason).toMatch(/stale/);
  });

  it("L-7 · agent-reported STOPPED → STOPPED", () => {
    const hb = fixture({ lifecycle_state: "STOPPED", emitted_at: new Date(NOW - 1_000).toISOString() });
    const r = deriveExternalState({ newest_heartbeat: hb, now_ms: NOW, heartbeat_interval_ms: INTERVAL });
    expect(r.state).toBe("STOPPED");
  });

  it("L-8 · agent-reported FAILED → FAILED (even with fresh heartbeat)", () => {
    const hb = fixture({ lifecycle_state: "FAILED", emitted_at: new Date(NOW - 1_000).toISOString() });
    const r = deriveExternalState({ newest_heartbeat: hb, now_ms: NOW, heartbeat_interval_ms: INTERVAL });
    expect(r.state).toBe("FAILED");
  });

  it("L-9 · agent-reported MISSION_STALLED · surfaces as MISSION_STALLED", () => {
    const hb = fixture({
      lifecycle_state: "MISSION_STALLED",
      emitted_at: new Date(NOW - 1_000).toISOString(),
      mission_id: "mission-1", progress_counter: 0,
    });
    const r = deriveExternalState({ newest_heartbeat: hb, now_ms: NOW, heartbeat_interval_ms: INTERVAL });
    expect(r.state).toBe("MISSION_STALLED");
  });

  it("L-10 · founder anti-doctrine · fresh heartbeat every 5s but no work never becomes WORKING", () => {
    // 120 heartbeats spanning 10 minutes · none has a mission · none should be WORKING
    // The newest ones are fresh; older ones are stale (FAILED). Neither state is WORKING.
    for (let i = 0; i < 120; i++) {
      const hb = fixture({
        emitted_at: new Date(NOW - (120 - i) * INTERVAL + 100).toISOString(),
        mission_id: null,
      });
      const r = deriveExternalState({ newest_heartbeat: hb, now_ms: NOW, heartbeat_interval_ms: INTERVAL });
      expect(r.state).not.toBe("WORKING");
    }
    // Freshest heartbeat with no mission → ALIVE_IDLE · not WORKING
    const fresh = fixture({ emitted_at: new Date(NOW - 500).toISOString(), mission_id: null });
    const rFresh = deriveExternalState({ newest_heartbeat: fresh, now_ms: NOW, heartbeat_interval_ms: INTERVAL });
    expect(rFresh.state).toBe("ALIVE_IDLE");
    expect(rFresh.state).not.toBe("WORKING");
    // Fresh heartbeat WITH mission but no progress → MISSION_ASSIGNED · still not WORKING
    const withMission = fixture({ emitted_at: new Date(NOW - 500).toISOString(), mission_id: "m-1", progress_counter: 0, evidence_refs: [] });
    const rMission = deriveExternalState({ newest_heartbeat: withMission, now_ms: NOW, heartbeat_interval_ms: INTERVAL });
    expect(rMission.state).toBe("MISSION_ASSIGNED");
    expect(rMission.state).not.toBe("WORKING");
    // Progress WITHOUT evidence still not WORKING
    const partial = fixture({ emitted_at: new Date(NOW - 500).toISOString(), mission_id: "m-1", progress_counter: 5, evidence_refs: [] });
    const rPartial = deriveExternalState({ newest_heartbeat: partial, now_ms: NOW, heartbeat_interval_ms: INTERVAL });
    expect(rPartial.state).not.toBe("WORKING");
    // Only all four together produce WORKING
    const full = fixture({ emitted_at: new Date(NOW - 500).toISOString(), mission_id: "m-1", progress_counter: 5, evidence_refs: ["e-1"] });
    const rFull = deriveExternalState({ newest_heartbeat: full, now_ms: NOW, heartbeat_interval_ms: INTERVAL });
    expect(rFull.state).toBe("WORKING");
  });
});

describe("WO-NEX-RUNTIME-01 · lifecycle transitions", () => {
  it("T-1 · INITIALISING → ALIVE_IDLE allowed", () => {
    expect(canTransition("INITIALISING", "ALIVE_IDLE")).toBe(true);
  });
  it("T-2 · INITIALISING → WORKING NOT allowed (must pass ALIVE_IDLE + MISSION_ASSIGNED)", () => {
    expect(canTransition("INITIALISING", "WORKING")).toBe(false);
  });
  it("T-3 · STOPPED is terminal · no transitions out", () => {
    expect(canTransition("STOPPED", "ALIVE_IDLE")).toBe(false);
    expect(canTransition("STOPPED", "MISSION_ASSIGNED")).toBe(false);
  });
  it("T-4 · MISSION_ASSIGNED → WORKING allowed", () => {
    expect(canTransition("MISSION_ASSIGNED", "WORKING")).toBe(true);
  });
});
