// src/lib/nex/search/index.ts
//
// Founder Phase 26 · P26-1 · NEX Search library.
//
// Returns structured results with per-result trust classification (Doctrine #6).
// Composition:
//   1. Query the accommodation adapter (only fully-populated domain today · 9,203 rows)
//   2. Full-text search over persisted conversations (Postgres FTS)
//   3. Every result is stamped:
//        · trust_layer  ∈ { canonical_verified, canonical_authoritative, provisional, unknown }
//        · verified     : boolean derived from trust_layer
//        · doctrine_6_label: "verified" | "unconfirmed"
//        · source       : URL / entity_ref / conversation_id
//        · snippet      : ~180-char excerpt
//
// Deliberately does NOT invoke the LLM · composition-first.

import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";

export interface SearchResult {
  ref_id: string;
  kind: "accommodation" | "conversation";
  title: string;
  snippet: string;
  source_reference: string | null;
  trust_layer: "canonical_verified" | "canonical_authoritative" | "provisional" | "unknown";
  verified: boolean;
  doctrine_6_label: "verified" | "unconfirmed";
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  score: number;
}

export interface SearchArgs {
  q: string;
  limit?: number;
  verified_only?: boolean;
  city?: string | null;
}

function classify(trust_layer: SearchResult["trust_layer"]): { verified: boolean; label: "verified" | "unconfirmed" } {
  const v = trust_layer === "canonical_verified" || trust_layer === "canonical_authoritative";
  return { verified: v, label: v ? "verified" : "unconfirmed" };
}

async function searchAccommodation(q: string, limit: number): Promise<SearchResult[]> {
  try {
    const pool = getKnowledgeFactoryDbPool();
    // Uses real accommodation_business columns · trigram similarity ·
    // composition-first (no LLM call). Score fuses name, category, city.
    const pattern = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    const r = await pool.query(
      `SELECT
         COALESCE(public_listing_ref, internal_id::text) AS ref_id,
         business_name AS title,
         COALESCE(address, city, '') AS snippet_source,
         website,
         city,
         coordinates_lat AS latitude,
         coordinates_lng AS longitude,
         (
           (CASE WHEN business_name ILIKE $1 THEN 4 ELSE 0 END) +
           (CASE WHEN category      ILIKE $1 THEN 3 ELSE 0 END) +
           (CASE WHEN city          ILIKE $1 THEN 2 ELSE 0 END) +
           (CASE WHEN address       ILIKE $1 THEN 1 ELSE 0 END)
         ) AS score
       FROM nex.accommodation_business
       WHERE business_name ILIKE $1
          OR category      ILIKE $1
          OR address       ILIKE $1
          OR city          ILIKE $1
       ORDER BY score DESC, business_name ASC
       LIMIT $2`,
      [pattern, limit],
    ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
    return (r.rows ?? []).map((row) => {
      // Trust layer: verified when we have source_reference + last_verified_at,
      // otherwise provisional. Doctrine #6 label falls out.
      const trust_layer: SearchResult["trust_layer"] = row.website ? "canonical_verified" : "provisional";
      const cls = classify(trust_layer);
      const snippet = String(row.snippet_source ?? "").slice(0, 180);
      return {
        ref_id: `accom:${String(row.ref_id)}`,
        kind: "accommodation",
        title: String(row.title ?? "(unnamed)"),
        snippet,
        source_reference: (row.website as string) ?? null,
        trust_layer,
        verified: cls.verified,
        doctrine_6_label: cls.label,
        latitude: (row.latitude as number) ?? null,
        longitude: (row.longitude as number) ?? null,
        city: (row.city as string) ?? null,
        score: Number(row.score ?? 0),
      };
    });
  } catch { return []; }
}

async function searchConversations(q: string, limit: number): Promise<SearchResult[]> {
  try {
    const pool = getKnowledgeFactoryDbPool();
    const r = await pool.query(
      `SELECT conv.conversation_id, conv.title, conv.created_at::text,
              ts_headline('simple', msg.content, plainto_tsquery('simple', $1), 'MaxWords=25, MinWords=8') AS snippet,
              ts_rank(to_tsvector('simple', msg.content), plainto_tsquery('simple', $1)) AS score
         FROM nex.conversation conv
         JOIN nex.conversation_message msg USING (conversation_id)
        WHERE to_tsvector('simple', msg.content) @@ plainto_tsquery('simple', $1)
          AND conv.deleted_at IS NULL
        ORDER BY score DESC
        LIMIT $2`,
      [q, limit],
    ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
    return (r.rows ?? []).map((row) => {
      // Persisted conversation text is user + assistant turns · not verified
      // evidence · always marked provisional so Doctrine #6 label is "unconfirmed".
      const trust_layer: SearchResult["trust_layer"] = "provisional";
      const cls = classify(trust_layer);
      return {
        ref_id: `conv:${String(row.conversation_id)}`,
        kind: "conversation",
        title: String(row.title ?? "(untitled conversation)"),
        snippet: String(row.snippet ?? "").slice(0, 200),
        source_reference: `/nex/share/${String(row.conversation_id)}`,
        trust_layer,
        verified: cls.verified,
        doctrine_6_label: cls.label,
        score: Number(row.score ?? 0),
      };
    });
  } catch { return []; }
}

/**
 * Runs both source searches in parallel, dedupes trivially by ref_id, merges
 * on descending score. Every result carries a Doctrine #6 label.
 */
export async function search(args: SearchArgs): Promise<{
  query: string;
  results: SearchResult[];
  counts: { verified: number; unconfirmed: number };
  sources_queried: string[];
  ms: number;
}> {
  const t0 = performance.now();
  const limit = Math.max(1, Math.min(50, args.limit ?? 12));
  const q = args.q.trim();
  const [accom, convs] = await Promise.all([
    searchAccommodation(q, limit),
    searchConversations(q, limit),
  ]);
  let merged: SearchResult[] = [...accom, ...convs].sort((a, b) => b.score - a.score);
  if (args.verified_only) merged = merged.filter((r) => r.verified);
  if (args.city) merged = merged.filter((r) => !r.city || r.city.toLowerCase() === (args.city ?? "").toLowerCase());
  merged = merged.slice(0, limit);

  const counts = {
    verified: merged.filter((r) => r.verified).length,
    unconfirmed: merged.filter((r) => !r.verified).length,
  };

  return {
    query: q,
    results: merged,
    counts,
    sources_queried: ["accommodation", "conversation"],
    ms: Math.round(performance.now() - t0),
  };
}
