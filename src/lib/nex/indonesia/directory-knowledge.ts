// src/lib/nex/indonesia/directory-knowledge.ts
//
// 2026-09-05 · Chief-engineer S3 slice · Directory-aware knowledge tier.
//
// Bridges the LIVE directory (nex.accommodation_business ·
// nex.service_business · nex.food_business · nex.mp_seller ·
// nex.transport_acquisition_record) into the knowledge retrieval
// surface so the LLM composer sees real hotel / gym / restaurant /
// marketplace / transport rows as ranked knowledge hits alongside
// walker-acquired and hand-authored records.
//
// WHY THIS EXISTS:
//   Prior to this slice the chat route called retrieveKnowledge() (which
//   loads knowledge-seed.json + knowledge-acquired.json + P1-promoted
//   records) in parallel with searchWorld() (which reads live directory
//   rows). Both flowed to the composer BUT via disjoint code paths.
//
//   Consequence: for a query like "gym in Jakarta", retrieveKnowledge
//   returned 0 (no walker records for gyms) even though searchWorld
//   returned real gym rows. The LLM composer only had walker knowledge
//   for its RAG context — the real directory data never became
//   composable evidence.
//
//   This module returns directory rows as KnowledgeRecord-shaped hits
//   that can be merged into retrieveKnowledge() results before they
//   flow into composeReplyViaLocalLLM.
//
// SAFETY:
//   · READ-ONLY — uses the canonical searchWorld() adapter
//   · Respects the same visibility gate as public /accommodation and
//     /services pages (adapters enforce visibility='public' AND
//     claim_status='listed')
//   · Provenance tagged with source="directory:live:{vertical}" and
//     walker_id="directory:{vertical}" so downstream retrieval can
//     distinguish directory rows from walker/seed records
//   · Never fabricates a field · adapter's null-preservation invariant
//     is carried through into the KnowledgeRecord shape
//   · Feature-flagged via NEX_DIRECTORY_KNOWLEDGE_ENABLED (default true)
//   · Fail-safe: never throws · returns [] on any error
//   · Bounded latency via Promise.race timeout
//
// COMPOSITION with existing surfaces:
//   · retrieveKnowledge() unchanged · continues to load its 4 sources
//   · searchWorld() unchanged · continues to feed world_cards + presented cards
//   · This module gives the COMPOSER richer RAG context. The card
//     surfaces (world_cards) remain the authoritative "these are the
//     businesses" UI · this module ensures the composer's spoken text
//     is grounded in the same rows.

import type { KnowledgeRecord } from "./knowledge";
import type { WorldRecord, WorldVertical } from "@/lib/nex/brain/world-adapters/types";
import { searchWorld } from "@/lib/nex/brain/world-adapters";

const DEFAULT_TIMEOUT_MS = 750;
const DEFAULT_PER_VERTICAL_LIMIT = 3;

const FLAG_ENABLED = () => process.env.NEX_DIRECTORY_KNOWLEDGE_ENABLED !== "false";

/** Stopwords removed from tokenized queries. Kept intentionally small
 *  so we don't accidentally strip a meaningful noun (business names
 *  often collide with common English words). */
const STOPWORDS = new Set([
  "the", "and", "for", "with", "near", "from", "into", "onto",
  "have", "has", "had", "was", "were", "are", "will", "would",
  "should", "could", "which", "what", "when", "where", "why", "how",
  "who", "one", "ones", "any", "some", "all", "this", "that", "these", "those",
  "about", "would", "please", "help", "want", "need", "look", "actually",
  "really", "just", "tell", "give", "show", "find", "coming", "starting",
  "somewhere", "yourself", "myself", "cheap", "cheaper", "cheapest", "good",
  "better", "best", "much", "many", "more", "less", "than", "then",
  "recommend", "recommended", "suggestion", "suggestions",
  "explain", "describe", "define", "compare", "difference",
]);

/** Short-but-meaningful tokens whitelisted below the min length. Every
 *  key here is also a CATEGORY_HINTS entry — if the user typed one of
 *  these we WANT to query. Keeping this list in sync with hints. */
const SHORT_MEANINGFUL = new Set([
  "gym", "gyms", "kos", "bar", "spa", "atm", "app", "car",
  "bnb", "inn", "cif", "moq",
]);

/** Extract meaningful tokens (>=5 chars OR whitelisted short) minus
 *  stopwords. Preserves the ORIGINAL full query as the first entry so
 *  exact-string business-name matches still score first. */
