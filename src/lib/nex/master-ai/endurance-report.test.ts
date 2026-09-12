// src/lib/nex/master-ai/endurance-report.test.ts
//
// Phase 5 · endurance report generator · contract tests

import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { generateEnduranceReport } from "./endurance-report";

function synthRepo(): string {
  const root = mkdtempSync(path.join(tmpdir(), "nex-p5-endurance-"));
  mkdirSync(path.join(root, "data", "nex-agent-runtime"), { recursive: true });
  mkdirSync(path.join(root, "data", "master-ai"), { recursive: true });
  mkdirSync(path.join(root, "data", "programmer-improvement"), { recursive: true });
  mkdirSync(path.join(root, "data", "programmer-learning"), { recursive: true });
  return root;
}

describe("Phase 5 · endurance report generator", () => {
  it("returns UNKNOWN-ish state honestly for a repo with no ledgers", () => {
    const root = synthRepo();
    const r = generateEnduranceReport(root);
    expect(r.observed_events.total).toBe(0);
    expect(r.failures.total_work_failed).toBe(0);
    expect(r.research.total_findings).toBe(0);
    expect(r.learning.candidates_created).toBe(0);
    expect(r.storage.total_bytes_now).toBe(0);
    expect(r.endurance_readiness.verdict).toBe("GREEN");
  });

  it("counts real events by kind and by agent · no fabrication", () => {
    const root = synthRepo();
    const events = [
      { kind: "AGENT_STARTED", agent_id: "programmer", timestamp_iso: "2026-09-05T00:00:00Z" },
      { kind: "WORK_COMPLETED", agent_id: "programmer", timestamp_iso: "2026-09-05T01:00:00Z" },
      { kind: "WORK_FAILED", agent_id: "accommodation", timestamp_iso: "2026-09-05T02:00:00Z", attributes: { reason: "test failure" } },
      { kind: "WORK_COMPLETED", agent_id: "master_ai", timestamp_iso: "2026-09-05T03:00:00Z" },
    ];
    writeFileSync(path.join(root, "data", "nex-agent-runtime", "events.jsonl"),
      events.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
    const r = generateEnduranceReport(root);
    expect(r.observed_events.total).toBe(4);
    expect(r.observed_events.by_kind["WORK_COMPLETED"]).toBe(2);
    expect(r.observed_events.by_kind["WORK_FAILED"]).toBe(1);
    expect(r.observed_events.by_agent["programmer"]).toBe(2);
    expect(r.failures.total_work_failed).toBe(1);
  });

  it("computes uptime from AGENT_STARTED + heartbeat freshness", () => {
    const root = synthRepo();
    writeFileSync(path.join(root, "data", "nex-agent-runtime", "events.jsonl"),
      JSON.stringify({ kind: "AGENT_STARTED", agent_id: "programmer", timestamp_iso: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString() }) + "\n", "utf8");
    writeFileSync(path.join(root, "data", "nex-agent-runtime", "heartbeat-programmer.json"),
      JSON.stringify({ agent_id: "programmer", timestamp_iso: new Date().toISOString(), status: "RUNNING" }), "utf8");
    const r = generateEnduranceReport(root);
    const p = r.agents.find((a) => a.agent_id === "programmer")!;
    expect(p.started_at_iso).toBeDefined();
    expect(p.uptime_hours).toBeGreaterThan(9);
    expect(p.uptime_hours).toBeLessThan(11);
    expect(p.heartbeat_status).toBe("RUNNING");
  });

  it("verdict YELLOW when heartbeat stale > 60s", () => {
    const root = synthRepo();
    writeFileSync(path.join(root, "data", "nex-agent-runtime", "events.jsonl"),
      JSON.stringify({ kind: "AGENT_STARTED", agent_id: "programmer", timestamp_iso: new Date(Date.now() - 5 * 60 * 1000).toISOString() }) + "\n", "utf8");
    writeFileSync(path.join(root, "data", "nex-agent-runtime", "heartbeat-programmer.json"),
      JSON.stringify({ agent_id: "programmer", timestamp_iso: new Date(Date.now() - 5 * 60 * 1000).toISOString(), status: "RUNNING" }), "utf8");
    const r = generateEnduranceReport(root);
    expect(r.endurance_readiness.verdict).toBe("YELLOW");
    expect(r.endurance_readiness.reasons.some((x) => /stale/.test(x))).toBe(true);
  });

  it("projects 7-day and 30-day storage bytes from current append rate", () => {
    const root = synthRepo();
    // Small event log spanning 10 hours ago to now · one event
    const eventsFile = path.join(root, "data", "nex-agent-runtime", "events.jsonl");
    const line = JSON.stringify({ kind: "AGENT_STARTED", agent_id: "programmer", timestamp_iso: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString() });
    writeFileSync(eventsFile, line + "\n", "utf8");
    const r = generateEnduranceReport(root);
    expect(r.storage.total_bytes_now).toBeGreaterThan(0);
    expect(r.storage.bytes_per_hour_estimate).toBeGreaterThan(0);
    expect(r.storage.projection_7d_bytes).toBeGreaterThan(r.storage.total_bytes_now);
    expect(r.storage.projection_30d_bytes).toBeGreaterThan(r.storage.projection_7d_bytes);
  });

  it("never fabricates activity · empty findings / candidates / patterns return zero counts", () => {
    const root = synthRepo();
    // Only an AGENT_STARTED event · no failures · no research · no candidates
    writeFileSync(path.join(root, "data", "nex-agent-runtime", "events.jsonl"),
      JSON.stringify({ kind: "AGENT_STARTED", agent_id: "programmer", timestamp_iso: "2026-09-05T00:00:00Z" }) + "\n", "utf8");
    const r = generateEnduranceReport(root);
    expect(r.failures.failure_patterns_count).toBe(0);
    expect(r.failures.top_patterns).toEqual([]);
    expect(r.research.total_findings).toBe(0);
    expect(r.research.recent_topics).toEqual([]);
    expect(r.learning.candidates_created).toBe(0);
    expect(r.learning.knowledge_items).toBe(0);
    expect(r.recommendations.daily_reports_count).toBe(0);
    expect(r.refusals.decisions_with_refuse).toBe(0);
  });
});
