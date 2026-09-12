// src/lib/nex-integration/pipeline.ts
//
// NEX1 · INTEGRATION GATE · deterministic layered pipeline.
//
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Constitutional order (IG-1):
//   LANGUAGE / INTENT
//     → ORIGIN PROTECTION
//     → RELEVANCE / INTENT
//     → TRUTH / EVIDENCE
//     → SAFETY
//     → AUTHORISATION
//     → RESPONSE PLAN
//
// IG-2: no later layer may override a higher-priority constitutional refusal.
// IG-3: every layer emits an inspectable decision object with rule reference.
// IG-4: fail-closed on missing decision.
// IG-5: TEST-ONLY · no public UI · no reveal cadence.
//
// Purpose-bearing elevation from Relevance NEVER touches Origin/Safety/Authorisation.
// No LLM. No network. Deterministic.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { processLanguageInput } from "@/lib/nex-language-brain/intent-bridge-v0";
import { classifyForOriginExtraction } from "@/lib/nex-origin-canon/origin-protection-classifier";
import { observeTurn } from "@/lib/nex-origin-canon/multi-turn-tracker";
import { composeGoldenResponse } from "@/lib/nex-origin-canon/golden-response-pattern";
import { classifyRelevance } from "@/lib/nex-relevance/relevance-classifier";
import { composeRelevanceResponse } from "@/lib/nex-relevance/relevance-response";
import { classifyStoryTopic, composeStoryResponse } from "@/lib/nex-stories-brain/stories-store";
import type { LayerDecision, PipelineDecision, LayerId, FinalDisposition } from "./decision-types";

export interface PipelineInput {
  readonly utterance: string;
  readonly session_id: string;
}

