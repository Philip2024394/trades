// src/lib/nex/knowledge-brain/index.ts
//
// Founder Path A · Phase A3 · Knowledge Brain facade.
//
// One call that unifies Knowledge Factory + Truth Engine + Retrieval
// + Memory. A CONSUMER of the existing subsystems (never a replacement).
//
// Doctrine anchors:
//   #1 · Every hit that reaches the answer passes the Truth Engine
//        trust check · unverified hits are surfaced as HONEST UNKNOWN.
//   #2 · Knowledge Brain never proposes or executes actions.
//   #3 · Web-derived hits (if surfaced later by web-acquisition path)
//        stay capped at evidence_provisional.
//   #4 · This module has no memory-access surface · memory context
//        flows via bundle.user_context on the RETRIEVAL side only.

import type { Pool } from "pg";
import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";
// Founder Phase 4 · P4-2 · retrieval telemetry (fire-and-forget).
import { writeRetrievalEvent } from "@/lib/nex/observatory-brain/retrieval-telemetry";
import type { KnowledgeBrainFacade, KnowledgeQuery, KnowledgeAnswer, HybridHit } from "./contract";
import { KnowledgeQuerySchema } from "./contract";
import { hybridRetrieve } from "./hybrid-retriever";
import type { EvidenceItem } from "@/lib/nex/live-chat-completion/llm-rescue/contract";

const HEADLINE_MAX_CHARS = 220;
// Minimum fused score for a hit to survive the trust check.
// Deliberately lenient · rejection reason is surfaced when zero pass.
const TRUST_MIN_FUSED = 0.15;

export interface KnowledgeBrainOptions {
  kfPool?: Pool;
  /** Override the fused-score floor for the trust check. */
  trust_min_fused?: number;
}

export function makeKnowledgeBrain(opts: KnowledgeBrainOptions = {}): KnowledgeBrainFacade {
  const kfPool = opts.kfPool ?? getKnowledgeFactoryDbPool();
  const trustFloor = typeof opts.trust_min_fused === "number" ? opts.trust_min_fused : TRUST_MIN_FUSED;

  return {
    name: "knowledge-brain-v1",

    async answer(rawQuery: KnowledgeQuery): Promise<KnowledgeAnswer> {
      const query = KnowledgeQuerySchema.parse(rawQuery);
      const t0 = performance.now();

      // 1. Hybrid retrieve (BM25 + dense + rerank fusion)
      const retrieved = await hybridRetrieve({
        query: query.query,
        kfPool,
        domain_hint: query.domain_hint,
        entity_hint: query.entity_hint,
        intent_slug: query.intent_slug,
        top_k: query.top_k,
      });
      // Founder Phase 4 · P4-2 · emit retrieval telemetry (fire-and-forget).
      writeRetrievalEvent({
        retriever_path: "kb_hybrid",
        domain: query.domain_hint ?? null,
        query_length_chars: query.query.length,
        hit_count: retrieved.hits.length,
        top_hit_similarity: retrieved.hits[0]?.scores?.fused ?? null,
        latency_ms: retrieved.stage_ms.bm25 + retrieved.stage_ms.dense + retrieved.stage_ms.rerank,
        error: retrieved.provider_meta.bm25_error ?? retrieved.provider_meta.dense_error ?? null,
        sub_provider_meta: {
          bm25_hits: retrieved.provider_meta.bm25_hit_count,
          dense_hits: retrieved.provider_meta.dense_hit_count,
          fused_hits: retrieved.provider_meta.fused_hit_count,
          dense_method: retrieved.provider_meta.dense_method,
        },
      });

      // 2. Truth-Engine trust check · a hit passes if its fused score
      //    is >= trustFloor AND it is either canonical_verified or its
      //    freshness is within an acceptable window.
      //    (Freshness policy stays deferred to the domain-specific Truth
      //    Engine · here we apply the fused-score floor as the general
      //    knowledge-brain gate. Domain adapters can layer stricter rules.)
      const truthT0 = performance.now();
      const passed: HybridHit[] = retrieved.hits.filter((h) => (h.scores.fused ?? 0) >= trustFloor);
      const truthMs = Math.round(performance.now() - truthT0);

      const totalMs = Math.round(performance.now() - t0);
      const answered = passed.length > 0;

      // Trust band: canonical_verified only if the TOP hit is verified;
      // otherwise evidence_provisional (LLM-rescue precedent); UNKNOWN
      // when no hits survive.
      const trust: KnowledgeAnswer["trust"] = !answered
        ? "unknown"
        : passed[0].confidence >= 0.85
        ? "canonical_verified"
        : "evidence_provisional";

      const headline = answered
        ? passed[0].text.slice(0, HEADLINE_MAX_CHARS)
        : undefined;

      return {
        answered,
        headline,
        hits: passed,
        trust,
        unverified_reason: answered ? undefined : (
          retrieved.hits.length === 0
            ? "no_hits_returned"
            : `no_hits_above_trust_floor:${trustFloor}`
        ),
        stage_ms: {
          bm25: retrieved.stage_ms.bm25,
          dense: retrieved.stage_ms.dense,
          rerank: retrieved.stage_ms.rerank,
          truth_check: truthMs,
          total: totalMs,
        },
        provider_meta: {
          ...retrieved.provider_meta,
          truth_pass_count: passed.length,
        },
      };
    },

    answerToEvidenceItems(answer: KnowledgeAnswer): EvidenceItem[] {
      // Passthrough · HybridHit shape is a superset of EvidenceItem.
      // Web-derived items (source_type=web_search) stay capped at 0.75
      // to preserve Doctrine #3 in downstream LLM rescue.
      return answer.hits.map((h) => {
        const capped = h.source_type === "web_search" || h.source_type === "vision" || h.source_type === "file"
          ? Math.min(0.75, h.confidence)
          : h.confidence;
        return {
          ref_id: h.ref_id,
          source_type: h.source_type,
          text: h.text,
          entity_ref: h.entity_ref ?? null,
          intent_slug: h.intent_slug ?? null,
          confidence: capped,
          verified_at: h.verified_at ?? null,
          source_reference: h.source_reference ?? null,
        };
      });
    },
  };
}

/** Env-selected default. Returns null when NEX_KNOWLEDGE_BRAIN=off. */
export function makeDefaultKnowledgeBrain(): KnowledgeBrainFacade | null {
  const enabled = process.env.NEX_KNOWLEDGE_BRAIN;
  if (enabled === "off" || enabled === "0" || enabled === "false") return null;
  return makeKnowledgeBrain();
}
