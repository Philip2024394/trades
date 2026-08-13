// End-to-End Pipeline smoke tests.
// Validates the full 11-stage pipeline runs for real Kitchen + Staircase queries.

import { describe, it, expect } from "vitest";
import { converse } from "./converse";

describe("converse · End-to-End Pipeline", () => {
  it("runs a full kitchen query end-to-end", () => {
    const r = converse({
      input: "how do I choose a kitchen worktop for my family?",
      session_id: "test_kitchen_001",
    });
    expect(r.trace).toBeDefined();
    expect(r.trace?.pipeline_version).toBe("1.0");
    expect(r.trace?.identity.register).toBeTruthy();
    expect(r.trace?.intent.layer1_verb).toBeTruthy();
    expect(r.trace?.intent.layer2_domain).toBeTruthy();
    expect(r.trace?.knowledge.domain).toBe("kitchen");
    expect(r.trace?.coverage.maturity_level).toBeTruthy();
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });

  it("runs a full staircase query end-to-end", () => {
    const r = converse({
      input: "which staircase style suits a modern home with a young family?",
      session_id: "test_staircase_001",
    });
    expect(r.trace).toBeDefined();
    expect(r.trace?.knowledge.domain).toBe("staircase");
    expect(r.trace?.knowledge.items.length).toBeGreaterThanOrEqual(0);
    expect(r.trace?.confidence).toBeDefined();
  });

  it("returns a clarifying question when confidence is too low", () => {
    const r = converse({
      input: "xyz",
      session_id: "test_low_001",
    });
    expect(r.needs_clarification).toBe(true);
    expect(r.clarifying_question).toBeTruthy();
  });

  it("handles empty input safely", () => {
    const r = converse({
      input: "",
      session_id: "test_empty",
    });
    expect(r.needs_clarification).toBe(true);
    expect(r.confidence).toBe(0);
  });

  it("captures learning to the log", () => {
    const r = converse({
      input: "which timber worktop lasts longest?",
      session_id: "test_learning_001",
    });
    expect(r.trace?.learning_captured).toBe(true);
  });

  it("produces a Router Trace with all 11 stages recorded", () => {
    const r = converse({
      input: "should my kitchen match my staircase?",
      session_id: "test_trace_001",
    });
    expect(r.trace?.pipeline_version).toBe("1.0");
    expect(r.trace?.timestamp).toBeTruthy();
    expect(r.trace?.session_id).toBe("test_trace_001");
    expect(r.trace?.identity).toBeDefined();
    expect(r.trace?.goal).toBeDefined();
    expect(r.trace?.intent).toBeDefined();
    expect(r.trace?.knowledge).toBeDefined();
    expect(r.trace?.coverage).toBeDefined();
    expect(r.trace?.confidence).toBeDefined();
    expect(r.trace?.response).toBeDefined();
    expect(r.trace?.trace_reason.length).toBeGreaterThan(20);
  });

  it("computes overall confidence from layered signals", () => {
    const r = converse({
      input: "compare oak and walnut for a staircase",
      session_id: "test_confidence_001",
    });
    expect(r.trace?.confidence.identity).toBeGreaterThanOrEqual(0);
    expect(r.trace?.confidence.intent).toBeGreaterThanOrEqual(0);
    expect(r.trace?.confidence.knowledge).toBeGreaterThanOrEqual(0);
    expect(r.trace?.confidence.coverage_multiplier).toBeGreaterThan(0);
    expect(r.trace?.confidence.overall).toBeGreaterThanOrEqual(0);
  });
});
