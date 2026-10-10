// src/lib/nex-agent/code-engine/cell-centre/capability-map-v2-semantic.ts
//
// NEX1 · Capability Map v2 · SEMANTIC extension.
// Founder-authorised 2026-09-18 · direct response to session finding:
//
//   "The current mechanism isn't good enough to call that capability
//    awareness. structure → match rather than meaning → capability →
//    context → appropriate consultation."
//
// PURPOSE
//   Add semantic-relevance criteria to each capability without modifying
//   the frozen capability-map.ts. This module is a Ledger B ADDITIVE
//   overlay · v1 remains byte-identical.
//
// LEDGER
//   The semantic vocabulary is Claude-authored (Ledger B). The specific
//   selections made by matching semantic features to capability criteria
//   on a given input are data-derived.

import type { CapabilityEntry } from "./capability-map";
import { CAPABILITY_MAP } from "./capability-map";

// ── Semantic feature extraction ─────────────────────────────────────────

export type VerbClass = "create" | "delete" | "review" | "test" | "build" | "other" | "unknown";
export type TargetClass = "present_novel" | "present_existing" | "null";
export type ActivityClass = "build" | "test" | "observe" | "delete" | "other" | "unknown";

export interface InputSemanticFeatures {
  readonly verb_class: VerbClass;
  readonly target_class: TargetClass;
  readonly activity_class: ActivityClass;
  readonly has_proposed_change: boolean;
  readonly has_existing_tests: boolean;
  readonly has_multi_step: boolean;
  readonly has_verdict_records: boolean;
  readonly has_message: boolean;
}

export function extractSemanticFeatures(input: Readonly<Record<string, unknown>>): InputSemanticFeatures {
  const intent = String(input.intent ?? "").toLowerCase();
  let verb_class: VerbClass = "unknown";
  if (/\b(create|introduce)\b/.test(intent)) verb_class = "create";
  else if (/\b(add|new)\b/.test(intent) && !(/\b(remove|delete)\b/.test(intent))) verb_class = "create";
  else if (/\b(delete|remove|drop)\b/.test(intent)) verb_class = "delete";
  else if (/\b(review|inspect|observe|check)\b/.test(intent)) verb_class = "review";
  else if (/\b(test|verify|assert)\b/.test(intent)) verb_class = "test";
  else if (/\b(build|implement)\b/.test(intent)) verb_class = "build";
  else verb_class = "other";

  const target = input.target;
  const existing = Array.isArray(input.existing_capabilities) ? input.existing_capabilities as readonly string[] : [];
  let target_class: TargetClass;
  if (target === null || target === undefined || target === "") target_class = "null";
  else if (existing.some((e) => String(e).toLowerCase() === String(target).toLowerCase())) target_class = "present_existing";
  else target_class = "present_novel";

  const activity = String(input.activity ?? "").toLowerCase();
  let activity_class: ActivityClass = "unknown";
  if (activity === "build") activity_class = "build";
  else if (activity === "test") activity_class = "test";
  else if (activity === "observe") activity_class = "observe";
  else if (activity === "delete") activity_class = "delete";
  else if (activity.length > 0) activity_class = "other";

  const proposed = input.proposed_change;
  const has_proposed_change = proposed !== null && proposed !== undefined && typeof proposed === "object" && Object.keys(proposed as Record<string, unknown>).length > 0;
  const has_existing_tests = Array.isArray(input.existing_tests) && (input.existing_tests as unknown[]).length > 0;
  const has_multi_step = Array.isArray(input.steps) && (input.steps as unknown[]).length >= 2;
  const has_verdict_records = Array.isArray(input.verdict_records) && (input.verdict_records as unknown[]).length > 0;
  const has_message = typeof input.message === "string" && (input.message as string).length > 0;

  return {
    verb_class, target_class, activity_class,
    has_proposed_change, has_existing_tests, has_multi_step, has_verdict_records, has_message,
  };
}

// ── Capability semantic criteria (Ledger B) ─────────────────────────────
//
// For each specialist capability in v1 map, declare the SEMANTIC conditions
// under which the capability is relevant. Match is boolean · a capability
// is relevant iff ALL specified criteria are met.
//
// Criteria can reference: verb_class (allowed values) · target_class
// (allowed values) · activity_class (allowed values) · required boolean
// features (has_*).

