// src/lib/nex/brain/reasoning/entity-reasoning.ts
//
// NEX Wave 7 · Conversational Entity Reasoning
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE
//
// PURPOSE (§3 · §5 · §7 · §8 · §18)
//   Given a decision-intent + entities in scope + evidence + user
//   facts, produce a structured Reasoning payload with distinct
//   FACT / EVIDENCE / INFERENCE / RECOMMENDATION / UNKNOWN sections.
//   Every substantive assertion decomposes into Claims; unsupported
//   Claims are dropped before the reply is rendered.
//
// SUBORDINATION (§17)
//   This module is deterministic. It does NOT call an LLM. It composes
//   over EXISTING evidence-state maps and existing detectors. The
//   reply renderer (reasoning-reply.ts) turns the payload into
//   natural language without inventing new claims.
//
// REUSES
//   entityCardMemo (session) · viewedEntity.memo (session) ·
//   compareCandidates (comparison.ts) · recommendation heuristics.

import type { AttributeState } from "../entity-attribute-contract";
import type { EntityCardMemo } from "../entity-result-cards";
import type { DecisionIntentKind } from "./decision-intent";
import {
  verifyClaims,
  shippableClaims,
  listMissingEvidence,
  type Claim,
  type EvidenceLookup,
  type VerifiedClaim,
} from "./claim";

// ─── Types ──────────────────────────────────────────────────────

/** Explicit-only user context. Inferred facts are NEVER injected. */
export type UserContext = {
  /** G23 explicit user facts by category, filtered to relevant subjects.
   *  e.g. { preference: ["quiet"], party: ["children"] } */
  explicit_facts: Record<string, string[]>;
  /** Current-turn preferences the user just stated (persist only for
   *  this reasoning · never promoted to G23 without explicit rules). */
  current_turn_preferences: string[];
};

export type ReasoningPayload = {
  intent: DecisionIntentKind;
  language: "EN" | "ID";
  /** Whether there was a valid result set to reason over. */
  has_active_result_set: boolean;
  /** Entities in scope for this reasoning turn · empty when no result
   *  set is active. */
  entities_in_scope: readonly EntityInScope[];
  /** Verified claims · UNSUPPORTED already dropped. May be empty. */
  claims: readonly VerifiedClaim[];
  /** Missing-evidence surface · used for "what don't you know?" and
   *  for hedging recommendations. */
  missing_evidence: readonly { key: string; refIds: string[] }[];
  /** Optional recommendation · only present when the composer could
   *  produce one from supported claims. */
  recommendation?: {
    winner_ref_id: string;
    winner_name: string;
    reason: string;
    based_on: string[];      // attribute keys the recommendation used
    honest_gaps: string[];   // attribute keys that would matter but are missing
  };
};

/** Entity subset used across the reasoning composer. */
export type EntityInScope = {
  ref_id: string;
  name: string;
  attribute_states: ReadonlyMap<string, AttributeState>;
};

// ─── Attribute keys the reasoning composer knows about ─────────

/** Attribute keys the composer considers when reasoning about
 *  suitability / comparison / recommendation. Restricted to
 *  known evidence-tracked attributes across verticals. */
const REASONING_ATTRIBUTES = [
  // decision-critical first · these dominate honest_gaps + missing_evidence
  "price", "rating", "reviewCount", "area_proximity",
  // rooms
  "bedrooms", "bathrooms", "capacity", "room_count",
  // facilities · commonly asked
  "pool", "wifi", "ac", "parking", "breakfast", "gym", "spa",
  "restaurant", "laundry", "airport_transfer",
  // contact
  "phone", "whatsapp", "website",
  // food
  "cuisine", "reservations", "delivery", "takeaway",
  // service
  "emergency", "free_quote",
];

// ─── Entity extraction from session ─────────────────────────────

/** Build the entities-in-scope + evidence-lookup from the caller's
 *  input. Uses session.entityCardMemo · optionally augmented by
 *  viewed-entity.memo already prepended upstream. */
export function extractEntitiesInScope(input: {
  entityCardMemo: readonly EntityCardMemo[] | undefined;
}): { entities: EntityInScope[]; evidence: EvidenceLookup } {
  const entities: EntityInScope[] = [];
  const evidence = new Map<string, Map<string, AttributeState>>();
  for (const memo of input.entityCardMemo ?? []) {
    const stateMap = new Map<string, AttributeState>();
    for (const [k, v] of Object.entries(memo.attribute_states ?? {})) {
      stateMap.set(k, v);
    }
    entities.push({
      ref_id: memo.ref_id,
      name: memo.name,
      attribute_states: stateMap,
    });
    evidence.set(memo.ref_id, stateMap);
  }
  return { entities, evidence };
}

