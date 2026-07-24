// analyzeConstructionImage — mocks reviewImage so no network hit.
// Verifies:
//   • No-key path returns error='no_vision_key' with honest summary
//   • Model failure returns error='model_failed'
//   • Valid JSON validates + normalises properly
//   • Cache dedupes second call

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReview = vi.fn();

vi.mock("@/lib/openai/vision", () => ({
  reviewImage: (...args: unknown[]) => mockReview(...args)
}));

import { _clearCvCache } from "./cache";
import { analyzeConstructionImage } from "./analyze";

beforeEach(() => {
  _clearCvCache();
  mockReview.mockReset();
});

describe("analyzeConstructionImage", () => {
  it("no vision key → returns honest 'no_vision_key' with summary + disclaimer", async () => {
    mockReview.mockResolvedValueOnce(null);
    const a = await analyzeConstructionImage({ imageUrl: "https://img/x.jpg" });
    expect(a.error).toBe("no_vision_key");
    expect(a.summary.toLowerCase()).toContain("openai");
    expect(a.disclaimer.length).toBeGreaterThan(0);
    expect(a.overall_confidence).toBe("low");
  });

  it("model returns unparseable → error='model_failed'", async () => {
    mockReview.mockResolvedValueOnce({ parsed: null, raw: "gibberish" });
    const a = await analyzeConstructionImage({ imageUrl: "https://img/x.jpg" });
    expect(a.error).toBe("model_failed");
  });

  it("valid JSON is normalised into VisionAnalysis + confidence surfaces", async () => {
    mockReview.mockResolvedValueOnce({
      parsed: {
        summary: "Wall showing skim coat.",
        primary_trade: "plastering",
        stage: "in-progress",
        detected: [
          { label: "plasterboard",  category: "material", confidence: "high" },
          { label: "corner bead",   category: "material", confidence: "medium" },
          { label: null,            category: "material", confidence: "low" }   // dropped: no label
        ],
        observations: [{ headline: "Skim looks uneven on the left", confidence: "medium" }],
        defects:      [{ headline: "Possible crack forming", confidence: "low" }],
        safety:       [{ hazard: "trailing cable", severity: "medium", recommended_action: "coil off floor", confidence: "medium" }],
        next_steps:   [{ action: "Re-skim the left wall", reason: "visible undulation" }],
        overall_confidence: "medium"
      },
      raw: "..."
    });
    const a = await analyzeConstructionImage({ imageUrl: "https://img/x.jpg" });
    expect(a.error).toBeUndefined();
    expect(a.primary_trade).toBe("plastering");
    expect(a.stage).toBe("in-progress");
    expect(a.detected.length).toBe(2);       // null-label item filtered
    expect(a.observations[0].key).toBe("obs_0");
    expect(a.defects[0].key).toBe("def_0");
    expect(a.safety[0].human_verification_note.length).toBeGreaterThan(0);
    expect(a.overall_confidence).toBe("medium");
  });

  it("invalid enum values fall back safely", async () => {
    mockReview.mockResolvedValueOnce({
      parsed: {
        summary: "Site photo.",
        primary_trade: null,
        stage: "made up stage",         // → 'unknown'
        detected: [{ label: "thing", category: "gibberish", confidence: "definitely" }],  // → 'unknown' + 'low'
        observations: [], defects: [], safety: [], next_steps: [],
        overall_confidence: "extreme"   // → 'low'
      },
      raw: "..."
    });
    const a = await analyzeConstructionImage({ imageUrl: "https://img/x.jpg" });
    expect(a.stage).toBe("unknown");
    expect(a.detected[0].category).toBe("unknown");
    expect(a.detected[0].confidence).toBe("low");
    expect(a.overall_confidence).toBe("low");
  });

  it("caches — same URL doesn't re-call the vision model", async () => {
    mockReview.mockResolvedValueOnce({
      parsed: { summary: "Cached", stage: "before", detected: [], observations: [], defects: [], safety: [], next_steps: [], overall_confidence: "medium", primary_trade: null },
      raw: "..."
    });
    await analyzeConstructionImage({ imageUrl: "https://img/same.jpg" });
    await analyzeConstructionImage({ imageUrl: "https://img/same.jpg" });
    expect(mockReview).toHaveBeenCalledTimes(1);
  });
});