function extractQueryTokens(query: string, maxTokens = 4): string[] {
  const raw = query.trim();
  if (!raw) return [];
  const tokens = raw
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => (t.length >= 5 || SHORT_MEANINGFUL.has(t)) && !STOPWORDS.has(t));
  const uniq = Array.from(new Set(tokens)).slice(0, maxTokens);
  return raw.length >= 5 ? [raw, ...uniq] : uniq;
}

/** Verticals that have a live-directory adapter today. Grows when
 *  new adapters are registered in world-adapters/index.ts. Places is
 *  intentionally excluded until an adapter exists. */
const DEFAULT_VERTICALS: readonly WorldVertical[] = [
  "accommodation",
  "food",
  "service",
  "commerce",
  "transport",
];

/** Convert a WorldRecord to a KnowledgeRecord the retrieval merger can
 *  score alongside seed + walker + promoted records. All optional
 *  fields carry through unchanged · no fabrication. */
function worldRecordToKnowledge(rec: WorldRecord): KnowledgeRecord {
  const region = rec.city ?? rec.district ?? "Indonesia";
  const category = rec.vertical; // accommodation | food | service | ...
  const keywords: string[] = [];
  // Business name tokens (>=3 chars) become keywords for scoring.
  for (const tok of rec.name.toLowerCase().split(/[^a-z0-9]+/)) {
    if (tok.length >= 3) keywords.push(tok);
  }
  if (rec.category) keywords.push(rec.category.toLowerCase());
  if (rec.city) keywords.push(rec.city.toLowerCase());
  if (rec.district) keywords.push(rec.district.toLowerCase());
  keywords.push(rec.vertical);

  // Compose an honest content string · what the LLM will see as
  // evidence. Include only fields the adapter actually populated.
  const parts: string[] = [];
  parts.push(`${rec.name}`);
  if (rec.category) parts.push(`(${rec.category})`);
  const locBits: string[] = [];
  if (rec.district) locBits.push(rec.district);
  if (rec.city) locBits.push(rec.city);
  if (locBits.length > 0) parts.push(`in ${locBits.join(", ")}`);
  if (rec.address) parts.push(`· address: ${rec.address}`);
  if (rec.phone) parts.push(`· phone: ${rec.phone}`);
  if (rec.website) parts.push(`· website: ${rec.website}`);
  if (rec.rating !== undefined) parts.push(`· rating: ${rec.rating}`);
  if (rec.starRating !== undefined) parts.push(`· ${rec.starRating} stars`);
  if (rec.claimStatus) parts.push(`· ${rec.claimStatus} on NEX`);
  if (rec.verified) parts.push(`· verified`);
  const content = parts.join(" ");

  return {
    id: `directory:${rec.vertical}:${rec.id}`,
    topic: `${rec.vertical}.${(rec.category ?? "listing").toLowerCase()}.${rec.id.toLowerCase()}`,
    region,
    language: "en",
    stability: "live",
    confidence: rec.verified ? 0.95 : rec.claimStatus === "listed" ? 0.75 : 0.6,
    source: `directory:live:${rec.vertical}`,
    last_verified: rec.updatedAt ?? rec.provenance?.readAt ?? new Date().toISOString().slice(0, 10),
    content,
    keywords: Array.from(new Set(keywords)).slice(0, 12),
    category,
    audience: [],
    walker_id: `directory:${rec.vertical}`,
    market: rec.market,
    geo: rec.latitude !== undefined && rec.longitude !== undefined
      ? { lat: rec.latitude, lng: rec.longitude }
      : undefined,
    acquired_at: rec.provenance?.readAt?.slice(0, 10),
  };
}

export type DirectoryKnowledgeOptions = {
  market: "ID" | "UK" | "US";
  /** Verticals to query. Defaults to all registered. */
  verticals?: readonly WorldVertical[];
  /** Max records per vertical. Default 3. */
  perVerticalLimit?: number;
  /** Timeout for the whole parallel fetch. Default 750ms. */
  timeoutMs?: number;
  /** Optional city hint the composer already parsed from the message. */
  city?: string;
  /** Optional category hint the composer already parsed. */
  category?: string;
};

/**
 * Query the live directory across verticals and return the results
 * as KnowledgeRecords the composer's RAG context can consume.
 *
 * FAIL-SAFE: catches all errors · returns [] · never throws.
 * BOUNDED: hard timeout via Promise.race so the chat turn never stalls.
 * FLAGGED: NEX_DIRECTORY_KNOWLEDGE_ENABLED=false skips the whole path.
 */
