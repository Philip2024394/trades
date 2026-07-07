// Natural-language memory query.
//
// Takes a question like "show me every sandstone patio in LS6 with
// grey pointing", asks the LLM to extract:
//   1. Structured facet filters (trade / materials / postcode / etc.)
//   2. A concise search phrase to embed
//
// Then executes both queries in Postgres:
//   - Structured: memory_records @> facetMatch
//   - Vector: match_memory_records RPC via cosine similarity
// Union + dedupe + rank the results.
//
// Fails safe: if the LLM is unavailable, extracts trivial keyword
// filters via regex and runs a structured-only query. Still useful.

import { createClient } from "@supabase/supabase-js";
import { completeJson } from "@/lib/llm/anthropic";
import { embedText } from "@/lib/llm/embeddings";
import type { MemoryRecord, MemoryRecordType } from "./types";

function client() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export type NlQueryPlan = {
  facetMatch: Record<string, unknown>;
  postcodeStartsWith: string | null;
  recordType: MemoryRecordType | null;
  searchPhrase: string;
  interpretation: string;
};

export type QueryHit = {
  record: MemoryRecord;
  score: number;
  matchedBy: "structured" | "vector" | "both";
};

/** Ask the LLM to translate the NL question into a structured plan. */
async function planQuery(
  question: string
): Promise<NlQueryPlan | null> {
  const plan = await completeJson<{
    facet_match?: Record<string, unknown>;
    postcode_starts_with?: string;
    record_type?: string;
    search_phrase?: string;
    interpretation?: string;
  }>({
    system: `You translate merchant questions about their business archive into structured search plans.
Respond in JSON only. Never invent facts.

Facet keys used in the archive:
- trade (e.g. "roofer", "landscaper", "kitchen_fitter")
- service (e.g. "slate_re_tile", "patio")
- materials (array of strings)
- colours (array of strings)
- cost_band ("small" | "medium" | "large" | "premium")
- completed_at (ISO date range implicit — if the question mentions
  time, put it in interpretation but don't add to facet_match)

Record types: "job", "customer", "material_used", "technique",
"certification", "staff_member", "service", "vehicle", "service_area".

Only include facet_match keys the question CLEARLY implies. If the
question is broad, keep facet_match small and rely on search_phrase.`,
    maxTokens: 400,
    temperature: 0.2,
    messages: [
      {
        role: "user",
        content: `Question: "${question}"

Return JSON with:
- facet_match: partial object like { "trade": "landscaper", "materials": ["sandstone"] }
- postcode_starts_with: UK postcode district prefix if mentioned (e.g. "LS6")
- record_type: if implied (usually "job")
- search_phrase: 3-6 words that summarise what to search for semantically
- interpretation: one short human sentence stating how you understood the question`
      }
    ]
  });
  if (!plan) return null;
  return {
    facetMatch: (plan.facet_match as Record<string, unknown>) ?? {},
    postcodeStartsWith: plan.postcode_starts_with?.toUpperCase() ?? null,
    recordType: (plan.record_type as MemoryRecordType | undefined) ?? null,
    searchPhrase: plan.search_phrase ?? question,
    interpretation: plan.interpretation ?? question
  };
}

/** Fallback keyword extraction — very light regex for when LLM is
 *  unavailable. Not clever, but doesn't fail. */
function trivialPlan(question: string): NlQueryPlan {
  const q = question.toLowerCase();
  const postcodeMatch = q.match(/\b([a-z]{1,2}[0-9]{1,2})\b/i);
  return {
    facetMatch: {},
    postcodeStartsWith: postcodeMatch ? postcodeMatch[1].toUpperCase() : null,
    recordType: null,
    searchPhrase: question,
    interpretation: `Basic keyword search for "${question}" (LLM offline).`
  };
}

/** Execute the plan against Postgres. Runs vector + structured in
 *  parallel, unions the sets, dedupes on id, ranks by combined score. */
async function executePlan(
  merchantId: string,
  plan: NlQueryPlan
): Promise<QueryHit[]> {
  const c = client();
  if (!c) return [];

  // Vector query (best-effort — falls through cleanly if no embedding).
  const embedding = await embedText(plan.searchPhrase);
  const vectorHits = new Map<string, QueryHit>();
  if (embedding) {
    const { data } = await c.rpc("match_memory_records", {
      filter_merchant_id: merchantId,
      query_embedding: embedding,
      match_count: 20,
      min_similarity: 0.25
    });
    for (const raw of (data ?? []) as Array<{
      id: string;
      record_type: string;
      facets: Record<string, unknown>;
      postcode: string | null;
      latitude: number | null;
      longitude: number | null;
      linked_event_ids: string[];
      created_at: string;
      updated_at: string;
      similarity: number;
    }>) {
      vectorHits.set(raw.id, {
        record: {
          id: raw.id,
          merchantId,
          recordType: raw.record_type as MemoryRecordType,
          facets: raw.facets ?? {},
          postcode: raw.postcode,
          latitude: raw.latitude,
          longitude: raw.longitude,
          linkedEventIds: raw.linked_event_ids ?? [],
          createdAt: raw.created_at,
          updatedAt: raw.updated_at
        },
        score: raw.similarity ?? 0,
        matchedBy: "vector"
      });
    }
  }

  // Structured query.
  let q = c
    .from("memory_records")
    .select("*")
    .eq("merchant_id", merchantId);
  if (plan.recordType) q = q.eq("record_type", plan.recordType);
  if (plan.facetMatch && Object.keys(plan.facetMatch).length > 0) {
    q = q.contains("facets", plan.facetMatch);
  }
  if (plan.postcodeStartsWith) {
    q = q.like("postcode", `${plan.postcodeStartsWith}%`);
  }
  const { data: structRows } = await q
    .order("updated_at", { ascending: false })
    .limit(20);

  const structuredHits = new Map<string, QueryHit>();
  for (const row of (structRows ?? []) as Array<{
    id: string;
    record_type: string;
    facets: Record<string, unknown>;
    postcode: string | null;
    latitude: number | null;
    longitude: number | null;
    linked_event_ids: string[];
    created_at: string;
    updated_at: string;
  }>) {
    structuredHits.set(row.id, {
      record: {
        id: row.id,
        merchantId,
        recordType: row.record_type as MemoryRecordType,
        facets: row.facets ?? {},
        postcode: row.postcode,
        latitude: row.latitude,
        longitude: row.longitude,
        linkedEventIds: row.linked_event_ids ?? [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      },
      score: 1.0, // structured hits are exact matches — high confidence
      matchedBy: "structured"
    });
  }

  // Merge — structured beats vector on score when both match.
  const merged = new Map<string, QueryHit>();
  for (const [id, hit] of vectorHits) merged.set(id, hit);
  for (const [id, hit] of structuredHits) {
    const existing = merged.get(id);
    if (existing) {
      merged.set(id, {
        ...hit,
        score: Math.max(existing.score, hit.score),
        matchedBy: "both"
      });
    } else {
      merged.set(id, hit);
    }
  }

  return Array.from(merged.values()).sort((a, b) => b.score - a.score);
}

/** The public entry point. Merchant asks a question → returns hits +
 *  the plan we used to serve them. */
export async function askMemory(
  merchantId: string,
  question: string
): Promise<{ plan: NlQueryPlan; hits: QueryHit[] }> {
  const plan = (await planQuery(question)) ?? trivialPlan(question);
  const hits = await executePlan(merchantId, plan);
  return { plan, hits };
}
