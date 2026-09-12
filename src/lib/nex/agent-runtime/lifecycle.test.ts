// src/lib/nex/agent-runtime/lifecycle.test.ts
// NEX Agent Runtime · lifecycle contracts (§37)

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { registerAgent, getPosition, setDesiredState, setFounderStopOverride, readFounderStopOverride, listPositions } from "./registry";
import { emitEvent, readRecentEvents } from "./event-bus";
import { auditCommand, readRecentCommands } from "./command-audit";
import { writeHeartbeat, readHeartbeat, clearHeartbeat, writePidRecord, readPidRecord, clearPidRecord, isPidAlive, heartbeatStalenessMs } from "./heartbeat";
import { deriveAgentStatus, heartbeatFreshnessCeilingMs } from "./runtime-state";
import { watchdogAssess } from "./watchdog";
import { mayProceedOffline, _forceInternetStateForTests, _resetInternetCacheForTests, cachedInternetState } from "./internet-check";
import { AGENT_RUNTIME_VERSION } from "./types";

// Isolate every test's on-disk state under a fresh temp dir.
function isolate(): void {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nex-agent-rt-"));
  process.env.NEX_AGENT_RUNTIME_DATA_ROOT = tmp;
  _resetInternetCacheForTests();
}

describe("registry · lifecycle", () => {
  beforeEach(() => isolate());
  it("register + read", () => {
    const p = registerAgent({ agent_id: "programmer", machinery: "programmer_agent", domain: "engineering", internet_requirement: "PREFERRED" });
    expect(p.agent_id).toBe("programmer");
    expect(p.desired_state).toBe("STOPPED");   // §35 default
    expect(getPosition("programmer")?.machinery).toBe("programmer_agent");
  });
  it("re-register is idempotent · preserves desired_state", () => {
    registerAgent({ agent_id: "programmer", machinery: "programmer_agent", domain: "engineering", internet_requirement: "PREFERRED" });
    setDesiredState("programmer", "RUNNING", "test_start");
    registerAgent({ agent_id: "programmer", machinery: "programmer_agent_v2", domain: "engineering", internet_requirement: "REQUIRED" });
    const p = getPosition("programmer");
    expect(p?.desired_state).toBe("RUNNING");    // preserved
    expect(p?.machinery).toBe("programmer_agent_v2");   // updated
  });
  it("setDesiredState records reason + timestamp", () => {
    registerAgent({ agent_id: "programmer", machinery: "programmer_agent", domain: "engineering", internet_requirement: "PREFERRED" });
    const before = getPosition("programmer")!;
    setDesiredState("programmer", "RUNNING", "test_reason_xyz");
    const after = getPosition("programmer")!;
    expect(after.desired_state).toBe("RUNNING");
    expect(after.last_desired_change_reason).toBe("test_reason_xyz");
    expect(after.last_desired_change_iso >= before.last_desired_change_iso).toBe(true);
  });
  it("setDesiredState throws on unknown agent", () => {
    expect(() => setDesiredState("programmer", "RUNNING", "x")).toThrow(/unknown_agent/);
  });
});

describe("event-bus · append + tail (§13)", () => {
  beforeEach(() => isolate());
  it("emits + reads", () => {
    emitEvent({ kind: "AGENT_STARTED", agent_id: "programmer", process_id: 1234, attributes: { run_id: "r1" } });
    emitEvent({ kind: "AGENT_HEARTBEAT", agent_id: "programmer", process_id: 1234, attributes: {} });
    const events = readRecentEvents(10);
    expect(events.length).toBe(2);
    expect(events[0].kind).toBe("AGENT_STARTED");
    expect(events[0].attributes.run_id).toBe("r1");
  });
  it("readRecentEvents limits", () => {
    for (let i = 0; i < 50; i++) emitEvent({ kind: "AGENT_HEARTBEAT", agent_id: "programmer", process_id: 1, attributes: { i } });
    expect(readRecentEvents(10).length).toBe(10);
  });
});