export function runPipeline(input: PipelineInput): PipelineDecision {
  const utterance = input.utterance ?? "";
  const session_id = input.session_id || "anonymous_session";
  const at = new Date().toISOString();
  const decisions: LayerDecision[] = [];

  // ── Layer 1 · Language / Intent ─────────────────────────────────
  // Refusal classes that must PROPAGATE to pipeline CLARIFY (founder rule
  // 2026-09-12 · shadow diagnosis remediation): reference-unresolved,
  // ambiguous, underspecified. These are honest signals that the utterance
  // cannot be acted on without clarification · they must not be flattened
  // into PASS at this layer. Higher-priority gates (origin_protection,
  // safety, authorisation) still run · they may still override.
  const CLARIFY_WORTHY_REFUSALS: readonly string[] = [
    "refused_reference_unresolved",
    "refused_ambiguous",
    "refused_underspecified",
  ];
  let langOk: "recognise" | "clarify" | "refuse" = "recognise";
  let langDetail: unknown = null;
  let langNeedsClarify = false;    // set when Language Brain refuses with a clarify-worthy class
  let langRefusalClass: string | null = null;
  try {
    const registry = JSON.parse(readFileSync(resolve(process.cwd(), "data/nex1-language-brain/pattern-registry-v0.json"), "utf8"));
    const obs = processLanguageInput({ utterance }, { registry });
    langDetail = obs;
    if (obs.ok === true) langOk = "recognise";
    else if (obs.ok === "clarify") langOk = "clarify";
    else {
      langOk = "refuse";
      langRefusalClass = obs.refusal.refusal_class;
      langNeedsClarify = CLARIFY_WORTHY_REFUSALS.includes(obs.refusal.refusal_class);
    }
    const langDisposition = langOk === "recognise" ? "PASS"
      : langOk === "clarify" ? "CLARIFY"
      : langNeedsClarify ? "CLARIFY"
      : "PASS";
    decisions.push({
      layer: "language_intent",
      disposition: langDisposition,
      summary: langOk === "recognise" ? "language brain recognised intent · pipeline continues"
             : langOk === "clarify" ? "language brain requested clarification"
             : langNeedsClarify ? `language brain refused '${langRefusalClass}' · CLARIFY propagates to pipeline · higher-priority gates still run`
             : `language brain refused '${langRefusalClass ?? "?"}' · not clarify-worthy · pipeline continues`,
      rule_reference: "LB-intent-bridge-v0",
      evidence_pointers: ["src/lib/nex-language-brain/intent-bridge-v0.ts"],
      deterministic: true,
      detail: obs,
    });
  } catch (e) {
    return failClosed(utterance, session_id, at, decisions, "language_intent", `language brain unavailable: ${(e as Error).message}`);
  }

  // ── Layer 2 · Origin Protection · WINS over everything below ────
  const originSingle = classifyForOriginExtraction(utterance);
  const originMulti = observeTurn(session_id, utterance);
  const originShouldRefuse = originSingle.should_refuse || originMulti.should_refuse;
  if (originShouldRefuse) {
    const golden = composeGoldenResponse(originSingle, originMulti);
    decisions.push({
      layer: "origin_protection",
      disposition: "REFUSE",
      summary: `origin protection triggered · objective='${originSingle.objective ?? "multi_turn"}' · rule='${originSingle.matched_rule_id ?? "cross_turn"}'`,
      rule_reference: "OP-1 · OP-4 · IG-2",
      evidence_pointers: [originSingle.matched_rule_id ?? "cross_turn", ...golden.evidence_pointers],
      deterministic: true,
      detail: { single: originSingle, multi: originMulti, golden },
    });
    // IG-2 · pipeline halts here · no downstream layer can override
    return {
      utterance, session_id, at,
      layer_decisions: decisions,
      final_disposition: "REFUSED",
      refuses_at_layer: "origin_protection",
      response_plan: golden,
      attribution: attribution(),
      test_only: true,
    };
  }
  decisions.push({
    layer: "origin_protection",
    disposition: "PASS",
    summary: "no origin-extraction pattern matched · pipeline continues",
    rule_reference: "OP-1 · pass-through",
    evidence_pointers: [],
    deterministic: true,
    detail: { single: originSingle, multi: originMulti },
  });

  // ── Layer 3 · Relevance / Intent ────────────────────────────────
  const rel = classifyRelevance(utterance);
  const relPlan = composeRelevanceResponse(rel);
  const relDisposition = pickRelevanceDisposition(rel.stance);
  decisions.push({
    layer: "relevance",
    disposition: relDisposition,
    summary: `relevance='${rel.category}' · stance='${rel.stance}' · purpose_bearing=${rel.purpose_bearing}`,
    rule_reference: `RD-* · matched_rule=${rel.matched_rule_id ?? "(default)"}`,
    evidence_pointers: relPlan.evidence_pointers,
    deterministic: true,
    detail: { verdict: rel, plan: relPlan },
  });
  // Note: even for REFUSE-like relevance (e.g. PROVOCATION → remain_calm), we
  // continue through Truth/Safety/Authorisation so the pipeline still runs
  // the higher-priority gates on the raw utterance. The relevance decision
  // becomes the STANCE of the response plan · never a bypass of protection.

  // ── Layer 4 · Truth / Evidence (Stories Brain substrate) ────────
  const storyCls = classifyStoryTopic(utterance);
  const storyPlan = composeStoryResponse(storyCls);
  decisions.push({
    layer: "truth_evidence",
    disposition: storyCls.matched_topic_id ? "PASS" : "PASS",
    summary: storyCls.matched_topic_id
      ? `story topic recognised · topic='${storyCls.matched_topic_id}' · fingerprint='${storyCls.consistency_fingerprint}'`
      : "no story topic matched · truth/evidence layer defers to other content types",
    rule_reference: "SB-4 · SB-5 · SB-6",
    evidence_pointers: storyPlan.evidence_pointers,
    deterministic: true,
    detail: { classification: storyCls, plan: storyPlan },
  });

  // ── Layer 5 · Safety ────────────────────────────────────────────
  const safety = evaluateSafety(utterance);
  decisions.push({
    layer: "safety",
    disposition: safety.disposition,
    summary: safety.summary,
    rule_reference: safety.rule_reference,
    evidence_pointers: safety.evidence_pointers,
    deterministic: true,
    detail: safety.detail,
  });
  if (safety.disposition === "REFUSE") {
    return {
      utterance, session_id, at,
      layer_decisions: decisions,
      final_disposition: "REFUSED",
      refuses_at_layer: "safety",
      response_plan: { refusal_class: "refused_by_safety_layer", pointers: safety.evidence_pointers, taught_by: "master_ai_engineer" },
      attribution: attribution(),
      test_only: true,
    };
  }

  // ── Layer 6 · Authorisation ─────────────────────────────────────
  const auth = evaluateAuthorisation(utterance);
  decisions.push({
    layer: "authorisation",
    disposition: auth.disposition,
    summary: auth.summary,
    rule_reference: auth.rule_reference,
    evidence_pointers: auth.evidence_pointers,
    deterministic: true,
    detail: auth.detail,
  });
  if (auth.disposition === "REFUSE") {
    return {
      utterance, session_id, at,
      layer_decisions: decisions,
      final_disposition: "REFUSED",
      refuses_at_layer: "authorisation",
      response_plan: { refusal_class: "refused_by_authorisation_layer", pointers: auth.evidence_pointers, taught_by: "master_ai_engineer" },
      attribution: attribution(),
      test_only: true,
    };
  }

  // ── Layer 7 · Response Plan · composed from prior decisions ─────
  // The Relevance stance drives the top-level plan · the Stories Brain plan
  // is attached when a story topic was recognised · the Language Brain
  // composes natural utterances at emission (out of scope for this module).
  const responsePlan = {
    top_stance: rel.stance,
    relevance_plan: relPlan,
    story_plan: storyCls.matched_topic_id ? storyPlan : null,
    language_intent_snapshot: langDetail,
    semantic_only: true as const,
    taught_by: "master_ai_engineer" as const,
  };
  decisions.push({
    layer: "response_plan",
    disposition: "PASS",
    summary: `response plan composed · top_stance='${rel.stance}' · story_topic='${storyCls.matched_topic_id ?? "(none)"}'`,
    rule_reference: "IG-3 · RD-9 · SB-4",
    evidence_pointers: ["response-plan-composer"],
    deterministic: true,
    detail: responsePlan,
  });

  // Founder rule 2026-09-12: Language Brain reference/ambiguity/underspec
  // refusal propagates to CLARIFY as the pipeline's final disposition ·
  // higher-priority layers already ran above and did not refuse · Relevance
  // must not silently overwrite an honest CLARIFY signal from language.
  const final: FinalDisposition = langNeedsClarify ? "CLARIFY" : mapRelevanceToFinal(rel.stance);
  const refuses_at_layer_if_clarify_from_lang: LayerId | null = langNeedsClarify ? "language_intent" : null;
  return {
    utterance, session_id, at,
    layer_decisions: decisions,
    final_disposition: final,
    refuses_at_layer: refuses_at_layer_if_clarify_from_lang,
    response_plan: responsePlan,
    attribution: attribution(),
    test_only: true,
  };
}

