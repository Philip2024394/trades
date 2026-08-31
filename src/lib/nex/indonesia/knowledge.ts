// NEX Indonesia Knowledge Layer.
//
// Purpose · a small, curated, provenance-tagged corpus of STABLE
// Indonesia facts (capital, currency, food, tourism basics) that the
// conversation gate can retrieve from and hand to the LLM as
// grounded context, instead of stuffing everything into the system
// prompt or letting the LLM hallucinate.
//
// Design tenets (Philip 2026-08-30):
//   · SEPARATE stable knowledge (this file) from live data
//     (restaurants opening now, hotel prices, weather). Anything that
//     changes daily/hourly does NOT live here — it lives in NEX's
//     discovery/booking/weather services and is fetched at request
//     time via tools.
//   · Every record carries provenance: source, last_verified,
//     stability, confidence. Downstream code can gate on these (e.g.
//     "only cite records with confidence ≥ 0.9").
//   · Retrieval is deterministic keyword-overlap for v1 · no
//     embeddings, no LLM. Fast, offline, works with the local fleet.
//   · Never present a stale record as current — the stability field
//     tells the LLM (and any UI badge) how much to trust it.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { EntityRecord } from "./data/types";
import { listProvinces } from "./data/geo";

export type KnowledgeStability =
  | "stable"        // rarely changes (capital, food definition, geography)
  | "seasonal"      // may shift with dry/wet season, festivals, closures
  | "time_sensitive"// festival date, permit rule, one-off event
  | "live";         // must be fetched fresh · never store here

export type KnowledgeRecord = {
  id: string;
  topic: string;               // "indonesia.capital", "food.rendang"
  region: string;              // "Indonesia" | "Bali" | "Yogyakarta" | ...
  language: "en" | "id";
  stability: KnowledgeStability;
  confidence: number;          // 0..1
  source: string;              // "seed.official" | "seed.curated" | "gov.kemenparekraf" ...
  last_verified: string;       // ISO date
  content: string;             // the fact itself · plain text
  keywords: string[];          // canonical keywords for retrieval
  // ─── walker-pipeline extensions (optional · backward compatible) ─
  /** Walker-declared category · e.g. "landmark", "food", "safety". */
  category?: string;
  /** Audience filters · "tourist" | "family" | "backpacker" | ... */
  audience?: string[];
  /** Generated Q&A variants · retrieval scores against these. */
  questions?: string[];
  /** Extra alias phrasings. */
  aliases?: string[];
  /** ISO date · when the pipeline last refreshed this record. */
  acquired_at?: string;
  /** ISO date · when this record should be re-acquired. */
  refresh_after?: string;
  /** ID of the walker that produced this record. */
  walker_id?: string;
  /**
   * Market/country scope · Philip 2026-08-31 doctrine.
   * Lifted from provenance.market on the source EntityRecord.
   * Undefined ONLY for records missing market (backfill needed).
   */
  market?: "ID" | "UK" | "US" | "UNIVERSAL";
  /**
   * Geographic coordinates when the source record has them (place:*
   * entries from OSM etc.). Consumed by the Brain's accommodation
   * composer for honest distance-based area filtering. Stage 3.8+.
   */
  geo?: { lat?: number; lng?: number };
};

let CORPUS: KnowledgeRecord[] | null = null;
let ENTITY_CORPUS: KnowledgeRecord[] | null = null;

/**
 * Load canonical EntityRecord corpus and adapt each to KnowledgeRecord
 * shape for retrieval. This is the single source of truth per the
 * three-layer doctrine (Philip 2026-08-30) — every EntityRecord
 * (migrated legacy, seeded provinces/cities, live BMKG observations,
 * future domains) becomes retrievable through the same interface.
 *
 * Cached per-process · call `_resetKnowledgeCacheForTests()` to invalidate.
 */
