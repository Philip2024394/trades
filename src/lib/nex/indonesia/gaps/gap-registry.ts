// GapRegistry · persistent store for knowledge gaps.
//
// Same design pattern as WorkforceRegistry — in-memory ops with
// atomic file-backed persistence. Callers observe gaps via
// `observe()` (idempotent · same normalised query bumps frequency
// rather than duplicating). Supervisor asks for the top-N by
// priority when it needs new acquisition work.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GapObservation, GapRegistrySnapshot, KnowledgeGap, GapStatus } from "./types";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STATE_FILE = path.resolve(here, "../../../../../data/indonesia/knowledge-gaps.json");
const SCHEMA_VERSION = 1;

export type GapRegistryOptions = {
  stateFile?: string;
  now?: () => Date;
  inMemoryOnly?: boolean;
};

export class GapRegistry {
  private snapshot: GapRegistrySnapshot;
  private readonly stateFile: string;
  private readonly now: () => Date;
  private readonly persist: boolean;

  constructor(opts: GapRegistryOptions = {}) {
    this.stateFile = opts.stateFile ?? DEFAULT_STATE_FILE;
    this.now = opts.now ?? (() => new Date());
    this.persist = !opts.inMemoryOnly;
    this.snapshot = this.load();
  }

  getSnapshot(): GapRegistrySnapshot {
    return this.snapshot;
  }

  /** Record a knowledge gap · returns the resulting KnowledgeGap
   *  (either newly created or the pre-existing one with bumped
   *  frequency and refreshed lastSeenAt). */
  observe(obs: GapObservation): KnowledgeGap {
    const normalised = normaliseQuery(obs.rawQuery, obs.scope);
    const id = deterministicId(obs.intent, normalised);
    const nowIso = this.now().toISOString();
    const existing = this.snapshot.gaps.find((g) => g.id === id);
    if (existing) {
      existing.frequency += 1;
      existing.lastSeenAt = nowIso;
      existing.lastRawQuery = obs.rawQuery.slice(0, 400);
      existing.priority = computePriority(existing);
      this.save();
      return existing;
    }
    const gap: KnowledgeGap = {
      id,
      intent: obs.intent,
      normalisedQuery: normalised,
      lastRawQuery: obs.rawQuery.slice(0, 400),
      suggestedWalkers: obs.suggestedWalkers ?? [],
      scope: obs.scope,
      frequency: 1,
      firstSeenAt: nowIso,
      lastSeenAt: nowIso,
      reason: obs.reason,
      priority: 0,
      status: "OPEN",
      statusChangedAt: nowIso,
      evidenceRefs: [],
    };
    gap.priority = computePriority(gap);
    this.snapshot.gaps.push(gap);
    this.save();
    return gap;
  }

  /** Get the top-N open gaps by priority · used by the supervisor to
   *  choose what to acquire next. */
  topOpenGaps(limit: number = 20): KnowledgeGap[] {
    return this.snapshot.gaps
      .filter((g) => g.status === "OPEN" || g.status === "QUEUED" || g.status === "PARTIALLY_RESOLVED")
      .sort((a, b) => b.priority - a.priority || b.frequency - a.frequency)
      .slice(0, limit);
  }

  setStatus(gapId: string, status: GapStatus, evidenceRef?: string): void {
    const g = this.snapshot.gaps.find((x) => x.id === gapId);
    if (!g) return;
    g.status = status;
    g.statusChangedAt = this.now().toISOString();
    if (evidenceRef) g.evidenceRefs = [...g.evidenceRefs.filter((e) => e !== evidenceRef), evidenceRef];
    this.save();
  }

  /** For HQ. */
  summary(): { total: number; byStatus: Record<GapStatus, number>; byIntent: Record<string, number> } {
    const byStatus: Record<GapStatus, number> = {
      OPEN: 0, QUEUED: 0, IN_PROGRESS: 0, PARTIALLY_RESOLVED: 0, RESOLVED: 0, DEFERRED: 0, STALE: 0,
    };
    const byIntent: Record<string, number> = {};
    for (const g of this.snapshot.gaps) {
      byStatus[g.status] = (byStatus[g.status] ?? 0) + 1;
      byIntent[g.intent] = (byIntent[g.intent] ?? 0) + 1;
    }
    return { total: this.snapshot.gaps.length, byStatus, byIntent };
  }

  // ─── persistence · atomic write with schema-version guard ───────

  private load(): GapRegistrySnapshot {
    if (!this.persist) return this.empty();
    this.cleanupTmp();
    try {
      if (!existsSync(this.stateFile)) return this.empty();
      const parsed = JSON.parse(readFileSync(this.stateFile, "utf8")) as GapRegistrySnapshot;
      if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) return this.empty();
      if (!Array.isArray(parsed.gaps)) return this.empty();
      return parsed;
    } catch { return this.empty(); }
  }

  private save(): void {
    if (!this.persist) return;
    try {
      mkdirSync(path.dirname(this.stateFile), { recursive: true });
      this.snapshot.schemaVersion = SCHEMA_VERSION;
      this.snapshot.updatedAt = this.now().toISOString();
      const tmp = this.stateFile + ".tmp";
      writeFileSync(tmp, JSON.stringify(this.snapshot, null, 2) + "\n");
      renameSync(tmp, this.stateFile);
    } catch { /* never crash */ }
  }

  private cleanupTmp(): void {
    const tmp = this.stateFile + ".tmp";
    if (existsSync(tmp)) { try { unlinkSync(tmp); } catch { /* ignore */ } }
  }

  private empty(): GapRegistrySnapshot {
    return { schemaVersion: SCHEMA_VERSION, updatedAt: this.now().toISOString(), gaps: [] };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

/** Normalise a query for gap-identity clustering. Same phrasing
 *  should cluster into the same gap. Simple approach in v1: lowercase
 *  + strip punctuation + fold whitespace + drop common stopwords. */
export function normaliseQuery(raw: string, scope?: string): string {
  const stop = new Set(["a", "an", "the", "is", "are", "was", "were", "do", "does", "did",
    "in", "on", "at", "of", "to", "for", "with", "and", "or", "please", "tell", "me",
    "about", "any", "some", "what", "where", "when", "how", "which", "give", "show"]);
  const base = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !stop.has(t))
    .sort()
    .join(" ");
  return scope ? `${base}|${scope.toLowerCase()}` : base;
}

function deterministicId(intent: string, normalised: string): string {
  const h = createHash("sha1").update(`${intent}::${normalised}`).digest("hex").slice(0, 12);
  return `gap-${h}`;
}

/** Priority formula:
 *  · frequency contributes exponentially (2 hits > 2× 1 hit)
 *  · recency bonus for gaps hit in the last 7 days
 *  · reason weighting: requires_live > no_hits > low_confidence > requires_service
 */
function computePriority(g: KnowledgeGap): number {
  const freqScore = Math.log2(g.frequency + 1) * 3;
  const recencyBonus = ageMs(g.lastSeenAt) < 7 * 24 * 60 * 60_000 ? 2 : 0;
  const reasonWeight: Record<KnowledgeGap["reason"], number> = {
    requires_live: 5,
    no_hits: 4,
    low_confidence: 3,
    stale_only: 3,
    user_marked_unhelpful: 4,
    requires_service: 2,
  };
  return Number((freqScore + recencyBonus + reasonWeight[g.reason]).toFixed(2));
}

function ageMs(iso: string): number {
  return Date.now() - new Date(iso).getTime();
}
