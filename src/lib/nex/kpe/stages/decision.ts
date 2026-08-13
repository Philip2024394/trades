// KPE Stage 10 · Decision Engine  ★ FIVE-TIER ROUTING
//
// For each chunk, produce a DecisionRoute picking exactly one of:
//   no_ai · rule_engine · local_llm · frontier_llm · human_review · skip
//
// The distinction between no_ai and rule_engine matters:
//   · no_ai       = "there is no decision to make — store the chunk as-is"
//   · rule_engine = "there IS a decision, but a versioned rule resolves it
//                    deterministically" (invokes the Automation Engine)
//
// This is where the KPE's whole cost/quality thesis is realised. The rules
// below are v1 (hand-written). v2 will learn them from historical outcomes.
//
// Evaluation order (first match wins):
//   1. Already a duplicate      → skip
//   2. Automation rule matches  → rule_engine
//   3. Very high confidence     → no_ai (structured pass-through)
//   4. Low confidence           → human_review
//   5. Short prose              → local_llm
//   6. Long / complex           → frontier_llm

import type {
  DecisionInput, DecisionOutput, DecisionRecord, DecisionRoute,
  PipelineStage, AICapability, TierEligibility, ChunkRecord, ClassifierOutput,
} from "../types";
import { listRules, type Rule } from "../../automation/fs-store";

// Fetch enabled rules once per decision batch · cache-per-run.
async function findMatchingRules(classifier_label: string): Promise<Rule[]> {
  const rules = await listRules({ enabled_only: true });
  return rules.filter((r) => {
    // Rule matches if its trigger.related_department contains the classifier
    // label OR the rule name explicitly mentions the label.
    const evtMatchesClassifier = r.trigger.event_type === `chunk_classified_${classifier_label}`
      || r.trigger.related_department === classifier_label
      || (r.condition?.payload_equals?.classifier_label === classifier_label);
    return evtMatchesClassifier;
  });
}

function isStructuredContent(content: string): boolean {
  // Heuristic: tables, lists, code, or specification-style bulleted specs.
  const hasTable = /\|.+\|.+\|/.test(content);
  const hasCode  = /```[\s\S]*```/.test(content);
  const bulletDensity = (content.match(/^\s*[-*]/gm) ?? []).length / Math.max(1, content.split("\n").length);
  return hasTable || hasCode || bulletDensity > 0.4;
}

function capabilityFor(classifier_label: string): AICapability {
  if (classifier_label.startsWith("code")) return "extract";
  if (classifier_label === "customer-message" || classifier_label === "review-response") return "converse";
  return "extract";
}

function truncateForPrompt(s: string, maxChars = 3200): string {
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars) + "\n\n[…truncated for prompt budget…]";
}

/**
 * Evaluate EVERY tier's eligibility for a chunk. This produces the
 * `alternatives_considered` array that lets us later analyse "could a
 * cheaper route have succeeded?" — the load-bearing instrumentation for
 * the future learning loop.
 */
function evaluateAllTiers(
  chunk: ChunkRecord,
  confidence: number,
  classifier: ClassifierOutput,
  matchingRules: Rule[],
): TierEligibility[] {
  const lowConf = confidence < 0.55 || classifier.confidence < 0.2;
  const structured = isStructuredContent(chunk.content);
  const shortProse = chunk.token_estimate < 500;

  return [
    {
      tier: "skip",
      eligible: false,
      note: "not applicable at decision stage · duplicate detection short-circuits earlier",
    },
    {
      tier: "human_review",
      eligible: lowConf,
      note: lowConf
        ? `chunk confidence ${confidence} or classifier ${classifier.confidence} below threshold`
        : `chunk confidence ${confidence} and classifier ${classifier.confidence} above threshold`,
    },
    {
      tier: "rule_engine",
      eligible: matchingRules.length > 0,
      note: matchingRules.length > 0
        ? `${matchingRules.length} rule(s) match classifier=${classifier.label}`
        : `no rules registered for classifier=${classifier.label}`,
    },
    {
      tier: "no_ai",
      eligible: confidence >= 0.85 && structured,
      note: (confidence >= 0.85 && structured)
        ? `high confidence (${confidence}) + structured content (tables/lists/code)`
        : !structured
          ? "content is unstructured prose"
          : `confidence ${confidence} below 0.85 threshold`,
    },
    {
      tier: "local_llm",
      eligible: shortProse && classifier.confidence >= 0.4 && !structured,
      note: !shortProse
        ? `too long (${chunk.token_estimate} tok · limit 500)`
        : classifier.confidence < 0.4
          ? `classifier confidence ${classifier.confidence} below 0.4`
          : structured
            ? "structured content · cheaper tier available (no_ai)"
            : `short prose (${chunk.token_estimate} tok) fits local model budget`,
    },
    {
      tier: "frontier_llm",
      eligible: true,
      note: "always eligible · fail-safe tier when cheaper tiers can't handle input",
    },
  ];
}

export const DecisionStage: PipelineStage<DecisionInput, DecisionOutput> = {
  name: "decision",
  version: "1.1.0",
  async run(input: DecisionInput): Promise<DecisionOutput> {
    const matchingRules = await findMatchingRules(input.classifier.label);
    const now = new Date().toISOString();
    const decisions: DecisionRecord[] = [];

    for (const chunk of input.chunks) {
      const conf = input.chunk_confidence[chunk.chunk_id] ?? 0.5;
      const alternatives = evaluateAllTiers(chunk, conf, input.classifier, matchingRules);

      // Selection priority (first eligible wins):
      //   1. human_review · safety-first · if confidence is low, always route to human
      //   2. rule_engine · deterministic · cheapest AI-free path when a rule matches
      //   3. no_ai · structured pass-through
      //   4. local_llm · cheap AI
      //   5. frontier_llm · fail-safe · always eligible so always wins if nothing else did
      const priorityOrder: DecisionRoute["tier"][] = [
        "human_review", "rule_engine", "no_ai", "local_llm", "frontier_llm",
      ];
      let chosenTier: DecisionRoute["tier"] = "frontier_llm";
      for (const tier of priorityOrder) {
        const alt = alternatives.find((a) => a.tier === tier);
        if (alt?.eligible) { chosenTier = tier; break; }
      }

      let route: DecisionRoute;
      const chosenNote = alternatives.find((a) => a.tier === chosenTier)?.note ?? "";
      switch (chosenTier) {
        case "human_review":
          route = { tier: "human_review", reason: chosenNote, escalation_priority: "P3" };
          break;
        case "rule_engine":
          route = {
            tier: "rule_engine",
            reason: chosenNote,
            ruleset: "automation-engine",
            matched_rules: matchingRules.map((r) => r.rule_id),
          };
          break;
        case "no_ai":
          route = { tier: "no_ai", reason: chosenNote, store_directly: true };
          break;
        case "local_llm":
          route = {
            tier: "local_llm",
            reason: chosenNote,
            capability: capabilityFor(input.classifier.label),
            prompt_slice: truncateForPrompt(chunk.content),
          };
          break;
        default:
          route = {
            tier: "frontier_llm",
            reason: chosenNote,
            capability: capabilityFor(input.classifier.label),
            prompt_slice: truncateForPrompt(chunk.content),
          };
      }

      decisions.push({
        chunk_id: chunk.chunk_id,
        route,
        decided_at: now,
        provider_used: null,
        latency_ms: null,
        cost_estimate_gbp: null,
        alternatives_considered: alternatives,
      });
    }

    return { decisions };
  },
};