describe("command-audit · §28 no silent activation", () => {
  beforeEach(() => isolate());
  it("records authorized + rejected commands both", () => {
    auditCommand({
      founder_user_id: "u1", agent_id: "programmer", command: "START",
      authorization: "AUTHORIZED", authorization_reason: "founder_ok",
      previous_desired_state: "STOPPED", new_desired_state: "RUNNING",
      result: "OK", reason: "spawned:pid=1234",
    });
    auditCommand({
      founder_user_id: null, agent_id: "programmer", command: "START",
      authorization: "REJECTED", authorization_reason: "no_founder_session",
      previous_desired_state: null, new_desired_state: null,
      result: "REJECTED", reason: "attempted_bypass",
    });
    const cmds = readRecentCommands(10);
    expect(cmds.length).toBe(2);
    expect(cmds[0].authorization).toBe("AUTHORIZED");
    expect(cmds[1].authorization).toBe("REJECTED");
    expect(cmds[1].founder_user_id).toBeNull();
  });
});

describe("heartbeat + PID · §14 independent observability", () => {
  beforeEach(() => isolate());
  it("write + read heartbeat", () => {
    writeHeartbeat({
      agent_id: "programmer", run_id: "r1", process_id: 42,
      timestamp_iso: new Date().toISOString(), status: "RUNNING",
      current_task: "observing", last_success_iso: null, last_failure_iso: null,
      internet_state: "ONLINE", runtime_version: AGENT_RUNTIME_VERSION,
    });
    const hb = readHeartbeat("programmer");
    expect(hb).not.toBeNull();
    expect(hb!.process_id).toBe(42);
    expect(hb!.current_task).toBe("observing");
  });
  it("clearHeartbeat removes file", () => {
    writeHeartbeat({
      agent_id: "programmer", run_id: "r1", process_id: 42,
      timestamp_iso: new Date().toISOString(), status: "RUNNING",
      current_task: null, last_success_iso: null, last_failure_iso: null,
      internet_state: "ONLINE", runtime_version: AGENT_RUNTIME_VERSION,
    });
    clearHeartbeat("programmer");
    expect(readHeartbeat("programmer")).toBeNull();
  });
  it("staleness computes correctly", () => {
    const t = Date.parse("2026-09-06T00:00:00.000Z");
    const hb = { agent_id: "programmer", run_id: "r", process_id: 1, timestamp_iso: "2026-09-06T00:00:00.000Z", status: "RUNNING" as const, current_task: null, last_success_iso: null, last_failure_iso: null, internet_state: "ONLINE" as const, runtime_version: AGENT_RUNTIME_VERSION };
    expect(heartbeatStalenessMs(hb, t + 5000)).toBe(5000);
  });
  it("PID record write/read/clear", () => {
    writePidRecord({ agent_id: "programmer", pid: 999, started_at_iso: new Date().toISOString(), runtime_version: "0.1.0", command_line: "test" });
    expect(readPidRecord("programmer")?.pid).toBe(999);
    clearPidRecord("programmer");
    expect(readPidRecord("programmer")).toBeNull();
  });
  it("isPidAlive: 0/negative rejected", () => {
    expect(isPidAlive(0)).toBe(false);
    expect(isPidAlive(-1)).toBe(false);
  });
  it("isPidAlive: current process PID is alive", () => {
    expect(isPidAlive(process.pid)).toBe(true);
  });
  it("isPidAlive: extremely high PID is dead", () => {
    expect(isPidAlive(999_999_999)).toBe(false);
  });
});

