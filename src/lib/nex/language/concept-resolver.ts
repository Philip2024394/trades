// src/lib/nex/language/concept-resolver.ts
//
// Founder BEGIN 2026-09-11 · Step 3 of ADR-0308.
//
// resolveConcept(surface, context) is the SINGLE shared entry point that both
// NEX Chat and NEX1 call. Every knowledge lookup flows through it.
//
// ADR-0308 rules honoured:
//   9. Postgres is authoritative · in-memory is hot tier / cache only
//   6. Everyone reads the same concept row
//   4. Evidence attaches to the sense · surfaced in the result
//
// Deterministic scoring. Zero LLM. Zero third-party.

import { Client } from "pg";
import { normalise } from "./normaliser";

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

// ═══════════════════════════════════════════════════════════════════
// Types (align with ADR-0308 · resolver returns the sense the caller
// should treat as authoritative for the surface + context)
// ═══════════════════════════════════════════════════════════════════

export interface ResolvedSense {
  sense_id: string;
  sense_key: string;
  description: string;
  confidence: number;
  domain_hint: readonly string[];
  status: string;
}

export interface CandidateSense {
  sense_id: string;
  sense_key: string;
  score: number;
  matched_signals: readonly string[];
}

export interface ResolvedConcept {
  concept_id: string;
  canonical_key: string;
  display_name: string;
  chosen_sense: ResolvedSense | null;
  candidate_senses: readonly CandidateSense[];
  raw_surface: string;
  context_signals_used: readonly string[];
  ambiguous: boolean;
  hot_tier_hit: boolean;
}

export interface ResolveContext {
  cooccur_tokens?: readonly string[];
  domain_hint?: readonly string[];
  grammatical_role?: string;
}

// ═══════════════════════════════════════════════════════════════════
// Hot tier cache · in-memory only · disposable · rebuildable from Postgres
// ADR-0308 rule 9 preserved: this is acceleration, never truth.
// ═══════════════════════════════════════════════════════════════════

interface HotTierEntry {
  concept_id: string;
  canonical_key: string;
  display_name: string;
  senses: Array<{
    sense_id: string;
    sense_key: string;
    description: string;
    domain_hint: readonly string[];
    confidence: number;
    status: string;
    contexts: Array<{ surface_signal: string; signal_kind: string; weight: number }>;
  }>;
}

const HOT_TIER: Map<string, HotTierEntry> = new Map();
let HOT_TIER_LAST_LOAD = 0;
const HOT_TIER_TTL_MS = 60_000; // 1 minute · cheap re-load if data drifted

/** Force refresh · called by Guardian after writes, and by tests. */
export function invalidateHotTier(): void { HOT_TIER.clear(); HOT_TIER_LAST_LOAD = 0; }

async function ensureHotTierFresh(): Promise<void> {
  if (HOT_TIER.size > 0 && (Date.now() - HOT_TIER_LAST_LOAD) < HOT_TIER_TTL_MS) return;
  await withClient(async c => {
    const conRes = await c.query<{ concept_id: string; canonical_key: string; display_name: string }>(
      `SELECT concept_id, canonical_key, display_name FROM nex.concepts WHERE status <> 'deprecated'`
    );
    const senRes = await c.query<{ concept_id: string; sense_id: string; sense_key: string; description: string; domain_hint: string[]; confidence: string; status: string }>(
      `SELECT concept_id, sense_id, sense_key, description, domain_hint, confidence::text, status FROM nex.concept_senses WHERE status <> 'deprecated'`
    );
    const ctxRes = await c.query<{ sense_id: string; surface_signal: string; signal_kind: string; weight: string }>(
      `SELECT sense_id, surface_signal, signal_kind, weight::text FROM nex.contexts`
    );
    const byConcept = new Map<string, HotTierEntry>();
    for (const r of conRes.rows) {
      byConcept.set(r.concept_id, { concept_id: r.concept_id, canonical_key: r.canonical_key, display_name: r.display_name, senses: [] });
    }
    const senseIndex = new Map<string, HotTierEntry["senses"][number]>();
    for (const s of senRes.rows) {
      const c2 = byConcept.get(s.concept_id);
      if (!c2) continue;
      const sense = { sense_id: s.sense_id, sense_key: s.sense_key, description: s.description, domain_hint: s.domain_hint ?? [], confidence: Number(s.confidence), status: s.status, contexts: [] as HotTierEntry["senses"][number]["contexts"] };
      c2.senses.push(sense);
      senseIndex.set(s.sense_id, sense);
    }
    for (const cx of ctxRes.rows) {
      const sense = senseIndex.get(cx.sense_id);
      if (sense) sense.contexts.push({ surface_signal: cx.surface_signal, signal_kind: cx.signal_kind, weight: Number(cx.weight) });
    }
    HOT_TIER.clear();
    for (const entry of byConcept.values()) HOT_TIER.set(entry.canonical_key, entry);
    HOT_TIER_LAST_LOAD = Date.now();
  });
}