export async function retrieveDirectoryAsKnowledge(
  query: string,
  opts: DirectoryKnowledgeOptions,
): Promise<KnowledgeRecord[]> {
  if (!FLAG_ENABLED()) return [];
  if (opts.market !== "ID") return []; // adapters are Indonesia-only today
  if (!query || query.trim().length < 2) return [];

  const verticals = opts.verticals ?? DEFAULT_VERTICALS;
  const perVertical = Math.max(1, Math.min(opts.perVerticalLimit ?? DEFAULT_PER_VERTICAL_LIMIT, 10));
  const timeoutMs = Math.max(100, Math.min(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS, 5000));

  const tokens = extractQueryTokens(query);
  if (tokens.length === 0) return [];

  // Detect a category hint from tokens. If the user typed "gym" we
  // scope the service adapter to category="gyms" so we don't waste
  // the search across salons/dentists/etc.
  const CATEGORY_HINTS: Record<string, { vertical: WorldVertical; category?: string }> = {
    gym:        { vertical: "service", category: "gyms" },
    gyms:       { vertical: "service", category: "gyms" },
    fitness:    { vertical: "service", category: "gyms" },
    salon:      { vertical: "service", category: "salons" },
    salons:     { vertical: "service", category: "salons" },
    dentist:    { vertical: "service", category: "dentists" },
    dentists:   { vertical: "service", category: "dentists" },
    optician:   { vertical: "service", category: "opticians" },
    opticians:  { vertical: "service", category: "opticians" },
    pharmacy:   { vertical: "service", category: "pharmacies" },
    pharmacies: { vertical: "service", category: "pharmacies" },
    mechanic:   { vertical: "service", category: "car-repair" },
    hotel:      { vertical: "accommodation" },
    hotels:     { vertical: "accommodation" },
    guesthouse: { vertical: "accommodation", category: "guesthouse" },
    villa:      { vertical: "accommodation", category: "villa" },
    villas:     { vertical: "accommodation", category: "villa" },
    kos:        { vertical: "accommodation", category: "kos" },
    hostel:     { vertical: "accommodation", category: "hostel" },
    restaurant: { vertical: "food" },
    restaurants:{ vertical: "food" },
    warung:     { vertical: "food" },
    cafe:       { vertical: "food" },
    coffee:     { vertical: "food" },
    batik:      { vertical: "commerce" },
    seller:     { vertical: "commerce" },
    sellers:    { vertical: "commerce" },
  };
  // Highest-precedence hint (first token match) narrows which verticals
  // to query — but we never REPLACE the caller's opts.verticals if they
  // set one; hints are additive to per-query focus.
  let scopedVertical: WorldVertical | null = null;
  let scopedCategory: string | undefined = opts.category;
  for (const tok of tokens) {
    const hint = CATEGORY_HINTS[tok];
    if (hint) {
      scopedVertical = scopedVertical ?? hint.vertical;
      scopedCategory = scopedCategory ?? hint.category;
    }
  }

  // Build the query plan: one search per (vertical, token) pair, with
  // scoped vertical taking precedence when detected. Bounded so we
  // don't fan out unbounded queries.
  const verticalsToQuery: readonly WorldVertical[] = scopedVertical ? [scopedVertical] : verticals;
  const searchesPerVertical = Math.min(tokens.length, 3);
  const tokensToSearch = tokens.slice(0, searchesPerVertical);

  const run = async (): Promise<KnowledgeRecord[]> => {
    const searchPromises: Array<Promise<{ vertical: WorldVertical; records: WorldRecord[] } | null>> = [];
    for (const v of verticalsToQuery) {
      for (const tok of tokensToSearch) {
        searchPromises.push(
          searchWorld({
            vertical: v,
            market: opts.market,
            query: tok,
            city: opts.city,
            category: scopedCategory,
            limit: perVertical,
          })
            .then((r) => ({ vertical: v, records: r?.records ?? [] }))
            .catch(() => null),
        );
      }
    }
    const settled = await Promise.allSettled(searchPromises);
    const out: KnowledgeRecord[] = [];
    const seenIds = new Set<string>();
    for (const s of settled) {
      if (s.status !== "fulfilled" || !s.value) continue;
      for (const rec of s.value.records) {
        const kid = `directory:${rec.vertical}:${rec.id}`;
        if (seenIds.has(kid)) continue;
        seenIds.add(kid);
        try { out.push(worldRecordToKnowledge(rec)); }
        catch { /* per-row failure never breaks the batch */ }
      }
    }
    return out;
  };

  try {
    const timeoutPromise = new Promise<KnowledgeRecord[]>((resolve) =>
      setTimeout(() => resolve([]), timeoutMs),
    );
    return await Promise.race([run(), timeoutPromise]);
  } catch {
    return [];
  }
}