describe("runtime-state derivation · §1 evidence-based", () => {
  beforeEach(() => isolate());
  it("desired STOPPED + no process → STOPPED", () => {
    const p = registerAgent({ agent_id: "programmer", machinery: "programmer_agent", domain: "engineering", internet_requirement: "PREFERRED" });
    const s = deriveAgentStatus(p, Date.now());
    expect(s.runtime_state).toBe("STOPPED");
    expect(s.process_id).toBeNull();
  });
  it("desired RUNNING + no process → STOPPED (not fabricated RUNNING)", () => {
    const p = registerAgent({ agent_id: "programmer", machinery: "programmer_agent", domain: "engineering", internet_requirement: "PREFERRED" });
    setDesiredState("programmer", "RUNNING", "test");
    const s = deriveAgentStatus(getPosition("programmer")!, Date.now());
    expect(s.runtime_state).toBe("STOPPED");
  });
  it("desired RUNNING + PID alive + fresh heartbeat → RUNNING", () => {
    const p = registerAgent({ agent_id: "programmer", machinery: "programmer_agent", domain: "engineering", internet_requirement: "PREFERRED" });
    setDesiredState("programmer", "RUNNING", "test");
    writePidRecord({ agent_id: "programmer", pid: process.pid, started_at_iso: new Date().toISOString(), runtime_version: "0.1.0", command_line: "test" });
    writeHeartbeat({
      agent_id: "programmer", run_id: "r", process_id: process.pid,
      timestamp_iso: new Date().toISOString(), status: "RUNNING",
      current_task: null, last_success_iso: null, last_failure_iso: null,
      internet_state: "ONLINE", runtime_version: AGENT_RUNTIME_VERSION,
    });
    const s = deriveAgentStatus(getPosition("programmer")!, Date.now());
    expect(s.runtime_state).toBe("RUNNING");
    expect(s.process_id).toBe(process.pid);
  });
  it("desired RUNNING + PID alive + stale heartbeat → DEGRADED (not RUNNING)", () => {
    const p = registerAgent({ agent_id: "programmer", machinery: "programmer_agent", domain: "engineering", internet_requirement: "PREFERRED" });
    setDesiredState("programmer", "RUNNING", "test");
    writePidRecord({ agent_id: "programmer", pid: process.pid, started_at_iso: new Date().toISOString(), runtime_version: "0.1.0", command_line: "test" });
    const staleTs = new Date(Date.now() - 60_000).toISOString();
    writeHeartbeat({
      agent_id: "programmer", run_id: "r", process_id: process.pid,
      timestamp_iso: staleTs, status: "RUNNING",
      current_task: null, last_success_iso: null, last_failure_iso: null,
      internet_state: "ONLINE", runtime_version: AGENT_RUNTIME_VERSION,
    });
    const s = deriveAgentStatus(getPosition("programmer")!, Date.now());
    expect(s.runtime_state).toBe("DEGRADED");
  });
  it("desired RUNNING + PID dead + heartbeat file exists → CRASHED", () => {
    const p = registerAgent({ agent_id: "programmer", machinery: "programmer_agent", domain: "engineering", internet_requirement: "PREFERRED" });
    setDesiredState("programmer", "RUNNING", "test");
    writePidRecord({ agent_id: "programmer", pid: 999_999_999, started_at_iso: new Date().toISOString(), runtime_version: "0.1.0", command_line: "test" });
    writeHeartbeat({
      agent_id: "programmer", run_id: "r", process_id: 999_999_999,
      timestamp_iso: new Date().toISOString(), status: "RUNNING",
      current_task: null, last_success_iso: null, last_failure_iso: null,
      internet_state: "ONLINE", runtime_version: AGENT_RUNTIME_VERSION,
    });
    const s = deriveAgentStatus(getPosition("programmer")!, Date.now());
    expect(s.runtime_state).toBe("CRASHED");
  });
  it("desired STOPPED + PID alive → STOPPING", () => {
    const p = registerAgent({ agent_id: "programmer", machinery: "programmer_agent", domain: "engineering", internet_requirement: "PREFERRED" });
    // desired remains STOPPED
    writePidRecord({ agent_id: "programmer", pid: process.pid, started_at_iso: new Date().toISOString(), runtime_version: "0.1.0", command_line: "test" });
    writeHeartbeat({
      agent_id: "programmer", run_id: "r", process_id: process.pid,
      timestamp_iso: new Date().toISOString(), status: "STOPPING",
      current_task: null, last_success_iso: null, last_failure_iso: null,
      internet_state: "ONLINE", runtime_version: AGENT_RUNTIME_VERSION,
    });
    const s = deriveAgentStatus(getPosition("programmer")!, Date.now());
    expect(s.runtime_state).toBe("STOPPING");
  });
  it("BLOCKED authorization → BLOCKED runtime state", () => {
    const p = registerAgent({
      agent_id: "programmer", machinery: "programmer_agent", domain: "engineering",
      internet_requirement: "PREFERRED", authorization_state: "PENDING_AUTHORIZATION",
    });
    setDesiredState("programmer", "RUNNING", "test");
    const s = deriveAgentStatus(getPosition("programmer")!, Date.now());
    expect(s.runtime_state).toBe("BLOCKED");
  });
});

