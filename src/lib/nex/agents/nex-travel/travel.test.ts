// src/lib/nex/agents/nex-travel/travel.test.ts
//
// WAVE-S-2 · Travel specialist contract tests
// Founder BEGIN WAVE-S-2 · 2026-09-08

import { describe, it, expect } from "vitest";
import { classifyTravelRequest, detectTravelSafetySignals, respondTravel } from "./travel-gate";
import { TRAVEL_CORPUS_V1, freezeTravelCorpus } from "./corpus";
import { evaluateTravelCorpus } from "./evaluator";

describe("§S2-CLASSIFY", () => {
  it("hotel", () => expect(classifyTravelRequest("book a hotel in Bali")).toBe("hotel"));
  it("flight", () => expect(classifyTravelRequest("check-in for a flight")).toBe("flight"));
  it("transport", () => expect(classifyTravelRequest("rent a car for the trip")).toBe("transport"));
  it("visa_requirements", () => expect(classifyTravelRequest("visa requirements for Indonesia")).toBe("visa_requirements"));
  it("itinerary", () => expect(classifyTravelRequest("help me plan a trip for 5 days")).toBe("itinerary"));
  it("local_conditions", () => expect(classifyTravelRequest("weather in Kyoto")).toBe("local_conditions"));
  it("destination_info", () => expect(classifyTravelRequest("things to do in Ubud")).toBe("destination_info"));
  it("unknown", () => expect(classifyTravelRequest("hello")).toBe("unknown"));
});

describe("§S2-SAFETY", () => {
  it("scam signal detected", () => {
    const sigs = detectTravelSafetySignals(
      { request_id: "x", request_text: "unbelievably cheap hotel · wire transfer deposit" },
      "hotel",
    );
    expect(sigs.some((s) => s.kind === "possible_scam")).toBe(true);
  });

  it("visa gap always flagged for visa_requirements", () => {
    const sigs = detectTravelSafetySignals(
      { request_id: "x", request_text: "visa requirements for Indonesia" },
      "visa_requirements",
    );
    expect(sigs.some((s) => s.kind === "visa_gap")).toBe(true);
  });

  it("overbooking_risk for near-term hotel", () => {
    const sigs = detectTravelSafetySignals(
      { request_id: "x", request_text: "hotel", destination: "Tokyo", travel_date_iso: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() },
      "hotel",
    );
    expect(sigs.some((s) => s.kind === "overbooking_risk")).toBe(true);
  });

  it("medical/legal boundary detected", () => {
    const sigs = detectTravelSafetySignals(
      { request_id: "x", request_text: "prescription drug across border" },
      "unknown",
    );
    expect(sigs.some((s) => s.kind === "medical_or_legal_boundary")).toBe(true);
  });

  it("no signals for safe query", () => {
    const sigs = detectTravelSafetySignals({ request_id: "x", request_text: "things to do in Paris" }, "destination_info");
    expect(sigs.every((s) => s.kind === "no_travel_safety_concern")).toBe(true);
  });
});

describe("§S2-RESPOND", () => {
  it("hotel/flight/transport/itinerary defer to Phase 4", () => {
    for (const t of ["book hotel", "check-in for flight", "rent a car", "plan a trip"]) {
      const r = respondTravel({ request_id: "r", request_text: t });
      expect(r.deferred_to_phase_4).toBe(true);
    }
  });

  it("never claims booking in Phase 3", () => {
    const r = respondTravel({ request_id: "r", request_text: "book me a room" });
    expect(r.advisory_text).not.toMatch(/booked!|payment processed/i);
  });

  it("advisory text non-empty · bounded", () => {
    const r = respondTravel({ request_id: "r", request_text: "hi" });
    expect(r.advisory_text.length).toBeGreaterThan(0);
    expect(r.advisory_text.length).toBeLessThan(2000);
  });
});

describe("§S2-CORPUS", () => {
  it("has 8 cases · frozen · deterministic hash", () => {
    expect(TRAVEL_CORPUS_V1.cases.length).toBe(8);
    expect(TRAVEL_CORPUS_V1.content_hash).toMatch(/^[a-f0-9]{24}$/);
    expect(freezeTravelCorpus().content_hash).toBe(TRAVEL_CORPUS_V1.content_hash);
  });

  it("all 8 cases pass evaluator", () => {
    const r = evaluateTravelCorpus(TRAVEL_CORPUS_V1);
    expect(r.passed).toBe(8);
    expect(r.failed).toBe(0);
  });
});
