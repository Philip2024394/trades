// Hybrid retrieval — text now, vector when embeddings land, graph
// expansion on top. Every hit carries its provenance (text|vector|graph)
// so the UI can show "we found this because X."
//
// Ranking (deterministic, order matters):
//   1. tsvector match against title+summary+keywords
//   2. graph expansion from top-k seeds (adds neighbours with distance
//      weighting)
//   3. vector similarity (only when the entry has an embedding, else 0)
//
// Combined score is a weighted sum. Weights are tunable constants;
// change here, not scattered across callers.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { traverse } from "./graph";
import type { KnowledgeHit } from "./types";

const WEIGHT_TEXT   = 0.6;
const WEIGHT_VECTOR = 0.3;
const WEIGHT_GRAPH  = 0.1;

export async function hybridSearch(input: {
  query:    string;
  trade?:   string;
  limit?:   number;
  expand?:  boolean;             // graph-expand the top hits
}): Promise<KnowledgeHit[]> {
  const q = input.query.trim();
  if (!q) return [];
  const limit = input.limit ?? 5;

  const textHits = await textSearch(q, input.trade, limit * 2);

  const scored = new Map<string, KnowledgeHit>();
  for (const h of textHits) scored.set(h.id, h);

  if (input.expand !== false && textHits.length > 0) {
    // Expand from the top 3 seeds. Graph-only hits get a lower score
    // than text hits (weighted by depth).
    for (const seed of textHits.slice(0, 3)) {
      const nodes = await traverse({ seedEntryId: seed.id, maxHops: 2, maxNodes: 12 });
      for (const n of nodes) {
        if (n.depth === 0) continue;      // seed itself
        if (scored.has(n.entryId)) continue;
        const neighbour = await readEntryLite(n.entryId);
        if (!neighbour) continue;
        const graphScore = WEIGHT_GRAPH * (1 / n.depth);
        scored.set(neighbour.id, { ...neighbour, score: graphScore, reason: "graph" });
      }
    }
  }

  return Array.from(scored.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function textSearch(query: string, trade: string | undefined, limit: number): Promise<KnowledgeHit[]> {
  let q = supabaseAdmin
    .from("hammerex_nex_knowledge_entries")
    .select("id, trade, title, summary, confidence, version, sources")
    .eq("status", "published")
    .textSearch("search_tsv", query, { type: "websearch" });
  if (trade) q = q.eq("trade", trade);
  const { data } = await q.limit(limit);
  return (data ?? []).map((r, i) => ({
    id:         r.id,
    trade:      r.trade,
    title:      r.title,
    summary:    r.summary,
    confidence: r.confidence,
    version:    r.version,
    sources:    (r.sources ?? []) as KnowledgeHit["sources"],
    // Reciprocal rank as the text score contribution.
    score:      WEIGHT_TEXT * (1 / (i + 1)),
    reason:     "text" as const
  }));
}

async function readEntryLite(id: string): Promise<Omit<KnowledgeHit, "score" | "reason"> | null> {
  const { data } = await supabaseAdmin
    .from("hammerex_nex_knowledge_entries")
    .select("id, trade, title, summary, confidence, version, sources, status")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.status !== "published") return null;
  return {
    id:         data.id,
    trade:      data.trade,
    title:      data.title,
    summary:    data.summary,
    confidence: data.confidence,
    version:    data.version,
    sources:    (data.sources ?? []) as KnowledgeHit["sources"]
  };
}
