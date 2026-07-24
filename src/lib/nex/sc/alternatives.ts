// Alternatives lookup — queries the knowledge engine for equivalent
// materials. When nothing matches, returns an HONEST empty answer.
//
// The knowledge engine (Phase-earlier trade RAG) stores entries with
// content_type = 'material'. We text-search that pool by the query
// string; each hit becomes an alternative with a reason drawn from
// the entry's ai_summary.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type AlternativeItem, type AlternativesAnswer } from "./types";

export type FindAlternativesInput = {
  query:  string;              // "plasterboard" | "PVA primer"
  trade?: string;              // optional trade filter ("plastering")
  limit?: number;              // default 5
};

export async function findAlternatives(opts: FindAlternativesInput): Promise<AlternativesAnswer> {
  const q       = opts.query.trim();
  const limit   = opts.limit ?? 5;
  const ev      = evidenceFor("hammerex_knowledge_entries (content_type=material)", ["hammerex_knowledge_entries"]);

  if (!q) {
    return { query: q, alternatives: [], note: "Give me the product name.", evidence: ev };
  }

  let query = supabaseAdmin
    .from("hammerex_knowledge_entries")
    .select("title, ai_summary, source_url, trade_slug")
    .eq("content_type", "material")
    .eq("moderation_status", "approved")
    .ilike("title", `%${q}%`)
    .limit(limit);
  if (opts.trade) query = query.eq("trade_slug", opts.trade);

  const rows = await query;
  const alternatives: AlternativeItem[] = (rows.data ?? []).map((r) => ({
    label:      String(r.title),
    reason:     String(r.ai_summary ?? "").slice(0, 200),
    source_url: (r.source_url as string | null) ?? null,
    evidence:   ev
  }));

  const note = alternatives.length === 0
    ? `No alternative materials on file for "${q}". Alternatives populate as the knowledge engine grows — nothing invented.`
    : `${alternatives.length} alternative${alternatives.length === 1 ? "" : "s"} on file.`;

  return { query: q, alternatives, note, evidence: ev };
}
