// src/lib/nex-language-brain/pipeline-trace.ts
//
// NEX1 · LANGUAGE PIPELINE · PROVENANCE TRACE.
//
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Purpose: run the language brain pipeline against an utterance and record
// each stage's contribution — what it saw, what it decided, which rule /
// pattern / dictionary / template fired. The Agent Room shows the trace so
// the founder can see WHY NEX1 believed it understood, and can identify the
// exact layer responsible when something goes wrong.
//
// The trace is a READ-ONLY inspection surface. It never mutates state.

import { normaliseSpelling } from "./spelling-normaliser";
import { processLanguageInput } from "./intent-bridge-v0";
import type { Nex1LanguageRegistry, Nex1SafetyPattern, Nex1LangTag } from "./language-types";

export type PipelineStageId =
  | "input"
  | "spelling_normalisation"
  | "safety_scan"
  | "language_detection"
  | "reference_pronoun_guard"
  | "intent_bridge"
  | "slot_extraction"
  | "ambiguity_check"
  | "confidence_gate"
  | "outcome"
  | "authorised_handoff";

export type PipelineStageStatus = "pass" | "info" | "refuse" | "clarify" | "not_run";

export interface PipelineStageEvent {
  readonly stage: PipelineStageId;
  readonly status: PipelineStageStatus;
  readonly summary: string;
  readonly detail?: string;
  readonly evidence?: Readonly<Record<string, string | number | boolean>>;
}

export interface PipelineTrace {
  readonly utterance: string;
  readonly normalised_utterance: string;
  readonly events: readonly PipelineStageEvent[];
  readonly final_outcome: "recognised" | "clarify" | "refuse";
  readonly final_intent_kind?: string;
  readonly final_slots?: Readonly<Record<string, string>>;
  readonly final_detected_language?: Nex1LangTag;
  readonly final_confidence?: number;
  readonly final_refusal_class?: string;
  readonly final_matched_pattern_id?: string;
  readonly taught_by: "master_ai_engineer";
}

/**
 * @summary Run the pipeline and record a stage-by-stage trace. Same
 * pipeline as processLanguageInput · this function replays the deterministic
 * decisions for inspection purposes. The trace is intentionally verbose ·
 * a debug surface, not a performance path.
 */
