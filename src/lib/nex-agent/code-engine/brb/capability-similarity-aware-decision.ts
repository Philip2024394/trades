// src/lib/nex-agent/code-engine/brb/capability-similarity-aware-decision.ts
//
// NEX1 · Similarity-Aware Decision Wrapper · Ledger B wiring.
//
// PURPOSE
//   Wraps an incoming observation so that NEX can consult
//   brain_similarities + brain_similar_with_knowledge against a stored
//   corpus of past experiences BEFORE returning a judgment. If the new
//   observation is highly similar to a persisted cluster of experiences
//   with known outcomes, produce a signal.
//
// LEDGER DISCLOSURE
//   · Wrapper trigger: Claude-authored ("on every incoming decide() call,
//     consult brain_similarities against the corpus").
//   · Similarity threshold: Ledger B hyperparameter (single value, same
//     for all inputs).
//   · The COMPARISON is executed by NEX-side brains (brain_similarities
//     + brain_similar_with_knowledge). Both are NEX brains once
//     registered · they compute deterministic outputs from the inputs.
//   · The OUTPUT of the wrapper (which cluster the new observation is
//     nearest to, what confidence signal that produces) is data-derived
//     from NEX's own accumulated experiences.
//
// This does NOT modify predictWithReflection or any existing runtime
// path. It composes them.

import { registerAgent, recordHeartbeat } from "../capability-agent-registry";
import { computeSimilarities, type Experience } from "./capability-brain-similarities";
import { explainSimilarities, type ExperienceCluster } from "./capability-brain-similar-with-knowledge";

registerAgent({
  id: "similarity_aware_decision",
  name: "Similarity-Aware Decision Wrapper",
  cognitive_layer: "brain_recovery_specialist",
  description: "On new observation, invokes brain_similarities + brain_similar_with_knowledge against past corpus. If new observation clusters with past experiences, emits nearest-cluster signal. Recommend-only.",
});

const SIMILARITY_THRESHOLD_FOR_MATCH = 0.55;

export interface SimilarityDecisionInput {
  readonly new_observation: Experience;
  readonly past_experiences: readonly Experience[];
}

export interface SimilarityDecisionResult {
  readonly new_observation_id: string;
  readonly past_corpus_size: number;
  readonly nearest_past_id: string | null;
  readonly nearest_similarity: number;
  readonly nearest_shared_properties: readonly string[];
  readonly nearest_cluster: ExperienceCluster | null;
  readonly judgment_signal:
    | "no_prior_similar_experience"
    | "prior_similar_experience_with_matching_outcome"
    | "prior_similar_experience_with_conflicting_outcome"
    | "prior_similar_cluster_with_uniform_outcome";
  readonly signal_confidence: number;
  readonly evidence_refs: readonly string[];
  readonly r11b_marker: "SIMILARITY_DECISION_INFERRED";
}

/**
 * Consult the new brains and return a judgment signal.  Never modifies
 * anything downstream.  Purely additive to whatever caller does next.
 */
export function decideBySimilarity(input: SimilarityDecisionInput): SimilarityDecisionResult {
  // 1. Compose new observation + past into a full experience list
  const allExperiences: Experience[] = [input.new_observation, ...input.past_experiences];

  // 2. Ask brain_similarities to compute pairwise metrics
  const simResult = computeSimilarities(allExperiences);

  // 3. Ask brain_similar_with_knowledge to cluster
  const explained = explainSimilarities(
    simResult,
    allExperiences.map((e) => e.id),
    SIMILARITY_THRESHOLD_FOR_MATCH,
  );

  // 4. Find nearest past experience to the new observation
  const relevantPairs = simResult.pairwise.filter(
    (p) => p.a_id === input.new_observation.id || p.b_id === input.new_observation.id,
  );
  const nearest = relevantPairs.reduce<null | (typeof relevantPairs)[number]>(
    (best, p) => (best === null || p.composite_similarity > best.composite_similarity ? p : best),
    null,
  );
  const nearestOtherId = nearest === null
    ? null
    : nearest.a_id === input.new_observation.id ? nearest.b_id : nearest.a_id;
  const nearestPast = nearestOtherId === null
    ? null
    : input.past_experiences.find((e) => e.id === nearestOtherId) ?? null;

  // 5. Find the cluster that CONTAINS the new observation, if any
  const newObsCluster = explained.clusters.find((c) => c.member_ids.includes(input.new_observation.id)) ?? null;

  // 6. Judgment signal · deterministic rules on OBSERVED evidence only
  let signal: SimilarityDecisionResult["judgment_signal"] = "no_prior_similar_experience";
  let confidence = 0;
  const evidence_refs: string[] = [];

  if (nearest === null || nearestPast === null || nearest.composite_similarity < SIMILARITY_THRESHOLD_FOR_MATCH) {
    signal = "no_prior_similar_experience";
    confidence = 0.2;
  } else {
    evidence_refs.push(nearestPast.id);
    if (newObsCluster !== null && newObsCluster.members_count >= 3) {
      // Check if all cluster members share the same outcome (excluding the new obs)
      const clusterPasts = newObsCluster.member_ids.filter((id) => id !== input.new_observation.id).map((id) => input.past_experiences.find((e) => e.id === id)).filter((e): e is Experience => e !== undefined);
      const outcomes = new Set(clusterPasts.map((e) => e.outcome));
      if (outcomes.size === 1) {
        signal = "prior_similar_cluster_with_uniform_outcome";
        confidence = Math.min(0.9, 0.5 + newObsCluster.members_count * 0.1);
        for (const cp of clusterPasts) evidence_refs.push(cp.id);
      } else {
        signal = "prior_similar_experience_with_conflicting_outcome";
        confidence = 0.5;
      }
    } else {
      // Single-pair similarity
      if (nearestPast.outcome === input.new_observation.outcome) {
        signal = "prior_similar_experience_with_matching_outcome";
        confidence = Math.min(0.7, 0.3 + nearest.composite_similarity * 0.4);
      } else {
        signal = "prior_similar_experience_with_conflicting_outcome";
        confidence = 0.35;
      }
    }
  }

  recordHeartbeat({
    agent_id: "similarity_aware_decision",
    event_type: "decide",
    event_data: {
      new_id: input.new_observation.id,
      past_n: input.past_experiences.length,
      nearest_id: nearestOtherId,
      nearest_similarity: nearest?.composite_similarity ?? 0,
      signal,
      confidence,
    },
  });

  return {
    new_observation_id: input.new_observation.id,
    past_corpus_size: input.past_experiences.length,
    nearest_past_id: nearestOtherId,
    nearest_similarity: nearest?.composite_similarity ?? 0,
    nearest_shared_properties: nearest?.shared_structural_properties ?? [],
    nearest_cluster: newObsCluster,
    judgment_signal: signal,
    signal_confidence: confidence,
    evidence_refs,
    r11b_marker: "SIMILARITY_DECISION_INFERRED",
  };
}

export const SIMILARITY_AWARE_DECISION_VERSION = "similarity-aware-decision.v1";
