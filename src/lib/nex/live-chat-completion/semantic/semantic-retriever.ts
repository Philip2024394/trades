// src/lib/nex/live-chat-completion/semantic/semantic-retriever.ts
//
// Founder BEGIN Phase 3.4B · Semantic retriever · L3 of retrieval router.
//
// Loads the semantic index into memory once per process, exposes topK
// cosine similarity search over entities + answered questions. Wired
// into the retrieval router BETWEEN structured (L2) and LLM rescue.
//
// Founder rule: semantic HITS are candidates for verification, not
// answers on their own. The composer / gate decides how to treat them.

import type { Pool } from "pg";
import type { EmbeddingProvider } from "./embedding-provider";
import { cosine } from "./embedding-provider";

export interface SemanticEntityHit {
  entity_ref: string;
  canonical_name: string;
  similarity: number;
  source_text: string;
}

export interface SemanticQuestionHit {
  fingerprint: string;
  entity_ref: string | null;
  intent_slug: string | null;
  source_text: string;
  similarity: number;
}

export interface SemanticIndex {
  entities: Array<SemanticEntityHit & { embedding: readonly number[] }>;
  questions: Array<SemanticQuestionHit & { embedding: readonly number[] }>;
  loaded_at: string;
  model_id: string;
  dim: number;
}

let _cachedIndex: { domain: string; model: string; index: SemanticIndex } | null = null;

export async function loadSemanticIndex(deps: {
  kfPool: Pool;
  provider: EmbeddingProvider;
  domain: string;
}): Promise<SemanticIndex> {
  if (
    _cachedIndex
    && _cachedIndex.domain === deps.domain
    && _cachedIndex.model === deps.provider.model_id
  ) return _cachedIndex.index;

  const entitiesRes = await deps.kfPool.query(
    `SELECT sei.entity_ref, sei.embedding, sei.dim, sei.source_text, ei.canonical_name
       FROM nex.semantic_entity_index sei
       LEFT JOIN nex.entity_index ei
         ON ei.domain = sei.domain AND ei.entity_ref = sei.entity_ref
       WHERE sei.domain = $1 AND sei.embedding_model = $2`,
    [deps.domain, deps.provider.model_id],
  );
  const entities = entitiesRes.rows.map((r) => ({
    entity_ref: String(r.entity_ref),
    canonical_name: String(r.canonical_name ?? "(unknown)"),
    source_text: String(r.source_text),
    similarity: 0,
    embedding: Array.isArray(r.embedding) ? (r.embedding as number[]) : JSON.parse(String(r.embedding)),
  }));

  const questionsRes = await deps.kfPool.query(
    `SELECT fingerprint, entity_ref, intent_slug, source_text, embedding, dim
       FROM nex.semantic_question_index
       WHERE domain = $1 AND embedding_model = $2`,
    [deps.domain, deps.provider.model_id],
  );
  const questions = questionsRes.rows.map((r) => ({
    fingerprint: String(r.fingerprint),
    entity_ref: r.entity_ref ? String(r.entity_ref) : null,
    intent_slug: r.intent_slug ? String(r.intent_slug) : null,
    source_text: String(r.source_text),
    similarity: 0,
    embedding: Array.isArray(r.embedding) ? (r.embedding as number[]) : JSON.parse(String(r.embedding)),
  }));

  const index: SemanticIndex = {
    entities,
    questions,
    loaded_at: new Date().toISOString(),
    model_id: deps.provider.model_id,
    dim: entities[0]?.embedding.length ?? questions[0]?.embedding.length ?? deps.provider.dim,
  };
  _cachedIndex = { domain: deps.domain, model: deps.provider.model_id, index };
  return index;
}

/** Force-reload · used after backpop completes so the running process picks up new rows. */
export function invalidateSemanticIndex(): void {
  _cachedIndex = null;
}

export interface SemanticSearchResult {
  entity_hits: readonly SemanticEntityHit[];
  question_hits: readonly SemanticQuestionHit[];
  latency_ms: number;
  index_size: { entities: number; questions: number };
  provider_model: string;
}

export async function semanticSearch(input: {
  kfPool: Pool;
  provider: EmbeddingProvider;
  domain: string;
  query: string;
  top_k_entities?: number;
  top_k_questions?: number;
  min_similarity?: number;
}): Promise<SemanticSearchResult> {
  const t0 = performance.now();
  const kE = Math.max(1, Math.min(20, input.top_k_entities ?? 5));
  const kQ = Math.max(1, Math.min(20, input.top_k_questions ?? 5));
  const minSim = Math.max(0, Math.min(1, input.min_similarity ?? 0.15));

  const index = await loadSemanticIndex({ kfPool: input.kfPool, provider: input.provider, domain: input.domain });
  const queryVec = await input.provider.embed(input.query);

  const entityScores: SemanticEntityHit[] = [];
  for (const e of index.entities) {
    const sim = cosine(queryVec, e.embedding);
    if (sim >= minSim) entityScores.push({ ...e, similarity: sim });
  }
  entityScores.sort((a, b) => b.similarity - a.similarity);
  const entity_hits = entityScores.slice(0, kE).map(({ embedding: _e, ...rest }) => ({ ...rest }) as unknown as SemanticEntityHit);

  const questionScores: SemanticQuestionHit[] = [];
  for (const q of index.questions) {
    const sim = cosine(queryVec, q.embedding);
    if (sim >= minSim) questionScores.push({ ...q, similarity: sim });
  }
  questionScores.sort((a, b) => b.similarity - a.similarity);
  const question_hits = questionScores.slice(0, kQ).map(({ embedding: _e, ...rest }) => ({ ...rest }) as unknown as SemanticQuestionHit);

  return {
    entity_hits,
    question_hits,
    latency_ms: Math.round(performance.now() - t0),
    index_size: { entities: index.entities.length, questions: index.questions.length },
    provider_model: input.provider.model_id,
  };
}
