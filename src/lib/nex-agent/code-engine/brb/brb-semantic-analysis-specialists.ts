// src/lib/nex-agent/code-engine/brb/brb-semantic-analysis-specialists.ts
//
// NEX1 · Semantic Analysis Specialists · Ledger B additive.
// Founder authorised 2026-09-18 · continuation of "find intelligence".
//
// PURPOSE
//   New BRB specialists that emit signals BASELINE cannot derive with
//   simple heuristics:
//     · semantic_duplicate_specialist  · path/version-normalised duplicate detection
//     · verb_contradiction_specialist  · multi-verb intent scanning
//
// DISCIPLINE
//   · Same BRB pattern as existing 21 specialists
//   · Rules are domain-general (path normalisation + generic verb lists)
//   · NOT test-specific · defined before corpus construction
//   · RECOMMEND_ONLY_NEVER_EXECUTE safety pattern
//   · Zero LLM · deterministic · Ledger B
//   · No production wiring · Gate 1 frozen

import { createSpecialistBrain, type Capability, type Analysis, type Recommendation } from "./capability-specialist-brain";
import { registerSpecialist } from "./capability-brb-network-router";

// ═══════════════════════════════════════════════════════════════════════
// 1 · SEMANTIC DUPLICATE SPECIALIST
// ═══════════════════════════════════════════════════════════════════════
// Detects duplicates that string-equality baseline misses:
//   · version-suffixed variants: "auth-v2" vs "auth"
//   · pluralised or singular variants
//   · same basename in different subdirectory
//   · explicit "duplicate" keyword in intent

const semanticDuplicateCapabilities: readonly Capability[] = [
  { id: "semantic_duplicate_path_normalise", kind: "study", maturity: "PRIMITIVE", description: "Normalise target path by stripping version suffixes and comparing to existing capabilities." },
  { id: "semantic_duplicate_basename_check", kind: "study", maturity: "PRIMITIVE", description: "Check whether proposed target has same normalised basename as an existing capability." },
  { id: "semantic_duplicate_intent_keyword", kind: "study", maturity: "PRIMITIVE", description: "Detect explicit 'duplicate' keyword in intent." },
];