// ─── helpers ──────────────────────────────────────────────────────

function attribution() {
  return { external_llm_used: false as const, independent_authorship_percent: 0 as const, taught_by: "master_ai_engineer" as const };
}
function failClosed(utterance: string, session_id: string, at: string, decisions: LayerDecision[], layer: LayerId, why: string): PipelineDecision {
  decisions.push({
    layer,
    disposition: "UNKNOWN",
    summary: `fail-closed · ${why}`,
    rule_reference: "IG-4",
    evidence_pointers: [],
    deterministic: true,
  });
  return {
    utterance, session_id, at,
    layer_decisions: decisions,
    final_disposition: "FAIL_CLOSED",
    refuses_at_layer: layer,
    response_plan: null,
    attribution: attribution(),
    test_only: true,
  };
}
function pickRelevanceDisposition(stance: string): LayerDecision["disposition"] {
  switch (stance) {
    case "refuse":                  return "REFUSE";
    case "remain_calm":             return "REMAIN_CALM";
    case "identify_manipulation":   return "IDENTIFY_MANIPULATION";
    case "redirect_to_better_tool": return "REDIRECT";
    case "perform_with_note":       return "PERFORM_WITH_NOTE";
    case "perform_capability_test": return "PERFORM_CAPABILITY_TEST";
    case "invite_clarification":    return "CLARIFY";
    default:                        return "PASS";
  }
}
function mapRelevanceToFinal(stance: string): FinalDisposition {
  switch (stance) {
    case "refuse":                  return "REFUSED";
    case "remain_calm":             return "REMAIN_CALM";
    case "identify_manipulation":   return "IDENTIFY_MANIPULATION";
    case "redirect_to_better_tool": return "REDIRECT";
    case "perform_with_note":       return "PERFORM_WITH_NOTE";
    case "perform_capability_test": return "PERFORM_CAPABILITY_TEST";
    case "invite_clarification":    return "CLARIFY";
    case "perform_briefly":
    default:                        return "ALLOWED";
  }
}

