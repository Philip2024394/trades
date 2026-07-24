// Answer router — classifier + reply builder.

import { describe, it, expect } from "vitest";
import { answerEstimate, classifyEstimateQuestion, formatEstimateSummary } from "./answer";
import { buildEstimate } from "./engine";

describe("classifyEstimateQuestion", () => {
  it("routes 'estimate a 42m² plastering job' to build", () => {
    const q = classifyEstimateQuestion("estimate 42m² of plastering");
    expect(q.kind).toBe("build");
  });

  it("routes 'why 18 boards?' to explain", () => {
    expect(classifyEstimateQuestion("why 18 boards?").kind).toBe("explain");
  });

  it("routes 'what's my profit?' to profit", () => {
    expect(classifyEstimateQuestion("what's my profit?").kind).toBe("profit");
  });

  it("routes 'compare suppliers'", () => {
    expect(classifyEstimateQuestion("compare suppliers").kind).toBe("compare_suppliers");
  });

  it("routes 'which trades can you estimate?'", () => {
    expect(classifyEstimateQuestion("which trades can you estimate?").kind).toBe("list_trades");
  });

  it("returns none for unrelated text", () => {
    expect(classifyEstimateQuestion("what's the weather like").kind).toBe("none");
  });
});

describe("answerEstimate", () => {
  it("build path returns an estimate + summary", async () => {
    const res = await answerEstimate({ question: { kind: "build", brief: "estimate 42m² of plastering" } });
    expect(res.estimate).toBeDefined();
    expect(res.speak).toContain("Plastering");
    expect(res.speak).toContain("Total");
  });

  it("build path returns friendly message when trade cannot be parsed", async () => {
    const res = await answerEstimate({ question: { kind: "build", brief: "banana pancakes 4m²" } });
    expect(res.estimate).toBeUndefined();
    expect(res.speak.toLowerCase()).toContain("couldn't tell");
  });

  it("explain path looks up a line from the last estimate", async () => {
    const build = await buildEstimate({ brief: "estimate 42m² of plastering" });
    if (!build.ok) throw new Error();
    const res = await answerEstimate({
      question:     { kind: "explain", hint: "why the plaster bags?" },
      lastEstimate: build.estimate
    });
    expect(res.speak).toContain("Finish plaster");
    expect(res.speak).toContain("9 m²/bag");
  });

  it("explain path asks for an estimate first when none in context", async () => {
    const res = await answerEstimate({ question: { kind: "explain", hint: "why 18 boards?" } });
    expect(res.speak).toContain("Ask me for an estimate first");
  });

  it("profit path uses the last estimate", async () => {
    const build = await buildEstimate({ brief: "estimate 42m² of plastering" });
    if (!build.ok) throw new Error();
    const res = await answerEstimate({ question: { kind: "profit" }, lastEstimate: build.estimate });
    expect(res.speak).toContain("Profit");
    expect(res.speak).toContain("20%");
  });

  it("compare_suppliers stays silent about fabricated prices", async () => {
    const res = await answerEstimate({ question: { kind: "compare_suppliers" } });
    expect(res.speak.toLowerCase()).toContain("don't have one wired");
  });

  it("list_trades enumerates registered adapters", async () => {
    const res = await answerEstimate({ question: { kind: "list_trades" } });
    expect(res.speak).toContain("Plastering");
    expect(res.speak).toContain("Concreting");
    expect(res.speak).toContain("Painting");
  });
});

describe("formatEstimateSummary", () => {
  it("includes every headline category", async () => {
    const build = await buildEstimate({ brief: "estimate 42m² of plastering" });
    if (!build.ok) throw new Error();
    const s = formatEstimateSummary(build.estimate);
    for (const label of ["Materials", "Labour", "Waste", "Overhead", "Profit", "VAT", "Total"]) {
      expect(s).toContain(label);
    }
  });
});
