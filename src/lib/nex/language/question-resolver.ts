// src/lib/nex/language/question-resolver.ts
//
// Founder BEGIN 2026-09-11 · Layer 2 · question pattern resolver.
//
// Matches a raw user prompt against surface_pattern rows in nex.questions.
// Each pattern like "what does {entity} mean" becomes a regex; matches
// return the intent_slug + extracted entity + optional concept_id.
//
// Consumed by intent-parser as a strong signal BEFORE trigger-token scoring.
// Deterministic. Zero LLM. Postgres authoritative · in-memory hot tier only.

import { Client } from "pg";

function pgUrl(): string {
  return process.env.NEX_LANGUAGE_POSTGRES_URL
    ?? process.env.NEX_TAXONOMY_POSTGRES_URL
    ?? process.env.NEX_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}
async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  await c.connect();
  try { return await fn(c); } finally { try { await c.end(); } catch { /* ignore */ } }
}

export interface QuestionMatch {
  question_id: string;
  surface_pattern: string;
  intent_slug: string;
  answer_type: string;
  concept_id: string | null;
  confidence: number;
  entities: Record<string, string>;
  match_length: number; // surface_pattern length · used for tiebreak (longer = more specific)
}

interface CachedPattern {
  question_id: string;
  surface_pattern: string;
  intent_slug: string;
  answer_type: string;
  concept_id: string | null;
  confidence: number;
  entity_slots: Array<{ name: string; kind?: string }>;
  regex: RegExp;
  literalLength: number;
}

let CACHE: CachedPattern[] = [];
let CACHE_LOADED_AT = 0;
const CACHE_TTL_MS = 60_000;

export function invalidateQuestionCache(): void {
  CACHE = [];
  CACHE_LOADED_AT = 0;
}

function escapeRegexLiteral(s: string): string {
  return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
}

/** Convert "what does {entity} mean" → /^what does (.+?) mean$/i · captures entity. */
function compilePattern(surface: string): { regex: RegExp; slotNames: string[]; literalLength: number } {
  const slotNames: string[] = [];
  // Split around {slot} placeholders. Preserve the literal parts.
  const parts = surface.split(/(\{[a-zA-Z_][a-zA-Z0-9_]*\})/g);
  let body = "";
  let literalLength = 0;
  for (const p of parts) {
    const m = /^\{([a-zA-Z_][a-zA-Z0-9_]*)\}$/.exec(p);
    if (m) {
      slotNames.push(m[1]);
      body += "(.+?)";
    } else {
      body += escapeRegexLiteral(p);
      literalLength += p.length;
    }
  }
  // Match against a whitespace-normalised, punctuation-lite user prompt.
  const regex = new RegExp(`^${body}[\\s.,!?]*$`, "i");
  return { regex, slotNames, literalLength };
}

async function ensureCacheFresh(): Promise<void> {
  if (CACHE.length > 0 && Date.now() - CACHE_LOADED_AT < CACHE_TTL_MS) return;
  const rows = await withClient(c =>
    c.query<{ question_id: string; surface_pattern: string; intent_slug: string; entity_slots: unknown; concept_id: string | null; answer_type: string; confidence: string }>(
      `SELECT question_id, surface_pattern, intent_slug, entity_slots, concept_id, answer_type, confidence::text
         FROM nex.questions
        WHERE status IN ('authoritative','truth_engine_ok','guardian_ok')`
    ).then(r => r.rows)
  );
  CACHE = rows.map(r => {
    const compiled = compilePattern(r.surface_pattern);
    return {
      question_id: r.question_id,
      surface_pattern: r.surface_pattern,
      intent_slug: r.intent_slug,
      answer_type: r.answer_type,
      concept_id: r.concept_id,
      confidence: Number(r.confidence),
      entity_slots: Array.isArray(r.entity_slots) ? r.entity_slots as Array<{ name: string; kind?: string }> : [],
      regex: compiled.regex,
      literalLength: compiled.literalLength,
    };
  });
  // Sort by literalLength desc · longer patterns are more specific → match first
  CACHE.sort((a, b) => b.literalLength - a.literalLength);
  CACHE_LOADED_AT = Date.now();
}

function cleanForMatch(s: string): string {
  return String(s ?? "").toLowerCase()
    .replace(/[.,;!?"'`()\[\]{}—–]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Match a user prompt against the strongest applicable question pattern.
 * Returns null when nothing beats the min confidence bar.
 */
export async function matchQuestion(prompt: string, minConfidence = 0.75): Promise<QuestionMatch | null> {
  await ensureCacheFresh();
  const cleaned = cleanForMatch(prompt);
  let best: (CachedPattern & { entities: Record<string, string> }) | null = null;
  for (const p of CACHE) {
    const m = p.regex.exec(cleaned);
    if (!m) continue;
    if (p.confidence < minConfidence) continue;
    const entities: Record<string, string> = {};
    // slotNames from compile were stored in entity_slots; use them in order
    const compiled = compilePattern(p.surface_pattern);
    compiled.slotNames.forEach((name, idx) => {
      entities[name] = (m[idx + 1] ?? "").trim();
    });
    // Prefer longer literal patterns · CACHE is already sorted so first match wins
    if (!best) {
      best = { ...p, entities };
      break;
    }
  }
  if (!best) return null;
  return {
    question_id: best.question_id,
    surface_pattern: best.surface_pattern,
    intent_slug: best.intent_slug,
    answer_type: best.answer_type,
    concept_id: best.concept_id,
    confidence: best.confidence,
    entities: best.entities,
    match_length: best.literalLength,
  };
}

export function questionCacheStats(): { patterns_loaded: number; loaded_at: number } {
  return { patterns_loaded: CACHE.length, loaded_at: CACHE_LOADED_AT };
}