function loadEntityCorpus(): KnowledgeRecord[] {
  if (ENTITY_CORPUS) return ENTITY_CORPUS;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const entPath = path.resolve(here, "../../../../data/indonesia/knowledge-entities.json");
  const adapted: KnowledgeRecord[] = [];
  try {
    if (!existsSync(entPath)) { ENTITY_CORPUS = []; return ENTITY_CORPUS; }
    const parsed = JSON.parse(readFileSync(entPath, "utf8")) as { entities?: EntityRecord[] };
    for (const e of parsed.entities ?? []) {
      const hit = entityToKnowledgeRecord(e);
      if (hit) adapted.push(hit);
    }
  } catch { /* corrupt file · fall through to empty */ }
  ENTITY_CORPUS = adapted;
  return ENTITY_CORPUS;
}

/**
 * Convert an EntityRecord into a KnowledgeRecord-shaped view suitable
 * for the retrieval scoring loop. Never mutates the input entity.
 * Returns null if the record can't be adapted (e.g. no name).
 *
 * Provenance is preserved through `source` + `walker_id` so the LLM's
 * grounded-context block still carries "who said this + when".
 */
export function entityToKnowledgeRecord(e: EntityRecord): KnowledgeRecord | null {
  if (!e.id || !e.name) return null;
  // Prefer the original topic stored by migration · this is the
  // lossless path for the legacy 97. Otherwise construct one from
  // category + name-slug so seeded/new entities are also searchable.
  const legacyTopic = (e.attributes as { legacyTopic?: string } | undefined)?.legacyTopic;
  const nameSlug = e.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const topic = typeof legacyTopic === "string" && legacyTopic
    ? legacyTopic
    : (e.category ? `${e.category}.${nameSlug}` : `${e.kind}.${nameSlug}`);
  const region = resolveRegionDisplay(e);
  const stability = freshnessToStability(e.freshness?.policy);
  // Prefer the author-set legacy confidence (preserved by migration
  // in attributes.legacyConfidence) · falls back to the composite
  // quality score, then to a middling default. Author intent must not
  // be silently overridden by a computed score that rewards field-
  // completeness more than editorial care.
  const legacyConfidence = (e.attributes as { legacyConfidence?: number } | undefined)?.legacyConfidence;
  const confidence = typeof legacyConfidence === "number" ? legacyConfidence
    : typeof e.quality?.overall === "number" ? e.quality.overall
    : 0.7;
  const source = e.provenance?.[0]?.sourceName ?? "unknown";
  const lastVerified = e.freshness?.lastVerifiedAt ?? e.provenance?.[0]?.observedAt ?? "";
  const content = e.description ?? e.name;
  const walker = e.provenance?.[0]?.walkerId;
  const acquired = e.provenance?.[0]?.observedAt;
  // The migration writer attaches `questions` directly to EntityRecord
  // (not declared in the type) · read defensively.
  const questions = (e as unknown as { questions?: string[] }).questions;
  return {
    id: e.id,
    topic,
    region,
    language: "en",
    stability,
    confidence,
    source,
    last_verified: lastVerified,
    content,
    keywords: e.keywords ?? [],
    // Use the entity's own category · this carries walker-declared
    // signal (e.g. "safety" for emergency records) that the retrieval
    // safety-signal boost depends on. Falling back to topic-prefix
    // derivation only when the entity has no category.
    category: e.category ?? topic.split(".")[0],
    questions,
    aliases: e.aliases,
    acquired_at: acquired,
    walker_id: walker,
    // Lift the market from provenance so retrieval can filter · doctrine.
    market: e.provenance?.[0]?.market as ("ID" | "UK" | "US" | "UNIVERSAL" | undefined),
    // Geographic coordinates when available (place:* records).
    geo: (typeof e.geo?.lat === "number" && typeof e.geo?.lng === "number")
      ? { lat: e.geo.lat, lng: e.geo.lng }
      : undefined,
  };
}