// ─── Safety layer (deterministic · uses the safety pattern registry) ──
interface LayerEval {
  disposition: LayerDecision["disposition"];
  summary: string;
  rule_reference: string;
  evidence_pointers: string[];
  detail?: unknown;
}
function evaluateSafety(utterance: string): LayerEval {
  const registryPath = resolve(process.cwd(), "data/nex1-language-brain/pattern-registry-v0.json");
  if (!existsSync(registryPath)) {
    return { disposition: "REFUSE", summary: "safety pattern registry unavailable · fail-closed per IG-4", rule_reference: "IG-4", evidence_pointers: [] };
  }
  const reg = JSON.parse(readFileSync(registryPath, "utf8"));
  const lower = utterance.toLowerCase();
  for (const sp of reg.safety_patterns ?? []) {
    try {
      const re = new RegExp(sp.regex, "i");
      if (re.test(lower)) {
        return {
          disposition: "REFUSE",
          summary: `safety pattern '${sp.id}' matched · class='${sp.refusal_class}'`,
          rule_reference: `safety-registry · ${sp.id}`,
          evidence_pointers: [sp.id, sp.refusal_class],
          detail: sp,
        };
      }
    } catch { /* invalid regex · skip */ }
  }
  return { disposition: "PASS", summary: "no safety pattern matched", rule_reference: "safety-registry · pass", evidence_pointers: [] };
}

// ─── Authorisation layer (deterministic scope check) ──────────────
// v0: refuses any utterance that requests actions requiring founder authority
// that the current session cannot supply. Session is anonymous by default
// in this test-only pipeline · so any explicit request to authorise · deploy ·
// publish · release · promote · production-grade action is REFUSED.
function evaluateAuthorisation(utterance: string): LayerEval {
  const patterns: readonly { id: string; regex: RegExp; scope: string }[] = [
    { id: "auth.deploy",      regex: /\b(?:deploy|release|publish|promote)\s+(?:to\s+)?(?:production|live|prod)\b/i,       scope: "production_deploy" },
    { id: "auth.merge_main",  regex: /\b(?:merge|push)\s+(?:to\s+)?(?:main|master)\b/i,                                       scope: "merge_main" },
    { id: "auth.override_adr",regex: /\b(?:override|rewrite|delete|amend)\s+(?:the\s+)?(?:adr|constitution|independence\s+constitution)\b/i, scope: "constitutional_amendment" },
    { id: "auth.disable_reg", regex: /\b(?:disable|bypass|skip)\s+(?:the\s+)?(?:regression|regression\s+pool|guardian|truth\s+engine)\b/i,   scope: "safety_bypass" },
  ];
  for (const p of patterns) {
    if (p.regex.test(utterance)) {
      return {
        disposition: "REFUSE",
        summary: `authorisation required for scope='${p.scope}' · session does not carry founder authority`,
        rule_reference: `IG-2 · auth-scope · ${p.id}`,
        evidence_pointers: [p.id, p.scope],
        detail: { scope: p.scope },
      };
    }
  }
  return { disposition: "PASS", summary: "no authorisation-required action detected", rule_reference: "auth-scope · pass", evidence_pointers: [] };
}
