// Brand DNA · seed profiles + register/reinforce/query.
//
// Doctrine: docs/brains/nex-six-intelligence-layers-and-design-genome-libraries-philip-2026-08-04.md

import type { BrandArchetype, BrandProfile } from "./types";

const PHILIP = "Philip O'Farrell";
const AUTHORED = "2026-08-04";

const SEEDS: readonly BrandProfile[] = [
  { archetype: "industrial", display_name: "Industrial", keywords: ["strength", "engineering", "heavy-duty", "trade-focused"], colour_grammar_slots: ["strength", "premium"], audiences: ["builder_trade", "commercial"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { archetype: "luxury", display_name: "Luxury", keywords: ["premium", "exclusive", "high-end", "elegant"], colour_grammar_slots: ["luxury", "value", "premium"], audiences: ["luxury_homeowner"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { archetype: "trade", display_name: "Trade", keywords: ["practical", "professional", "installer", "workshop"], colour_grammar_slots: ["strength", "trust"], audiences: ["builder_trade", "installer"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { archetype: "premium", display_name: "Premium", keywords: ["quality", "refined", "professional"], colour_grammar_slots: ["premium", "value"], audiences: ["luxury_homeowner", "modern_family"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { archetype: "modern", display_name: "Modern", keywords: ["contemporary", "clean", "minimalist-adjacent"], colour_grammar_slots: ["trust", "clean"], audiences: ["modern_family"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { archetype: "family", display_name: "Family", keywords: ["safe", "warm", "reliable", "practical", "affordable"], colour_grammar_slots: ["eco", "trust"], audiences: ["general_homeowner", "modern_family"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { archetype: "minimal", display_name: "Minimal", keywords: ["clean", "space", "restrained"], colour_grammar_slots: ["clean"], audiences: ["modern_family"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { archetype: "corporate", display_name: "Corporate", keywords: ["trustworthy", "professional", "reliable"], colour_grammar_slots: ["trust"], audiences: ["installer", "commercial"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { archetype: "heritage", display_name: "Heritage", keywords: ["traditional", "craftsmanship", "timeless", "British"], colour_grammar_slots: ["premium", "warmth"], audiences: ["luxury_homeowner", "heritage_home"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { archetype: "eco", display_name: "Eco", keywords: ["natural", "sustainable", "biogenic", "warm"], colour_grammar_slots: ["eco", "warmth"], audiences: ["general_homeowner", "family"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
];

const STORE = new Map<BrandArchetype, BrandProfile>(SEEDS.map((p) => [p.archetype, { ...p }]));

export function reset(): void {
  STORE.clear();
  for (const p of SEEDS) STORE.set(p.archetype, { ...p, evidence_asset_ids: [], history: [], observation_count: 0, aggregate_confidence: 0.5 });
}

export function get(archetype: BrandArchetype): BrandProfile | undefined { return STORE.get(archetype); }
export function all(): readonly BrandProfile[] { return Array.from(STORE.values()); }
export function count(): number { return STORE.size; }

/** Reinforce a brand profile · cap delta so no single upload can dominate. */
export function reinforce(archetype: BrandArchetype, delta: number, reason: string, evidence_asset_id?: string): BrandProfile {
  const existing = STORE.get(archetype);
  if (!existing) throw new Error(`Unknown brand archetype: ${archetype}`);
  const cappedDelta = Math.max(0, Math.min(delta, 1 - existing.aggregate_confidence));
  const evidence = evidence_asset_id && !existing.evidence_asset_ids.includes(evidence_asset_id)
    ? [...existing.evidence_asset_ids, evidence_asset_id]
    : existing.evidence_asset_ids;
  const historyEntry = { at: new Date().toISOString(), delta: cappedDelta, reason, evidence: evidence_asset_id };
  const next: BrandProfile = {
    ...existing,
    observation_count: existing.observation_count + 1,
    aggregate_confidence: existing.aggregate_confidence + cappedDelta,
    evidence_asset_ids: evidence,
    history: [...existing.history, historyEntry],
  };
  STORE.set(archetype, next);
  return next;
}

/** Which brand archetypes best match a set of observed keywords / audience hints? */
export function suggestArchetypes(observed: { keywords?: readonly string[]; audience?: string; colour_meaning?: string }): readonly { archetype: BrandArchetype; score: number; reason: string }[] {
  const results: { archetype: BrandArchetype; score: number; reason: string }[] = [];
  for (const p of STORE.values()) {
    let score = 0;
    const reasons: string[] = [];
    if (observed.keywords) {
      const hits = observed.keywords.filter((k) => p.keywords.includes(k)).length;
      if (hits > 0) { score += hits * 0.2; reasons.push(`${hits} keyword hit${hits > 1 ? "s" : ""}`); }
    }
    if (observed.audience && p.audiences.includes(observed.audience)) { score += 0.3; reasons.push(`audience match: ${observed.audience}`); }
    if (observed.colour_meaning && p.colour_grammar_slots.includes(observed.colour_meaning)) { score += 0.2; reasons.push(`colour meaning: ${observed.colour_meaning}`); }
    if (score > 0) results.push({ archetype: p.archetype, score: Math.round(score * 100) / 100, reason: reasons.join(" · ") });
  }
  return results.sort((a, b) => b.score - a.score);
}