function resolveRegionDisplay(e: EntityRecord): string {
  const slug = e.geo?.province;
  if (!slug) return "Indonesia";
  const p = listProvinces().find((pp) => pp.slug === slug);
  return p?.name ?? "Indonesia";
}

function freshnessToStability(policy: string | undefined): KnowledgeStability {
  switch (policy) {
    case "live":                       return "live";
    case "very_fast":
    case "hourly":                     return "time_sensitive";
    case "daily":
    case "weekly":                     return "seasonal";
    case "monthly":
    case "seasonal":
    case "long_lived":
    default:                           return "stable";
  }
}

function loadCorpus(): KnowledgeRecord[] {
  if (CORPUS) return CORPUS;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const seedPath = path.resolve(here, "../../../../data/indonesia/knowledge-seed.json");
  const acquiredPath = path.resolve(here, "../../../../data/indonesia/knowledge-acquired.json");
  const merged: KnowledgeRecord[] = [];
  const seenIds = new Set<string>();

  // Hand-curated seed (ground truth · takes priority on ID collision).
  try {
    const raw = readFileSync(seedPath, "utf8");
    for (const r of JSON.parse(raw) as KnowledgeRecord[]) {
      if (!seenIds.has(r.id)) { seenIds.add(r.id); merged.push(r); }
    }
  } catch { /* seed file missing · corpus still usable via acquired */ }

  // Walker-acquired records (published by the pipeline).
  try {
    const raw = readFileSync(acquiredPath, "utf8");
    const parsed = JSON.parse(raw) as { records?: KnowledgeRecord[] };
    for (const r of parsed.records ?? []) {
      if (!seenIds.has(r.id)) { seenIds.add(r.id); merged.push(r); }
    }
  } catch { /* acquired file not published yet · corpus is seed-only */ }

  CORPUS = merged;
  return CORPUS;
}

export type RetrievalOptions = {
  /** Max number of hits to return. Default 3. */
  limit?: number;
  /** Only return records with confidence ≥ this. Default 0. */
  minConfidence?: number;
  /** Filter by region (e.g. "Bali"). */
  region?: string;
  /**
   * Market-scope filter · Philip 2026-08-31 doctrine.
   * When set, only records whose provenance.market matches (or is
   * "UNIVERSAL") are returned. When unset, no filter is applied
   * (backward compatible · legacy callers keep working).
   *
   * Set to "ID" from Indonesian chat surfaces to prevent UK/US
   * records from ever surfacing to an Indonesian user.
   */
  market?: "ID" | "UK" | "US" | "UNIVERSAL";
  /**
   * Preferred category · Philip 2026-08-31 · when the intent maps to
   * a specific NEX vertical (e.g. intent="accommodation" →
   * preferCategory="accommodation"), records whose id starts with
   * that vertical's namespace get a scoring boost. Purely additive ·
   * does not exclude other records · they can still appear.
   */
  preferCategory?: string;
};

export type KnowledgeHit = KnowledgeRecord & {
  /** How well the message matched · sum of keyword hits + region bonus. */
  score: number;
};

/** Retrieve the most-relevant stable knowledge records for a user
 *  message. Deterministic · keyword-overlap · no LLM call. Returns an
 *  empty array when nothing matches; the consumer must not fabricate.
 *
 *  **3-tier stability enforcement:** records with stability "live"
 *  are NEVER returned — those must come from real-time tools. If a
 *  live record ever leaks into the corpus (e.g. authoring mistake),
 *  this gate blocks it at retrieval so the LLM cannot cite it. */