// ─── Claim builders per intent ─────────────────────────────────

/** Build the natural claims relevant to a given intent. Returns raw
 *  Claim[] (unverified) · the composer feeds these to verifyClaims. */
export function buildClaimsForIntent(input: {
  intent: DecisionIntentKind;
  entities: readonly EntityInScope[];
  userContext: UserContext;
}): Claim[] {
  const { intent, entities } = input;
  if (entities.length === 0) return [];

  const claims: Claim[] = [];
  const idOf = (n: string) => n.replace(/[^a-z0-9]+/gi, "_").toLowerCase();

  // UNKNOWN_REQUEST · build "would-have-mattered" claims across all
  // reasoning attributes for the top entity so listMissingEvidence can
  // surface every UNKNOWN slot honestly. Uses only the attribute-key
  // vocabulary · never invents attributes.
  if (intent === "ENTITY_UNKNOWN_REQUEST") {
    const target = entities[0];
    if (!target) return [];
    for (const attr of REASONING_ATTRIBUTES) {
      claims.push({
        id: `unknown_check_${idOf(target.name)}_${attr}`,
        subject_ref_id: target.ref_id,
        text: `${target.name} · ${prettyAttr(attr)}`,
        evidence_keys: [attr],
        kind: "FACT",
      });
    }
    return claims;
  }

  switch (intent) {
    case "ENTITY_REASON_REQUEST":
    case "ENTITY_EVIDENCE_REQUEST":
    case "ENTITY_COMPARISON":
    case "ENTITY_RECOMMENDATION_REQUEST":
    case "ENTITY_BEST_FOR":
    case "ENTITY_SUITABILITY":
    case "ENTITY_OPINION_REQUEST": {
      // Build pairwise claims for the top 2 entities on each reasoning
      // attribute. Superlative comparisons handled by ENTITY_RANKING.
      const a = entities[0];
      const b = entities[1];
      if (!b) {
        // Single-entity opinion — build "the entity has X" facts
        for (const attr of REASONING_ATTRIBUTES) {
          if (a.attribute_states.get(attr) === "KNOWN_YES"
              || a.attribute_states.get(attr) === "UNVERIFIED") {
            claims.push({
              id: `${idOf(a.name)}_has_${attr}`,
              subject_ref_id: a.ref_id,
              text: `${a.name} has ${prettyAttr(attr)}`,
              evidence_keys: [attr],
              kind: "FACT",
            });
          }
        }
        return claims;
      }
      // Two-entity comparison · build per-attribute has/hasn't claims
      // AND a "closer/cheaper/better-rated" comparison claim for
      // attributes where both sides have KNOWN_YES.
      for (const attr of REASONING_ATTRIBUTES) {
        const aState = a.attribute_states.get(attr);
        const bState = b.attribute_states.get(attr);
        // Presence claims
        if (aState === "KNOWN_YES" || aState === "UNVERIFIED") {
          claims.push({
            id: `${idOf(a.name)}_has_${attr}`,
            subject_ref_id: a.ref_id,
            text: `${a.name} has ${prettyAttr(attr)}`,
            evidence_keys: [attr],
            kind: "FACT",
          });
        }
        if (bState === "KNOWN_YES" || bState === "UNVERIFIED") {
          claims.push({
            id: `${idOf(b.name)}_has_${attr}`,
            subject_ref_id: b.ref_id,
            text: `${b.name} has ${prettyAttr(attr)}`,
            evidence_keys: [attr],
            kind: "FACT",
          });
        }
      }
      return claims;
    }

    case "ENTITY_PROS_CONS": {
      const a = entities[0];
      if (!a) return [];
      // Pros: known-yes facilities/attributes
      for (const attr of REASONING_ATTRIBUTES) {
        if (a.attribute_states.get(attr) === "KNOWN_YES") {
          claims.push({
            id: `pro_${idOf(a.name)}_${attr}`,
            subject_ref_id: a.ref_id,
            text: `Verified: ${prettyAttr(attr)}`,
            evidence_keys: [attr],
            kind: "FACT",
          });
        }
      }
      return claims;
    }

    case "ENTITY_RANKING": {
      // Ranking claims across all entities · e.g. "cheapest" · the
      // reply renderer picks the winner from SUPPORTED claims only.
      // For each rankable attribute, produce a claim per entity.
      const rankableAttrs = ["price", "rating", "area_proximity", "reviewCount"];
      for (const attr of rankableAttrs) {
        for (const e of entities) {
          claims.push({
            id: `${idOf(e.name)}_${attr}`,
            subject_ref_id: e.ref_id,
            text: `${e.name} has ${prettyAttr(attr)} data`,
            evidence_keys: [attr],
            kind: "FACT",
          });
        }
      }
      return claims;
    }

    default:
      return [];
  }
}

