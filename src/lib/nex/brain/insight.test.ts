// Stage 3.8 · Insight subsystem unit tests (Philip 2026-08-31).
// Deterministic decision function · no LLM · no chat integration.

import { describe, it, expect } from "vitest";
import { decideAccommodationInsight, type AccommodationInsightInput } from "./insight";
import type { AccommodationSlots, ExtractResult } from "./accommodation-slots";

function makeInput(overrides: Partial<AccommodationInsightInput> = {}): AccommodationInsightInput {
  const defaultExtraction: ExtractResult = { slots: {}, correction: false, isKnowledgeQuestion: false };
  return {
    message: "test",
    extraction: defaultExtraction,
    priorSlots: undefined,
    mergedSlots: {},
    realPropertiesMatched: 0,
    realPropertiesAvailable: 0,
    isBookIntent: false,
    isPriceQuestion: false,
    isAmenityQuestion: false,
    amenitiesAsked: [],
    ...overrides,
  };
}

describe("decideAccommodationInsight · signal ordering", () => {
  it("contradiction fires when correction flag + type change", () => {
    const priorSlots: AccommodationSlots = { type: "hotel", location: "yogyakarta" };
    const extraction: ExtractResult = { slots: { type: "guesthouse", action: "discover" }, correction: true, isKnowledgeQuestion: false };
    const merged: AccommodationSlots = { type: "guesthouse", location: "yogyakarta" };
    const d = decideAccommodationInsight(makeInput({ priorSlots, extraction, mergedSlots: merged, realPropertiesMatched: 5, realPropertiesAvailable: 14 }));
    expect(d.reason).toBe("contradiction");
    expect(d.priority).toBe("useful");
    expect(d.shouldSpeak).toBe(true);
    expect(d.contradictionSummary?.toLowerCase()).toContain("switching");
    expect(d.contradictionSummary?.toLowerCase()).toContain("guesthouse");
  });

  it("book intent wins over missing slots (honest boundary is required)", () => {
    const d = decideAccommodationInsight(makeInput({
      mergedSlots: { action: "book" },
      isBookIntent: true,
    }));
    expect(d.reason).toBe("opportunity");
    expect(d.priority).toBe("required");
    expect(d.question).toMatch(/can'?t book|no live booking/i);
  });

  it("price question surfaces learning_gap with scope=accommodation.pricing", () => {
    const d = decideAccommodationInsight(makeInput({
      message: "How much?",
      mergedSlots: { type: "hotel", location: "yogyakarta" },
      isPriceQuestion: true,
    }));
    expect(d.reason).toBe("learning_gap");
    expect(d.learningGap?.scope).toBe("accommodation.pricing");
    expect(d.learningGap?.unmet).toBe("price");
    expect(d.question).toMatch(/no price data|can'?t quote/i);
  });

  it("amenity question surfaces learning_gap with scope=accommodation.amenities", () => {
    const d = decideAccommodationInsight(makeInput({
      message: "With a pool",
      extraction: { slots: { amenities: ["pool"] }, correction: false, isKnowledgeQuestion: false },
      mergedSlots: { type: "hotel", amenities: ["pool"] },
      isAmenityQuestion: true,
      amenitiesAsked: ["pool"],
    }));
    expect(d.reason).toBe("learning_gap");
    expect(d.learningGap?.scope).toBe("accommodation.amenities");
    expect(d.learningGap?.unmet).toBe("pool");
  });

  it("missing location asks for city (required)", () => {
    const d = decideAccommodationInsight(makeInput({ mergedSlots: {} }));
    expect(d.reason).toBe("missing_required_slot");
    expect(d.priority).toBe("required");
    expect(d.question?.toLowerCase()).toContain("city");
  });

  it("missing type after location asks for type (required)", () => {
    const d = decideAccommodationInsight(makeInput({ mergedSlots: { location: "yogyakarta" } }));
    expect(d.reason).toBe("missing_required_slot");
    expect(d.question?.toLowerCase()).toContain("hotel");
    expect(d.question?.toLowerCase()).toContain("guesthouse");
  });

  it("missing budget after location+type asks for budget (useful)", () => {
    const d = decideAccommodationInsight(makeInput({
      mergedSlots: { location: "yogyakarta", type: "hotel" },
      realPropertiesMatched: 14, realPropertiesAvailable: 14,
    }));
    expect(d.reason).toBe("useful_preference");
    expect(d.priority).toBe("useful");
    expect(d.question?.toLowerCase()).toMatch(/budget|mid-range|upmarket/);
  });

  it("missing area in Yogyakarta suggests Malioboro/Prawirotaman (useful)", () => {
    const d = decideAccommodationInsight(makeInput({
      mergedSlots: { location: "yogyakarta", type: "hotel", budget: "budget" },
      realPropertiesMatched: 14, realPropertiesAvailable: 14,
    }));
    expect(d.reason).toBe("useful_preference");
    expect(d.question?.toLowerCase()).toContain("malioboro");
  });

  it("narrow result set offers next-action opportunity (optional)", () => {
    const d = decideAccommodationInsight(makeInput({
      mergedSlots: { location: "yogyakarta", type: "hotel", budget: "budget", area: "malioboro" },
      realPropertiesMatched: 3, realPropertiesAvailable: 14,
    }));
    expect(d.reason).toBe("opportunity");
    expect(d.priority).toBe("optional");
    expect(d.question?.toLowerCase()).toMatch(/directory|refine/);
  });

  it("over-narrowed (0 matched from many available) offers to relax filters", () => {
    const d = decideAccommodationInsight(makeInput({
      mergedSlots: { location: "yogyakarta", type: "villa", budget: "luxury", area: "malioboro" },
      realPropertiesMatched: 0, realPropertiesAvailable: 14,
    }));
    expect(d.reason).toBe("clarification");
    expect(d.priority).toBe("useful");
    expect(d.question?.toLowerCase()).toMatch(/relax|widen/);
  });

  it("stays silent (reason=none) when everything relevant is known and results are healthy", () => {
    const d = decideAccommodationInsight(makeInput({
      mergedSlots: { location: "yogyakarta", type: "hotel", budget: "budget", area: "malioboro" },
      realPropertiesMatched: 10, realPropertiesAvailable: 14,
    }));
    expect(d.reason).toBe("none");
    expect(d.shouldSpeak).toBe(false);
    expect(d.priority).toBe("optional");
    expect(d.presentation).toBe("regular");
  });
});

describe("Eureka presentation state (Philip 2026-08-31)", () => {
  it("over-narrowed clarification presents as EUREKA with grounded observation", () => {
    // All required + preference slots filled so we reach the
    // over-narrowed signal (signal ordering: budget/area asked first).
    const d = decideAccommodationInsight(makeInput({
      mergedSlots: { location: "yogyakarta", type: "villa", budget: "luxury", area: "malioboro" },
      realPropertiesMatched: 0, realPropertiesAvailable: 14,
    }));
    expect(d.reason).toBe("clarification");
    expect(d.presentation).toBe("eureka");
    // Eureka opener is baked into the question.
    expect(d.question?.toLowerCase()).toContain("one thing i noticed");
    // Must cite the ACTUAL available count · never fabricated.
    expect(d.question).toContain("14");
  });

  it("all non-eureka signals present as REGULAR (default state)", () => {
    // Missing-slot
    expect(decideAccommodationInsight(makeInput({ mergedSlots: {} })).presentation).toBe("regular");
    // Useful-preference
    expect(decideAccommodationInsight(makeInput({
      mergedSlots: { location: "yogyakarta", type: "hotel" },
    })).presentation).toBe("regular");
    // Learning-gap
    expect(decideAccommodationInsight(makeInput({
      message: "How much?", isPriceQuestion: true, mergedSlots: { location: "yogyakarta", type: "hotel" },
    })).presentation).toBe("regular");
    // Contradiction (uses "Switching to X" opener, not eureka)
    expect(decideAccommodationInsight(makeInput({
      priorSlots: { type: "hotel", location: "yogyakarta" },
      extraction: { slots: { type: "guesthouse" }, correction: true, isKnowledgeQuestion: false },
      mergedSlots: { type: "guesthouse", location: "yogyakarta" },
    })).presentation).toBe("regular");
    // Book intent
    expect(decideAccommodationInsight(makeInput({
      mergedSlots: { action: "book" }, isBookIntent: true,
    })).presentation).toBe("regular");
  });
});

describe("decideAccommodationInsight · signal precedence", () => {
  it("book intent beats missing-slot questions (don't ask for city while user is trying to book)", () => {
    const d = decideAccommodationInsight(makeInput({
      mergedSlots: { action: "book" }, // no location, no type
      isBookIntent: true,
    }));
    expect(d.reason).toBe("opportunity");
    expect(d.question).toMatch(/can'?t book/i);
  });

  it("price question beats useful_preference (don't ask 'budget?' when they asked 'how much?')", () => {
    const d = decideAccommodationInsight(makeInput({
      message: "How much?",
      mergedSlots: { location: "yogyakarta", type: "hotel" }, // budget still missing
      isPriceQuestion: true,
    }));
    expect(d.reason).toBe("learning_gap");
    expect(d.learningGap?.scope).toBe("accommodation.pricing");
  });

  it("contradiction beats amenity gap (user's correction is the most important signal)", () => {
    const priorSlots: AccommodationSlots = { type: "hotel", location: "yogyakarta" };
    const extraction: ExtractResult = {
      slots: { type: "guesthouse", amenities: ["pool"] },
      correction: true, isKnowledgeQuestion: false,
    };
    const d = decideAccommodationInsight(makeInput({
      priorSlots, extraction,
      mergedSlots: { type: "guesthouse", location: "yogyakarta", amenities: ["pool"] },
      isAmenityQuestion: true, amenitiesAsked: ["pool"],
      realPropertiesMatched: 5, realPropertiesAvailable: 14,
    }));
    expect(d.reason).toBe("contradiction");
  });
});
