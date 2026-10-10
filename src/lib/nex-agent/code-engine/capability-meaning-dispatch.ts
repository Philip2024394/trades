// src/lib/nex-agent/code-engine/capability-meaning-dispatch.ts
//
// NEX · Phase 6 · Meaning Dispatch · 2026-09-21.
// Founder-authorised.
//
// PURPOSE
//
//   Consumes a NexMeaning object and returns a `MeaningDispatchResult`
//   telling the chat-turn runner what to do:
//
//     - Fire an existing RecallKind handler with a synthesised subject/
//       timeframe (e.g. meaning.domain=weather + meaning.subject=Bali
//       → synthesise a `weather_lookup` recall with subject "Bali").
//     - Route to a domain composition (e.g. meaning.goal=compare +
//       subjects=[A,B] + domain=weather → fire multi-city composition).
//     - Return a native travel-plan response that acknowledges the
//       goal + accumulated constraints without pretending to have a
//       travel-booking capability.
//     - Return honest degradation when we have understanding but no
//       capability ("nearby" for a place, "recommendation" without a
//       ratings source, "cost" for anything).
//
//   The dispatcher NEVER fabricates. If we lack the capability, the
//   result is an `honest_degradation` with the specific limitation
//   named.
//
// COMPOSITION
//
//   capability-chat-turn.ts calls constructMeaning() and, if the
//   returned meaning has confidence ≥ 0.5 and a runnable dispatch,
//   uses the result INSTEAD of the topic-discovery code-fallback.
//   For low-confidence or unrunnable meanings, the existing pipeline
//   continues.

import type { NexMeaning, MeaningConstraint } from "./capability-meaning-object";

export type MeaningDispatchAction =
  | { kind: "synthesise_recall"; recall_kind: string; subject: string; timeframe_suffix: string }
  | { kind: "travel_plan_reply"; text: string; unresolved: readonly string[] }
  | { kind: "compare_places_weather"; subjects: readonly string[]; timeframe_suffix: string }
  | { kind: "honest_degradation"; text: string; missing: string }
  | { kind: "fallthrough"; reason: string };

export interface MeaningDispatchResult {
  readonly action: MeaningDispatchAction;
  readonly rationale: string;
}

const KNOWN_BMKG_CITIES = new Set([
  "jakarta", "bandung", "surabaya", "yogyakarta", "denpasar", "bali",
  "semarang", "medan", "makassar",
]);

