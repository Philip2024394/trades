// src/lib/nex-agent/code-engine/brb/capability-similarity-aware-prediction.ts
//
// NEX1 · Similarity-Aware Prediction Wrapper · Ledger B autonomous-use wiring.
//
// PURPOSE
//   When a new observation arrives, this wrapper autonomously invokes
//   brain_similarities_v2 + brain_similar_with_knowledge against a
//   supplied past-experience corpus, and returns a similarity-based
//   judgment alongside the raw prediction. This is the α path — the
//   wiring that lets NEX consult the new brains without external cue.
//
// LEDGER DISCLOSURE (explicit)
//   · Wiring trigger: Claude-authored ("on every predict call, consult
//     similarity brains against the supplied past corpus")
//   · Signature dimensions (v2): 5 Claude-selected structural bits
//   · Threshold for cluster membership: single hyperparameter
//   · The specific similarity output on given data is data-derived
//   · Ground truth for verification tests is supplied EXTERNALLY by the
//     caller · never invented by this wrapper
//
// The critical evidence question this wiring enables:
//   When NEX autonomously consults the new brains on a genuinely fresh
//   observation, does the resulting judgment match independently-defined
//   ground truth?

import { registerAgent, recordHeartbeat } from "../capability-agent-registry";
import { computeSignatureSimilarities, type ExperienceSignature } from "./capability-brain-similarities-v2";
import { explainSimilarities, type ExperienceCluster } from "./capability-brain-similar-with-knowledge";
import type { Experience } from "./capability-brain-similarities";

registerAgent({
  id: "similarity_aware_prediction",
  name: "Similarity-Aware Prediction Wrapper · autonomous invocation",
  cognitive_layer: "brain_recovery_specialist",
  description: "On new observation, autonomously invokes brain_similarities_v2 + brain_similar_with_knowledge against the supplied past corpus. Returns similarity-based judgment. Recommend-only. Ledger B wiring; content is data-derived.",
});

export interface SimilarityAwarePredictionInput {
  readonly new_observation: Experience;
  readonly past_experiences: readonly Experience[];
  readonly cluster_threshold?: number;
}

export interface SimilarityAwarePredictionEnvelope {
  readonly new_observation_id: string;
  readonly past_corpus_size: number;
  readonly cluster_threshold: number;
  readonly nearest_past_id: string | null;
  readonly nearest_agreement_fraction: number;
  readonly landed_in_cluster: ExperienceCluster | null;
  readonly cluster_outcome_distribution: Readonly<Record<string, number>>;
  readonly predicted_outcome: "success" | "failure" | "unknown";
  readonly prediction_confidence: number;
  readonly prediction_basis:
    | "no_prior_similar_experience"
    | "single_nearest_neighbour"
    | "cluster_majority_outcome"
    | "cluster_uniform_outcome";
  readonly evidence_refs: readonly string[];
  readonly signature_of_new_observation: ExperienceSignature;
  readonly r11b_marker: "SIMILARITY_PREDICTION_INFERRED";
}

const DEFAULT_CLUSTER_THRESHOLD = 0.8;

