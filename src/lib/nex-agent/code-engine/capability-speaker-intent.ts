// src/lib/nex-agent/code-engine/capability-speaker-intent.ts
//
// NEX1 · Fix 29 · Speaker-Intent Inference (ToM analogue).
// Founder-authorised 2026-09-18.
//
// PURPOSE
//   Recognise that certain surface-analytical verb combinations imply the
//   speaker actually wants a CODING outcome even though no coding verb
//   appears on the surface.
//
//   Rule-based · deterministic · zero LLM. This is NOT a general Theory of
//   Mind; it is a specific pragmatic pattern:
//
//     "analyse … identify … explain what is wrong … propose a correction"
//       → the speaker wants a fix
//     "investigate … find the bug … then fix it"
//       → the speaker wants a fix
//     "why is X broken?"
//       → the speaker wants a fix
//
//   Distinct from Fix 25 (which routes AFTER investigation completes based
//   on structural evidence). Fix 29 acts UPSTREAM at classification time.
//
//   CONSTITUTIONAL PRESERVATION
//   - Zero LLM.
//   - Does not modify the classifier; produces a supplementary inferred
//     intent that a consumer may OPT-IN to using.
//   - Never authorises action. The user must still authorise via Turn 2.
//   - Does not touch Q7/Q8/Fix 23/Schema V1.

export type InferredIntent =
  | "CODING_FIX_REQUEST"
  | "INVESTIGATION_ONLY"
  | "UNCLEAR";

export interface SpeakerIntentInput {
  readonly user_message: string;
  /** Optional set of verb-family hits already extracted by the classifier.
   *  When provided, this is used to strengthen the inference. */
  readonly classifier_verb_families?: readonly string[];
}

export interface SpeakerIntentResult {
  readonly evidence_kind: "INFERRED";
  readonly intent: InferredIntent;
  readonly confidence: number; // deterministic 0..1
  readonly rule_hits: readonly string[];
  readonly rationale: string;
}

// ── Deterministic pattern set ─────────────────────────────────────────────

// Patterns whose co-occurrence in the message strongly implies coding intent
const INVESTIGATIVE_VERBS = [
  "analyse", "analyze", "investigate", "look at", "check", "review", "inspect",
  "diagnose", "explain", "identify", "explore", "examine",
];
const FIX_INTENT_MARKERS = [
  "propose a correction",
  "propose a fix",
  "fix the",
  "fix it",
  "correct the",
  "correct it",
  "make it work",
  "make it right",
  "what is wrong",
  "what's wrong",
  "why is it",
  "why does it",
  "why doesn't it",
  "find the bug",
  "find the issue",
  "find the error",
  "find what is wrong",
  "resolve the",
  "repair the",
  "the tests are failing",
  "not working",
];
const PURE_INVESTIGATION_MARKERS = [
  "explain the design",
  "explain the architecture",
  "how does",
  "what does this do",
  "give me an overview",
  "walk me through",
  "tell me about",
  "document",
  "summarise",
  "summarize",
];

function countMatches(text: string, phrases: readonly string[]): { count: number; hits: string[] } {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const p of phrases) {
    if (lower.includes(p)) hits.push(p);
  }
  return { count: hits.length, hits };
}

export function inferSpeakerIntent(input: SpeakerIntentInput): SpeakerIntentResult {
  const msg = (input.user_message || "").trim();
  if (msg === "") {
    return {
      evidence_kind: "INFERRED",
      intent: "UNCLEAR",
      confidence: 0,
      rule_hits: [],
      rationale: "empty message",
    };
  }
  const inv = countMatches(msg, INVESTIGATIVE_VERBS);
  const fix = countMatches(msg, FIX_INTENT_MARKERS);
  const pure = countMatches(msg, PURE_INVESTIGATION_MARKERS);
  const classifierSaysFix =
    (input.classifier_verb_families ?? []).includes("FIX") ||
    (input.classifier_verb_families ?? []).includes("MODIFY");
  const classifierSaysInvestigate =
    (input.classifier_verb_families ?? []).includes("INVESTIGATE");

  // Strong CODING_FIX signals:
  //  - any fix-intent marker present
  //  - OR classifier already said FIX/MODIFY
  //  - AND (implicitly) at least one investigative verb OR fix marker
  const hasFixSignal = fix.count > 0 || classifierSaysFix;
  const hasInvestigativeSurface = inv.count > 0 || classifierSaysInvestigate;
  const hasPureInvestigationSignal = pure.count > 0;

  if (hasFixSignal) {
    const conf = Math.min(
      0.95,
      0.5 + 0.15 * fix.count + (classifierSaysFix ? 0.2 : 0) + (hasInvestigativeSurface ? 0.1 : 0),
    );
    return {
      evidence_kind: "INFERRED",
      intent: "CODING_FIX_REQUEST",
      confidence: Math.round(conf * 100) / 100,
      rule_hits: [...fix.hits, ...(classifierSaysFix ? ["classifier:FIX"] : [])],
      rationale:
        `fix-intent markers (${fix.count}) + investigative-surface (${inv.count}) + classifier=${classifierSaysFix ? "FIX" : classifierSaysInvestigate ? "INVESTIGATE" : "n/a"} → CODING_FIX_REQUEST`,
    };
  }
  if (hasPureInvestigationSignal && !hasFixSignal) {
    return {
      evidence_kind: "INFERRED",
      intent: "INVESTIGATION_ONLY",
      confidence: Math.min(0.9, 0.55 + 0.1 * pure.count),
      rule_hits: pure.hits,
      rationale:
        `pure-investigation markers (${pure.count}), no fix markers · INVESTIGATION_ONLY`,
    };
  }
  if (hasInvestigativeSurface && !hasFixSignal && !hasPureInvestigationSignal) {
    // Analytical prose without explicit fix cue. Still likely INVESTIGATION;
    // consumer can prompt for clarification.
    return {
      evidence_kind: "INFERRED",
      intent: "INVESTIGATION_ONLY",
      confidence: 0.55,
      rule_hits: inv.hits,
      rationale:
        `investigative verbs (${inv.count}), no clear fix or pure-investigation cue · defaulting to INVESTIGATION_ONLY`,
    };
  }
  return {
    evidence_kind: "INFERRED",
    intent: "UNCLEAR",
    confidence: 0.3,
    rule_hits: [],
    rationale: "no strong pragmatic cue in either direction",
  };
}

export const SPEAKER_INTENT_VERSION = "fix29.v1";
