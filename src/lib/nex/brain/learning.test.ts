// Stage 3.13 · Phase 6 · Learning ledger unit tests.

import { describe, it, expect, beforeEach } from "vitest";
import {
  recordLearning,
  listLearning,
  recentLearningForConversation,
  recentLearningGlobal,
  learningSummary,
  _resetLearningForTests,
} from "./learning";

beforeEach(() => _resetLearningForTests());

describe("Learning ledger · basic writes", () => {
  it("records an entry with id + atMs auto-populated", () => {
    const e = recordLearning({
      kind: "insight_gap_detected",
      conversationId: "conv-1",
      scope: "accommodation.pricing",
      summary: "user asked about price · no data",
    });
    expect(e.id).toMatch(/^learn:/);
    expect(e.atMs).toBeGreaterThan(0);
    expect(listLearning()).toHaveLength(1);
  });

  it("preserves ordering (append)", () => {
    recordLearning({ kind: "insight_gap_detected", conversationId: "c1", summary: "one" });
    recordLearning({ kind: "confidence_low", conversationId: "c1", summary: "two" });
    recordLearning({ kind: "reflection_failure", conversationId: "c1", summary: "three" });
    const all = listLearning();
    expect(all.map((e) => e.summary)).toEqual(["one", "two", "three"]);
  });

  it("caps rolling window at 200 entries", () => {
    for (let i = 0; i < 250; i++) {
      recordLearning({ kind: "confidence_low", conversationId: "c1", summary: `entry-${i}` });
    }
    expect(listLearning().length).toBe(200);
    // Oldest have been dropped · newest are kept.
    expect(listLearning()[0].summary).toBe("entry-50");
    expect(listLearning()[199].summary).toBe("entry-249");
  });
});

describe("Learning ledger · queries", () => {
  it("recentLearningForConversation filters by conversation", () => {
    recordLearning({ kind: "insight_gap_detected", conversationId: "conv-A", summary: "gap-A" });
    recordLearning({ kind: "insight_gap_detected", conversationId: "conv-B", summary: "gap-B" });
    recordLearning({ kind: "insight_gap_detected", conversationId: "conv-A", summary: "gap-A2" });
    const a = recentLearningForConversation("conv-A", 10);
    const b = recentLearningForConversation("conv-B", 10);
    expect(a.map((e) => e.summary)).toEqual(["gap-A2", "gap-A"]); // most recent first
    expect(b.map((e) => e.summary)).toEqual(["gap-B"]);
  });

  it("recentLearningForConversation returns empty for undefined/unknown", () => {
    recordLearning({ kind: "insight_gap_detected", conversationId: "conv-A", summary: "gap-A" });
    expect(recentLearningForConversation(undefined)).toEqual([]);
    expect(recentLearningForConversation("does-not-exist")).toEqual([]);
  });

  it("recentLearningGlobal returns most-recent-first", () => {
    recordLearning({ kind: "insight_gap_detected", conversationId: "c1", summary: "first" });
    recordLearning({ kind: "insight_gap_detected", conversationId: "c1", summary: "second" });
    const g = recentLearningGlobal(5);
    expect(g[0].summary).toBe("second");
  });

  it("learningSummary tallies by kind", () => {
    recordLearning({ kind: "insight_gap_detected", conversationId: "c1", summary: "" });
    recordLearning({ kind: "insight_gap_detected", conversationId: "c1", summary: "" });
    recordLearning({ kind: "confidence_low", conversationId: "c1", summary: "" });
    const s = learningSummary();
    expect(s.total).toBe(3);
    expect(s.byKind.insight_gap_detected).toBe(2);
    expect(s.byKind.confidence_low).toBe(1);
  });
});
