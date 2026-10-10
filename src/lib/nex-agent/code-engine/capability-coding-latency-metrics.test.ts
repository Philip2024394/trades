import { describe, it, expect, beforeEach } from "vitest";
import {
  startSession,
  beginPhase,
  endPhase,
  incrementCounter,
  finaliseReport,
  _resetForTests,
  CODING_LATENCY_METRICS_VERSION,
} from "./capability-coding-latency-metrics";

beforeEach(() => _resetForTests());

describe("coding latency metrics · §40 §55", () => {
  it("records real phase durations", async () => {
    const id = startSession();
    beginPhase(id, "understand");
    await new Promise((r) => setTimeout(r, 20));
    const d = endPhase(id, "understand");
    expect(d).not.toBeNull();
    expect(d!).toBeGreaterThanOrEqual(15);
    const report = finaliseReport(id)!;
    expect(report.time_to_understand_ms).toBeGreaterThanOrEqual(15);
  });

  it("records multiple phases + counters", async () => {
    const id = startSession();
    for (const p of ["understand", "hypothesis", "first_change", "target_test"] as const) {
      beginPhase(id, p);
      await new Promise((r) => setTimeout(r, 5));
      endPhase(id, p);
    }
    incrementCounter(id, "files_changed", 2);
    incrementCounter(id, "tests_run", 1);
    incrementCounter(id, "cache_hits", 5);
    const report = finaliseReport(id)!;
    expect(report.time_to_understand_ms).toBeGreaterThan(0);
    expect(report.time_to_hypothesis_ms).toBeGreaterThan(0);
    expect(report.time_to_first_change_ms).toBeGreaterThan(0);
    expect(report.time_to_test_ms).toBeGreaterThan(0);
    expect(report.counters.files_changed).toBe(2);
    expect(report.counters.cache_hits).toBe(5);
  });

  it("efficiency_score penalises duplicate operations", async () => {
    const id = startSession();
    beginPhase(id, "understand");
    await new Promise((r) => setTimeout(r, 1));
    endPhase(id, "understand");
    incrementCounter(id, "files_read", 5);
    incrementCounter(id, "duplicate_operations", 3);
    const report = finaliseReport(id)!;
    expect(report.efficiency_score).toBeLessThan(1);
  });

  it("efficiency_score is 1.0 with no waste", async () => {
    const id = startSession();
    beginPhase(id, "understand");
    endPhase(id, "understand");
    incrementCounter(id, "files_read", 5);
    incrementCounter(id, "agent_handoffs", 1);
    const report = finaliseReport(id)!;
    expect(report.efficiency_score).toBe(1);
  });

  it("declares zero_llm=true and ledger=B", () => {
    const id = startSession();
    const report = finaliseReport(id)!;
    expect(report.zero_llm).toBe(true);
    expect(report.ledger).toBe("B");
  });

  it("canonical version", () => {
    expect(CODING_LATENCY_METRICS_VERSION).toBe("coding-latency-metrics.v1.2026-09-19");
  });
});