export interface SemanticCriteria {
  readonly capability_id: string;
  /** Any of these verb classes match · empty means don't restrict. */
  readonly verb_classes?: readonly VerbClass[];
  readonly target_classes?: readonly TargetClass[];
  readonly activity_classes?: readonly ActivityClass[];
  /** Boolean requirements: each named field must be true in the input semantic features. */
  readonly required_true?: readonly (keyof InputSemanticFeatures)[];
  /** Boolean forbiddens: each named field must be false. */
  readonly required_false?: readonly (keyof InputSemanticFeatures)[];
}

export const CAPABILITY_SEMANTIC_CRITERIA: readonly SemanticCriteria[] = [
  // creation_specialist: relevant on create-intent inputs
  {
    capability_id: "creation_specialist",
    verb_classes: ["create"],
  },
  // building_specialist: relevant on multi-step build activity
  {
    capability_id: "building_specialist",
    activity_classes: ["build"],
    required_true: ["has_multi_step"],
  },
  // development_specialist: relevant on any dev-lifecycle activity
  {
    capability_id: "development_specialist",
    activity_classes: ["build", "test", "observe"],
  },
  // testing_specialist: relevant when there's a proposed change to verify OR test activity
  {
    capability_id: "testing_specialist",
    activity_classes: ["test", "build"],
    required_true: ["has_proposed_change"],
  },
  // communication_specialist: relevant on review/observe/delete intents (non-build tasks)
  {
    capability_id: "communication_specialist",
    verb_classes: ["review", "delete", "other"],
  },
  // brain_surgeon: relevant when there's a proposed structural change
  {
    capability_id: "brain_surgeon",
    required_true: ["has_proposed_change"],
  },
  // neurologist: relevant on verdict-record analysis (failure diagnosis)
  {
    capability_id: "neurologist",
    required_true: ["has_verdict_records"],
  },
  // innovation_specialist: relevant on build activities with target_class present_novel
  {
    capability_id: "innovation_specialist",
    target_classes: ["present_novel"],
    activity_classes: ["build"],
  },
  // creative_specialist: relevant on any input · always advisory (not restricted)
  // (deliberately empty criteria · matches all)
  {
    capability_id: "creative_specialist",
  },
];

// ── Semantic matcher ────────────────────────────────────────────────────

export function semanticMatchCapabilities(
  input: Readonly<Record<string, unknown>>,
): { selected: readonly string[]; features: InputSemanticFeatures; per_capability_match: Readonly<Record<string, boolean>> } {
  const features = extractSemanticFeatures(input);
  const matches: Record<string, boolean> = {};
  const selected: string[] = [];

  for (const criteria of CAPABILITY_SEMANTIC_CRITERIA) {
    let ok = true;
    if (criteria.verb_classes && criteria.verb_classes.length > 0) {
      if (!criteria.verb_classes.includes(features.verb_class)) ok = false;
    }
    if (ok && criteria.target_classes && criteria.target_classes.length > 0) {
      if (!criteria.target_classes.includes(features.target_class)) ok = false;
    }
    if (ok && criteria.activity_classes && criteria.activity_classes.length > 0) {
      if (!criteria.activity_classes.includes(features.activity_class)) ok = false;
    }
    if (ok && criteria.required_true) {
      for (const f of criteria.required_true) {
        if (features[f] !== true) { ok = false; break; }
      }
    }
    if (ok && criteria.required_false) {
      for (const f of criteria.required_false) {
        if (features[f] !== false) { ok = false; break; }
      }
    }
    matches[criteria.capability_id] = ok;
    if (ok) selected.push(criteria.capability_id);
  }

  // Also mark v1-map capabilities without semantic criteria as false
  for (const c of CAPABILITY_MAP) {
    if (c.kind === "specialist" && !(c.id in matches)) matches[c.id] = false;
  }

  return { selected, features, per_capability_match: matches };
}

export const CAPABILITY_MAP_V2_SEMANTIC_VERSION = "capability-map-v2-semantic.v1.2026-09-18";
