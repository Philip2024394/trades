// src/lib/nex/knowledge-brain/contract.ts
//
// Founder Path A · Phase A3 · Knowledge Brain contract.
//
// The Knowledge Brain unifies four existing production subsystems
// behind ONE call:
//
//   Knowledge Factory (nex.question_variant · entity_index)
//   Truth Engine      (freshness + conflict + trust)
//   Retrieval         (hybrid BM25 + dense + rerank)
//   Memory            (Doctrine #4 · personalization context only)
//
// The facade is a CONSUMER of the existing pieces, not a replacement.
// DomainAdapter contract stays exactly as it is. Chat route can gain
// a KnowledgeBrain.answer() call when a domain adapter honestly
// UNKNOWNs but the Knowledge Factory has grown facts about the entity.
//
// Doctrine anchors:
//   #1 · Answers pass through the same Truth Engine that gates every
//        other verified reply. No shortcut, no override.
//   #2 · Knowledge Brain never proposes or executes actions.
//   #3 · Web-derived evidence stays capped at evidence_provisional.
//   #4 · Memory shapes RANKING/FILTERING only · never seeds truth.

import { z } from "zod";
import type { EvidenceItem } from "@/lib/nex/live-chat-completion/llm-rescue/contract";

// ═══════════════════════════════════════════════════════════════════
// Query + answer
// ═══════════════════════════════════════════════════════════════════

export const KnowledgeQuerySchema = z.object({
  query: z.string().min(2).max(1000),
  language: z.enum(["en", "id"]).default("en"),
  domain_hint: z.string().max(60).optional(),
  entity_hint: z.string().max(200).optional(),
  intent_slug: z.string().max(80).optional(),
  /** Max evidence items to return in the answer. */
  top_k: z.number().int().min(1).max(50).default(10),
  /** Wall-clock budget for the whole answer path. */
  budget_ms: z.number().int().min(200).max(30_000).default(3_000),
});
export type KnowledgeQuery = z.infer<typeof KnowledgeQuerySchema>;

/**
 * A single retrieved evidence item scored by the hybrid retriever.
 * ref_id is compatible with EvidenceItem — the Knowledge Brain output
 * can be fed directly into a RetrievalBundle if a downstream LLM
 * rescue call is needed.
 */
export interface HybridHit {
  ref_id: string;                     // stable · reused as EvidenceItem.ref_id
  source_type: EvidenceItem["source_type"];
  text: string;
  entity_ref?: string | null;
  intent_slug?: string | null;
  confidence: number;                 // 0..1 · from underlying source
  verified_at?: string | null;
  source_reference?: string | null;
  /** Per-method scores · surfaced for observability + reranking. */
  scores: {
    bm25?: number;                    // 0..N · Postgres FTS ts_rank_cd
    dense?: number;                   // 0..1 · deterministic char-trigram cosine
    rerank?: number;                  // 0..1 · cross-encoder-style alignment
    fused?: number;                   // 0..1 · final fused rank
  };
  /** Which retriever produced this hit first. */
  retriever: "bm25" | "dense" | "both";
}

/**
 * Answer shape. answered=true when at least one hit survives the
 * Truth-Engine trust check. answered=false is HONEST UNKNOWN.
 */
export interface KnowledgeAnswer {
  answered: boolean;
  headline?: string;                  // ≤ 220 chars · from top-ranked hit
  hits: readonly HybridHit[];
  trust: "canonical_verified" | "evidence_provisional" | "unknown";
  /** Present when answered=false. */
  unverified_reason?: string;
  /** Per-stage timings for observability. */
  stage_ms: {
    bm25?: number;
    dense?: number;
    rerank?: number;
    truth_check?: number;
    total: number;
  };
  /** Retriever meta · counts + provider errors. */
  provider_meta: Readonly<{
    bm25_hit_count?: number;
    dense_hit_count?: number;
    fused_hit_count?: number;
    truth_pass_count?: number;
    bm25_error?: string;
    dense_error?: string;
    truth_error?: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════
// Facade
// ═══════════════════════════════════════════════════════════════════

export interface KnowledgeBrainFacade {
  name: string;
  /**
   * Answer a knowledge query using hybrid retrieval + Truth Engine.
   * Returns HONEST UNKNOWN when nothing survives trust check.
   */
  answer(query: KnowledgeQuery): Promise<KnowledgeAnswer>;
  /**
   * Convenience: convert an answer's hits into EvidenceItem[] so a
   * downstream LLM rescue call can consume them uniformly.
   */
  answerToEvidenceItems(answer: KnowledgeAnswer): EvidenceItem[];
}

// ═══════════════════════════════════════════════════════════════════
// Fusion helper · Reciprocal Rank Fusion (RRF · Cormack et al 2009)
// Widely used in production hybrid search (Elasticsearch/Vespa/Qdrant)
// because it is score-scale-agnostic. Constant k=60 is standard.
// ═══════════════════════════════════════════════════════════════════

export function reciprocalRankFusion<T extends { ref_id: string }>(
  rankedLists: readonly (readonly T[])[],
  k: number = 60,
): Array<{ item: T; rrf_score: number }> {
  const scores = new Map<string, { item: T; rrf_score: number }>();
  for (const list of rankedLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const item = list[rank];
      const contribution = 1 / (k + rank + 1); // 1-based rank
      const existing = scores.get(item.ref_id);
      if (existing) {
        existing.rrf_score += contribution;
      } else {
        scores.set(item.ref_id, { item, rrf_score: contribution });
      }
    }
  }
  return [...scores.values()].sort((a, b) => b.rrf_score - a.rrf_score);
}
