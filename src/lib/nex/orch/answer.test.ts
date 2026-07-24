// orch/answer.ts — isCompoundAsk + formatOrchestration.

import { describe, it, expect } from "vitest";
import { formatOrchestration, isCompoundAsk } from "./answer";
import type { OrchestrationResult } from "./types";

const ev = { source: "t", tables: [], computed_at: "x" };

describe("isCompoundAsk", () => {
  it("true for 'quote this extension' (multiple specialities)", () => {
    expect(isCompoundAsk("quote this extension")).toBe(true);
  });
  it("false for a plain question", () => {
    expect(isCompoundAsk("hello there")).toBe(false);
  });
  it("false when only ONE agent keyword matches", () => {
    // "regulations" alone doesn't trip any compound shape → single agent
    expect(isCompoundAsk("what are the regulations for a staircase")).toBe(false);
  });
});

describe("formatOrchestration", () => {
  const baseRes: OrchestrationResult = {
    ask: "quote this extension",
    plan: {
      ask: "quote this extension", reason: "test",
      steps: [{ agent_id: "estimating", focus_ask: "x", depends_on: [] }, { agent_id: "procurement", focus_ask: "x", depends_on: [] }]
    },
    contributions: [
      { agent_id: "estimating",  headline: "£12,000",     speak: "s1", confidence: "medium", evidence: ev },
      { agent_id: "procurement", headline: "5 listings",  speak: "s2", confidence: "medium", evidence: ev }
    ],
    explanation: "I checked: Estimating, Procurement.",
    speak:       "- Estimating: £12,000 (confidence: medium)\n- Procurement: 5 listings (confidence: medium)",
    errors:      []
  };

  it("includes 'I checked:' trail", () => {
    const out = formatOrchestration(baseRes);
    expect(out).toContain("I checked:");
    expect(out).toContain("Estimating");
    expect(out).toContain("Procurement");
  });

  it("surfaces agent errors when any", () => {
    const withErr = { ...baseRes, errors: [{ agent_id: "finance" as const, error: "kaboom" }] };
    const out = formatOrchestration(withErr);
    expect(out.toLowerCase()).toContain("couldn't respond");
    expect(out).toContain("kaboom");
  });

  it("empty plan → empty string", () => {
    const empty: OrchestrationResult = { ...baseRes, plan: { ...baseRes.plan, steps: [] } };
    expect(formatOrchestration(empty)).toBe("");
  });
});