// ═══════════════════════════════════════════════════════════════════
// Resolver core
// ═══════════════════════════════════════════════════════════════════

/**
 * Resolve a surface phrase to a canonical concept + best matching sense given
 * the current cooccurrence context. Returns null when the concept doesn't
 * exist in nex.concepts at all — caller can enqueue a knowledge gap.
 *
 * Behaviour rules (deterministic):
 *   1. canonical_key match on the normalised surface first
 *   2. If concept has one sense · that's the answer
 *   3. If multiple senses · score each by context signal overlap
 *   4. If top score doesn't clear runner-up by 0.2 → mark ambiguous, still
 *      return top as chosen_sense but candidate_senses are visible
 *   5. domain_hint from ResolveContext bumps senses whose domain_hint overlaps
 */
export async function resolveConcept(surface: string, context: ResolveContext = {}): Promise<ResolvedConcept | null> {
  const norm = normalise(surface);
  // Look up by the first canonical token · fallback to raw normalised text.
  const primaryToken = norm.canonical_tokens[0] ?? norm.cleaned;
  const canonicalKey = primaryToken.toLowerCase();

  await ensureHotTierFresh();
  let hotHit = HOT_TIER.get(canonicalKey);
  let entry = hotHit ?? (await loadOneConceptFromPg(canonicalKey));
  // Singular fallback · try stripping trailing "s" for plural inputs
  // (tests → test · migrations → migration · endpoints → endpoint).
  if (!entry && canonicalKey.endsWith("s") && canonicalKey.length > 3) {
    const singular = canonicalKey.replace(/s$/, "");
    hotHit = HOT_TIER.get(singular);
    entry = hotHit ?? (await loadOneConceptFromPg(singular));
  }
  if (!entry) return null;

  const contextTokens = new Set(
    (context.cooccur_tokens ?? [])
      .concat(norm.canonical_tokens)
      .map(t => t.toLowerCase())
  );
  const domainHints = new Set((context.domain_hint ?? []).map(d => d.toLowerCase()));
  const contextSignalsUsed: string[] = [];

  const scored = entry.senses.map(sense => {
    let score = 0;
    const matched: string[] = [];
    // 1. Explicit context signals (cooccur tokens · phrases · domain hints)
    for (const ctx of sense.contexts) {
      const sig = ctx.surface_signal.toLowerCase();
      if (ctx.signal_kind === "cooccur_token" && contextTokens.has(sig)) {
        score += ctx.weight; matched.push(sig); contextSignalsUsed.push(sig);
      } else if (ctx.signal_kind === "cooccur_phrase" && [...contextTokens].join(" ").includes(sig)) {
        score += ctx.weight * 1.2; matched.push(sig); contextSignalsUsed.push(sig);
      } else if (ctx.signal_kind === "domain_hint" && domainHints.has(sig)) {
        score += ctx.weight * 1.5; matched.push(sig); contextSignalsUsed.push(sig);
      }
    }
    // 2. Direct domain_hint[] overlap with ResolveContext.domain_hint
    for (const dh of sense.domain_hint) {
      if (domainHints.has(dh.toLowerCase())) { score += 0.3; matched.push(`domain:${dh}`); }
    }
    // 3. Base confidence · gentle nudge so higher-confidence sense wins on ties
    score += sense.confidence * 0.05;
    return { sense, score: Number(score.toFixed(4)), matched };
  });

  scored.sort((a, b) => b.score - a.score);

  const candidates: CandidateSense[] = scored.map(s => ({
    sense_id: s.sense.sense_id,
    sense_key: s.sense.sense_key,
    score: s.score,
    matched_signals: s.matched,
  }));

  // If only one sense exists · that's the answer regardless of score
  let chosen: ResolvedSense | null = null;
  let ambiguous = false;
  if (scored.length === 1) {
    const s = scored[0].sense;
    chosen = { sense_id: s.sense_id, sense_key: s.sense_key, description: s.description, confidence: s.confidence, domain_hint: s.domain_hint, status: s.status };
  } else if (scored.length > 1) {
    const top = scored[0];
    const runnerUp = scored[1];
    // Chose top if it clears runner-up by 0.2 OR if any context signal matched
    if (top.score - runnerUp.score >= 0.2 || top.matched.length > 0) {
      const s = top.sense;
      chosen = { sense_id: s.sense_id, sense_key: s.sense_key, description: s.description, confidence: s.confidence, domain_hint: s.domain_hint, status: s.status };
      if (top.score - runnerUp.score < 0.2) ambiguous = true;
    } else {
      ambiguous = true;
    }
  }

  return {
    concept_id: entry.concept_id,
    canonical_key: entry.canonical_key,
    display_name: entry.display_name,
    chosen_sense: chosen,
    candidate_senses: candidates,
    raw_surface: surface,
    context_signals_used: Array.from(new Set(contextSignalsUsed)),
    ambiguous,
    hot_tier_hit: !!hotHit,
  };
}

