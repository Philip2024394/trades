// Stage 3.25 · Phase 18 · Adaptation unit tests.

import { describe, it, expect, beforeEach } from "vitest";
import { detectAdaptations } from "./adaptation";
import { recordLearning, _resetLearningForTests } from "./learning";

const CID = "adaptation-test-conv";

beforeEach(() => _resetLearningForTests());

describe("detectAdaptations · edge cases", () => {
  it("no conversationId → no signals", () => {
    const r = detectAdaptations({});
    expect(r.signals).toEqual([]);
    expect(r.hasSignals).toBe(false);
    expect(r.summary).toContain("no conversation");
  });

  it("no ledger entries → no signals", () => {
    const r = detectAdaptations({ conversationId: CID });
    expect(r.hasSignals).toBe(false);
    expect(r.summary).toContain("no adaptation");
  });

  it("single entry below thresholds → no signals", () => {
    recordLearning({ kind: "insight_gap_detected", conversationId: CID, scope: "accommodation.pricing", summary: "one gap" });
    const r = detectAdaptations({ conversationId: CID });
    expect(r.hasSignals).toBe(false);
  });
});

describe("detectAdaptations · pattern 1 · repeated_gap_scope", () => {
  it("fires when same scope hit ≥2 times", () => {
    recordLearning({ kind: "insight_gap_detected", conversationId: CID, scope: "accommodation.pricing", summary: "one" });
    recordLearning({ kind: "insight_gap_detected", conversationId: CID, scope: "accommodation.pricing", summary: "two" });
    const r = detectAdaptations({ conversationId: CID });
    const s = r.signals.find((x) => x.kind === "repeated_gap_scope");
    expect(s).toBeDefined();
    expect(s?.scope).toBe("accommodation.pricing");
    expect(s?.occurrenceCount).toBe(2);
    expect(s?.suggestedAdjustment).toContain("acknowledge");
  });

  it("counts per scope · different scopes not conflated", () => {
    recordLearning({ kind: "insight_gap_detected", conversationId: CID, scope: "accommodation.pricing", summary: "a" });
    recordLearning({ kind: "insight_gap_detected", conversationId: CID, scope: "accommodation.pricing", summary: "b" });
    recordLearning({ kind: "insight_gap_detected", conversationId: CID, scope: "accommodation.amenities", summary: "c" });
    const r = detectAdaptations({ conversationId: CID });
    const gapSignals = r.signals.filter((s) => s.kind === "repeated_gap_scope");
    // Only pricing hits threshold (2 · amenities has 1)
    expect(gapSignals).toHaveLength(1);
    expect(gapSignals[0].scope).toBe("accommodation.pricing");
  });
});

describe("detectAdaptations · pattern 2 · frequent_corrections", () => {
  it("fires when ≥2 slot corrections observed", () => {
    recordLearning({ kind: "slot_correction_observed", conversationId: CID, summary: "hotel → guesthouse" });
    recordLearning({ kind: "slot_correction_observed", conversationId: CID, summary: "malioboro → kraton" });
    const r = detectAdaptations({ conversationId: CID });
    const s = r.signals.find((x) => x.kind === "frequent_corrections");
    expect(s).toBeDefined();
    expect(s?.occurrenceCount).toBe(2);
    expect(s?.suggestedAdjustment.toLowerCase()).toContain("echo");
  });

  it("single correction below threshold", () => {
    recordLearning({ kind: "slot_correction_observed", conversationId: CID, summary: "one" });
    const r = detectAdaptations({ conversationId: CID });
    expect(r.signals.find((x) => x.kind === "frequent_corrections")).toBeUndefined();
  });
});

describe("detectAdaptations · pattern 3 · recurring_reflection_failure", () => {
  it("fires when same scope has ≥2 reflection failures", () => {
    recordLearning({ kind: "reflection_failure", conversationId: CID, scope: "accommodation.reflection", summary: "a" });
    recordLearning({ kind: "reflection_failure", conversationId: CID, scope: "accommodation.reflection", summary: "b" });
    const r = detectAdaptations({ conversationId: CID });
    const s = r.signals.find((x) => x.kind === "recurring_reflection_failure");
    expect(s).toBeDefined();
    expect(s?.scope).toBe("accommodation.reflection");
  });
});

describe("detectAdaptations · pattern 4 · persistent_low_confidence", () => {
  it("fires when ≥3 confidence_low entries", () => {
    recordLearning({ kind: "confidence_low", conversationId: CID, summary: "a" });
    recordLearning({ kind: "confidence_low", conversationId: CID, summary: "b" });
    recordLearning({ kind: "confidence_low", conversationId: CID, summary: "c" });
    const r = detectAdaptations({ conversationId: CID });
    const s = r.signals.find((x) => x.kind === "persistent_low_confidence");
    expect(s).toBeDefined();
    expect(s?.occurrenceCount).toBe(3);
    expect(s?.suggestedAdjustment.toLowerCase()).toContain("grounding");
  });

  it("2 low-confidence entries below threshold (needs 3)", () => {
    recordLearning({ kind: "confidence_low", conversationId: CID, summary: "a" });
    recordLearning({ kind: "confidence_low", conversationId: CID, summary: "b" });
    const r = detectAdaptations({ conversationId: CID });
    expect(r.signals.find((x) => x.kind === "persistent_low_confidence")).toBeUndefined();
  });
});

describe("detectAdaptations · multiple patterns simultaneously", () => {
  it("fires multiple signals when multiple patterns present", () => {
    // 3× pricing gaps → repeated_gap_scope
    for (let i = 0; i < 3; i++) {
      recordLearning({ kind: "insight_gap_detected", conversationId: CID, scope: "accommodation.pricing", summary: `gap-${i}` });
    }
    // 2× corrections → frequent_corrections
    recordLearning({ kind: "slot_correction_observed", conversationId: CID, summary: "c1" });
    recordLearning({ kind: "slot_correction_observed", conversationId: CID, summary: "c2" });
    const r = detectAdaptations({ conversationId: CID });
    expect(r.hasSignals).toBe(true);
    expect(r.signals.length).toBeGreaterThanOrEqual(2);
    expect(r.signals.map((s) => s.kind)).toContain("repeated_gap_scope");
    expect(r.signals.map((s) => s.kind)).toContain("frequent_corrections");
  });
});

describe("detectAdaptations · cross-conversation isolation", () => {
  it("only reads entries for the given conversation", () => {
    recordLearning({ kind: "insight_gap_detected", conversationId: "conv-A", scope: "accommodation.pricing", summary: "a1" });
    recordLearning({ kind: "insight_gap_detected", conversationId: "conv-A", scope: "accommodation.pricing", summary: "a2" });
    recordLearning({ kind: "insight_gap_detected", conversationId: "conv-B", scope: "accommodation.pricing", summary: "b1" });
    const rA = detectAdaptations({ conversationId: "conv-A" });
    const rB = detectAdaptations({ conversationId: "conv-B" });
    expect(rA.signals.find((s) => s.kind === "repeated_gap_scope")).toBeDefined();
    expect(rB.signals.find((s) => s.kind === "repeated_gap_scope")).toBeUndefined();
  });
});

describe("detectAdaptations · summary line", () => {
  it("summary describes signals when detected", () => {
    for (let i = 0; i < 3; i++) {
      recordLearning({ kind: "insight_gap_detected", conversationId: CID, scope: "accommodation.pricing", summary: "" });
    }
    const r = detectAdaptations({ conversationId: CID });
    expect(r.summary).toContain("pattern");
    expect(r.summary).toContain("repeated_gap_scope");
  });
});
