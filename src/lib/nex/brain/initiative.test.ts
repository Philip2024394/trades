// Stage 3.24 · Phase 17 · Initiative unit tests.

import { describe, it, expect } from "vitest";
import { decideInitiative, type InitiativeInput } from "./initiative";
import type { PredictionReport, PredictedNext } from "./prediction";

function highPrediction(kind: PredictedNext["kind"] = "narrow_area"): PredictionReport {
  const p: PredictedNext = {
    kind, hint: "test hint", exampleUtterance: "test",
    confidence: "high", reason: "test reason",
  };
  return { candidates: [p], top: p, reason: "test" };
}
function mediumPrediction(): PredictionReport {
  const p: PredictedNext = {
    kind: "narrow_budget", hint: "h", exampleUtterance: "e",
    confidence: "medium", reason: "r",
  };
  return { candidates: [p], top: p, reason: "test" };
}

function base(overrides: Partial<InitiativeInput> = {}): InitiativeInput {
  return {
    prediction: highPrediction(),
    reply: "I've got 14 real listings.",  // no ? at end
    didExecuteAction: false,
    didComparison: false,
    didRecommendation: false,
    sessionInitiativeCount: 0,
    ...overrides,
  };
}

describe("decideInitiative · volunteers on happy path", () => {
  it("high-confidence prediction + no suppression → volunteered", () => {
    const r = decideInitiative(base());
    expect(r.decision.volunteered).toBe(true);
    if (r.decision.volunteered) {
      expect(r.decision.suggestion.kind).toBe("narrow_area");
      expect(r.sessionCount).toBe(1);
    }
  });
});

describe("decideInitiative · suppression gates", () => {
  it("no prediction → not volunteered", () => {
    const r = decideInitiative(base({ prediction: { candidates: [], reason: "empty" } }));
    expect(r.decision.volunteered).toBe(false);
    if (!r.decision.volunteered) expect(r.decision.reason).toContain("no prediction");
  });

  it("no prediction.top → not volunteered", () => {
    const r = decideInitiative(base({ prediction: { candidates: [], reason: "empty" } }));
    expect(r.decision.volunteered).toBe(false);
  });

  it("session cap reached → not volunteered", () => {
    const r = decideInitiative(base({ sessionInitiativeCount: 3 }));
    expect(r.decision.volunteered).toBe(false);
    if (!r.decision.volunteered) expect(r.decision.reason).toContain("session cap");
  });

  it("custom cap respected", () => {
    const r = decideInitiative(base({ sessionInitiativeCount: 1, cap: 1 }));
    expect(r.decision.volunteered).toBe(false);
  });

  it("medium confidence → not volunteered", () => {
    const r = decideInitiative(base({ prediction: mediumPrediction() }));
    expect(r.decision.volunteered).toBe(false);
    if (!r.decision.volunteered) expect(r.decision.reason).toContain("confidence=medium");
  });

  it("reply ends with ? → not volunteered", () => {
    const r = decideInitiative(base({ reply: "Do you want budget or upmarket?" }));
    expect(r.decision.volunteered).toBe(false);
    if (!r.decision.volunteered) expect(r.decision.reason).toContain("composer already ended");
  });

  it("comparison already surfaced → not volunteered", () => {
    const r = decideInitiative(base({ didComparison: true }));
    expect(r.decision.volunteered).toBe(false);
    if (!r.decision.volunteered) expect(r.decision.reason).toContain("comparison");
  });

  it("recommendation already surfaced → not volunteered", () => {
    const r = decideInitiative(base({ didRecommendation: true }));
    expect(r.decision.volunteered).toBe(false);
    if (!r.decision.volunteered) expect(r.decision.reason).toContain("recommendation");
  });

  it("action executed → not volunteered (user is progressing)", () => {
    const r = decideInitiative(base({ didExecuteAction: true }));
    expect(r.decision.volunteered).toBe(false);
    if (!r.decision.volunteered) expect(r.decision.reason).toContain("action executed");
  });
});

describe("decideInitiative · session counter progression", () => {
  it("counter increments only when volunteered", () => {
    const r1 = decideInitiative(base({ sessionInitiativeCount: 0 }));
    expect(r1.sessionCount).toBe(1);

    const r2 = decideInitiative(base({ sessionInitiativeCount: 1 }));
    expect(r2.sessionCount).toBe(2);

    const suppressed = decideInitiative(base({ sessionInitiativeCount: 2, didComparison: true }));
    expect(suppressed.sessionCount).toBe(2); // unchanged
  });

  it("cap can be overridden", () => {
    const r = decideInitiative(base({ sessionInitiativeCount: 0, cap: 10 }));
    expect(r.cap).toBe(10);
    expect(r.decision.volunteered).toBe(true);
  });
});

describe("decideInitiative · suggestion carries prediction data", () => {
  it("volunteered suggestion has kind + confidence + exampleUtterance", () => {
    const pred = highPrediction("compare");
    const r = decideInitiative(base({ prediction: pred }));
    expect(r.decision.volunteered).toBe(true);
    if (r.decision.volunteered) {
      expect(r.decision.suggestion.kind).toBe("compare");
      expect(r.decision.suggestion.confidence).toBe("high");
      expect(r.decision.suggestion.exampleUtterance).toBeTruthy();
    }
  });
});
