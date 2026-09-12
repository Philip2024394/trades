// src/lib/nex/knowledge-brain/hybrid-retriever.ts
//
// Founder Path A · Phase A3 · Hybrid retriever.
//
// Fuses THREE retrieval methods (2026 industry consensus per
// docs/research/nex_architecture_research_2026_09_09.md · P5):
//
//   1. BM25          · Postgres full-text search on question_variant
//                      (ts_rank_cd · deterministic · covers exact tokens)
//   2. Dense         · char-trigram cosine (SI-1 style · deterministic)
//                      OR Ollama neural embeddings when NEX_KB_DENSE=ollama
//                      (Founder KB-Real · graceful fallback to trigram)
//   3. Cross-encoder · alignment scorer from Fabrication Gate v2
//                      (used as REranker on the fused top-K)
//
// Fusion: Reciprocal Rank Fusion (RRF · Cormack 2009) is score-scale
// agnostic. Rerank runs LAST on the top-K RRF winners.

import type { Pool } from "pg";
import type { HybridHit } from "./contract";
import { reciprocalRankFusion } from "./contract";
import { scoreClaimAlignment } from "@/lib/nex/live-chat-completion/llm-rescue/alignment";
// Founder KB-Real · optional neural embeddings via Ollama (opt-in · graceful fallback).
import { makeOllamaEmbeddingProvider } from "@/lib/nex/live-chat-completion/semantic/embedding-provider";

const BM25_LIMIT = 20;
const DENSE_LIMIT = 20;
const FUSED_LIMIT = 20;
const RERANK_TOP_K = 12;

// Founder KB-Real · dense method selection.
//   trigram (default) · deterministic char-trigram cosine
//   ollama            · neural embeddings via Ollama nomic-embed-text
// Falls back to trigram if Ollama unreachable so hybrid retrieval
// never fails when the neural path is opt-in.
const _DENSE_METHOD = (() => {
  const v = (process.env.NEX_KB_DENSE ?? "trigram").toLowerCase();
  return v === "ollama" ? "ollama" : "trigram";
})();
const _neuralProvider = _DENSE_METHOD === "ollama" ? makeOllamaEmbeddingProvider() : null;

export interface HybridRetrieverInput {
  query: string;
  kfPool: Pool;
  domain_hint?: string;
  entity_hint?: string;
  intent_slug?: string;
  top_k?: number;
}

export interface HybridRetrieverOutput {
  hits: HybridHit[];
  stage_ms: { bm25: number; dense: number; rerank: number };
  provider_meta: {
    bm25_hit_count: number;
    dense_hit_count: number;
    fused_hit_count: number;
    bm25_error?: string;
    dense_error?: string;
    /** Founder KB-Real · which dense method actually ran ("trigram" or "ollama:...") */
    dense_method?: string;
  };
}