function prettyAttr(attr: string): string {
  return attr.replace(/_/g, " ");
}

// ─── Recommendation heuristic ──────────────────────────────────

/** Simple recommendation heuristic · picks the winner from SUPPORTED
 *  claims only. Never picks a winner unsupported by evidence. Uses
 *  attribute count as the tiebreaker, and explicit user-context
 *  attribute matches as a booster (never inferring). */
export function pickRecommendationWinner(input: {
  entities: readonly EntityInScope[];
  supportedClaims: readonly VerifiedClaim[];
  userContext: UserContext;
}): ReasoningPayload["recommendation"] {
  const { entities, supportedClaims, userContext } = input;
  if (entities.length === 0) return undefined;

  // Score each entity by count of SUPPORTED "has X" claims about it,
  // with a bonus for KNOWN_YES matches against explicit user-context
  // preference words.
  const explicitPreferenceTokens = new Set(
    Object.values(userContext.explicit_facts).flat()
      .concat(userContext.current_turn_preferences)
      .map((s) => s.toLowerCase()),
  );

  const scores = new Map<string, number>();
  const basedOn = new Set<string>();

  for (const claim of supportedClaims) {
    if (claim.state !== "SUPPORTED") continue;
    const baseline = scores.get(claim.subject_ref_id) ?? 0;
    let score = baseline + 1;
    // Bonus when the claim's attribute matches an explicit preference
    for (const key of claim.evidence_keys) {
      if (explicitPreferenceTokens.has(key)) {
        score += 2;
        basedOn.add(key);
      }
    }
    scores.set(claim.subject_ref_id, score);
    for (const key of claim.evidence_keys) basedOn.add(key);
  }

  // Only recommend when we actually have supporting evidence · never
  // pick a winner from zero.
  if (scores.size === 0) return undefined;

  // Pick highest · deterministic tiebreak: preserve entities order.
  let winner: EntityInScope | undefined;
  let winnerScore = -1;
  for (const e of entities) {
    const s = scores.get(e.ref_id) ?? 0;
    if (s > winnerScore) { winnerScore = s; winner = e; }
  }
  if (!winner) return undefined;

  // honest_gaps: attributes that would have mattered but were missing
  // for the WINNER (so we can hedge in the reply)
  const honestGaps: string[] = [];
  const winnerStates = winner.attribute_states;
  for (const attr of ["price", "rating", "reviewCount", "availability"]) {
    const state = winnerStates.get(attr) ?? "UNKNOWN";
    if (state === "UNKNOWN" || state === "KNOWN_NO") honestGaps.push(attr);
  }

  return {
    winner_ref_id: winner.ref_id,
    winner_name: winner.name,
    reason: `most_supported_facts${basedOn.size ? `:based_on=${[...basedOn].slice(0, 5).join(",")}` : ""}`,
    based_on: [...basedOn],
    honest_gaps: honestGaps,
  };
}

// ─── Main composer ────────────────────────────────────────────

/** Compose the full ReasoningPayload for a turn. Deterministic. */
export function composeReasoning(input: {
  intent: DecisionIntentKind;
  language: "EN" | "ID";
  entityCardMemo: readonly EntityCardMemo[] | undefined;
  userContext: UserContext;
}): ReasoningPayload {
  const { intent, language, userContext } = input;
  const { entities, evidence } = extractEntitiesInScope({ entityCardMemo: input.entityCardMemo });
  const has_active_result_set = entities.length > 0;

  if (!has_active_result_set) {
    return {
      intent, language,
      has_active_result_set: false,
      entities_in_scope: [],
      claims: [],
      missing_evidence: [],
    };
  }

  const rawClaims = buildClaimsForIntent({ intent, entities, userContext });
  const verified = verifyClaims(rawClaims, evidence);
  const shippable = shippableClaims(verified);
  const missing = listMissingEvidence(rawClaims, evidence);

  let recommendation: ReasoningPayload["recommendation"];
  if (
    intent === "ENTITY_RECOMMENDATION_REQUEST" ||
    intent === "ENTITY_BEST_FOR" ||
    intent === "ENTITY_OPINION_REQUEST"
  ) {
    recommendation = pickRecommendationWinner({
      entities,
      supportedClaims: shippable.filter((c) => c.state === "SUPPORTED"),
      userContext,
    });
  }

  return {
    intent, language,
    has_active_result_set: true,
    entities_in_scope: entities,
    claims: shippable,
    missing_evidence: missing,
    recommendation,
  };
}
