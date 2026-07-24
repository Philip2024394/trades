// Answer router — classifier + dispatch + no-image edge cases.
// Mocks each specialised analysis so no network hit.

import { describe, it, expect, vi, beforeEach } from "vitest";

const okAnalysis = {
  summary: "Wall showing skim coat.",
  primary_trade: "plastering",
  stage: "in-progress" as const,
  detected: [{ label: "plasterboard", category: "material" as const, confidence: "medium" as const }],
  observations: [{ key: "obs_0", headline: "Skim looks flat", confidence: "medium" as const }],
  defects: [],
  safety: [],
  next_steps: [{ action: "Second coat tomorrow", reason: "let it dry" }],
  overall_confidence: "medium" as const,
  disclaimer: "Vision analysis is a first look.",
  evidence: { source: "t", tables: [], computed_at: "x" }
};

vi.mock("./analyze", () => ({ analyzeConstructionImage: vi.fn(async () => okAnalysis) }));
vi.mock("./damage",  () => ({ analyzeDamage: vi.fn(async () => ({
  summary: "One crack noted.", damage: [{ label: "hairline crack", likely_cause: "settlement", severity: "low", confidence: "medium" }], recommended_action: "monitor", disclaimer: "d", evidence: { source: "t", tables: [], computed_at: "x" }
})) }));
vi.mock("./safety",  () => ({ analyzeSafety: vi.fn(async () => ({
  summary: "One hazard.", observations: [{ hazard: "trailing cable", severity: "medium", recommended_action: "coil off floor", confidence: "medium", human_verification_note: "verify in person" }], disclaimer: "d", evidence: { source: "t", tables: [], computed_at: "x" }
})) }));
vi.mock("./measure", () => ({ estimateMeasurements: vi.fn(async () => ({
  summary: "Approximate sizes.", scaled: false, estimates: [{ label: "wall H/W", value: "~1.6", confidence: "low" }], disclaimer: "d", evidence: { source: "t", tables: [], computed_at: "x" }
})) }));
vi.mock("./ocr",     () => ({ extractDocument: vi.fn(async () => ({
  summary: "Receipt read.", document_kind: "receipt", fields: [{ key: "total", value: "£42.50", confidence: "high" }], disclaimer: "d", evidence: { source: "t", tables: [], computed_at: "x" }
})) }));
vi.mock("./compare", () => ({ compareImages: vi.fn(async () => ({
  summary: "Two-week diff.", changes: [{ label: "roof tiles laid", detail: "west slope", confidence: "high" }], improvements: [], concerns: [], disclaimer: "d", evidence: { source: "t", tables: [], computed_at: "x" }
})) }));

import { answerVision, classifyVisionQuestion, formatAnalyze, formatCompare, formatDamage, formatMeasure, formatOCR, formatSafety } from "./answer";

beforeEach(() => vi.clearAllMocks());

describe("classifyVisionQuestion", () => {
  it("routes analyze", () => {
    expect(classifyVisionQuestion("what do you think of this photo?").kind).toBe("analyze");
    expect(classifyVisionQuestion("inspect this").kind).toBe("analyze");
    expect(classifyVisionQuestion("analyse this image").kind).toBe("analyze");
  });
  it("routes damage", () => {
    expect(classifyVisionQuestion("what's wrong with this wall?").kind).toBe("damage");
    expect(classifyVisionQuestion("any defects").kind).toBe("damage");
  });
  it("routes safety", () => {
    expect(classifyVisionQuestion("is this safe?").kind).toBe("safety");
    expect(classifyVisionQuestion("safety check").kind).toBe("safety");
  });
  it("routes measure", () => {
    expect(classifyVisionQuestion("measure this room").kind).toBe("measure");
    expect(classifyVisionQuestion("estimate the size of this photo").kind).toBe("measure");
  });
  it("routes ocr", () => {
    expect(classifyVisionQuestion("read this receipt").kind).toBe("ocr");
    expect(classifyVisionQuestion("ocr this invoice").kind).toBe("ocr");
  });
  it("routes compare", () => {
    expect(classifyVisionQuestion("compare these images").kind).toBe("compare");
    expect(classifyVisionQuestion("before and after").kind).toBe("compare");
  });
  it("returns 'none' for unrelated text", () => {
    expect(classifyVisionQuestion("hello there").kind).toBe("none");
  });
});

