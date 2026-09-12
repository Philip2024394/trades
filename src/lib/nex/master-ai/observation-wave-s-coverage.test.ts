// src/lib/nex/master-ai/observation-wave-s-coverage.test.ts
//
// Master AI observation coverage · Vision/Travel/Business (WAVE-S specialists)
// Founder-authorized concurrent work · 2026-09-08
//
// Proves:
//   · agent-registry seeds now include speaking + vision + travel + business
//   · endurance-report scans all 7 agent_ids · not only the historical 4
//   · WORK_FAILED events emitted with agent_id=vision/travel/business are
//     picked up by aggregateFailurePatterns · nothing structural blocks them

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, existsSync, appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Isolate master-ai state to a fresh tmp dir per test
let TMP_ROOT: string;

beforeEach(() => {
  TMP_ROOT = mkdtempSync(path.join(tmpdir(), "nex-obs-wave-s-"));
  process.env.NEX_MASTER_AI_DATA_ROOT = TMP_ROOT;
  process.env.NEX_AGENT_RUNTIME_DATA_ROOT = path.join(TMP_ROOT, "runtime");
  mkdirSync(process.env.NEX_AGENT_RUNTIME_DATA_ROOT, { recursive: true });
});

afterEach(() => {
  // Best-effort cleanup · never fail the test on cleanup errors
});

// Dynamic imports so env-vars set in beforeEach take effect
async function loadRegistry() {
  return await import("./agent-registry");
}
async function loadFailure() {
  return await import("./failure-intelligence");
}
async function loadEndurance() {
  return await import("./endurance-report");
}

describe("Master AI observation · WAVE-S coverage · 2026-09-08", () => {

  it("agent-registry seeds now include all 11 agents (programmer/accommodation/master_ai/speaking/vision/travel/business/food/construction/healthcare/transport)", async () => {
    const { ensureRuntimeAgentsRegistered, listAgents } = await loadRegistry();
    ensureRuntimeAgentsRegistered({ registered_by: "test" });
    const ids = new Set(listAgents().map((a) => a.agent_id));
    expect(ids.has("programmer")).toBe(true);
    expect(ids.has("accommodation")).toBe(true);
    expect(ids.has("master_ai")).toBe(true);
    expect(ids.has("speaking")).toBe(true);
    expect(ids.has("vision")).toBe(true);
    expect(ids.has("travel")).toBe(true);
    expect(ids.has("business")).toBe(true);
    expect(ids.has("food")).toBe(true);
    expect(ids.has("construction")).toBe(true);
    expect(ids.has("healthcare")).toBe(true);
    expect(ids.has("transport")).toBe(true);
  });

  it("agent-registry seeding is idempotent (second call is no-op when identity fields match)", async () => {
    const { ensureRuntimeAgentsRegistered, listAgents } = await loadRegistry();
    ensureRuntimeAgentsRegistered({ registered_by: "test" });
    const firstCount = listAgents().length;
    ensureRuntimeAgentsRegistered({ registered_by: "test" });
    const secondCount = listAgents().length;
    expect(secondCount).toBe(firstCount); // no duplicate registrations
  });

  it("STOPPED-registered agents (vision/travel/business/food/construction/healthcare/transport) are AUTHORIZED but lifecycle_state=REGISTERED (not ACTIVE)", async () => {
    const { ensureRuntimeAgentsRegistered, getAgent } = await loadRegistry();
    ensureRuntimeAgentsRegistered({ registered_by: "test" });
    for (const id of ["vision", "travel", "business", "food", "construction", "healthcare", "transport"] as const) {
      const a = getAgent(id);
      expect(a).toBeDefined();
      expect(a!.authorization_state).toBe("AUTHORIZED");
      expect(a!.lifecycle_state).toBe("REGISTERED");
      expect(a!.notes.toLowerCase()).toContain("stopped-registered");
    }
  });

  it("aggregateFailurePatterns picks up WORK_FAILED events emitted by vision/travel/business", async () => {
    const { aggregateFailurePatterns, listCurrentPatterns } = await loadFailure();
    const eventsPath = path.join(process.env.NEX_AGENT_RUNTIME_DATA_ROOT!, "events.jsonl");
    const now = new Date().toISOString();
    const events = [
      { kind: "WORK_FAILED", agent_id: "vision", timestamp_iso: now, attributes: { work: "vision_self_benchmark", reason: "vision_benchmark_failure:missing_image_shape" } },
      { kind: "WORK_FAILED", agent_id: "travel", timestamp_iso: now, attributes: { work: "travel_self_benchmark", reason: "travel_benchmark_failure:missing_locale" } },
      { kind: "WORK_FAILED", agent_id: "business", timestamp_iso: now, attributes: { work: "business_self_benchmark", reason: "business_benchmark_failure:missing_context" } },
    ];
    writeFileSync(eventsPath, events.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");

    const patterns = aggregateFailurePatterns(1000);
    expect(patterns.length).toBeGreaterThanOrEqual(3);
    const affectedAgents = new Set<string>();
    for (const p of listCurrentPatterns()) {
      for (const a of p.affected_agents) affectedAgents.add(a);
    }
    expect(affectedAgents.has("vision")).toBe(true);
    expect(affectedAgents.has("travel")).toBe(true);
    expect(affectedAgents.has("business")).toBe(true);
  });

  it("endurance report includes all 11 agent_ids (vision/travel/business/food/construction/healthcare/transport no longer omitted)", async () => {
    // Seed catalogue so endurance report has agents to reference
    const { ensureRuntimeAgentsRegistered } = await loadRegistry();
    ensureRuntimeAgentsRegistered({ registered_by: "test" });
    // Endurance report reads heartbeat files from runtime dir · agents with no
    // heartbeat file get hb=null (that is the honest STOPPED-registered signal)
    const { generateEnduranceReport } = await loadEndurance();
    const report = generateEnduranceReport();
    const reportedAgents = new Set(report.agents.map((a: { agent_id: string }) => a.agent_id));
    expect(reportedAgents.has("programmer")).toBe(true);
    expect(reportedAgents.has("accommodation")).toBe(true);
    expect(reportedAgents.has("master_ai")).toBe(true);
    expect(reportedAgents.has("speaking")).toBe(true);
    expect(reportedAgents.has("vision")).toBe(true);
    expect(reportedAgents.has("travel")).toBe(true);
    expect(reportedAgents.has("business")).toBe(true);
    expect(reportedAgents.has("food")).toBe(true);
    expect(reportedAgents.has("construction")).toBe(true);
    expect(reportedAgents.has("healthcare")).toBe(true);
    expect(reportedAgents.has("transport")).toBe(true);
  });
});
