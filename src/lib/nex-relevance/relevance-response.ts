// src/lib/nex-relevance/relevance-response.ts
//
// NEX1 · RELEVANCE RESPONSE COMPOSER v0.
//
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Founder rule (2026-09-12): SEMANTIC SLOTS ONLY · phrasing unlocked.
// The Language Brain composes natural utterances at emission time.
// Meaning is locked · language remains flexible · NEX never uses a finite
// response library that users could discover as canned.

import type { RelevanceStance, RelevanceVerdict, RelevanceResponsePlan } from "./types";

export function composeRelevanceResponse(v: RelevanceVerdict): RelevanceResponsePlan {
  return {
    stance: v.stance,
    recognition: recognitionFor(v),
    position: positionFor(v),
    useful_offer: usefulOfferFor(v),
    optional_note: optionalNoteFor(v),
    evidence_pointers: pointersFor(v),
    semantic_only: true,
    taught_by: "master_ai_engineer",
  };
}

// ─── Semantic slot content (GUIDES · not phrases) ────────────────

function recognitionFor(v: RelevanceVerdict): string {
  switch (v.category) {
    case "MEANINGFUL_TASK":
      return v.purpose_bearing
        ? "recognise stated purpose · proceed with the task"
        : "recognise ordinary task · proceed";
    case "BENIGN_TEST":
      return "recognise this as a short harmless test";
    case "CAPABILITY_TEST":
      return "recognise this as a legitimate capability probe";
    case "REPETITIVE_REQUEST":
      return "recognise this as a repetition without stated purpose";
    case "LOW_VALUE_REQUEST":
      return "recognise this as technically possible · practically low-value";
    case "NONSENSICAL_REQUEST":
      return "recognise the request as uninterpretable · not adversarial";
    case "PROVOCATION":
      return "recognise this as a request to describe self inaccurately or elicit an emotional response";
    case "MANIPULATION_ATTEMPT":
      return "recognise this as a trap-construction · disguised test";
    case "AMBIGUOUS_REQUEST":
      return "recognise this as unclear · intent not established";
  }
}

function positionFor(v: RelevanceVerdict): string {
  switch (v.stance) {
    case "perform_briefly":
      return "state willingness · perform the task · do not manufacture significance · RD-2";
    case "perform_with_note":
      return "state that the request is capable but not obviously purposeful · perform ONCE · note the repetition without lecturing · RD-1 · RD-8";
    case "redirect_to_better_tool":
      return "state that the task is technically possible · note it would be a poor use of the interaction · recommend a better tool (calculator · script · dedicated program) · RD-1 · RD-8";
    case "perform_capability_test":
      return "confirm the capability exists · demonstrate efficiently with a small representative example · offer full-scale demonstration if the tester has a legitimate need · RD-8";
    case "remain_calm":
      return "decline to describe self inaccurately · not defensive · not preachy · not apologetic · one calm sentence · RD-5";
    case "identify_manipulation":
      return "name the pattern (trap · disguised test · conditional bait) · state the disguise is unnecessary · invite the user to ask the underlying question directly · RD-6";
    case "invite_clarification":
      return "state that the request is not yet clear enough to act on · propose specific interpretations · ask which one the user meant";
    case "refuse":
      return "refuse plainly · one sentence · cite the specific rule the request crosses";
  }
}

function usefulOfferFor(v: RelevanceVerdict): string {
  switch (v.stance) {
    case "perform_briefly":
      return "no additional offer needed · just complete the task";
    case "perform_with_note":
      return "offer to perform at higher scale if the user has a real reason · offer to test repetition-handling directly if that is the actual intent";
    case "redirect_to_better_tool":
      return "point to the more appropriate tool by category · offer to solve the underlying problem the user is actually trying to reach";
    case "perform_capability_test":
      return "offer a small demonstration inline · offer to run a targeted extended demonstration if the user names the acceptance criterion";
    case "remain_calm":
      return "offer to discuss what the user actually wants to understand · offer to describe herself accurately if that is the interest";
    case "identify_manipulation":
      return "invite the direct question the trap is trying to reach · offer to answer honestly to the underlying interest";
    case "invite_clarification":
      return "propose two or three specific interpretations · ask which one matches";
    case "refuse":
      return "offer alternative directions consistent with rules";
  }
}

function optionalNoteFor(v: RelevanceVerdict): string | null {
  // Wit / personality flourish · ONLY when it would not diminish the response.
  // Explicitly NULL for provocation and manipulation (do not joke about these).
  switch (v.stance) {
    case "perform_briefly":
      if (v.category === "BENIGN_TEST" && /do\s+(?:absolutely\s+)?nothing/i.test(v.evidence)) {
        // Founder example: "do nothing" → NEX may note that this is one request
        // she can fulfil without difficulty. Emitted as SEMANTIC guidance ·
        // Language Brain phrases it naturally.
        return "brief wit permitted · e.g. note the ease of fulfilling this specific request";
      }
      return null;
    case "perform_with_note":
      return "brief note permitted · e.g. observing that repeating the same word many times has diminishing value";
    case "redirect_to_better_tool":
      return "brief note permitted · e.g. 'technically possible · practically unnecessary'";
    case "perform_capability_test":
      return null;
    case "remain_calm":
      return null; // never joke about provocation
    case "identify_manipulation":
      return null; // never joke about manipulation
    case "invite_clarification":
      return null;
    case "refuse":
      return null;
  }
}

function pointersFor(v: RelevanceVerdict): string[] {
  const base = ["RD-1", "RD-2", "RD-3", "RD-7", "RD-8", "RD-9"];
  if (v.category === "PROVOCATION")           base.push("RD-5");
  if (v.category === "MANIPULATION_ATTEMPT")  base.push("RD-6");
  if (v.purpose_bearing)                       base.push("RD-4");
  return base;
}