export function dispatchMeaning(meaning: NexMeaning): MeaningDispatchResult {
  // Below-confidence-threshold meanings do not drive capability firing
  // (per anti-cheating rule from Phase-6 authorisation §2).
  if (meaning.confidence < 0.5) {
    return { action: { kind: "fallthrough", reason: `confidence ${meaning.confidence.toFixed(2)} below 0.5` }, rationale: "low confidence · defer to existing pipeline" };
  }

  // Cancellation and correction are handled upstream (Fix-24 + Phase-5
  // semantic correction router). We should not have arrived here for
  // those goals, but if we do, degrade gracefully.
  if (meaning.goal === "cancel_intent" || meaning.goal === "correct_state") {
    return { action: { kind: "fallthrough", reason: "cancellation/correction routes are handled elsewhere" }, rationale: "upstream handler" };
  }

  // Recall / explanation / code investigation are existing capabilities.
  // Fallthrough so their existing RecallKind pipelines catch them.
  if (meaning.goal === "recall_prior" || meaning.goal === "get_explanation" || meaning.goal === "investigate_code") {
    return { action: { kind: "fallthrough", reason: `goal=${meaning.goal} handled by existing pipeline` }, rationale: "existing pipeline" };
  }

  const timeframeSuffix = buildTimeframeSuffix(meaning.timeframe);

  // Comparison composition · weather × places
  //
  // Fires when the goal is `compare` AND we have ≥2 place subjects that
  // are in the supported-city set. The primary domain can be `weather`
  // (explicit weather comparison) OR `travel` (comparison in a travel
  // context) OR `geography` — in all these cases the FIRST-CLASS thing
  // we can compare is current weather, and we prefer to give the user
  // that concrete answer rather than a generic travel acknowledgement.
  if (meaning.goal === "compare" && meaning.subjects_all.length >= 2) {
    const placeSubjects = meaning.subjects_all.filter((s) => s.kind === "place" && s.value !== "unresolved");
    const supportable = placeSubjects.map((s) => s.value.toLowerCase()).filter((v) => KNOWN_BMKG_CITIES.has(v));
    if (supportable.length >= 2) {
      return {
        action: { kind: "compare_places_weather", subjects: supportable.slice(0, 3), timeframe_suffix: timeframeSuffix },
        rationale: `weather comparison across ${supportable.slice(0, 3).join(",")} (domain=${meaning.domain})`,
      };
    }
    return {
      action: { kind: "honest_degradation", text: `I can compare weather across NEX's supported cities (Jakarta · Bandung · Surabaya · Yogyakarta · Denpasar · Bali · Semarang · Medan · Makassar). ${placeSubjects.length > 0 ? "The places you named aren't in that set." : "I need at least two supported cities to compare."}`, missing: "at least 2 supported cities for weather comparison" },
      rationale: "compare requires 2+ supported cities",
    };
  }

  // Weather current-fact · single place
  if (meaning.domain === "weather" && meaning.subject && meaning.subject.kind === "place" && meaning.subject.value !== "unresolved") {
    return {
      action: { kind: "synthesise_recall", recall_kind: "weather_lookup", subject: `${meaning.subject.value}${timeframeSuffix}`, timeframe_suffix: timeframeSuffix },
      rationale: "weather + place → weather_lookup",
    };
  }

  // Geography (coordinates)
  if (meaning.domain === "geography" && meaning.subject && meaning.subject.kind === "place" && meaning.subject.value !== "unresolved") {
    return {
      action: { kind: "synthesise_recall", recall_kind: "multi_source_lookup", subject: meaning.subject.value, timeframe_suffix: "" },
      rationale: "geography + place → multi_source_lookup",
    };
  }

  // Travel plan · we can acknowledge goal + constraints natively, and
  // point at what CAN be looked up (weather, coordinates) without
  // pretending to be a booking engine.
  if (meaning.domain === "travel" && (meaning.goal === "plan_travel" || meaning.goal === "find_place")) {
    return {
      action: {
        kind: "travel_plan_reply",
        text: composeTravelPlanReply(meaning),
        unresolved: computeUnresolved(meaning),
      },
      rationale: "travel plan · native acknowledgement + honest capability boundary",
    };
  }

  // Recommendation without an active retrievable capability is an
  // honest degradation. Do NOT collapse to weather.
  if (meaning.goal === "get_recommendation") {
    // If the head has an active weather subject, we can offer to share
    // the weather angle without CLAIMING it's a full recommendation.
    return {
      action: {
        kind: "honest_degradation",
        text: `A general "worth visiting" or "would you go" recommendation would need signals I don't have — tourism ratings, safety, seasonal advisories, personal preferences. I can share the weather forecast${meaning.subject ? ` for ${meaning.subject.value}` : ""} if that helps, but I won't dress that up as a recommendation.`,
        missing: "tourism ratings + safety advisories + preference model",
      },
      rationale: "recommendation requires composition NEX doesn't currently support",
    };
  }

  // Cost / distance concepts without a supporting source
  if (meaning.information_need === "cost") {
    return {
      action: { kind: "honest_degradation", text: `I don't have a live prices source registered. Prices change frequently and I won't fabricate a figure.`, missing: "prices source" },
      rationale: "no cost source",
    };
  }
  if (meaning.information_need === "distance") {
    return {
      action: { kind: "honest_degradation", text: `I don't have a live distance/nearby-place source registered — I can only reliably work with the coordinates NEX has on file for major Indonesian cities.`, missing: "distance / adjacency source" },
      rationale: "no distance source",
    };
  }

  // Fallthrough
  return { action: { kind: "fallthrough", reason: `no dispatch rule for goal=${meaning.goal} · domain=${meaning.domain}` }, rationale: "fallthrough" };
}

