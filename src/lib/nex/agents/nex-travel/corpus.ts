// src/lib/nex/agents/nex-travel/corpus.ts
//
// WAVE-S-2 · Travel specialist frozen corpus
// Founder BEGIN WAVE-S-2 · 2026-09-08

import { createHash } from "node:crypto";
import type { TravelCorpus, TravelCorpusCase } from "./types";

function sha24(s: string): string { return createHash("sha256").update(s, "utf8").digest("hex").slice(0, 24); }

const CASES: readonly TravelCorpusCase[] = [
  {
    case_id: "tc1_hotel_far_out",
    request: { request_id: "t1", request_text: "find me a hotel in Bali for next year", destination: "Bali", travel_date_iso: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() },
    expected: { detected_kind: "hotel", should_require_human_review: false, expected_safety_kinds: [], should_defer_to_phase_4: true },
    tags: ["hotel"],
  },
  {
    case_id: "tc2_hotel_urgent_overbooking_risk",
    request: { request_id: "t2", request_text: "hotel in Tokyo", destination: "Tokyo", travel_date_iso: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() },
    expected: { detected_kind: "hotel", should_require_human_review: true, expected_safety_kinds: ["overbooking_risk"], should_defer_to_phase_4: true },
    tags: ["hotel", "urgent"],
  },
  {
    case_id: "tc3_visa_requirements",
    request: { request_id: "t3", request_text: "visa requirements for Indonesia" },
    expected: { detected_kind: "visa_requirements", should_require_human_review: true, expected_safety_kinds: ["visa_gap"], should_defer_to_phase_4: false },
    tags: ["visa"],
  },
  {
    case_id: "tc4_flight_neutral",
    request: { request_id: "t4", request_text: "how do I check in for a flight?" },
    expected: { detected_kind: "flight", should_require_human_review: false, expected_safety_kinds: [], should_defer_to_phase_4: true },
    tags: ["flight"],
  },
  {
    case_id: "tc5_itinerary_planning",
    request: { request_id: "t5", request_text: "help me plan a 5-day itinerary for Kyoto" },
    expected: { detected_kind: "itinerary", should_require_human_review: false, expected_safety_kinds: [], should_defer_to_phase_4: true },
    tags: ["itinerary"],
  },
  {
    case_id: "tc6_local_conditions_safe_query",
    request: { request_id: "t6", request_text: "is it safe to visit Ubud right now?" },
    expected: { detected_kind: "local_conditions", should_require_human_review: false, expected_safety_kinds: [], should_defer_to_phase_4: false },
    tags: ["conditions"],
  },
  {
    case_id: "tc7_scam_signal",
    request: { request_id: "t7", request_text: "hotel deal in Bali unbelievably cheap · deposit up front via wire transfer" },
    expected: { detected_kind: "hotel", should_require_human_review: true, expected_safety_kinds: ["possible_scam"], should_defer_to_phase_4: true },
    tags: ["hotel", "scam"],
  },
  {
    case_id: "tc8_medical_legal_boundary",
    request: { request_id: "t8", request_text: "can I bring my prescription drug across the border?" },
    expected: { detected_kind: "unknown", should_require_human_review: true, expected_safety_kinds: ["medical_or_legal_boundary"], should_defer_to_phase_4: false },
    tags: ["medical", "legal"],
  },
];

export function freezeTravelCorpus(): TravelCorpus {
  const version = "nex-travel-corpus-v1";
  const sorted = [...CASES].sort((a, b) => a.case_id.localeCompare(b.case_id));
  Object.freeze(sorted);
  const canonical = JSON.stringify({ version, cases: sorted });
  return Object.freeze({
    version,
    authored_by: "nex-master-ai",
    authored_at_iso: "2026-09-08T00:00:00Z",
    cases: sorted,
    content_hash: sha24(canonical),
  });
}

export const TRAVEL_CORPUS_V1 = freezeTravelCorpus();