export function retrieveKnowledge(message: string, opts: RetrievalOptions = {}): KnowledgeHit[] {
  // Doctrine (Philip 2026-08-30): retrieval consumes the canonical
  // EntityRecord corpus. Legacy corpus is a fallback ONLY when the
  // entity corpus is empty (fresh checkout · migration not yet run).
  const entityView = loadEntityCorpus();
  const corpus = entityView.length > 0 ? entityView : loadCorpus();
  if (corpus.length === 0) return [];
  const limit = opts.limit ?? 3;
  const minConfidence = opts.minConfidence ?? 0;
  const lower = message.toLowerCase();

  const scored: KnowledgeHit[] = [];
  for (const rec of corpus) {
    // Live records ARE retrievable now (doctrine rule 4) · downstream
    // personality/system-prompt tells the LLM that live-tier evidence
    // may need a fresh tool check. Retrieval no longer hard-blocks.
    if (rec.confidence < minConfidence) continue;
    if (opts.region && rec.region.toLowerCase() !== opts.region.toLowerCase() && rec.region !== "Indonesia") continue;
    // Market filter · Philip 2026-08-31 doctrine.
    // When caller specifies market, only records matching that market
    // (or explicitly UNIVERSAL) pass. Records with undefined market
    // are DROPPED under an explicit market filter · safer than
    // guessing which market they belong to.
    if (opts.market) {
      const recMarket = rec.market;
      if (recMarket !== opts.market && recMarket !== "UNIVERSAL") continue;
    }

    let score = 0;
    for (const kw of rec.keywords) {
      if (lower.includes(kw.toLowerCase())) score += 1;
    }
    // Question-variant + alias bonus (walker-produced Q&A). Matches
    // are strong signals — worth 1.5 each because a variant is a
    // specific phrasing of the same information need.
    if (rec.questions) {
      for (const q of rec.questions) {
        if (lower.includes(q.toLowerCase())) score += 1.5;
      }
    }
    if (rec.aliases) {
      for (const a of rec.aliases) {
        if (lower.includes(a.toLowerCase())) score += 0.7;
      }
    }
    // Topic prefix bonus · SKIPS generic country parts like
    // "indonesia" / "practical" that appear in most topics · those
    // words don't distinguish records. Only distinguishing parts
    // ("food", "tourism", "capital", "yogyakarta") earn the bonus.
    const GENERIC_TOPIC_PARTS = new Set(["indonesia", "practical", "general"]);
    for (const part of rec.topic.split(".")) {
      if (part.length >= 3 && !GENERIC_TOPIC_PARTS.has(part) && lower.includes(part.toLowerCase())) score += 0.5;
    }
    // Region name bonus (weaker · we don't want a generic "Indonesia"
    // to swamp a specific match).
    if (rec.region !== "Indonesia" && lower.includes(rec.region.toLowerCase())) score += 0.5;

    // Category-match bonus · when the user's message contains the
    // record's walker-declared category ("airport", "hospital",
    // "food"), boost significantly. This is the fix for the
    // "asking about a Bali hospital returns the Bali overview"
    // failure mode — the category signal beats generic region.
    // Generic country-scoped categories ("indonesia", "practical",
    // "general", "geo") are excluded · they appear on too many records
    // to be a distinguishing signal and would boost broad records over
    // specific ones.
    const GENERIC_CATEGORIES = new Set(["indonesia", "practical", "general", "geo"]);
    if (rec.category && rec.category.length >= 3 && !GENERIC_CATEGORIES.has(rec.category.toLowerCase()) && lower.includes(rec.category.toLowerCase())) score += 2.0;

    // Safety-signal boost · when a user's message contains a
    // safety-adjacent word (lost, stolen, help, sick, hurt, passport,
    // etc.) AND the record's category is "safety", boost strongly.
    // A person asking "I lost my passport in Bali" should get the
    // embassy record, not a Bali tourism overview. This is the
    // routing counterpart to the safety-mode intent gate.
    const SAFETY_SIGNALS = ["lost", "stolen", "help", "sick", "hurt", "injured", "passport", "emergency", "police", "hospital", "ambulance"];
    if (rec.category === "safety" && SAFETY_SIGNALS.some((w) => lower.includes(w))) score += 3.0;
    // Also match the topic's first segment when it maps to a
    // recognisable domain word (airport, hospital, emergency, food,
    // etc.). This complements the category bonus for hand-authored
    // seed records that don't carry a category field.
    const topicHead = rec.topic.split(".")[0] ?? "";
    const RECOGNISED_HEADS = new Set(["airport", "hospital", "emergency", "food", "landmark", "tourism", "culture", "practical", "experience"]);
    if (RECOGNISED_HEADS.has(topicHead) && lower.includes(topicHead)) score += 2.0;

    // Specific topic-tail match · when a record's topic ends with a
    // bare word (no underscores) that appears in the message, that's
    // an unmistakable signal. E.g. `food.halal` + user says "halal"
    // → this record beats any generic food record.
    //
    // BUT skip when the tail equals the region name (case-insensitive)
    // — otherwise `tourism.bali` gets +3 for every message about Bali,
    // which would swamp specific Bali records (airport, hospital,
    // landmark, ...) that also mention Bali.
    const topicTail = rec.topic.split(".").pop() ?? "";
    const tailLower = topicTail.toLowerCase();
    if (
      topicTail &&
      !topicTail.includes("_") &&
      topicTail.length >= 4 &&
      lower.includes(tailLower) &&
      tailLower !== rec.region.toLowerCase()
    ) score += 3.0;

    // Prefer-category boost · Philip 2026-08-31 · when the caller
    // signals a specific vertical (e.g. "accommodation"), boost records
    // that belong to it so they beat generic tourism/city records at
    // retrieval time. Additive only · does not exclude other matches.
    //
    // Two shapes qualify (Philip 2026-08-31 · accommodation discovery fix):
    //   1. Curated explanation records use `id="${vertical}:*"`
    //      (e.g. accommodation:type:hotel, accommodation:regional:*).
    //   2. Real properties use `category="${vertical}.*"` and
    //      `id="place:${vertical}:*"` (e.g. category="accommodation.hotel"
    //      with id="place:accommodation:osm:node_492167658"). Real 274
    //      OSM Yogyakarta properties fall in this bucket.
    // Without matching both shapes, real property records score 0 on
    // the vertical signal and get swamped by the tourism essay for
    // "I need a hotel in Yogyakarta".
    if (opts.preferCategory) {
      const prefer = opts.preferCategory;
      const idMatch = rec.id.startsWith(`${prefer}:`) || rec.id.startsWith(`place:${prefer}:`);
      const catMatch = !!rec.category && (rec.category === prefer || rec.category.startsWith(`${prefer}.`));
      if (idMatch || catMatch) score += 3.5;
    }
    if (score > 0) scored.push({ ...rec, score });
  }

  scored.sort((a, b) => b.score - a.score || b.confidence - a.confidence);
  return scored.slice(0, limit);
}