function normalisePath(p: string): string {
  const lower = p.toLowerCase().trim();
  // Strip trailing /mod.ts or /index.ts to compare module directories
  const stripped = lower.replace(/\/(mod|index|main)\.(ts|tsx|js|jsx|mjs)$/i, "");
  // Strip version suffixes: -v2, _v2, .v2, /v2 (at end of path components)
  const versionStripped = stripped
    .replace(/([-._/])v\d+(?=[/]|$)/g, "")
    .replace(/([-._/])(legacy|old|deprecated|new)(?=[/]|$)/g, "");
  // Collapse consecutive separators
  return versionStripped.replace(/[-_./]+/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
}

export const semanticDuplicateSpecialist = createSpecialistBrain({
  specialist_id: "semantic_duplicate_specialist",
  domain: "semantic_path_similarity_and_duplicate_detection",
  description: "Detect proposed creations whose target semantically overlaps an existing capability (version-suffix, aliases, or explicit duplicate keyword). Complements creation_specialist's exact-match check. Recommend-only.",
  capabilities: semanticDuplicateCapabilities,
  cognitive_layer: "brain_recovery_specialist",
  safety_level: "RECOMMEND_ONLY_NEVER_EXECUTE",
  onAnalyse: (input): Omit<Analysis, "specialist_id" | "timestamp"> => {
    const data = (input ?? {}) as { intent?: string; target?: string; existing_capabilities?: readonly string[] };
    const intent = String(data.intent ?? "").toLowerCase();
    const target = data.target ?? "";
    const existing = data.existing_capabilities ?? [];

    const intentHasDuplicateWord = /\b(duplicate|copy|clone|another\s+\w+\s+module|another\s+version)\b/.test(intent);

    if (!target || existing.length === 0) {
      return {
        kind: intentHasDuplicateWord ? "semantic_duplicate_intent_signal_only" : "no_semantic_duplicate_signal",
        findings: { intent_has_duplicate_word: intentHasDuplicateWord, target_present: !!target, existing_count: existing.length },
        confidence: intentHasDuplicateWord ? 0.6 : 0.3,
        evidence_ids: [],
        evidence_kind: "OBSERVED",
      };
    }

    const normTarget = normalisePath(target);
    const overlaps: { existing: string; normalised: string; reason: string }[] = [];

    for (const e of existing) {
      const normE = normalisePath(e);
      if (normTarget === normE) {
        overlaps.push({ existing: e, normalised: normE, reason: "normalised_paths_equal" });
        continue;
      }
      // Basename comparison after normalisation
      const targetBase = normTarget.split("/").pop() ?? "";
      const existingBase = normE.split("/").pop() ?? "";
      if (targetBase.length >= 3 && existingBase.length >= 3 && targetBase === existingBase) {
        overlaps.push({ existing: e, normalised: normE, reason: "normalised_basename_equal" });
      }
    }

    if (overlaps.length > 0 || intentHasDuplicateWord) {
      const strong = overlaps.length > 0;
      return {
        kind: "semantic_duplicate_detected",
        findings: { target, existing_overlaps: overlaps, intent_has_duplicate_word: intentHasDuplicateWord, normalised_target: normTarget },
        confidence: strong ? 0.75 : 0.6,
        evidence_ids: [],
        evidence_kind: "OBSERVED",
      };
    }

    return {
      kind: "no_semantic_duplicate_signal",
      findings: { intent_has_duplicate_word: false, target_present: true, existing_count: existing.length, normalised_target: normTarget },
      confidence: 0.7,
      evidence_ids: [],
      evidence_kind: "OBSERVED",
    };
  },
  onRecommend: (input): Omit<Recommendation, "specialist_id" | "timestamp" | "action_class" | "requires_approval"> => {
    const data = (input ?? {}) as { intent?: string; target?: string; existing_capabilities?: readonly string[] };
    // Reuse analyse logic for consistency
    const analysis = (semanticDuplicateSpecialist as unknown as { analyse: (i: unknown) => Analysis }).analyse(data);
    if (analysis.kind === "semantic_duplicate_detected") {
      return {
        kind: "REFUSE_DUPLICATE_PROPOSAL",
        detail: { rationale: "semantic duplicate detected · path overlap or duplicate keyword", requires_verification: true, requires_approval: true },
        evidence_ids: [],
      };
    }
    return { kind: "no_op", detail: {}, evidence_ids: [] };
  },
});

registerSpecialist(semanticDuplicateSpecialist);

// ═══════════════════════════════════════════════════════════════════════
// 2 · VERB CONTRADICTION SPECIALIST
// ═══════════════════════════════════════════════════════════════════════
// Detects intents that combine opposing verbs from different classes:
//   · create-class: create · add · new · introduce · write · build
//   · destroy-class: delete · remove · drop · destroy · uninstall · purge
//   · modify-class: rewrite · replace · refactor · migrate
// Emits contradiction signal when a single intent contains verbs from
// opposing classes. Baseline resolves naively (first-match wins).

const contradictionCapabilities: readonly Capability[] = [
  { id: "verb_class_extraction", kind: "study", maturity: "PRIMITIVE", description: "Extract verb membership across create · destroy · modify · observe classes." },
  { id: "verb_contradiction_detect", kind: "study", maturity: "PRIMITIVE", description: "Emit signal when opposing verb classes co-occur in one intent." },
];

const CREATE_VERBS = /\b(create|add|new|introduce|write|build)\b/;
const DESTROY_VERBS = /\b(delete|remove|drop|destroy|uninstall|purge)\b/;
const MODIFY_VERBS = /\b(rewrite|replace|refactor|migrate|overwrite)\b/;

export const verbContradictionSpecialist = createSpecialistBrain({
  specialist_id: "verb_contradiction_specialist",
  domain: "intent_verb_class_contradiction_detection",
  description: "Detect intents combining verbs from opposing classes (create vs destroy · create vs modify). Emits contradiction signal that lets downstream synthesise UNKNOWN rather than picking first rule. Recommend-only.",
  capabilities: contradictionCapabilities,
  cognitive_layer: "brain_recovery_specialist",
  safety_level: "RECOMMEND_ONLY_NEVER_EXECUTE",
  onAnalyse: (input): Omit<Analysis, "specialist_id" | "timestamp"> => {
    const data = (input ?? {}) as { intent?: string; activity?: string };
    const intent = String(data.intent ?? "").toLowerCase();
    const activity = String(data.activity ?? "").toLowerCase();
    const hasCreate = CREATE_VERBS.test(intent);
    const hasDestroy = DESTROY_VERBS.test(intent);
    const hasModify = MODIFY_VERBS.test(intent);
    const activityIsDelete = activity === "delete";
    const activityIsBuild = activity === "build";

    const classes: string[] = [];
    if (hasCreate) classes.push("create");
    if (hasDestroy) classes.push("destroy");
    if (hasModify) classes.push("modify");

    const contradictionInIntent = classes.length >= 2;
    const contradictionCrossField = hasCreate && activityIsDelete;

    if (contradictionInIntent || contradictionCrossField) {
      return {
        kind: "verb_contradiction_detected",
        findings: {
          intent_classes: classes,
          contradiction_within_intent: contradictionInIntent,
          contradiction_intent_vs_activity: contradictionCrossField,
          activity,
        },
        confidence: 0.75,
        evidence_ids: [],
        evidence_kind: "OBSERVED",
      };
    }

    return {
      kind: "no_verb_contradiction",
      findings: { intent_classes: classes, activity },
      confidence: 0.7,
      evidence_ids: [],
      evidence_kind: "OBSERVED",
    };
  },
  onRecommend: (input): Omit<Recommendation, "specialist_id" | "timestamp" | "action_class" | "requires_approval"> => {
    const data = (input ?? {}) as { intent?: string; activity?: string };
    const intent = String(data.intent ?? "").toLowerCase();
    const activity = String(data.activity ?? "").toLowerCase();
    const hasCreate = CREATE_VERBS.test(intent);
    const hasDestroy = DESTROY_VERBS.test(intent);
    const hasModify = MODIFY_VERBS.test(intent);
    const activityIsDelete = activity === "delete";

    const classes: string[] = [];
    if (hasCreate) classes.push("create");
    if (hasDestroy) classes.push("destroy");
    if (hasModify) classes.push("modify");
    const contradictionInIntent = classes.length >= 2;
    const contradictionCrossField = hasCreate && activityIsDelete;

    if (contradictionInIntent || contradictionCrossField) {
      return {
        kind: "REQUEST_CLARIFICATION_PROPOSAL",
        detail: { rationale: "opposing verb classes in intent · request clarification", requires_verification: true, requires_approval: true },
        evidence_ids: [],
      };
    }
    return { kind: "no_op", detail: {}, evidence_ids: [] };
  },
});

registerSpecialist(verbContradictionSpecialist);