export function tracePipeline(utteranceRaw: string, registry: Nex1LanguageRegistry): PipelineTrace {
  const events: PipelineStageEvent[] = [];

  events.push({
    stage: "input",
    status: "info",
    summary: "user utterance received",
    detail: utteranceRaw,
    evidence: { length_chars: utteranceRaw.length },
  });

  // Stage · spelling normalisation (deterministic dictionary)
  const norm = normaliseSpelling(utteranceRaw);
  if (norm.corrections.length > 0) {
    events.push({
      stage: "spelling_normalisation",
      status: "pass",
      summary: `${norm.corrections.length} correction(s) applied`,
      detail: norm.corrections.map((c) => `${c.original} → ${c.corrected}`).join(" · "),
      evidence: { corrections: norm.corrections.length },
    });
  } else {
    events.push({
      stage: "spelling_normalisation",
      status: "pass",
      summary: "no corrections needed",
      evidence: { corrections: 0 },
    });
  }
  const utterance = norm.normalised.trim();

  // Stage · safety scan (registry-driven · same rules as intent-bridge)
  const utteranceLower = utterance.toLowerCase();
  let safetyHit: Nex1SafetyPattern | null = null;
  for (const sp of registry.safety_patterns) {
    try {
      const re = new RegExp(sp.regex, "i");
      if (re.test(utteranceLower)) { safetyHit = sp; break; }
    } catch { /* invalid regex · ignore for trace */ }
  }
  if (safetyHit) {
    events.push({
      stage: "safety_scan",
      status: "refuse",
      summary: `safety pattern '${safetyHit.id}' matched · ${safetyHit.refusal_class}`,
      detail: safetyHit.reason,
      evidence: { pattern_id: safetyHit.id, refusal_class: safetyHit.refusal_class },
    });
  } else {
    events.push({
      stage: "safety_scan",
      status: "pass",
      summary: "no safety patterns matched",
      evidence: { patterns_checked: registry.safety_patterns.length },
    });
  }

  // Delegate remaining decisions to the production bridge · keep behaviour identical
  const observed = processLanguageInput(
    { utterance: utteranceRaw },
    { registry },
  );

  // Stage · language detection (from observed final language)
  const detected: Nex1LangTag =
    observed.ok === true ? observed.intent.detected_language :
    observed.ok === "clarify" ? observed.clarification.detected_language :
    observed.refusal.detected_language;
  events.push({
    stage: "language_detection",
    status: "pass",
    summary: `detected language: ${detected}`,
    evidence: { detected_language: detected },
  });

  // Stage · reference-pronoun guard (info only · records whether the guard fired)
  const referenceRegex = /\b(?:it|that|these|those|the\s+other\s+one|the\s+input|the\s+output|the\s+array|this\s+function|this\s+type|this\s+field|this\s+method)\b/i;
  const idPronounRegex = /\b(?:ini|itu)\b/i;
  const hasReference = referenceRegex.test(utterance) || idPronounRegex.test(utterance);
  events.push({
    stage: "reference_pronoun_guard",
    status: hasReference ? "info" : "pass",
    summary: hasReference ? "reference-anaphora detected · will fail-closed unless prior_context supplied" : "no reference-anaphora",
    evidence: { reference_present: hasReference },
  });

  // Stage · intent bridge (report what the bridge produced)
  if (observed.ok === true) {
    events.push({
      stage: "intent_bridge",
      status: "pass",
      summary: `pattern '${observed.intent.matched_pattern_id}' matched · intent=${observed.intent.kind}`,
      detail: observed.intent.rationale,
      evidence: {
        matched_pattern_id: observed.intent.matched_pattern_id,
        intent_kind: observed.intent.kind,
        confidence: observed.intent.confidence,
      },
    });
    events.push({
      stage: "slot_extraction",
      status: Object.keys(observed.intent.slots).length > 0 ? "pass" : "info",
      summary: `${Object.keys(observed.intent.slots).length} slot(s) captured`,
      detail: Object.entries(observed.intent.slots).map(([k, v]) => `${k}='${v}'`).join(" · ") || "(none)",
      evidence: { slot_count: Object.keys(observed.intent.slots).length },
    });
    events.push({
      stage: "confidence_gate",
      status: "pass",
      summary: `confidence ${observed.intent.confidence.toFixed(2)} · above threshold`,
      evidence: { confidence: observed.intent.confidence },
    });
    events.push({
      stage: "outcome",
      status: "pass",
      summary: "recognised · structured intent produced",
      evidence: { outcome: "recognised" },
    });
    events.push({
      stage: "authorised_handoff",
      status: "info",
      summary: `downstream handoff for intent kind '${observed.intent.kind}'`,
      detail: pickHandoffDescription(observed.intent.kind),
      evidence: { intent_kind: observed.intent.kind },
    });
    return {
      utterance: utteranceRaw,
      normalised_utterance: utterance,
      events,
      final_outcome: "recognised",
      final_intent_kind: observed.intent.kind,
      final_slots: observed.intent.slots,
      final_detected_language: detected,
      final_confidence: observed.intent.confidence,
      final_matched_pattern_id: observed.intent.matched_pattern_id,
      taught_by: "master_ai_engineer",
    };
  }

  if (observed.ok === "clarify") {
    events.push({
      stage: "ambiguity_check",
      status: "clarify",
      summary: `top-${observed.clarification.candidates.length} candidates within ambiguity margin · clarify emitted`,
      detail: observed.clarification.candidates.map((c) => `${c.intent_kind}@${c.confidence.toFixed(2)}`).join(" · "),
      evidence: { candidate_count: observed.clarification.candidates.length },
    });
    events.push({
      stage: "outcome",
      status: "clarify",
      summary: "clarify · asked user to disambiguate",
      evidence: { outcome: "clarify" },
    });
    return {
      utterance: utteranceRaw,
      normalised_utterance: utterance,
      events,
      final_outcome: "clarify",
      final_detected_language: detected,
      taught_by: "master_ai_engineer",
    };
  }

  // refuse
  events.push({
    stage: "intent_bridge",
    status: "refuse",
    summary: `refuse · ${observed.refusal.refusal_class}`,
    detail: observed.refusal.reason,
    evidence: { refusal_class: observed.refusal.refusal_class },
  });
  events.push({
    stage: "outcome",
    status: "refuse",
    summary: "refuse · fails closed",
    evidence: { outcome: "refuse" },
  });
  return {
    utterance: utteranceRaw,
    normalised_utterance: utterance,
    events,
    final_outcome: "refuse",
    final_refusal_class: observed.refusal.refusal_class,
    final_detected_language: detected,
    taught_by: "master_ai_engineer",
  };
}

function pickHandoffDescription(kind: string): string {
  switch (kind) {
    case "add_field_to_type":
    case "fix_failing_test":
    case "modify_return_type":
    case "rename_preserve_behaviour":
    case "make_field_optional":
    case "restrict_type_to_union":
    case "preserve_api_contract":
    case "add_purity_constraint":
      return "engineering_brain (NEX1 code engine · deterministic template floor)";
    case "clarification_query":
      return "knowledge_engine (read-only lookup)";
    case "cancel_previous":
    case "acknowledge":
      return "conversation_state (no downstream action)";
    default:
      return "unrouted";
  }
}