async function loadOneConceptFromPg(canonicalKey: string): Promise<HotTierEntry | null> {
  return withClient(async c => {
    const conRes = await c.query<{ concept_id: string; canonical_key: string; display_name: string }>(
      `SELECT concept_id, canonical_key, display_name FROM nex.concepts WHERE canonical_key=$1 AND status <> 'deprecated' LIMIT 1`,
      [canonicalKey]
    );
    if (conRes.rows.length === 0) return null;
    const concept = conRes.rows[0];
    const senRes = await c.query<{ sense_id: string; sense_key: string; description: string; domain_hint: string[]; confidence: string; status: string }>(
      `SELECT sense_id, sense_key, description, domain_hint, confidence::text, status FROM nex.concept_senses WHERE concept_id=$1 AND status <> 'deprecated' ORDER BY sense_key`,
      [concept.concept_id]
    );
    const senses = senRes.rows.map(s => ({ sense_id: s.sense_id, sense_key: s.sense_key, description: s.description, domain_hint: s.domain_hint ?? [], confidence: Number(s.confidence), status: s.status, contexts: [] as { surface_signal: string; signal_kind: string; weight: number }[] }));
    if (senses.length > 0) {
      const ctxRes = await c.query<{ sense_id: string; surface_signal: string; signal_kind: string; weight: string }>(
        `SELECT sense_id, surface_signal, signal_kind, weight::text FROM nex.contexts WHERE sense_id = ANY($1::uuid[])`,
        [senses.map(s => s.sense_id)]
      );
      const senseIndex = new Map(senses.map(s => [s.sense_id, s]));
      for (const cx of ctxRes.rows) {
        const s = senseIndex.get(cx.sense_id);
        if (s) s.contexts.push({ surface_signal: cx.surface_signal, signal_kind: cx.signal_kind, weight: Number(cx.weight) });
      }
    }
    const entry: HotTierEntry = { concept_id: concept.concept_id, canonical_key: concept.canonical_key, display_name: concept.display_name, senses };
    HOT_TIER.set(concept.canonical_key, entry);
    if (HOT_TIER_LAST_LOAD === 0) HOT_TIER_LAST_LOAD = Date.now();
    return entry;
  });
}

// ═══════════════════════════════════════════════════════════════════
// Helper · fetch canonical answer body for a resolved sense (Step 4 wiring)
// ═══════════════════════════════════════════════════════════════════

export interface ConceptAnswer {
  body: string;
  answer_kind: string;
  confidence: number;
  status: string;
}

export async function fetchAnswerForSense(sense_id: string, preferKind?: string): Promise<ConceptAnswer | null> {
  return withClient(async c => {
    // If caller expressed a preferred kind (steps · list · fact · definition),
    // try that FIRST · fall back to any authoritative answer if none.
    if (preferKind) {
      const preferred = await c.query<ConceptAnswer>(
        `SELECT body, answer_kind, confidence::float, status FROM nex.answers
          WHERE sense_id=$1 AND answer_kind=$2
            AND status IN ('authoritative','truth_engine_ok','guardian_ok')
          ORDER BY confidence DESC LIMIT 1`,
        [sense_id, preferKind]
      );
      if (preferred.rows.length > 0) return preferred.rows[0];
    }
    const r = await c.query<ConceptAnswer>(
      `SELECT body, answer_kind, confidence::float, status FROM nex.answers
        WHERE sense_id=$1 AND status IN ('authoritative','truth_engine_ok','guardian_ok')
        ORDER BY confidence DESC LIMIT 1`,
      [sense_id]
    );
    return r.rows[0] ?? null;
  });
}
