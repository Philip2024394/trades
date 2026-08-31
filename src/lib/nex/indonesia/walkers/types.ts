// NEX Indonesia · Knowledge Walker types.
//
// A "walker" is any pluggable acquirer of Indonesia facts — from a
// curated static file, an embassy page, a tourism-ministry feed, a
// hospital directory, or (later) a web crawl. Every walker produces
// the same shape (RawFactChunk[]) so the pipeline (see pipeline.ts)
// can normalise, dedupe, quality-score and publish them into the
// KnowledgeRecord corpus consistently.
//
// Design tenets (Philip 2026-08-30):
//   · Walkers are pure acquirers. They do NOT publish directly to the
//     corpus. The pipeline is the single funnel — that's what lets us
//     enforce provenance, dedupe, and Q&A generation once.
//   · Every RawFactChunk carries its source. Untraced facts are
//     rejected — the pipeline drops chunks without provenance.
//   · Walkers are async but MUST be deterministic given the same
//     input. A curated-source walker reads a file; an HTTP walker
//     must record the URL + fetch timestamp so re-runs are auditable.
//   · Walker output is CONTENT ONLY. The pipeline attaches
//     stability, refresh cadence, and Q&A variants based on the
//     walker's declared domain + the fact's category.

import type { KnowledgeStability } from "../knowledge";

export type KnowledgeDomain =
  | "places"        // cities, islands, regions
  | "landmark"      // temples, monuments, natural landmarks
  | "food"          // dishes, cuisine styles
  | "culture"       // customs, religion, etiquette, language
  | "practical"     // transport, SIM, payment, visa, airports
  | "safety"        // hospitals, emergency, scams, security
  | "experience";   // family / romantic / backpacker / luxury filters

export type FactAudience =
  | "tourist"
  | "family"
  | "backpacker"
  | "luxury"
  | "digital_nomad"
  | "couple"
  | "solo"
  | "senior"
  | "general";

/** Raw output of any walker · one fact per chunk. Pipeline normalises
 *  and enriches these into KnowledgeRecords. */
export type RawFactChunk = {
  /** Walker-scoped stable ID · e.g. "curated:airports:cgk". Pipeline
   *  namespaces per walker to prevent collisions across sources. */
  externalId: string;
  domain: KnowledgeDomain;
  /** Free-text topic tag · pipeline may standardise. */
  topic: string;
  region: string;
  /** Fact content · plain text · 40–800 chars ideal. */
  content: string;
  /** Discovery keywords · pipeline dedupes and lower-cases. */
  keywords: string[];
  /** Who the fact is most useful for. Default ["tourist"]. */
  audience?: FactAudience[];
  language?: "en" | "id";
  stability?: KnowledgeStability;
  /** ISO date · when this fact was last confirmed by the walker. */
  observedAt: string;
  /** Provenance · MUST be set. Rejected by pipeline when empty. */
  source: string;
  /** Walker-declared confidence 0..1. Pipeline may downgrade. */
  confidence?: number;
};

/** A concrete walker — one file per source. All acquire() calls MUST
 *  be safe to run repeatedly (idempotent from the walker's side —
 *  the pipeline handles dedupe). */
export interface KnowledgeWalker {
  /** Stable walker ID · e.g. "curated:airports". Pipeline uses this
   *  as the namespace for produced records. */
  readonly id: string;
  readonly domain: KnowledgeDomain;
  /** Default stability for facts this walker produces. Overridable
   *  per chunk. */
  readonly defaultStability: KnowledgeStability;
  /** Human description shown in the walker inventory. */
  readonly description: string;
  /** How often the pipeline should re-run this walker (informational
   *  only in v1 · a scheduler would consume it later). */
  readonly refreshCadenceDays: number;
  acquire(): Promise<RawFactChunk[]>;
}
