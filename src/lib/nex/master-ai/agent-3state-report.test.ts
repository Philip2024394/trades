// src/lib/nex/master-ai/agent-3state-report.test.ts
//
// Contract tests for 3-state agent report (observation · runtime · capability)
// Founder BEGIN 2026-09-08

import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let TMP_ROOT: string;

beforeEach(() => {
  TMP_ROOT = mkdtempSync(path.join(tmpdir(), "nex-3state-"));
  process.env.NEX_MASTER_AI_DATA_ROOT = TMP_ROOT;
  process.env.NEX_AGENT_RUNTIME_DATA_ROOT = path.join(TMP_ROOT, "runtime");
  mkdirSync(process.env.NEX_AGENT_RUNTIME_DATA_ROOT, { recursive: true });
});

async function loadRegistry() { return await import("./agent-registry"); }
async function load3State() { return await import("./agent-3state-report"); }

describe("3-state report · observation × runtime × capability", () => {

  it("invisible + STOPPED_HONEST + unknown for an agent that is not registered anywhere", async () => {
    const { reportAgent3State } = await load3State();
    const r = reportAgent3State("agent_that_does_not_exist");
    expect(r.observation_state).toBe("invisible");
    expect(r.registry).toBeNull();
    expect(r.runtime_state).toBe("STOPPED_HONEST");
    expect(r.capability_state).toBe("unknown");
    expect(r.capability_notes[0]).toContain("no capability spec");
  });

  it("visible + STOPPED_HONEST + has_deterministic_benchmark for a seeded STOPPED-registered agent (food)", async () => {
    const { ensureRuntimeAgentsRegistered } = await loadRegistry();
    ensureRuntimeAgentsRegistered({ registered_by: "test" });
    const { reportAgent3State } = await load3State();
    const r = reportAgent3State("food");
    expect(r.observation_state).toBe("visible");
    expect(r.runtime_state).toBe("STOPPED_HONEST");           // no heartbeat file
    expect(r.capability_state).toBe("has_deterministic_benchmark");
    expect(r.registry?.notes.toLowerCase()).toContain("stopped-registered");
  });

  it("visible + RUNNING + has_deterministic_benchmark when a fresh heartbeat file exists", async () => {
    const { ensureRuntimeAgentsRegistered } = await loadRegistry();
    ensureRuntimeAgentsRegistered({ registered_by: "test" });
    const runtimeDir = process.env.NEX_AGENT_RUNTIME_DATA_ROOT!;
    const now = new Date().toISOString();
    writeFileSync(
      path.join(runtimeDir, "heartbeat-programmer.json"),
      JSON.stringify({ agent_id: "programmer", timestamp_iso: now, status: "RUNNING", current_task: "idle" }),
      "utf8",
    );
    const { reportAgent3State } = await load3State();
    const r = reportAgent3State("programmer");
    expect(r.observation_state).toBe("visible");
    expect(r.runtime_state).toBe("RUNNING");
    expect(r.capability_state).toBe("has_deterministic_benchmark");
    expect(r.runtime_freshness_ms).not.toBeNull();
    expect(r.runtime_freshness_ms!).toBeGreaterThanOrEqual(0);
    expect(r.runtime_freshness_ms!).toBeLessThan(2000);
  });

  it("STOPPED_STALE when heartbeat is older than 60s", async () => {
    const { ensureRuntimeAgentsRegistered } = await loadRegistry();
    ensureRuntimeAgentsRegistered({ registered_by: "test" });
    const runtimeDir = process.env.NEX_AGENT_RUNTIME_DATA_ROOT!;
    const stale = new Date(Date.now() - 5 * 60 * 1000).toISOString();  // 5 min ago
    writeFileSync(
      path.join(runtimeDir, "heartbeat-accommodation.json"),
      JSON.stringify({ agent_id: "accommodation", timestamp_iso: stale, status: "RUNNING" }),
      "utf8",
    );
    const { reportAgent3State } = await load3State();
    const r = reportAgent3State("accommodation");
    expect(r.runtime_state).toBe("STOPPED_STALE");
  });

  it("STARTING when heartbeat status field says STARTING", async () => {
    const { ensureRuntimeAgentsRegistered } = await loadRegistry();
    ensureRuntimeAgentsRegistered({ registered_by: "test" });
    const runtimeDir = process.env.NEX_AGENT_RUNTIME_DATA_ROOT!;
    const now = new Date().toISOString();
    writeFileSync(
      path.join(runtimeDir, "heartbeat-speaking.json"),
      JSON.stringify({ agent_id: "speaking", timestamp_iso: now, status: "STARTING" }),
      "utf8",
    );
    const { reportAgent3State } = await load3State();
    const r = reportAgent3State("speaking");
    expect(r.runtime_state).toBe("STARTING");
  });

  it("UNKNOWN when heartbeat file exists but is malformed JSON", async () => {
    const { ensureRuntimeAgentsRegistered } = await loadRegistry();
    ensureRuntimeAgentsRegistered({ registered_by: "test" });
    const runtimeDir = process.env.NEX_AGENT_RUNTIME_DATA_ROOT!;
    writeFileSync(path.join(runtimeDir, "heartbeat-vision.json"), "not-valid-json", "utf8");
    const { reportAgent3State } = await load3State();
    const r = reportAgent3State("vision");
    expect(r.runtime_state).toBe("UNKNOWN");
  });

  it("reportAllRegisteredAgents3State covers every seeded agent in deterministic sorted order", async () => {
    const { ensureRuntimeAgentsRegistered } = await loadRegistry();
    ensureRuntimeAgentsRegistered({ registered_by: "test" });
    const { reportAllRegisteredAgents3State } = await load3State();
    const reports = reportAllRegisteredAgents3State();
    const ids = reports.map((r) => r.agent_id);
    // Sorted alphabetically
    const expected = [...ids].sort();
    expect(ids).toEqual(expected);
    // Every seeded agent appears
    for (const expectedId of ["accommodation", "business", "construction", "food", "healthcare", "master_ai", "programmer", "speaking", "transport", "travel", "vision"]) {
      expect(ids).toContain(expectedId);
    }
  });

  it("no agent claims has_measured_l4_evidence yet (V.5.4.3 not complete)", async () => {
    const { ensureRuntimeAgentsRegistered } = await loadRegistry();
    ensureRuntimeAgentsRegistered({ registered_by: "test" });
    const { reportAllRegisteredAgents3State } = await load3State();
    const reports = reportAllRegisteredAgents3State();
    const withL4 = reports.filter((r) => r.capability_state === "has_measured_l4_evidence");
    // Honest: no candidate has produced a successful RunProvenance yet ·
    // V.5.4.3-002 still running as of this test authoring. When Founder promotes,
    // update CAPABILITY_MAP + expect a specific agent here.
    expect(withL4.length).toBe(0);
  });

  it("no agent claims has_llm_augmented yet (Phase-4 L4-blocked)", async () => {
    const { ensureRuntimeAgentsRegistered } = await loadRegistry();
    ensureRuntimeAgentsRegistered({ registered_by: "test" });
    const { reportAllRegisteredAgents3State } = await load3State();
    const reports = reportAllRegisteredAgents3State();
    const withLLM = reports.filter((r) => r.capability_state === "has_llm_augmented");
    expect(withLLM.length).toBe(0);
  });

  it("summarize3StateReport counts match the doctrine (11 registered · 0 running by default · 0 L4-measured)", async () => {
    const { ensureRuntimeAgentsRegistered } = await loadRegistry();
    ensureRuntimeAgentsRegistered({ registered_by: "test" });
    const { reportAllRegisteredAgents3State, summarize3StateReport } = await load3State();
    const summary = summarize3StateReport(reportAllRegisteredAgents3State());
    expect(summary.total_agents).toBe(11);
    expect(summary.observable).toBe(11);
    expect(summary.running).toBe(0);
    expect(summary.stopped_honest).toBe(11);
    expect(summary.with_deterministic_benchmark).toBe(11);
    expect(summary.with_llm_augmented).toBe(0);
    expect(summary.with_measured_l4_evidence).toBe(0);
    expect(summary.no_worker).toBe(0);
  });

  it("does not modify any file (pure derivation)", async () => {
    const { ensureRuntimeAgentsRegistered, listAgents } = await loadRegistry();
    ensureRuntimeAgentsRegistered({ registered_by: "test" });
    const before = listAgents().length;
    const { reportAllRegisteredAgents3State } = await load3State();
    reportAllRegisteredAgents3State();
    reportAllRegisteredAgents3State();
    reportAllRegisteredAgents3State();
    const after = listAgents().length;
    expect(after).toBe(before);
  });
});
