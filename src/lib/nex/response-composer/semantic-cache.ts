// src/lib/nex/response-composer/semantic-cache.ts
//
// NEX Master AI Engineer · minimum viable semantic cache
// Founder BEGIN 2026-09-08 · "build only the minimum semantic-cache capability
// required for the pilot" + "do NOT allow stale information to masquerade as
// current truth."
//
// Cache key strategy · deterministic + zero external calls:
//   exact_key    = normalized query + user_scope
//   semantic_key = sorted content-token bag (Jaccard overlap ≥ 0.85 counted as hit)
//
// Freshness discipline:
//   - Every entry carries freshness_ttl_seconds + evidence_refs[]
//   - Cache invalidates event-driven when any evidence_ref is superseded
//   - Also honours TTL as backstop
//
// Owner-Identity boundary (V.1):
//   - user_scope is part of cache key · never leaks across users
//   - user-scoped entries never enter shared reservoir
//
// Zero external dependency · pure in-memory + JSONL persistence.
// Not a Redis · not a vector DB · designed for pilot measurement not scale.

import fs from "node:fs";
import path from "node:path";
import { normalizeQuery, shortHashSync, type NormalizedQuery } from "./request-normalizer.js";

export interface CacheEntry {
  entry_id: string;               // uuid-like id
  cache_key_fingerprint: string;  // sha256[:24] of exact_key + user_scope
  user_scope: string;
  question_normalized: string;
  content_bag: string[];          // sorted content tokens · used for semantic match
  answer_text: string;
  answer_kind: string;
  route_class_when_computed: string; // A/B/C/D/E
  confidence: number;
  freshness_state: "FRESH" | "STALE" | "PERMANENT" | "UNKNOWN";
  freshness_ttl_seconds: number | null; // null = permanent
  evidence_refs: string[];        // reservoir record IDs backing the answer
  computed_at_iso: string;
  computed_at_epoch_ms: number;
  invalidated_by: string | null;  // supersedes event id if invalidated
  invalidated_at_iso: string | null;
}

export interface CacheLookupResult {
  status: "exact_hit" | "semantic_hit" | "miss" | "stale_rejected";
  entry: CacheEntry | null;
  reason: string;
  latency_saved_ms: number | null;
  cache_key_fingerprint: string;
  semantic_overlap: number | null; // Jaccard [0..1] when semantic_hit or nearest miss
}

export interface CacheStats {
  entries_total: number;
  entries_fresh: number;
  entries_stale: number;
  entries_invalidated: number;
  exact_hits_lifetime: number;
  semantic_hits_lifetime: number;
  misses_lifetime: number;
  stale_rejections_lifetime: number;
}

const DEFAULT_SEMANTIC_THRESHOLD = 0.85;
const DEFAULT_TTL_SECONDS = 24 * 3600;

/**
 * In-memory + JSONL-persisted semantic cache.
 * Deliberately not a real DB. Designed for pilot measurement.
 */
export class ResponseComposerCache {
  private entries: Map<string, CacheEntry> = new Map(); // key = cache_key_fingerprint
  private stats: CacheStats = {
    entries_total: 0,
    entries_fresh: 0,
    entries_stale: 0,
    entries_invalidated: 0,
    exact_hits_lifetime: 0,
    semantic_hits_lifetime: 0,
    misses_lifetime: 0,
    stale_rejections_lifetime: 0,
  };
  private supersededEvidence: Set<string> = new Set();
  private jsonlPath: string | null;