describe("watchdog · §16 bounded restart · §17 founder override wins", () => {
  beforeEach(() => isolate());
  it("desired STOPPED → no_op", () => {
    const p = registerAgent({ agent_id: "programmer", machinery: "programmer_agent", domain: "engineering", internet_requirement: "PREFERRED" });
    const status = deriveAgentStatus(getPosition("programmer")!, Date.now());
    const dec = watchdogAssess({ position: p, status, nowMs: Date.now() });
    expect(dec.recommendation.action).toBe("no_op");
  });
  it("founder STOP override wins over desired RUNNING", () => {
    const p = registerAgent({ agent_id: "programmer", machinery: "programmer_agent", domain: "engineering", internet_requirement: "PREFERRED" });
    setDesiredState("programmer", "RUNNING", "test");
    setFounderStopOverride(true, "u1", "stop_all");
    const status = deriveAgentStatus(getPosition("programmer")!, Date.now());
    const dec = watchdogAssess({ position: getPosition("programmer")!, status, nowMs: Date.now() });
    expect(dec.recommendation.action).toBe("no_op");
    expect(dec.recommendation.reason).toBe("founder_stop_override_active");
  });
  it("desired RUNNING + STOPPED → recommend start", () => {
    const p = registerAgent({ agent_id: "programmer", machinery: "programmer_agent", domain: "engineering", internet_requirement: "PREFERRED" });
    setDesiredState("programmer", "RUNNING", "test");
    const status = deriveAgentStatus(getPosition("programmer")!, Date.now());
    const dec = watchdogAssess({ position: getPosition("programmer")!, status, nowMs: Date.now() });
    expect(dec.recommendation.action).toBe("start");
  });
  it("crash storm → stop_giveup", () => {
    const p = registerAgent({ agent_id: "programmer", machinery: "programmer_agent", domain: "engineering", internet_requirement: "PREFERRED" });
    setDesiredState("programmer", "RUNNING", "test");
    // Emit crashes to push past max_consecutive_crashes (default 5).
    for (let i = 0; i < 6; i++) {
      emitEvent({ kind: "AGENT_CRASHED", agent_id: "programmer", process_id: 999_999_999, attributes: {} });
    }
    // Simulate a CRASHED state (PID dead + heartbeat exists)
    writePidRecord({ agent_id: "programmer", pid: 999_999_999, started_at_iso: new Date().toISOString(), runtime_version: "0.1.0", command_line: "test" });
    writeHeartbeat({
      agent_id: "programmer", run_id: "r", process_id: 999_999_999,
      timestamp_iso: new Date().toISOString(), status: "RUNNING",
      current_task: null, last_success_iso: null, last_failure_iso: null,
      internet_state: "ONLINE", runtime_version: AGENT_RUNTIME_VERSION,
    });
    const status = deriveAgentStatus(getPosition("programmer")!, Date.now());
    const dec = watchdogAssess({ position: getPosition("programmer")!, status, nowMs: Date.now() });
    expect(dec.recommendation.action).toBe("stop_giveup");
    expect(dec.consecutive_crashes).toBeGreaterThanOrEqual(5);
  });
  it("restart-storm circuit breaker fires at max_restarts_per_hour", () => {
    const p = registerAgent({ agent_id: "programmer", machinery: "programmer_agent", domain: "engineering", internet_requirement: "PREFERRED" });
    setDesiredState("programmer", "RUNNING", "test");
    // Emit 13 restarts in the last hour (default cap: 12)
    for (let i = 0; i < 13; i++) {
      emitEvent({ kind: "AGENT_RESTARTED", agent_id: "programmer", process_id: 100 + i, attributes: {} });
    }
    const status = deriveAgentStatus(getPosition("programmer")!, Date.now());
    const dec = watchdogAssess({ position: getPosition("programmer")!, status, nowMs: Date.now() });
    expect(dec.recommendation.action).toBe("stop_giveup");
    expect(dec.recommendation.reason).toMatch(/restart_storm/);
  });
  it("unauthorized authorization_state → no_op", () => {
    const p = registerAgent({
      agent_id: "programmer", machinery: "programmer_agent", domain: "engineering",
      internet_requirement: "PREFERRED", authorization_state: "REVOKED",
    });
    setDesiredState("programmer", "RUNNING", "test");
    const status = deriveAgentStatus(getPosition("programmer")!, Date.now());
    const dec = watchdogAssess({ position: getPosition("programmer")!, status, nowMs: Date.now() });
    expect(dec.recommendation.action).toBe("no_op");
    expect(dec.recommendation.reason).toMatch(/unauthorized/);
  });
});