export function predictWithSimilarityAwareness(input: SimilarityAwarePredictionInput): SimilarityAwarePredictionEnvelope {
  const threshold = input.cluster_threshold ?? DEFAULT_CLUSTER_THRESHOLD;
  const combined: Experience[] = [input.new_observation, ...input.past_experiences];

  // Autonomous invocation of brain_similarities_v2
  const sim = computeSignatureSimilarities(combined);

  // Autonomous invocation of brain_similar_with_knowledge
  const explained = explainSimilarities(
    {
      pairs_computed: sim.pairwise.length,
      experiences_consumed: combined.length,
      pairwise: sim.pairwise.map((p) => ({
        a_id: p.a_id,
        b_id: p.b_id,
        field_name_jaccard: 0,
        value_type_overlap: 0,
        numeric_zero_co_occurrence: 0,
        numeric_nonzero_co_occurrence: 0,
        string_token_jaccard: 0,
        outcome_match: p.matching_dimensions.includes("outcome"),
        composite_similarity: p.agreement_fraction,
        shared_structural_properties: p.matching_dimensions,
      })),
      evidence_kind: "OBSERVED",
      r11b_marker: "SIMILARITIES_STRUCTURAL_ONLY",
    },
    combined.map((e) => e.id),
    threshold,
  );

  const newObsSignature = sim.signatures.find((s) => s.experience_id === input.new_observation.id)!;

  // Find nearest past experience
  const relevantPairs = sim.pairwise.filter(
    (p) => p.a_id === input.new_observation.id || p.b_id === input.new_observation.id,
  );
  const nearest = relevantPairs.reduce<null | (typeof relevantPairs)[number]>(
    (best, p) => (best === null || p.agreement_fraction > best.agreement_fraction ? p : best),
    null,
  );
  const nearestOtherId = nearest === null
    ? null
    : nearest.a_id === input.new_observation.id ? nearest.b_id : nearest.a_id;

  // Find the cluster the new observation landed in
  const cluster = explained.clusters.find((c) => c.member_ids.includes(input.new_observation.id)) ?? null;

  // Compute cluster outcome distribution (from past members, not from new observation)
  const outcome_dist: Record<string, number> = { success: 0, failure: 0, unknown: 0 };
  const cluster_past_members: Experience[] = [];
  if (cluster !== null) {
    for (const id of cluster.member_ids) {
      if (id === input.new_observation.id) continue;
      const past = input.past_experiences.find((e) => e.id === id);
      if (past) {
        cluster_past_members.push(past);
        outcome_dist[past.outcome]++;
      }
    }
  }

  // Prediction rule
  let predicted_outcome: "success" | "failure" | "unknown" = "unknown";
  let prediction_confidence = 0;
  let prediction_basis: SimilarityAwarePredictionEnvelope["prediction_basis"] = "no_prior_similar_experience";
  const evidence_refs: string[] = [];

  if (cluster !== null && cluster_past_members.length >= 2) {
    const outcomeSet = new Set(cluster_past_members.map((e) => e.outcome));
    if (outcomeSet.size === 1) {
      predicted_outcome = cluster_past_members[0].outcome;
      prediction_confidence = Math.min(0.9, 0.4 + cluster_past_members.length * 0.1);
      prediction_basis = "cluster_uniform_outcome";
      for (const e of cluster_past_members) evidence_refs.push(e.id);
    } else {
      const winner = Object.entries(outcome_dist).sort((a, b) => b[1] - a[1])[0][0] as "success" | "failure" | "unknown";
      const winner_count = outcome_dist[winner];
      const total = cluster_past_members.length;
      if (winner_count / total > 0.5) {
        predicted_outcome = winner;
        prediction_confidence = (winner_count / total) * 0.7;
        prediction_basis = "cluster_majority_outcome";
        for (const e of cluster_past_members) evidence_refs.push(e.id);
      } else {
        predicted_outcome = "unknown";
        prediction_confidence = 0.2;
        prediction_basis = "no_prior_similar_experience";
      }
    }
  } else if (nearest !== null && nearest.agreement_fraction >= threshold && nearestOtherId !== null) {
    const nearestPast = input.past_experiences.find((e) => e.id === nearestOtherId);
    if (nearestPast) {
      predicted_outcome = nearestPast.outcome;
      prediction_confidence = Math.min(0.6, nearest.agreement_fraction * 0.6);
      prediction_basis = "single_nearest_neighbour";
      evidence_refs.push(nearestPast.id);
    }
  }

  recordHeartbeat({
    agent_id: "similarity_aware_prediction",
    event_type: "predict",
    event_data: {
      new_id: input.new_observation.id,
      predicted: predicted_outcome,
      confidence: prediction_confidence,
      basis: prediction_basis,
      cluster_id: cluster?.cluster_id ?? null,
    },
  });

  return {
    new_observation_id: input.new_observation.id,
    past_corpus_size: input.past_experiences.length,
    cluster_threshold: threshold,
    nearest_past_id: nearestOtherId,
    nearest_agreement_fraction: nearest?.agreement_fraction ?? 0,
    landed_in_cluster: cluster,
    cluster_outcome_distribution: outcome_dist,
    predicted_outcome,
    prediction_confidence,
    prediction_basis,
    evidence_refs,
    signature_of_new_observation: newObsSignature,
    r11b_marker: "SIMILARITY_PREDICTION_INFERRED",
  };
}

export const SIMILARITY_AWARE_PREDICTION_VERSION = "similarity-aware-prediction.v1";