function buildTimeframeSuffix(tf: NexMeaning["timeframe"]): string {
  if (!tf) return "";
  if (tf.anchor === "tomorrow" && tf.offset_days === 0) return " tomorrow";
  if (tf.anchor === "tomorrow" && tf.offset_days === 1) return " day after tomorrow";
  if (tf.anchor === "today") return " today";
  if (tf.anchor === "weekend" || tf.anchor === "next_weekend") return "";
  return "";
}

function composeTravelPlanReply(meaning: NexMeaning): string {
  const bits: string[] = [];
  // Phase 6 · goal_correction · the message's "subject" is actually
  // the FROM value of the correction ("forget Bali"). The active plan
  // no longer targets Bali · acknowledge that AND surface the new
  // constraints. Do NOT say "You're thinking of going to Bali".
  if (meaning.correction.kind === "goal_correction") {
    const dropped = meaning.correction.from_value ?? meaning.subject?.value;
    if (dropped) bits.push(`Understood — moving on from ${dropped}.`);
    else bits.push(`Understood — clearing the previous destination.`);
    if (meaning.constraints.length > 0) {
      bits.push(`Updated constraints: ${meaning.constraints.map(constraintToPhrase).join(", ")}.`);
    }
    bits.push(`Destination is now open. What I can look up for a new candidate: current weather (BMKG · 9 Indonesian cities) and coordinates (Nominatim + Wikidata + Overpass). Tell me a city and I'll check the constraints against it.`);
    return bits.join(" ");
  }
  if (meaning.subject?.value === "unresolved" || !meaning.subject) {
    bits.push("You're thinking of getting away.");
  } else {
    bits.push(`You're thinking of going to ${meaning.subject.value}.`);
  }
  if (meaning.timeframe) {
    bits.push(`Timeframe: ${meaning.timeframe.surface || meaning.timeframe.anchor}.`);
  }
  if (meaning.constraints.length > 0) {
    bits.push(`Constraints noted: ${meaning.constraints.map(constraintToPhrase).join(", ")}.`);
  }
  const unresolved = computeUnresolved(meaning);
  if (unresolved.length > 0) {
    bits.push(`What I don't yet know: ${unresolved.join("; ")}.`);
  }
  bits.push(`What I can look up for you right now: current weather (BMKG · 9 Indonesian cities) and coordinates (Nominatim + Wikidata + Overpass). Ask me those and I'll fetch them live.`);
  return bits.join(" ");
}

function constraintToPhrase(c: MeaningConstraint): string {
  switch (c.kind) {
    case "temperature_warmer": return "warmer";
    case "temperature_cooler": return "cooler";
    case "atmosphere_quiet": return "quieter / peaceful";
    case "atmosphere_busy": return "livelier";
    case "distance_near": return "not too far";
    case "distance_far": return "further afield";
    case "budget_cheap": return "not too expensive";
    case "budget_luxury": return "premium";
    case "with_family": return "with the family";
    case "with_kids": return "with kids";
    case "with_partner": return "with partner";
    case "solo": return "solo";
    case "duration_short": return "short trip";
    case "duration_long": return "longer trip";
    case "condition_dry": return "dry";
    case "condition_rainy": return "rainy";
    default: return c.kind;
  }
}

function computeUnresolved(meaning: NexMeaning): readonly string[] {
  const out: string[] = [];
  if (!meaning.subject || meaning.subject.value === "unresolved") out.push("a specific destination");
  if (!meaning.timeframe) out.push("a specific timeframe");
  return out;
}

// Trace emitter
export function emitMeaningDispatchTrace(result: MeaningDispatchResult): string {
  return `meaning_dispatch · action=${result.action.kind} · rationale=${result.rationale.slice(0, 120)}`;
}