describe("answerVision — dispatch", () => {
  it("no image → returns 'attach an image' for single-image questions", async () => {
    const r = await answerVision({ question: { kind: "analyze" } });
    expect(r.speak).toContain("Attach an image");
  });

  it("compare with fewer than 2 images → asks for both", async () => {
    const r = await answerVision({ question: { kind: "compare" }, imageUrls: ["only-one"] });
    expect(r.speak).toContain("BEFORE");
  });

  it("analyze runs when image is present", async () => {
    const r = await answerVision({ question: { kind: "analyze" }, imageUrl: "https://img/x.jpg" });
    expect(r.speak).toContain("Wall showing skim coat");
    expect(r.data?.kind).toBe("analyze");
  });

  it("damage runs when image is present", async () => {
    const r = await answerVision({ question: { kind: "damage" }, imageUrl: "https://img/x.jpg" });
    expect(r.speak).toContain("crack");
    expect(r.data?.kind).toBe("damage");
  });

  it("safety runs when image is present", async () => {
    const r = await answerVision({ question: { kind: "safety" }, imageUrl: "https://img/x.jpg" });
    expect(r.speak).toContain("trailing cable");
    expect(r.data?.kind).toBe("safety");
  });

  it("measure surfaces the 'no scale reference' honest note when scaled=false", async () => {
    const r = await answerVision({ question: { kind: "measure" }, imageUrl: "https://img/x.jpg" });
    expect(r.speak.toLowerCase()).toContain("no scale reference");
  });

  it("ocr surfaces extracted fields", async () => {
    const r = await answerVision({ question: { kind: "ocr" }, imageUrl: "https://img/x.jpg" });
    expect(r.speak).toContain("£42.50");
  });

  it("compare runs when 2+ images present", async () => {
    const r = await answerVision({ question: { kind: "compare" }, imageUrls: ["a", "b"] });
    expect(r.speak).toContain("roof tiles");
    expect(r.data?.kind).toBe("compare");
  });

  it("'none' returns empty speak", async () => {
    const r = await answerVision({ question: { kind: "none" }, imageUrl: "https://img/x.jpg" });
    expect(r.speak).toBe("");
  });
});

describe("Formatters surface confidence + disclaimer", () => {
  it("formatAnalyze includes confidence + disclaimer", () => {
    const s = formatAnalyze(okAnalysis);
    expect(s).toContain("medium confidence");
    expect(s).toContain(okAnalysis.disclaimer);
  });

  it("formatAnalyze on error path just shows summary + disclaimer", () => {
    const s = formatAnalyze({ ...okAnalysis, error: "no_vision_key" });
    expect(s).toContain("Wall");
    expect(s).toContain(okAnalysis.disclaimer);
  });

  it("formatDamage handles empty damage list gracefully", () => {
    const s = formatDamage({ summary: "Nothing seen.", damage: [], recommended_action: "monitor", disclaimer: "d", evidence: { source: "t", tables: [], computed_at: "x" } });
    expect(s.toLowerCase()).toContain("nothing that looked");
  });

  it("formatSafety handles empty observations gracefully", () => {
    const s = formatSafety({ summary: "Clean.", observations: [], disclaimer: "d", evidence: { source: "t", tables: [], computed_at: "x" } });
    expect(s.toLowerCase()).toContain("no visible safety concerns");
  });

  it("formatMeasure surfaces 'unscaled → ratios only' when scaled=false", () => {
    const s = formatMeasure({ summary: "Sizes", scaled: false, estimates: [{ label: "ratio", value: "1.2:1", confidence: "low" }], disclaimer: "d", evidence: { source: "t", tables: [], computed_at: "x" } });
    expect(s.toLowerCase()).toContain("no scale reference");
  });

  it("formatOCR shows fields", () => {
    const s = formatOCR({ summary: "OK", document_kind: "receipt", fields: [{ key: "total", value: "£10", confidence: "high" }], disclaimer: "d", evidence: { source: "t", tables: [], computed_at: "x" } });
    expect(s).toContain("total");
    expect(s).toContain("£10");
  });

  it("formatCompare lists changes with confidence", () => {
    const s = formatCompare({ summary: "Diff", changes: [{ label: "x", detail: "y", confidence: "high" }], improvements: [], concerns: [], disclaimer: "d", evidence: { source: "t", tables: [], computed_at: "x" } });
    expect(s).toContain("high confidence");
  });
});