  constructor(opts: {
    persistJsonlPath?: string | null;
    semanticThreshold?: number;
    defaultTtlSeconds?: number;
  } = {}) {
    this.jsonlPath = opts.persistJsonlPath ?? null;
    if (this.jsonlPath && fs.existsSync(this.jsonlPath)) {
      // Cold-start replay from JSONL — best-effort.
      const content = fs.readFileSync(this.jsonlPath, "utf8");
      for (const line of content.split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line) as CacheEntry;
          this.entries.set(entry.cache_key_fingerprint, entry);
        } catch { /* skip malformed */ }
      }
      this.stats.entries_total = this.entries.size;
      this.recomputeFreshness();
    }
    this.semanticThreshold = opts.semanticThreshold ?? DEFAULT_SEMANTIC_THRESHOLD;
    this.defaultTtlSeconds = opts.defaultTtlSeconds ?? DEFAULT_TTL_SECONDS;
  }

  private semanticThreshold: number;
  private defaultTtlSeconds: number;

  /** Build the deterministic cache key. */
  static keyFor(normalized: NormalizedQuery, user_scope: string): string {
    return shortHashSync(`${user_scope}::${normalized.exact_key}`);
  }

  /** Try exact match, then semantic match, honouring freshness. */
  lookup(input: {
    question: string;
    user_scope: string;
    require_fresh?: boolean;
  }): CacheLookupResult {
    const requireFresh = input.require_fresh !== false;
    const normalized = normalizeQuery(input.question);
    const fingerprint = ResponseComposerCache.keyFor(normalized, input.user_scope);

    // Exact-match path
    const exact = this.entries.get(fingerprint);
    if (exact) {
      const stale = this.isEntryStale(exact);
      if (stale && requireFresh) {
        this.stats.stale_rejections_lifetime++;
        return {
          status: "stale_rejected",
          entry: exact,
          reason: exact.invalidated_by
            ? `evidence ${exact.invalidated_by} superseded`
            : `TTL expired ${((Date.now() - exact.computed_at_epoch_ms)/1000).toFixed(0)}s ago`,
          latency_saved_ms: null,
          cache_key_fingerprint: fingerprint,
          semantic_overlap: 1.0,
        };
      }
      this.stats.exact_hits_lifetime++;
      return {
        status: "exact_hit",
        entry: exact,
        reason: "identical query fingerprint",
        latency_saved_ms: 500, // conservative default · caller can override
        cache_key_fingerprint: fingerprint,
        semantic_overlap: 1.0,
      };
    }

    // Semantic-match path — Jaccard over normalized content bags, scoped by user
    const scoped = [...this.entries.values()].filter((e) => e.user_scope === input.user_scope);
    let bestOverlap = 0;
    let bestEntry: CacheEntry | null = null;
    const querySet = new Set(normalized.semantic_bag);
    for (const entry of scoped) {
      const cand = new Set(entry.content_bag);
      if (querySet.size === 0 && cand.size === 0) continue;
      const inter = intersectSize(querySet, cand);
      const union = querySet.size + cand.size - inter;
      const jaccard = union === 0 ? 0 : inter / union;
      if (jaccard > bestOverlap) {
        bestOverlap = jaccard;
        bestEntry = entry;
      }
    }
    if (bestEntry && bestOverlap >= this.semanticThreshold) {
      const stale = this.isEntryStale(bestEntry);
      if (stale && requireFresh) {
        this.stats.stale_rejections_lifetime++;
        return {
          status: "stale_rejected",
          entry: bestEntry,
          reason: bestEntry.invalidated_by
            ? `evidence ${bestEntry.invalidated_by} superseded (semantic match)`
            : `TTL expired on semantic match`,
          latency_saved_ms: null,
          cache_key_fingerprint: fingerprint,
          semantic_overlap: bestOverlap,
        };
      }
      this.stats.semantic_hits_lifetime++;
      return {
        status: "semantic_hit",
        entry: bestEntry,
        reason: `Jaccard ${bestOverlap.toFixed(3)} ≥ ${this.semanticThreshold}`,
        latency_saved_ms: 500,
        cache_key_fingerprint: fingerprint,
        semantic_overlap: bestOverlap,
      };
    }

    this.stats.misses_lifetime++;
    return {
      status: "miss",
      entry: null,
      reason: bestEntry ? `nearest overlap ${bestOverlap.toFixed(3)} < threshold` : "no scoped entries",
      latency_saved_ms: null,
      cache_key_fingerprint: fingerprint,
      semantic_overlap: bestEntry ? bestOverlap : null,
    };
  }

  /** Write an entry (or supersede an existing one with the same fingerprint). */
  put(input: {
    question: string;
    user_scope: string;
    answer_text: string;
    answer_kind: string;
    route_class_when_computed: string;
    confidence: number;
    freshness_state: "FRESH" | "STALE" | "PERMANENT" | "UNKNOWN";
    freshness_ttl_seconds?: number | null;
    evidence_refs: string[];
  }): CacheEntry {
    const normalized = normalizeQuery(input.question);
    const fingerprint = ResponseComposerCache.keyFor(normalized, input.user_scope);
    const now = Date.now();
    const entry: CacheEntry = {
      entry_id: `cache_${fingerprint}_${now}`,
      cache_key_fingerprint: fingerprint,
      user_scope: input.user_scope,
      question_normalized: normalized.exact_key,
      content_bag: normalized.semantic_bag,
      answer_text: input.answer_text,
      answer_kind: input.answer_kind,
      route_class_when_computed: input.route_class_when_computed,
      confidence: input.confidence,
      freshness_state: input.freshness_state,
      freshness_ttl_seconds: input.freshness_ttl_seconds ?? (input.freshness_state === "PERMANENT" ? null : this.defaultTtlSeconds),
      evidence_refs: input.evidence_refs,
      computed_at_iso: new Date(now).toISOString(),
      computed_at_epoch_ms: now,
      invalidated_by: null,
      invalidated_at_iso: null,
    };
    this.entries.set(fingerprint, entry);
    this.stats.entries_total = this.entries.size;
    this.recomputeFreshness();
    this.persistOne(entry);
    return entry;
  }

  /** Mark all entries whose evidence_refs include this ref as invalidated. */
  invalidateByEvidence(evidence_ref: string): number {
    this.supersededEvidence.add(evidence_ref);
    let invalidated = 0;
    const nowIso = new Date().toISOString();
    for (const entry of this.entries.values()) {
      if (entry.evidence_refs.includes(evidence_ref) && !entry.invalidated_by) {
        entry.invalidated_by = evidence_ref;
        entry.invalidated_at_iso = nowIso;
        invalidated++;
      }
    }
    if (invalidated > 0) this.recomputeFreshness();
    return invalidated;
  }

  private isEntryStale(entry: CacheEntry): boolean {
    if (entry.invalidated_by) return true;
    if (entry.freshness_ttl_seconds === null) return false; // permanent
    const ageSeconds = (Date.now() - entry.computed_at_epoch_ms) / 1000;
    return ageSeconds > entry.freshness_ttl_seconds;
  }

  private recomputeFreshness(): void {
    let fresh = 0, stale = 0, invalidated = 0;
    for (const e of this.entries.values()) {
      if (e.invalidated_by) invalidated++;
      else if (this.isEntryStale(e)) stale++;
      else fresh++;
    }
    this.stats.entries_fresh = fresh;
    this.stats.entries_stale = stale;
    this.stats.entries_invalidated = invalidated;
  }

  private persistOne(entry: CacheEntry): void {
    if (!this.jsonlPath) return;
    const dir = path.dirname(this.jsonlPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(this.jsonlPath, JSON.stringify(entry) + "\n", "utf8");
  }

  getStats(): CacheStats { return { ...this.stats }; }
  size(): number { return this.entries.size; }
  clear(): void {
    this.entries.clear();
    this.stats = {
      entries_total: 0, entries_fresh: 0, entries_stale: 0, entries_invalidated: 0,
      exact_hits_lifetime: 0, semantic_hits_lifetime: 0, misses_lifetime: 0, stale_rejections_lifetime: 0,
    };
  }
}

function intersectSize<T>(a: Set<T>, b: Set<T>): number {
  let n = 0;
  const [smaller, larger] = a.size < b.size ? [a, b] : [b, a];
  for (const x of smaller) if (larger.has(x)) n++;
  return n;
}