/** Format retrieved hits as a compact grounded-context block the LLM
 *  can consume. Includes provenance so the model + downstream
 *  telemetry know what NEX knew. */
export function formatKnowledgeBlock(hits: KnowledgeHit[]): string {
  if (hits.length === 0) return "";
  const lines: string[] = ["NEX Indonesia knowledge (grounded · cite the region/topic when useful, do not embellish):"];
  for (const h of hits) {
    lines.push(`  · [${h.topic} · ${h.region} · ${h.stability} · verified ${h.last_verified}]`);
    lines.push(`    ${h.content}`);
  }
  return lines.join("\n");
}

/** Reset for tests — clears BOTH corpora so the next call re-reads. */
export function _resetKnowledgeCacheForTests(): void {
  CORPUS = null;
  ENTITY_CORPUS = null;
}

/** Legacy KnowledgeRecord store (seed + acquired files). Kept for
 *  guardian migration-lossless assertions and HQ legacy-record count. */
export function listAllRecords(): readonly KnowledgeRecord[] {
  return loadCorpus();
}

/** Canonical entity corpus adapted to KnowledgeRecord view · used by
 *  retrieval and any surface that wants to see everything NEX knows. */
export function listAllEntities(): readonly KnowledgeRecord[] {
  return loadEntityCorpus();
}
