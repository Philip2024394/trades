// src/lib/nex/live-chat-completion/semantic/embedding-provider.ts
//
// Founder BEGIN Phase 3.4B · Embedding provider contract.
//
// The retrieval router calls this to turn text into a vector. Multiple
// providers can coexist (embedding_model column on the semantic index
// tables discriminates). Cosine similarity is computed on unit-normalised
// vectors — every provider MUST return normalised output.
//
// Providers this session:
//   - DeterministicTokenProvider (real, zero deps, feature-hashed TF-IDF-ish)
//   - OllamaEmbeddingProvider    (stub · real when Ollama is running)
//
// Future BEGINs can add TransformersJsProvider (all-MiniLM-L6-v2 via
// @xenova/transformers) for neural-quality semantics with no external
// runtime.

export interface EmbeddingProvider {
  /** Model identifier stored in nex.semantic_*.embedding_model. */
  model_id: string;
  /** Vector dimensionality. */
  dim: number;
  /** Turn text into a unit-normalised vector. */
  embed(text: string): Promise<number[]>;
  /** Batch embedding · providers may parallelise · fall back to loop. */
  embedBatch?(texts: readonly string[]): Promise<readonly number[][]>;
}

// ═══════════════════════════════════════════════════════════════════
// DeterministicTokenProvider
//
// Hashing trick: each token + bigram is hashed to a bucket in a fixed-dim
// vector; count-based weights are log-scaled; final vector is L2-normalised.
// Zero deps. Deterministic across runs (same text → same vector).
//
// Semantic quality: better than fingerprint (handles word-order + partial
// paraphrases) but worse than neural. Cross-lingual matching is limited
// to shared tokens (EN + ID share few enough that "wifi" matches
// "wifinya" via the bigram "wi" · but "kamar" ↛ "rooms").
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_DIM = 512;

export function makeDeterministicTokenProvider(dim: number = DEFAULT_DIM): EmbeddingProvider {
  return {
    // Bumped to v2 · adds character-trigrams for better name-fuzzy matching.
    model_id: `det-token-v2:d${dim}`,
    dim,
    async embed(text: string): Promise<number[]> {
      return embedTextDet(text, dim);
    },
    async embedBatch(texts): Promise<readonly number[][]> {
      return texts.map((t) => embedTextDet(t, dim));
    },
  };
}

function normaliseForEmbed(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenise(text: string): string[] {
  const norm = normaliseForEmbed(text);
  if (!norm) return [];
  return norm.split(" ").filter((t) => t.length >= 2);
}

function bigrams(tokens: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) out.push(tokens[i] + "_" + tokens[i + 1]);
  return out;
}

// FNV-1a 32-bit hash · deterministic · fast.
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

function charTrigrams(text: string): string[] {
  // Char-3-grams on the concatenated normalised text (no spaces) so
  // "gaotama" shares grams with "hotelgaotama". Boundary characters are
  // preserved for start/end sensitivity.
  const s = "$" + text.replace(/\s+/g, "$") + "$";
  const out: string[] = [];
  for (let i = 0; i <= s.length - 3; i++) out.push(s.slice(i, i + 3));
  return out;
}

function embedTextDet(text: string, dim: number): number[] {
  const vec = new Array<number>(dim).fill(0);
  const norm = normaliseForEmbed(text);
  if (!norm) return vec;
  const tokens = tokenise(norm);
  const feats: string[] = [];
  for (const t of tokens) feats.push("t:" + t);
  for (const b of bigrams(tokens)) feats.push("b:" + b);
  for (const g of charTrigrams(norm)) feats.push("c:" + g);
  if (feats.length === 0) return vec;
  const counts = new Map<string, number>();
  for (const f of feats) counts.set(f, (counts.get(f) ?? 0) + 1);
  // Feature-weighted contributions. Tokens + bigrams weighted higher than
  // char-trigrams so word-level meaning still dominates.
  for (const [feat, cnt] of counts.entries()) {
    const b = fnv1a(feat) % dim;
    const sign = (fnv1a("s:" + feat) & 1) === 0 ? 1 : -1;
    const kindWeight = feat.startsWith("c:") ? 0.3 : (feat.startsWith("b:") ? 1.5 : 1);
    const weight = kindWeight * (1 + Math.log(1 + cnt));
    vec[b] += sign * weight;
  }
  let sq = 0;
  for (const v of vec) sq += v * v;
  if (sq > 0) {
    const inv = 1 / Math.sqrt(sq);
    for (let i = 0; i < dim; i++) vec[i] *= inv;
  }
  return vec;
}

// ═══════════════════════════════════════════════════════════════════
// Cosine similarity helper (dot product for unit-normalised vectors)
// ═══════════════════════════════════════════════════════════════════
export function cosine(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

// ═══════════════════════════════════════════════════════════════════
// OllamaEmbeddingProvider · real when Ollama runs · env-controlled
// ═══════════════════════════════════════════════════════════════════
export function makeOllamaEmbeddingProvider(opts?: { model?: string; base?: string }): EmbeddingProvider {
  const base = opts?.base ?? process.env.NEX_OLLAMA_URL ?? "http://localhost:11434";
  const model = opts?.model ?? process.env.NEX_OLLAMA_EMBED_MODEL ?? "nomic-embed-text";
  // dim is decided by the model · nomic-embed-text = 768. We don't hardcode
  // in case the founder swaps to bge-small (384) etc. First successful
  // embed populates this.
  let discoveredDim = 0;
  return {
    model_id: `ollama:${model}`,
    get dim(): number { return discoveredDim; },
    async embed(text: string): Promise<number[]> {
      const res = await fetch(`${base}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: text }),
      });
      if (!res.ok) throw new Error(`Ollama embedding error ${res.status}`);
      const j = await res.json() as { embedding: number[] };
      if (!Array.isArray(j.embedding)) throw new Error("Ollama returned no embedding");
      if (discoveredDim === 0) discoveredDim = j.embedding.length;
      // L2 normalise · Ollama returns raw vectors.
      let sq = 0;
      for (const v of j.embedding) sq += v * v;
      if (sq > 0) {
        const inv = 1 / Math.sqrt(sq);
        return j.embedding.map((v) => v * inv);
      }
      return j.embedding;
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// Env-selected default provider
// ═══════════════════════════════════════════════════════════════════
export function makeDefaultEmbeddingProvider(): EmbeddingProvider {
  const kind = (process.env.NEX_EMBEDDING_PROVIDER ?? "deterministic").toLowerCase();
  if (kind === "ollama") return makeOllamaEmbeddingProvider();
  return makeDeterministicTokenProvider();
}
