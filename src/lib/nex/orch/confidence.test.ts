// Confidence rollup + conflict resolution.

import { describe, it, expect } from "vitest";
import { detectConflicts, resolveConflict, rollupConfidence, stepUp, stepDown } from "./confidence";
import type { AgentResult } from "./types";

const ev = { source: "t", tables: [], computed_at: "x" };
const mk = (id: string, headline: string, confidence: AgentResult["confidence"], is_official = false, error?: string): AgentResult => ({
  agent_id: id as AgentResult["agent_id"], headline, speak: headline,
  confidence, is_official, evidence: ev, error
});

describe("stepUp / stepDown", () => {
  it("caps at high/low", () => {
    expect(stepUp("high")).toBe("high");
    expect(stepDown("low")).toBe("low");
    expect(stepUp("low")).toBe("medium");
    expect(stepDown("high")).toBe("medium");
  });
});

describe("rollupConfidence", () => {
  it("empty → low", () => {
    expect(rollupConfidence([])).toBe("low");
  });

  it("takes min confidence", () => {
    const results = [mk("a", "hi", "high"), mk("b", "hi", "low")];
    expect(rollupConfidence(results)).toBe("low");
  });

  it("bumps up when ≥2 medium+ AND has official", () => {
    const results = [
      mk("regulations", "hi", "medium", true),
      mk("estimating", "hi", "medium", false)
    ];
    expect(rollupConfidence(results)).toBe("high");
  });

  it("does NOT bump when no official present", () => {
    const results = [
      mk("estimating", "hi", "medium", false),
      mk("procurement", "hi", "medium", false)
    ];
    expect(rollupConfidence(results)).toBe("medium");
  });

  it("skips errored contributors", () => {
    const results = [
      mk("a", "hi", "high"),
      mk("b", "err", "low", false, "boom")
    ];
    expect(rollupConfidence(results)).toBe("high");
  });
});

describe("detectConflicts", () => {
  it("detects yes/no polarity", () => {
    const a = mk("planning", "Yes, permitted under GPDO", "medium");
    const b = mk("building_control", "No, this needs a full application", "medium");
    expect(detectConflicts([a, b])).toHaveLength(1);
  });

  it("detects safe/unsafe polarity", () => {
    const a = mk("structural", "The wall is safe to remove.", "medium");
    const b = mk("fire_safety", "Removing that wall is unsafe.", "high");
    expect(detectConflicts([a, b])).toHaveLength(1);
  });

  it("no conflict when both agree", () => {
    const a = mk("planning", "Yes, allowed.", "medium");
    const b = mk("building_control", "Yes, notify us.", "medium");
    expect(detectConflicts([a, b])).toHaveLength(0);
  });

  it("errored replies never conflict", () => {
    const a = mk("planning", "Yes", "medium");
    const b = mk("building_control", "No", "medium", false, "err");
    expect(detectConflicts([a, b])).toHaveLength(0);
  });
});

describe("resolveConflict", () => {
  it("official wins over non-official", () => {
    const conflict = {
      a: mk("regulations", "Yes, permitted.", "medium", true),
      b: mk("estimating", "No, blocked.", "medium", false),
      reason: "test"
    };
    const res = resolveConflict(conflict);
    expect(res.is_tie).toBe(false);
    expect(res.preferred?.agent_id).toBe("regulations");
  });

  it("higher confidence wins when neither is official", () => {
    const conflict = {
      a: mk("estimating", "Yes", "low"),
      b: mk("procurement", "No", "high"),
      reason: "test"
    };
    const res = resolveConflict(conflict);
    expect(res.preferred?.agent_id).toBe("procurement");
  });

  it("tie at same confidence + no official → surface both", () => {
    const conflict = {
      a: mk("estimating", "Yes", "medium"),
      b: mk("procurement", "No", "medium"),
      reason: "test"
    };
    const res = resolveConflict(conflict);
    expect(res.is_tie).toBe(true);
    expect(res.preferred).toBeNull();
  });
});
