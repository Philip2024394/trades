// src/lib/nex-agent/code-engine/brb/capability-brain-similar-with-knowledge.ts
//
// NEX1 · Brain Similar-With-Knowledge · Ledger B interpretation layer.
//
// PURPOSE
//   Consumes the pairwise similarity matrix from brain_similarities and
//   produces:
//     · clusters (experiences grouped by high pairwise similarity)
//     · cluster descriptions (structural properties · not conclusions)
//     · pairwise "shared knowledge" (which structural properties they
//       share, in evidence terms)
//
// ANTI-CHEATING PROTECTIONS
//   · Cluster labels are auto-generated FROM the structural properties
//     shared within the cluster · never from a preset taxonomy.
//   · No relationship vocabulary is baked in.
//   · Threshold for clustering is a single hyperparameter · same for all
//     clusters · not tuned per benchmark.
//
// The "knowledge" this brain provides is *structural knowledge about
// what NEX has observed* — not domain knowledge Claude injected.

import { registerAgent, recordHeartbeat } from "../capability-agent-registry";
import type { PairwiseSimilarity, SimilaritiesResult } from "./capability-brain-similarities";

registerAgent({
  id: "brain_similar_with_knowledge",
  name: "Brain Similar-With-Knowledge · clusters + structural explanations",
  cognitive_layer: "brain_recovery_specialist",
  description: "Consumes pairwise similarity matrix. Produces clusters (by threshold) and cluster labels derived from shared structural properties. Never encodes a relationship taxonomy.",
});

// ── Types ─────────────────────────────────────────────────────────────

export interface ExperienceCluster {
  readonly cluster_id: string;
  readonly member_ids: readonly string[];
  readonly members_count: number;
  readonly structural_label: string;  // auto-generated from shared properties
  readonly shared_properties: readonly string[];
  readonly average_composite_similarity: number;
}

export interface SharedKnowledge {
  readonly pair_a: string;
  readonly pair_b: string;
  readonly composite_similarity: number;
  readonly observed_shared_facts: readonly string[];
  readonly note: string;   // deterministic template describing what is observed
}

export interface SimilarWithKnowledgeResult {
  readonly clusters: readonly ExperienceCluster[];
  readonly singletons: readonly string[];         // experiences that clustered alone
  readonly pairwise_knowledge: readonly SharedKnowledge[];
  readonly threshold_used: number;
  readonly evidence_kind: "OBSERVED";
  readonly r11b_marker: "STRUCTURAL_INTERPRETATION_ONLY";
}

// ── Public API ────────────────────────────────────────────────────────

const DEFAULT_CLUSTER_THRESHOLD = 0.55;   // single hyperparameter, applied uniformly

export function explainSimilarities(
  similarities: SimilaritiesResult,
  experience_ids: readonly string[],
  threshold: number = DEFAULT_CLUSTER_THRESHOLD,
): SimilarWithKnowledgeResult {
  // 1 · Build simple threshold-based clustering (single-link).
  const adjacency = new Map<string, Set<string>>();
  for (const id of experience_ids) adjacency.set(id, new Set());
  for (const p of similarities.pairwise) {
    if (p.composite_similarity >= threshold) {
      adjacency.get(p.a_id)!.add(p.b_id);
      adjacency.get(p.b_id)!.add(p.a_id);
    }
  }
  // Connected components
  const visited = new Set<string>();
  const clusters: ExperienceCluster[] = [];
  const singletons: string[] = [];
  let clusterCounter = 0;
  for (const start of experience_ids) {
    if (visited.has(start)) continue;
    const component: string[] = [];
    const stack = [start];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (visited.has(node)) continue;
      visited.add(node);
      component.push(node);
      for (const neighbour of adjacency.get(node)!) if (!visited.has(neighbour)) stack.push(neighbour);
    }
    if (component.length === 1) {
      singletons.push(component[0]);
    } else {
      // Compute shared properties across the whole cluster
      const memberPairs = similarities.pairwise.filter((p) => component.includes(p.a_id) && component.includes(p.b_id));
      const propertyFreq = new Map<string, number>();
      for (const mp of memberPairs) for (const prop of mp.shared_structural_properties) propertyFreq.set(prop, (propertyFreq.get(prop) ?? 0) + 1);
      const totalPairsInCluster = memberPairs.length;
      // Properties observed in ≥ half of intra-cluster pairs are "shared"
      const clusterShared = [...propertyFreq.entries()].filter(([, n]) => n >= Math.ceil(totalPairsInCluster / 2)).map(([k]) => k).sort();
      // Auto-generate label from the shared properties (structural only)
      const label = clusterShared.length > 0
        ? "cluster_of_" + component.length + "_experiences_with_" + clusterShared.slice(0, 3).join("_AND_")
        : "cluster_of_" + component.length + "_experiences_low_shared_property_agreement";
      const avgSim = memberPairs.length > 0 ? memberPairs.reduce((s, p) => s + p.composite_similarity, 0) / memberPairs.length : 0;
      clusters.push({
        cluster_id: "cluster_" + (clusterCounter++),
        member_ids: component,
        members_count: component.length,
        structural_label: label,
        shared_properties: clusterShared,
        average_composite_similarity: avgSim,
      });
    }
  }

  // 2 · Pairwise "shared knowledge" · deterministic descriptions
  const pairwise_knowledge: SharedKnowledge[] = similarities.pairwise.map((p) => ({
    pair_a: p.a_id,
    pair_b: p.b_id,
    composite_similarity: p.composite_similarity,
    observed_shared_facts: p.shared_structural_properties,
    note: p.shared_structural_properties.length > 0
      ? "these_two_experiences_share_" + p.shared_structural_properties.length + "_observable_structural_properties"
      : "these_two_experiences_share_no_notable_observable_structural_properties_above_reporting_threshold",
  }));

  recordHeartbeat({
    agent_id: "brain_similar_with_knowledge",
    event_type: "explain",
    event_data: {
      clusters_found: clusters.length,
      singletons: singletons.length,
      threshold,
    },
  });

  return {
    clusters,
    singletons,
    pairwise_knowledge,
    threshold_used: threshold,
    evidence_kind: "OBSERVED",
    r11b_marker: "STRUCTURAL_INTERPRETATION_ONLY",
  };
}

export const BRAIN_SIMILAR_WITH_KNOWLEDGE_VERSION = "brain-similar-with-knowledge.v1";
