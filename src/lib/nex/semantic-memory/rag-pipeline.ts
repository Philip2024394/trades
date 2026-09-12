// src/lib/nex/semantic-memory/rag-pipeline.ts
//
// WAVE-P-3 · RAG blend · semantic + composite score merger
// Founder BEGIN WAVE-P-3 · 2026-09-08
//
// Blends semantic (vector) retrieval with the existing composite-scored
// living-memory retrieval. Never REPLACES composite scoring · always
// ADDS to it. Preserves anti-recency-bias + confidence gating from
// the composite side.

import type {
  BlendedRetrievalResult,
  EmbeddingProvider,
  RagBlendConfig,
  VectorQueryResult,
  VectorStore,
} from "./types";
import { DEFAULT_RAG_BLEND } from "./types";

// ═══════════════════════════════════════════════════════════════════
// § A · SEMANTIC-SIDE RETRIEVAL
// ═══════════════════════════════════════════════════════════════════

/** Query the vector store using the query text · returns semantic
 *  matches. Encapsulates the embedding call so callers never need to
 *  touch EmbeddingProvider directly (gateway single-choke-point). */
export async function semanticRetrieve(input: {
  query_text: string;
  top_k: number;
  filter?: (metadata: Record<string, unknown>) => boolean;
  min_score?: number;
  provider: EmbeddingProvider;
  store: VectorStore;
}): Promise<readonly VectorQueryResult[]> {
  const embedding = await input.provider.embed({ text: input.query_text });
  return input.store.query({
    vector: embedding.vector,
    top_k: input.top_k,
    filter: input.filter,
    min_score: input.min_score,
  });
}

// ═══════════════════════════════════════════════════════════════════
// § B · BLEND (semantic + composite)
// ═══════════════════════════════════════════════════════════════════

/** Callers provide composite-side results (from existing
 *  living-memory/retrieval.ts style logic) alongside semantic-side
 *  results. This function merges by record_id · combining scores. */
export function blendRetrieval(input: {
  semantic_results: readonly VectorQueryResult[];
  composite_results: readonly {
    record_id: string;
    content: string;
    metadata: Record<string, unknown>;
    composite_score: number;    // 0..100 · living-memory scale
  }[];
  config?: RagBlendConfig;
}): readonly BlendedRetrievalResult[] {
  const cfg = input.config ?? DEFAULT_RAG_BLEND;
  const map = new Map<string, BlendedRetrievalResult>();

  // Ingest semantic results
  for (const s of input.semantic_results) {
    map.set(s.record_id, {
      record_id: s.record_id,
      content: s.content,
      metadata: s.metadata,
      semantic_score: s.score,
      blended_score: 0,          // filled below
      source: "semantic",
    });
  }
  // Merge composite results
  for (const c of input.composite_results) {
    const norm_composite = Math.max(0, Math.min(1, c.composite_score / 100));
    const existing = map.get(c.record_id);
    if (existing) {
      existing.composite_score = norm_composite;
      existing.source = "both";
    } else {
      map.set(c.record_id, {
        record_id: c.record_id,
        content: c.content,
        metadata: c.metadata,
        composite_score: norm_composite,
        blended_score: 0,
        source: "composite",
      });
    }
  }

  // Compute blended scores
  const out: BlendedRetrievalResult[] = [];
  for (const r of map.values()) {
    const sem = r.semantic_score ?? 0;
    const comp = r.composite_score ?? 0;
    // If a source is missing · attribute its weight to what's present
    let blended: number;
    if (r.source === "both") {
      blended = sem * cfg.semantic_weight + comp * cfg.composite_weight;
    } else if (r.source === "semantic") {
      // Score at semantic-only · normalize as if only semantic weight was there
      blended = sem * (cfg.semantic_weight + cfg.composite_weight);
    } else {
      blended = comp * (cfg.semantic_weight + cfg.composite_weight);
    }
    r.blended_score = Math.max(0, Math.min(1, blended));
    if (r.blended_score >= cfg.min_blended_score) out.push(r);
  }
  out.sort((a, b) => b.blended_score - a.blended_score);
  return out.slice(0, cfg.top_k_final);
}

// ═══════════════════════════════════════════════════════════════════
// § C · END-TO-END RAG (semantic + composite blend in one call)
// ═══════════════════════════════════════════════════════════════════

/** Complete retrieval pipeline · query text → semantic + composite →
 *  blend. Caller provides composite retriever as a function so
 *  living-memory/retrieval.ts logic can be plugged in without a
 *  hard dependency. */
export async function ragRetrieve(input: {
  query_text: string;
  semantic_top_k: number;
  composite_retriever: (query_text: string) => Promise<readonly {
    record_id: string;
    content: string;
    metadata: Record<string, unknown>;
    composite_score: number;
  }[]>;
  provider: EmbeddingProvider;
  store: VectorStore;
  blend_config?: RagBlendConfig;
  semantic_min_score?: number;
  filter?: (metadata: Record<string, unknown>) => boolean;
}): Promise<readonly BlendedRetrievalResult[]> {
  const [semantic, composite] = await Promise.all([
    semanticRetrieve({
      query_text: input.query_text,
      top_k: input.semantic_top_k,
      provider: input.provider,
      store: input.store,
      min_score: input.semantic_min_score,
      filter: input.filter,
    }),
    input.composite_retriever(input.query_text),
  ]);
  return blendRetrieval({
    semantic_results: semantic,
    composite_results: composite,
    config: input.blend_config,
  });
}