export async function hybridRetrieve(input: HybridRetrieverInput): Promise<HybridRetrieverOutput> {
  const topK = Math.min(Math.max(input.top_k ?? 10, 1), FUSED_LIMIT);

  const [bm25Result, denseResult] = await Promise.all([
    runBm25(input).catch((e) => ({ hits: [] as HybridHit[], ms: 0, error: err(e) })),
    runDense(input).catch((e) => ({ hits: [] as HybridHit[], ms: 0, error: err(e), method: "error" as string })),
  ]);

  const fusedRanked = reciprocalRankFusion([bm25Result.hits, denseResult.hits]);
  const fusedTop = fusedRanked.slice(0, FUSED_LIMIT);

  // Rerank top K using Gate-v2 alignment scorer.
  const rerankT0 = performance.now();
  const rerankPool = fusedTop.slice(0, RERANK_TOP_K);
  for (const entry of rerankPool) {
    const align = scoreClaimAlignment(input.query, entry.item.text);
    entry.item.scores.rerank = Number(align.score.toFixed(3));
  }
  for (const entry of fusedTop) {
    const rerank = entry.item.scores.rerank ?? 0;
    const maxRrf = Math.max(...fusedTop.map((e) => e.rrf_score), 0.001);
    const rrfNorm = entry.rrf_score / maxRrf;
    if (entry.item.scores.rerank !== undefined) {
      entry.item.scores.fused = Number((0.6 * rerank + 0.4 * rrfNorm).toFixed(3));
    } else {
      entry.item.scores.fused = Number((0.4 * rrfNorm).toFixed(3));
    }
  }
  fusedTop.sort((a, b) => (b.item.scores.fused ?? 0) - (a.item.scores.fused ?? 0));
  const rerankMs = Math.round(performance.now() - rerankT0);

  return {
    hits: fusedTop.slice(0, topK).map((e) => e.item),
    stage_ms: { bm25: bm25Result.ms, dense: denseResult.ms, rerank: rerankMs },
    provider_meta: {
      bm25_hit_count: bm25Result.hits.length,
      dense_hit_count: denseResult.hits.length,
      fused_hit_count: fusedTop.length,
      bm25_error: bm25Result.error,
      dense_error: denseResult.error,
      dense_method: (denseResult as { method?: string }).method,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// BM25 · Postgres full-text search
// ═══════════════════════════════════════════════════════════════════

async function runBm25(input: HybridRetrieverInput): Promise<{ hits: HybridHit[]; ms: number; error?: string }> {
  const t0 = performance.now();
  const conds: string[] = [];
  const params: unknown[] = [];
  let p = 0;
  params.push(input.query);
  const tsqueryParam = `$${++p}`;
  conds.push("answer_status IN ('answered','partially_answered')");
  conds.push(`to_tsvector('simple', coalesce(raw_text,'')) @@ websearch_to_tsquery('simple', ${tsqueryParam})`);
  if (input.domain_hint) { params.push(input.domain_hint); conds.push(`domain = $${++p}`); }
  if (input.entity_hint) { params.push(input.entity_hint); conds.push(`entity_ref = $${++p}`); }
  if (input.intent_slug) { params.push(input.intent_slug); conds.push(`intent_slug = $${++p}`); }
  params.push(BM25_LIMIT);
  try {
    const res = await input.kfPool.query(
      `SELECT fingerprint, entity_ref, intent_slug, raw_text, trust, last_verified_at,
              ts_rank_cd(to_tsvector('simple', coalesce(raw_text,'')),
                          websearch_to_tsquery('simple', ${tsqueryParam})) AS bm25_score
         FROM nex.question_variant
         WHERE ${conds.join(" AND ")}
         ORDER BY bm25_score DESC NULLS LAST
         LIMIT $${++p}`,
      params,
    );
    const hits: HybridHit[] = res.rows.map((r) => ({
      ref_id: `qv:${r.fingerprint}`,
      source_type: "question_variant",
      text: String(r.raw_text ?? "").slice(0, 400),
      entity_ref: r.entity_ref ?? null,
      intent_slug: r.intent_slug ?? null,
      confidence: r.trust === "canonical_verified" ? 0.9 : 0.7,
      verified_at: r.last_verified_at ? new Date(r.last_verified_at).toISOString() : null,
      source_reference: `nex.question_variant:${r.fingerprint}`,
      scores: { bm25: Number(Number(r.bm25_score ?? 0).toFixed(4)) },
      retriever: "bm25",
    }));
    return { hits, ms: Math.round(performance.now() - t0) };
  } catch (e) {
    return { hits: [], ms: Math.round(performance.now() - t0), error: err(e) };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Dense · trigram default · Ollama neural when opted in (KB-Real)
// ═══════════════════════════════════════════════════════════════════

async function runDense(input: HybridRetrieverInput): Promise<{ hits: HybridHit[]; ms: number; error?: string; method?: string }> {
  const t0 = performance.now();
  try {
    const conds: string[] = ["answer_status IN ('answered','partially_answered')"];
    const params: unknown[] = [];
    let p = 0;
    if (input.domain_hint) { params.push(input.domain_hint); conds.push(`domain = $${++p}`); }
    if (input.entity_hint) { params.push(input.entity_hint); conds.push(`entity_ref = $${++p}`); }
    if (input.intent_slug) { params.push(input.intent_slug); conds.push(`intent_slug = $${++p}`); }
    params.push(200);
    const res = await input.kfPool.query(
      `SELECT fingerprint, entity_ref, intent_slug, raw_text, trust, last_verified_at
         FROM nex.question_variant
         WHERE ${conds.join(" AND ")}
         ORDER BY last_verified_at DESC NULLS LAST
         LIMIT $${++p}`,
      params,
    );

    // Founder KB-Real · try neural first when opted in · fall back to trigram.
    let scored: Array<{ row: (typeof res.rows)[number]; score: number }> = [];
    let usedMethod: string = "trigram";
    if (_neuralProvider) {
      try {
        const qVec = await _neuralProvider.embed(input.query);
        const docs = res.rows.slice(0, 40);
        const dVecs = await Promise.all(docs.map((r) => _neuralProvider!.embed(String(r.raw_text ?? "").slice(0, 500))));
        for (let i = 0; i < docs.length; i++) {
          const cos = cosine(qVec, dVecs[i]);
          if (cos > 0) scored.push({ row: docs[i], score: cos });
        }
        scored.sort((a, b) => b.score - a.score);
        usedMethod = `ollama:${_neuralProvider.model_id}`;
      } catch {
        scored = [];
      }
    }
    if (scored.length === 0) {
      const qGrams = trigramSet(input.query);
      if (qGrams.size === 0) return { hits: [], ms: Math.round(performance.now() - t0), method: "trigram" };
      for (const row of res.rows) {
        const dGrams = trigramSet(String(row.raw_text ?? ""));
        if (dGrams.size === 0) continue;
        let inter = 0;
        for (const g of qGrams) if (dGrams.has(g)) inter += 1;
        const cos = inter / Math.sqrt(qGrams.size * dGrams.size);
        if (cos > 0) scored.push({ row, score: cos });
      }
      scored.sort((a, b) => b.score - a.score);
      usedMethod = "trigram";
    }

    const hits: HybridHit[] = scored.slice(0, DENSE_LIMIT).map((s) => ({
      ref_id: `qv:${s.row.fingerprint}`,
      source_type: "question_variant",
      text: String(s.row.raw_text ?? "").slice(0, 400),
      entity_ref: s.row.entity_ref ?? null,
      intent_slug: s.row.intent_slug ?? null,
      confidence: s.row.trust === "canonical_verified" ? 0.9 : 0.7,
      verified_at: s.row.last_verified_at ? new Date(s.row.last_verified_at).toISOString() : null,
      source_reference: `nex.question_variant:${s.row.fingerprint}`,
      scores: { dense: Number(s.score.toFixed(4)) },
      retriever: "dense",
    }));
    return { hits, ms: Math.round(performance.now() - t0), method: usedMethod };
  } catch (e) {
    return { hits: [], ms: Math.round(performance.now() - t0), error: err(e), method: "error" };
  }
}

function cosine(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

function trigramSet(text: string): Set<string> {
  const norm = String(text ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
  const s = new Set<string>();
  if (norm.length < 3) return s;
  for (let i = 0; i <= norm.length - 3; i++) s.add(norm.slice(i, i + 3));
  return s;
}

function err(e: unknown): string {
  return e instanceof Error ? e.message.slice(0, 100) : "unknown_error";
}