describe("internet-check + work classification · §9 §10", () => {
  beforeEach(() => isolate());
  it("LOCAL_SAFE runs regardless of internet state", () => {
    expect(mayProceedOffline("LOCAL_SAFE", "ONLINE")).toBe(true);
    expect(mayProceedOffline("LOCAL_SAFE", "OFFLINE")).toBe(true);
    expect(mayProceedOffline("LOCAL_SAFE", "UNKNOWN")).toBe(true);
  });
  it("NETWORK_REQUIRED requires ONLINE", () => {
    expect(mayProceedOffline("NETWORK_REQUIRED", "ONLINE")).toBe(true);
    expect(mayProceedOffline("NETWORK_REQUIRED", "OFFLINE")).toBe(false);
    expect(mayProceedOffline("NETWORK_REQUIRED", "UNKNOWN")).toBe(false);
  });
  it("EXTERNAL_DEPENDENCY_REQUIRED requires ONLINE", () => {
    expect(mayProceedOffline("EXTERNAL_DEPENDENCY_REQUIRED", "OFFLINE")).toBe(false);
  });
  it("forceInternetStateForTests → cachedInternetState reflects it", () => {
    _forceInternetStateForTests("OFFLINE", "test");
    expect(cachedInternetState().state).toBe("OFFLINE");
    _forceInternetStateForTests("ONLINE", "test");
    expect(cachedInternetState().state).toBe("ONLINE");
  });
});

describe("founder stop override · §17 sticky", () => {
  beforeEach(() => isolate());
  it("default: not active", () => {
    expect(readFounderStopOverride().active).toBe(false);
  });
  it("set + read + release", () => {
    setFounderStopOverride(true, "u1", "stop_all");
    expect(readFounderStopOverride().active).toBe(true);
    expect(readFounderStopOverride().set_by_user_id).toBe("u1");
    setFounderStopOverride(false, "u1", "start_all");
    expect(readFounderStopOverride().active).toBe(false);
  });
});

describe("no cross-agent self-activation · §29 §30", () => {
  beforeEach(() => isolate());
  it("registerAgent can only add positions the caller names — it cannot activate a different one on behalf of another", () => {
    // §29 enforcement is really at the API + control-plane layer (agent-side code never calls startAgent).
    // Structural check: registerAgent+setDesiredState is a two-step operation that requires the caller to know
    // the exact target agent_id. There is no "startTheOtherAgent()" helper by design.
    registerAgent({ agent_id: "programmer", machinery: "programmer_agent", domain: "engineering", internet_requirement: "PREFERRED" });
    // programmer trying to activate accommodation must NOT be a supported operation:
    expect(() => setDesiredState("accommodation", "RUNNING", "attempted_self_activation")).toThrow(/unknown_agent/);
  });
});

describe("persistence · state survives module reload", () => {
  beforeEach(() => isolate());
  it("registry survives simulated reload (read after write)", () => {
    registerAgent({ agent_id: "programmer", machinery: "programmer_agent", domain: "engineering", internet_requirement: "PREFERRED" });
    setDesiredState("programmer", "RUNNING", "persist_test");
    // Simulate reload: registry re-reads the file
    const list = listPositions();
    expect(list.find((p) => p.agent_id === "programmer")?.desired_state).toBe("RUNNING");
  });
  it("events survive across reads", () => {
    emitEvent({ kind: "AGENT_STARTED", agent_id: "programmer", process_id: 1, attributes: {} });
    // Simulate another reader
    const readAgain = readRecentEvents(10);
    expect(readAgain.length).toBe(1);
    expect(readAgain[0].kind).toBe("AGENT_STARTED");
  });
});
