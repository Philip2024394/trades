// src/lib/nex/research-signals/wardley-classifier.ts
//
// UWI · Wave 4 · M17 layer 6 · Wardley evolution-stage classifier
// Founder-authorised programme.
//
// Rule-based deterministic classifier that assigns a Wardley evolution
// stage (Genesis · Custom-Built · Product · Commodity) based on a
// weighted signal bag.
//
// This is a DEDUP LAYER 6 primitive — two opportunities occupying the
// same (evolution_stage × value_chain_position) cell are candidates
// for merge.

import type { WardleyClassification, WardleyStage } from "./types";

export interface WardleyInput {
  /** Approximate age of the concept in months (0 = brand-new). */
  readonly age_months: number;
  /** Number of distinct known implementations of this idea in the wild. */
  readonly implementations_count: number;
  /** Does a stable industry standard exist for this idea? */
  readonly has_industry_standard: boolean;
  /** Rough count of ready-to-use commercial offerings. */
  readonly commercial_offerings_count: number;
  /** Is this idea broadly substitutable across vendors? */
  readonly is_substitutable: boolean;
  /** Value-chain position relative to end user. */
  readonly value_chain_position: WardleyClassification["value_chain_position"];
}

/** Classify a concept into a Wardley stage from the signal bag. Pure. */
export function classifyWardley(input: WardleyInput): WardleyClassification {
  const signals = [
    { signal: "age_months", value: input.age_months, weight: 0.20 },
    { signal: "implementations_count", value: input.implementations_count, weight: 0.20 },
    { signal: "has_industry_standard", value: input.has_industry_standard, weight: 0.25 },
    { signal: "commercial_offerings_count", value: input.commercial_offerings_count, weight: 0.20 },
    { signal: "is_substitutable", value: input.is_substitutable, weight: 0.15 },
  ] as const;

  // Score each stage independently; highest wins.
  const genesis_score =
    (input.age_months < 12 ? 1 : 0) * 0.20 +
    (input.implementations_count <= 2 ? 1 : 0) * 0.20 +
    (!input.has_industry_standard ? 1 : 0) * 0.25 +
    (input.commercial_offerings_count === 0 ? 1 : 0) * 0.20 +
    (!input.is_substitutable ? 1 : 0) * 0.15;

  const custom_score =
    (input.age_months >= 6 && input.age_months < 36 ? 1 : 0) * 0.20 +
    (input.implementations_count >= 2 && input.implementations_count <= 10 ? 1 : 0) * 0.20 +
    (!input.has_industry_standard ? 1 : 0) * 0.15 +
    (input.commercial_offerings_count >= 1 && input.commercial_offerings_count <= 5 ? 1 : 0) * 0.25 +
    (!input.is_substitutable ? 1 : 0) * 0.20;

  const product_score =
    (input.age_months >= 24 ? 1 : 0) * 0.15 +
    (input.implementations_count > 10 ? 1 : 0) * 0.20 +
    (input.has_industry_standard ? 1 : 0) * 0.20 +
    (input.commercial_offerings_count > 5 ? 1 : 0) * 0.25 +
    (input.is_substitutable ? 1 : 0) * 0.20;

  const commodity_score =
    (input.age_months >= 60 ? 1 : 0) * 0.15 +
    (input.implementations_count > 50 ? 1 : 0) * 0.20 +
    (input.has_industry_standard ? 1 : 0) * 0.25 +
    (input.commercial_offerings_count > 20 ? 1 : 0) * 0.20 +
    (input.is_substitutable ? 1 : 0) * 0.20;

  // Ordered by evolution direction so that on tie we prefer the MORE
  // EVOLVED stage (commodity > product > custom_built > genesis). This
  // reflects that commodity signals are a stricter superset of product
  // signals — when both fully fire, commodity is the more informative
  // classification.
  const scores: [WardleyStage, number][] = [
    ["genesis", genesis_score],
    ["custom_built", custom_score],
    ["product", product_score],
    ["commodity", commodity_score],
  ];
  // Stable sort by score DESC; ties preserve later-array (more-evolved) order first
  scores.sort((a, b) => b[1] - a[1] || evolutionRank(b[0]) - evolutionRank(a[0]));
  const winner: WardleyStage = scores[0][0];

  return {
    stage: winner,
    signals,
    value_chain_position: input.value_chain_position,
  };
}

/** Positional key for dedup layer 6 (same cell → candidate for merge). */
export function positionalKey(c: WardleyClassification): string {
  return `${c.value_chain_position}::${c.stage}`;
}

function evolutionRank(s: WardleyStage): number {
  switch (s) {
    case "genesis": return 0;
    case "custom_built": return 1;
    case "product": return 2;
    case "commodity": return 3;
  }
}
