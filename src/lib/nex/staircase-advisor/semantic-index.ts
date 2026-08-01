// Semantic index for the Nex Advisor (Philip 2026-08-01)
//
// Priority 2 from Philip's engineering review:
//   "Semantic retrieval (embeddings) · handles paraphrases · handles any
//   document shape · matches by meaning not words."
//
// Design:
//   - Precomputes embeddings for every snippet in the Truth Index once,
//     stores them in a JSON cache file at data/nex-staircase-embeddings.json
//   - At query time, embeds the customer's message and does cosine
//     similarity against the cached vectors
//   - Falls back gracefully to null when OPENAI_API_KEY is missing (calling
//     code degrades to keyword-only retrieval)
//   - Rebuild triggered by admin (button on authoring page)

import "server-only";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { embedText, EMBEDDING_DIMS } from "@/lib/llm/embeddings";
import { getTruthIndex, type IndexedSnippet } from "./truth-index";

const CACHE_PATH = "data/nex-staircase-embeddings.json";

type EmbeddingRecord = {
  id:     string;
  vector: number[];
};

type EmbeddingCache = {
  built_at:  string;
  model:     string;
  dims:      number;
  snippets:  EmbeddingRecord[];
};

let cachedIndex: Map<string, number[]> | null = null;

function cacheAbs(): string {
  return join(process.cwd(), CACHE_PATH);
}

/**
 * Rebuild the semantic index. Reads all approved snippets from Truth Index,
 * embeds each one via OpenAI, writes JSON cache file.
 * Returns null if OpenAI key missing · caller falls back to keyword-only.
 */
export async function rebuildSemanticIndex(): Promise<{
  built: number;
  failed: number;
  skipped: number;
  ok: boolean;
  reason?: string;
} | null> {
  const snippets = getTruthIndex();
  if (snippets.length === 0) {
    return { built: 0, failed: 0, skipped: 0, ok: false, reason: "no snippets indexed" };
  }

  // Test-embed a sanity string to confirm the API works before batching
  const probe = await embedText("staircase test probe");
  if (!probe) {
    return { built: 0, failed: 0, skipped: 0, ok: false, reason: "OPENAI_API_KEY missing or embedding API unreachable" };
  }

  const records: EmbeddingRecord[] = [];
  let failed = 0;

  for (const snippet of snippets) {
    // Embed section title + body for best semantic match
    const text = `${snippet.section}\n\n${snippet.text}`.slice(0, 8000);
    const vec = await embedText(text);
    if (vec) {
      records.push({ id: snippet.id, vector: vec });
    } else {
      failed += 1;
    }
  }

  const cache: EmbeddingCache = {
    built_at: new Date().toISOString(),
    model:    "text-embedding-3-small",
    dims:     EMBEDDING_DIMS,
    snippets: records,
  };
  writeFileSync(cacheAbs(), JSON.stringify(cache), "utf8");
  cachedIndex = null; // force reload on next query

  return {
    built:   records.length,
    failed,
    skipped: 0,
    ok:      true,
  };
}

/** Load embeddings from cache file into memory. */
function loadCache(): Map<string, number[]> | null {
  if (cachedIndex) return cachedIndex;
  const path = cacheAbs();
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf8");
    const cache = JSON.parse(raw) as EmbeddingCache;
    const map = new Map<string, number[]>();
    for (const rec of cache.snippets) map.set(rec.id, rec.vector);
    cachedIndex = map;
    return map;
  } catch {
    return null;
  }
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export type SemanticHit = {
  snippet: IndexedSnippet;
  score:   number;   // cosine similarity · 0..1
};

/**
 * Semantic search · returns top-k snippets by cosine similarity.
 * Returns [] when cache missing or query embedding fails.
 * Callers should combine with keyword scoring for hybrid ranking.
 */
export async function semanticSearch(query: string, k = 5): Promise<SemanticHit[]> {
  const index = loadCache();
  if (!index || index.size === 0) return [];

  const queryVec = await embedText(query);
  if (!queryVec) return [];

  const snippets = getTruthIndex();
  const bySnippetId = new Map(snippets.map((s) => [s.id, s]));

  const hits: SemanticHit[] = [];
  for (const [snippetId, snippetVec] of index) {
    const snippet = bySnippetId.get(snippetId);
    if (!snippet) continue;
    const score = cosine(queryVec, snippetVec);
    hits.push({ snippet, score });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, k);
}

export function isSemanticIndexReady(): boolean {
  const index = loadCache();
  return index !== null && index.size > 0;
}

export function getSemanticIndexStats(): { built_at: string | null; snippet_count: number } {
  const index = loadCache();
  if (!index) return { built_at: null, snippet_count: 0 };
  try {
    const raw = readFileSync(cacheAbs(), "utf8");
    const cache = JSON.parse(raw) as EmbeddingCache;
    return { built_at: cache.built_at, snippet_count: cache.snippets.length };
  } catch {
    return { built_at: null, snippet_count: index.size };
  }
}
