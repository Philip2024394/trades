// src/lib/nex-agent/code-engine/capability-micro-brain.test.ts
//
// Micro-brain pattern + cortex router unit tests.

import { describe, it, expect } from "vitest";
import { createMicroBrain, type MicroBrainObservation } from "./capability-micro-brain";
import { broadcastToBrains } from "./capability-cortex-router";
import {
  mb_test_shape,
  mb_identifier_hint,
  mb_fix_confidence,
  ALL_MICRO_BRAINS,
} from "./capability-micro-brains-instances";

describe("micro-brain pattern", () => {
  const brainA = createMicroBrain({
    id: "test_brain_a",
    name: "test A",
    domain: "test",
    cognitive_layer: "perception",
    description: "test-only brain A",
    rulebook: [
      {
        id: "always_1",
        matches: (obs) => obs.kind === "num",
        predict: () => ({ value: 1, confidence: 0.9 }),
      },
    ],
  });
  const brainB = createMicroBrain({
    id: "test_brain_b",
    name: "test B",
    domain: "test",
    cognitive_layer: "perception",
    description: "test-only brain B",
    rulebook: [
      {
        id: "always_2",
        matches: (obs) => obs.kind === "num",
        predict: () => ({ value: 2, confidence: 0.9 }),
      },
    ],
  });
  const brainAgree = createMicroBrain({
    id: "test_brain_agree",
    name: "test agree",
    domain: "test",
    cognitive_layer: "perception",
    description: "test-only brain agree",
    rulebook: [
      {
        id: "always_1",
        matches: (obs) => obs.kind === "num",
        predict: () => ({ value: 1, confidence: 0.9 }),
      },
    ],
  });

  const obs: MicroBrainObservation = { kind: "num", data: {} };

  it("predicts based on rulebook match", () => {
    const p = brainA.predict(obs);
    expect(p.prediction).toBe(1);
    expect(p.confidence).toBe(0.9);
    expect(p.rule_hits).toEqual(["always_1"]);
    expect(p.r11b_marker).toBe(
      "MICRO_BRAIN_PREDICTION_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
    );
    expect(p.evidence_kind).toBe("INFERRED");
  });

  it("returns null prediction when no rule matches", () => {
    const p = brainA.predict({ kind: "other", data: {} });
    expect(p.prediction).toBe(null);
    expect(p.confidence).toBe(0);
    expect(p.rule_hits).toEqual([]);
  });

  it("cortex router · disagreement preserved", () => {
    const r = broadcastToBrains([brainA, brainB], obs);
    expect(r.responders).toBe(2);
    expect(r.non_null_predictions).toBe(2);
    expect(r.consensus).toBe("DISAGREEMENT_PRESERVED");
    expect(r.disagreement_count).toBe(2);
  });

  it("cortex router · unanimous when all brains agree", () => {
    const r = broadcastToBrains([brainA, brainAgree], obs);
    expect(r.responders).toBe(2);
    expect(r.non_null_predictions).toBe(2);
    expect(r.consensus).toBe("UNANIMOUS_SAME_PREDICTION");
    expect(r.disagreement_count).toBe(1);
    expect(r.majority_value).toBe(1);
  });

  it("cortex router · majority agrees when 2 of 3 concur", () => {
    const r = broadcastToBrains([brainA, brainAgree, brainB], obs);
    expect(r.non_null_predictions).toBe(3);
    expect(r.consensus).toBe("MAJORITY_AGREES");
    expect(r.majority_value).toBe(1);
    expect(r.disagreement_count).toBe(2);
  });

  it("cortex router · single responder when only one brain matches", () => {
    const nonMatching = createMicroBrain({
      id: "test_brain_none",
      name: "test none",
      domain: "test",
      cognitive_layer: "perception",
      description: "no-op",
      rulebook: [],
    });
    const r = broadcastToBrains([brainA, nonMatching], obs);
    expect(r.non_null_predictions).toBe(1);
    expect(r.consensus).toBe("SINGLE_RESPONDER");
    expect(r.majority_value).toBe(1);
  });

  it("cortex router · NO_RESPONSE when no brain matches", () => {
    const r = broadcastToBrains([brainA, brainB], { kind: "other", data: {} });
    expect(r.non_null_predictions).toBe(0);
    expect(r.consensus).toBe("NO_RESPONSE");
    expect(r.majority_value).toBe(null);
  });

  it("micro-brain rules never throw · silent skip on error", () => {
    const throwingBrain = createMicroBrain({
      id: "test_brain_throw",
      name: "test throw",
      domain: "test",
      cognitive_layer: "perception",
      description: "rule that throws",
      rulebook: [
        {
          id: "always_throws",
          matches: () => { throw new Error("boom"); },
          predict: () => ({ value: 0, confidence: 1 }),
        },
        {
          id: "safe",
          matches: (o) => o.kind === "num",
          predict: () => ({ value: 5, confidence: 0.5 }),
        },
      ],
    });
    const p = throwingBrain.predict(obs);
    expect(p.prediction).toBe(5);
    expect(p.rule_hits).toEqual(["safe"]);
  });

  it("is deterministic — same input twice yields identical output", () => {
    const p1 = brainA.predict(obs);
    const p2 = brainA.predict(obs);
    // ignoring the runtime timestamps that go into the DB · the prediction
    // object itself has no timestamp field so must be deep-equal.
    expect(p1).toEqual(p2);
  });
});

describe("concrete micro-brain instances", () => {
  it("mb_test_shape recognises bare_call", () => {
    const p = mb_test_shape.predict({
      kind: "assertion",
      data: { source: "expect(fn()).toBe(42)" },
    });
    expect(p.prediction).toBe("bare_call");
  });

  it("mb_test_shape recognises member_access_on_call", () => {
    const p = mb_test_shape.predict({
      kind: "assertion",
      data: { source: "expect(fn().field).toBe(42)" },
    });
    expect(p.prediction).toBe("member_access_on_call");
  });

  it("mb_identifier_hint predicts function for verb-prefixed camelCase", () => {
    const p = mb_identifier_hint.predict({
      kind: "identifier",
      data: { token: "computeWorkerPool" },
    });
    expect(p.prediction).toBe("function");
  });

  it("mb_identifier_hint predicts constant for UPPER_SNAKE", () => {
    const p = mb_identifier_hint.predict({
      kind: "identifier",
      data: { token: "MAX_RETRIES" },
    });
    expect(p.prediction).toBe("constant");
  });

  it("mb_fix_confidence refuses protected target", () => {
    const p = mb_fix_confidence.predict({
      kind: "fix_context",
      data: { protected_target: true },
    });
    expect(p.prediction).toBe("REFUSE");
    expect(p.confidence).toBe(0.99);
  });

  it("all three micro-brains registered under ALL_MICRO_BRAINS", () => {
    expect(ALL_MICRO_BRAINS.length).toBe(3);
    const ids = ALL_MICRO_BRAINS.map((b) => b.id);
    expect(ids).toContain("mb_test_shape");
    expect(ids).toContain("mb_identifier_hint");
    expect(ids).toContain("mb_fix_confidence");
  });

  it("cortex router across all three micro-brains produces a single aggregate", () => {
    const r = broadcastToBrains(ALL_MICRO_BRAINS, {
      kind: "assertion",
      data: { source: "expect(fn()).toBe(1)" },
    });
    // Only test_shape responds to "assertion" kind.
    expect(r.non_null_predictions).toBe(1);
    expect(r.consensus).toBe("SINGLE_RESPONDER");
    expect(r.majority_value).toBe("bare_call");
  });
});
