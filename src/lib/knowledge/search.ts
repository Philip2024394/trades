// Trade Knowledge Engine — RAG search.
//
// Given a question + optional trade filter + optional video-tag
// filter, return top-K matching knowledge entries via:
//   · Semantic similarity (cosine) if embeddings available
//   · Full-text (tsvector) rank as fallback
//   · Tag overlap boost in both modes
//   · Confidence + moderation gates
//
// Delegates to two Postgres SQL functions defined in
// migration 20260722210002_knowledge_search_rpc.sql —
// keeps ranking logic in the DB where it belongs and avoids
// SQL-injection risk.
//
// Trade-agnostic: works identically for every trade pack.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { embedText } from "@/lib/knowledge/embed";

export type KnowledgeHit = {
  id:                    string;
  trade_slug:            string;
  content_type:          string;
  title:                 string;
  ai_summary:            string;
  detailed_explanation:  string | null;
  video_tags:            string[];
  merchant_categories:   string[];
  trade_categories:      string[];
  source_url:            string | null;
  source_publisher:      string | null;
  source_type:           string | null;
  last_verified_at:      string;
  confidence_score:      number;
  match_score:           number;
  match_mode:            "embedding" | "fulltext";
};

export type SearchOptions = {
  tradeSlugs?:    string[];
  videoTags?:     string[];
  topK?:          number;
  minConfidence?: number;
};

export async function searchKnowledge(
  question: string,
  opts: SearchOptions = {}
): Promise<KnowledgeHit[]> {
  const topK          = opts.topK ?? 6;
  const minConfidence = opts.minConfidence ?? 0.5;
  const tradeFilter   = opts.tradeSlugs && opts.tradeSlugs.length > 0 ? opts.tradeSlugs : null;
  const tagFilter     = opts.videoTags  && opts.videoTags.length  > 0 ? opts.videoTags  : null;

  const q = question.trim();
  if (q.length < 3) return [];

  // Semantic path
  const embedding = await embedText(q);
  if (embedding) {
    const { data, error } = await supabaseAdmin.rpc("knowledge_search_semantic", {
      query_embedding: embedding as unknown as string,
      trade_filter:    tradeFilter,
      tag_filter:      tagFilter,
      top_k:           topK,
      min_confidence:  minConfidence
    });
    if (!error && Array.isArray(data)) {
      return (data as any[]).map(r => ({ ...r, match_mode: "embedding" as const }));
    }
    console.error("[knowledge.search] semantic rpc failed, falling back:", error?.message);
  }

  // Full-text fallback (also used when no OPENAI key present)
  const { data, error } = await supabaseAdmin.rpc("knowledge_search_fulltext", {
    query_text:     q,
    trade_filter:   tradeFilter,
    tag_filter:     tagFilter,
    top_k:          topK,
    min_confidence: minConfidence
  });
  if (error) {
    console.error("[knowledge.search] fulltext rpc failed:", error.message);
    return [];
  }
  return ((data as any[]) ?? [])
    .filter(r => r.match_score > 0)
    .map(r => ({ ...r, match_mode: "fulltext" as const }));
}

/** Record that an AI answer cited these entries — for quality
 *  tracking + ranking. Fire-and-forget. */
export async function recordCitations(entryIds: string[]): Promise<void> {
  if (entryIds.length === 0) return;
  try {
    await supabaseAdmin.rpc("knowledge_bump_citation", { entry_ids: entryIds });
  } catch { /* fire-and-forget */ }
}

/** Merge KB hits into a compact context string for the LLM. */
export function buildKnowledgeContext(hits: KnowledgeHit[]): string {
  if (hits.length === 0) return "";
  return hits.map((h, i) => {
    const sourceLine = h.source_url
      ? `\nSource: ${h.source_publisher ?? h.source_type ?? "verified"} — ${h.source_url}`
      : "";
    return `[KB-${i + 1}] ${h.title}\n${h.ai_summary}\n${(h.detailed_explanation ?? "").slice(0, 800)}${sourceLine}`;
  }).join("\n\n---\n\n");
}
