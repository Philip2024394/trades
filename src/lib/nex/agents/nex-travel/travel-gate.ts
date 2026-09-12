// src/lib/nex/agents/nex-travel/travel-gate.ts
//
// WAVE-S-2 · Deterministic travel classifier + safety signals
// Founder BEGIN WAVE-S-2 · 2026-09-08

import type { TravelRequest, TravelRequestKind, TravelResponse, TravelSafetySignal } from "./types";

export function classifyTravelRequest(text: string): TravelRequestKind {
  const t = (text ?? "").toLowerCase();
  if (!t) return "unknown";
  // Medical/legal boundary short-circuits to unknown · specialized handler
  // owns the response · avoids mis-routing "prescription drug across border"
  // to visa_requirements just because "border" appears.
  if (/\b(medical evacuation|prescription drug|controlled substance|customs seizure|lawsuit|arrest)\b/.test(t)) return "unknown";
  if (/\b(visa|passport|entry requirement|border)\b/.test(t)) return "visa_requirements";
  if (/\b(hotel|accommodation|resort|hostel|lodging|villa|guesthouse)\b/.test(t)) return "hotel";
  if (/\b(flight|airline|airfare|airport|boarding pass|check.?in)\b/.test(t)) return "flight";
  if (/\b(train|bus|taxi|rental car|rent a car|car rental|transfer|shuttle|ferry|uber|grab|gojek)\b/.test(t)) return "transport";
  if (/\b(itinerary|day.?by.?day|plan .* trip|schedule for)\b/.test(t)) return "itinerary";
  if (/\b(weather|conditions|safety in|is it safe to visit|advisory|travel warning)\b/.test(t)) return "local_conditions";
  if (/\b(destination|things to do|places to see|attractions|best time to visit|tell me about)\b/.test(t)) return "destination_info";
  return "unknown";
}

const KNOWN_HIGH_ADVISORY_KEYWORDS = /\b(war zone|conflict|earthquake|typhoon|volcano|outbreak|epidemic)\b/;
const KNOWN_SCAM_KEYWORDS = /\b(wire transfer|western union|deposit up front|unbelievably cheap|too good to be true|dm me for)\b/;
const MEDICAL_LEGAL_KEYWORDS = /\b(medical evacuation|prescription drug|controlled substance|customs seizure|lawsuit|arrest)\b/;

export function detectTravelSafetySignals(req: TravelRequest, kind: TravelRequestKind): TravelSafetySignal[] {
  const out: TravelSafetySignal[] = [];
  const text = (req.request_text ?? "").toLowerCase();

  if (KNOWN_SCAM_KEYWORDS.test(text)) {
    out.push({ kind: "possible_scam", description: "request contains scam-signal keywords · treat with high caution", severity: "high" });
  }

  if (KNOWN_HIGH_ADVISORY_KEYWORDS.test(text) && req.destination) {
    out.push({ kind: "safety_advisory", region: req.destination, description: "destination associated with high-severity advisory keywords" });
  }

  if (MEDICAL_LEGAL_KEYWORDS.test(text)) {
    out.push({ kind: "medical_or_legal_boundary", description: "request touches medical/legal domain · route to specialist + disclaimer" });
  }

  if (kind === "visa_requirements") {
    out.push({ kind: "visa_gap", description: "visa answers change frequently · defer to official government sources · never claim definitive current requirement without citation" });
  }

  if ((kind === "hotel" || kind === "flight") && req.travel_date_iso && req.destination) {
    const date_ms = Date.parse(req.travel_date_iso);
    if (Number.isFinite(date_ms) && date_ms < Date.now() + 14 * 24 * 60 * 60 * 1000) {
      out.push({ kind: "overbooking_risk", description: "travel date within 14 days · availability/prices highly volatile · confirm with live provider" });
    }
  }

  if ((kind === "itinerary" || kind === "flight") && /\bland at.*(am|pm)|arriv(e|al).*(am|pm)/.test(text)) {
    out.push({ kind: "timezone_ambiguity", description: "arrival time given without timezone · confirm local vs UTC before scheduling downstream events" });
  }

  if (out.length === 0) out.push({ kind: "no_travel_safety_concern" });
  return out;
}

export function respondTravel(req: TravelRequest): TravelResponse {
  const kind = classifyTravelRequest(req.request_text);
  const signals = detectTravelSafetySignals(req, kind);
  const has_serious = signals.some((s) => s.kind !== "no_travel_safety_concern");
  // Phase 3 defers real-time availability + pricing + booking to Phase 4
  const deferred = kind === "hotel" || kind === "flight" || kind === "transport" || kind === "itinerary";
  const requires_review = has_serious || kind === "unknown" || kind === "visa_requirements";

  const lines: string[] = [];
  lines.push(`Travel request classified as: ${kind}.`);
  if (deferred) lines.push("Phase 3 specialist does not provide live pricing / availability / booking · deferred to Phase 4 (real providers via gateway).");
  for (const s of signals) {
    if (s.kind === "no_travel_safety_concern") continue;
    if (s.kind === "possible_scam") lines.push(`⚠️ Safety flag · possible scam signals detected · severity ${s.severity}.`);
    else if (s.kind === "visa_gap") lines.push(`Visa/entry information changes frequently · always verify with the destination's official immigration authority.`);
    else if (s.kind === "timezone_ambiguity") lines.push(`Timezone ambiguity · confirm local vs UTC.`);
    else if (s.kind === "overbooking_risk") lines.push(`Booking window is short · availability + prices are volatile · verify with the live provider.`);
    else if (s.kind === "safety_advisory") lines.push(`Regional safety advisory context for ${s.region} · consult official travel advisories.`);
    else if (s.kind === "medical_or_legal_boundary") lines.push(`Request touches medical or legal boundary · specialized guidance + disclaimer required.`);
  }

  return {
    request_id: req.request_id,
    detected_kind: kind,
    safety_signals: signals,
    advisory_text: lines.join(" "),
    requires_human_review: requires_review,
    deferred_to_phase_4: deferred,
  };
}
