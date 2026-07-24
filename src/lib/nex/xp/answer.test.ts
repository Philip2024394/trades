// XP answer router — classifier + labelled reply.

import { describe, it, expect, vi } from "vitest";

vi.mock("./loader", () => ({
  loadFingerprints: vi.fn(async () => {
    // 5 kitchen fingerprints for the same region so k-anonymity clears.
    return [10, 11, 12, 13, 14].map((d, i) => ({
      anon_id: `anon_${i}`, trade: "carpenter", project_type: "kitchen",
      property_type: "domestic" as const, region: "M",
      duration_days: d, labour_hours: d * 4, materials_spend_pence: 100_000, labour_spend_pence: 50_000,
      crew_size: 2, completed_at: "2026-07-01"
    }));
  })
}));

import { answerXP, classifyXPQuestion } from "./answer";

describe("classifyXPQuestion", () => {
  it("routes 'how long does X take?'", () => {
    expect(classifyXPQuestion("how long does a kitchen take?").kind).toBe("how_long");
  });
  it("routes 'average labour hours'", () => {
    expect(classifyXPQuestion("average labour hours for a kitchen").kind).toBe("labour_hours");
  });
  it("routes similar", () => {
    expect(classifyXPQuestion("show projects similar to my kitchen").kind).toBe("similar");
  });
  it("routes benchmark reveal", () => {
    expect(classifyXPQuestion("how many contributing projects?").kind).toBe("benchmark_reveal");
  });
  it("returns 'none' for unrelated text", () => {
    expect(classifyXPQuestion("hello there").kind).toBe("none");
  });
});

describe("answerXP", () => {
  it("how_long returns SEPARATE OFFICIAL + EXPERIENCE sections + disclaimer", async () => {
    const r = await answerXP({ question: { kind: "how_long", project_hint: "how long does a kitchen refit take" } });
    expect(r.speak).toContain("OFFICIAL");
    expect(r.speak).toContain("REAL-WORLD EXPERIENCE");
    expect(r.speak).toContain("median");
    expect(r.speak).toContain("n=5");                                      // sample size shown
    expect(r.speak.toLowerCase()).toContain("k-anonymity");
  });

  it("benchmark_reveal reports contributing project count + k-anonymity rule", async () => {
    const r = await answerXP({ question: { kind: "benchmark_reveal" } });
    expect(r.speak).toContain("Contributing projects on file: 5");
    expect(r.speak).toContain("k-anonymity");
  });

  it("similar returns experience section with sample size", async () => {
    const r = await answerXP({ question: { kind: "similar", project_hint: "kitchen refit" } });
    expect(r.speak).toContain("REAL-WORLD EXPERIENCE");
    expect(r.speak).toContain("similar contributing project");
  });

  it("data.claims separates regulation / experience / preference labels", async () => {
    const r = await answerXP({ question: { kind: "how_long", project_hint: "kitchen" } });
    expect(r.data).toBeDefined();
    const kinds = r.data!.claims.map((c) => c.source_kind);
    expect(kinds).toContain("regulation");
    expect(kinds).toContain("experience");
  });

  it("none returns empty speak", async () => {
    const r = await answerXP({ question: { kind: "none" } });
    expect(r.speak).toBe("");
  });
});
