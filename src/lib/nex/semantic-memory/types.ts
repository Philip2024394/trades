// src/lib/nex/semantic-memory/types.ts
//
// WAVE-P-3 · GAP-2 · Vector semantic memory (self-sustained)
// Founder BEGIN WAVE-P-3 · 2026-09-08
//
// Discipline:
//   · SELF-SUSTAINMENT DOCTRINE: default embedding provider is a
//     self-hosted model (BGE-M3 via Ollama-served endpoint OR the
//     built-in deterministic fallback for tests/offline). Paid
//     embedding APIs (text-embedding-3 · voyage-3) are OPT-IN via the
//     LLM gateway pattern.
//   · GATEWAY SINGLE-CHOKE-POINT INVARIANT (doctrine §8): all embedding
//     calls route through EmbeddingProvider · never direct SDK use.
//   · Vector storage: JSONL-backed default (self-sustained · no DB
//     dependency for basic operation) · pgvector adapter can be added
//     later via same VectorStore interface.
//   · Retrieval BLENDS with existing living-memory composite scoring ·
//     never replaces it.

// ═══════════════════════════════════════════════════════════════════
// § A · EMBEDDING TYPES
// ═══════════════════════════════════════════════════════════════════

/** A fixed-length vector · numeric embedding of a text/knowledge item. */
export type Embedding = {
  vector: readonly number[];
  dim: number;
  model_id: string;
  is_paid_third_party: boolean;    // load-bearing per Self-Sustainment doctrine
};

export type EmbeddingProviderConfig = {
  provider_id: string;             // e.g. "ollama:bge-m3" · "voyage-3" · "deterministic-test"
  dim: number;
  is_paid_third_party: boolean;
};

/** Adapter interface · single choke point for embedding generation. */
export interface EmbeddingProvider {
  readonly config: EmbeddingProviderConfig;
  embed(input: { text: string }): Promise<Embedding>;
  embedBatch(input: { texts: readonly string[] }): Promise<readonly Embedding[]>;
}

// ═══════════════════════════════════════════════════════════════════
// § B · VECTOR RECORD + STORE
// ═══════════════════════════════════════════════════════════════════

/** A record persisted in the vector store. Content stored alongside
 *  vector so retrieval can return the source text · no separate join. */
export type VectorRecord<TMeta = Record<string, unknown>> = {
  record_id: string;
  vector: readonly number[];
  dim: number;
  model_id: string;
  content: string;                 // canonical source text
  metadata: TMeta;
  created_at_iso: string;
};

/** Query interface. Supports metadata pre-filtering (namespace / tag). */
export type VectorQuery = {
  vector: readonly number[];
  top_k: number;
  filter?: (metadata: Record<string, unknown>) => boolean;
  /** Score threshold · records below are filtered out. 0..1 cosine range. */
  min_score?: number;
};

export type VectorQueryResult = {
  record_id: string;
  score: number;                   // 0..1 · cosine similarity
  content: string;
  metadata: Record<string, unknown>;
  model_id: string;
};

export interface VectorStore {
  upsert(record: VectorRecord): Promise<void>;
  upsertBatch(records: readonly VectorRecord[]): Promise<void>;
  query(query: VectorQuery): Promise<readonly VectorQueryResult[]>;
  delete(record_id: string): Promise<void>;
  size(): Promise<number>;
  /** For test cleanup. */
  reset?(): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════
// § C · RAG BLEND · combine semantic + composite scoring
// ═══════════════════════════════════════════════════════════════════

/** A single retrieved item · either from semantic (vector) side or
 *  composite (keyword + rules) side · merged into unified result. */
export type BlendedRetrievalResult = {
  record_id: string;
  content: string;
  metadata: Record<string, unknown>;
  semantic_score?: number;         // 0..1 · undefined if source was composite-only
  composite_score?: number;        // 0..100 · undefined if source was semantic-only
  blended_score: number;           // 0..1 · normalized blend
  source: "semantic" | "composite" | "both";
};

/** How semantic + composite scores combine · configurable weights. */
export type RagBlendConfig = {
  semantic_weight: number;         // 0..1 · fraction of blended score from semantic
  composite_weight: number;        // 0..1 · fraction from composite
  min_blended_score: number;       // filter after blend
  top_k_final: number;
};

export const DEFAULT_RAG_BLEND: RagBlendConfig = {
  semantic_weight: 0.5,
  composite_weight: 0.5,
  min_blended_score: 0.35,
  top_k_final: 10,
};

// ═══════════════════════════════════════════════════════════════════
// § D · DOCTRINE MARKERS
// ═══════════════════════════════════════════════════════════════════

/** Actions the semantic-memory layer must NOT do. */
export type SemanticMemoryForbiddenAction =
  | "callPaidEmbeddingProviderDirectlyBypassingGateway"  // must route through EmbeddingProvider
  | "replaceExistingCompositeRetrieval"                  // must BLEND · not REPLACE
  | "wireDirectlyIntoProductionRouteWithoutBegin"
  | "fabricateEmbeddingWhenProviderFails"                // return null/error · never fake
  | "silentlySwapProviderMidQuery";
