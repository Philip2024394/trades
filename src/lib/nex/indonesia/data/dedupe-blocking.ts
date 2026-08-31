// Dedupe blocking · candidate-generation for entity resolution.
//
// Naive all-pairs dedupe is O(N²) — infeasible at 1M records
// (10¹² comparisons). The standard production technique is BLOCKING:
// bucket entities by cheap keys (phone-hash, geo-cell, name-prefix,
// website-domain, category+region), then only run the expensive
// scoreMerge() on pairs that landed in the same bucket.
//
// This reduces the problem to O(N × K) where K is the average
// candidate-set size per entity — typically 5–50, not N.
//
// The pipeline calls dedupeCorpus(entities). It returns candidate
// merge pairs sorted by descending score. The pipeline then applies
// scoreMerge → mergeEntities in the same way the current code path
// already handles paired observations.

import type { EntityRecord } from "./types";
import { normalisePhone, normaliseName, scoreMerge, mergeEntities } from "./entity-resolution";

export type Blocker = {
  name: string;
  /** Key function · returns null if this entity can't be bucketed by
   *  this blocker (e.g. no phone). Multiple non-null keys are all
   *  used · entity lands in every non-null bucket. */
  key(e: EntityRecord): string[] | null;
};

/** GEO_CELL_DEGREES ≈ 0.02° ≈ 2.2 km at the equator · empirically a
 *  good tradeoff between candidate-set size and recall. A restaurant
 *  is unlikely to have a duplicate observation more than 2 km away. */
const GEO_CELL_DEGREES = 0.02;

/** Canonical blocker set. Additional blockers can be composed by the
 *  caller for special cases (e.g. Instagram-handle blocker). */
export const DEFAULT_BLOCKERS: Blocker[] = [
  {
    name: "phone",
    key(e) {
      const phones = (e.contacts ?? [])
        .filter((c) => c.kind === "phone" || c.kind === "whatsapp")
        .map((c) => normalisePhone(c.value))
        .filter((p): p is string => Boolean(p) && p.length >= 8);
      return phones.length > 0 ? phones.map((p) => `phone:${p}`) : null;
    },
  },
  {
    name: "website",
    key(e) {
      const sites = (e.contacts ?? [])
        .filter((c) => c.kind === "website")
        .map((c) => hostnameFromUrl(c.value))
        .filter((h): h is string => Boolean(h));
      return sites.length > 0 ? sites.map((h) => `web:${h}`) : null;
    },
  },
  {
    name: "geo_cell",
    key(e) {
      if (typeof e.geo?.lat !== "number" || typeof e.geo?.lng !== "number") return null;
      const cellLat = Math.floor(e.geo.lat / GEO_CELL_DEGREES) * GEO_CELL_DEGREES;
      const cellLng = Math.floor(e.geo.lng / GEO_CELL_DEGREES) * GEO_CELL_DEGREES;
      // A record lands in its own cell + 8 neighbours to catch
      // near-boundary duplicates. Costs ~9× the buckets but recall is
      // essential — a small extra work is worth a missed dupe.
      const keys: string[] = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const kLat = (cellLat + dy * GEO_CELL_DEGREES).toFixed(3);
          const kLng = (cellLng + dx * GEO_CELL_DEGREES).toFixed(3);
          keys.push(`geo:${kLat}:${kLng}`);
        }
      }
      return keys;
    },
  },
  {
    name: "name_prefix_region",
    key(e) {
      const name = normaliseName(e.name);
      if (!name || name.length < 3) return null;
      const prefix = name.split(/\s+/).slice(0, 2).join(" ").slice(0, 12);
      const region = (e.geo?.province ?? e.geo?.regency ?? "any").toLowerCase();
      return [`name:${prefix}|${region}`];
    },
  },
];

export type CandidatePair = {
  a: EntityRecord;
  b: EntityRecord;
  score: number;
  reasons: string[];
  blockerName: string;
};

/** Group entities into blocking buckets and produce all (a,b) pairs
 *  within any bucket. Duplicate pairs (same a,b seen in two buckets)
 *  are surfaced only once. */
export function generateCandidatePairs(entities: EntityRecord[], blockers: Blocker[] = DEFAULT_BLOCKERS): Array<{ a: EntityRecord; b: EntityRecord; blockerName: string }> {
  const seenPairs = new Set<string>();
  const out: Array<{ a: EntityRecord; b: EntityRecord; blockerName: string }> = [];
  const byIndex = entities;

  for (const blocker of blockers) {
    const buckets = new Map<string, number[]>();
    for (let i = 0; i < byIndex.length; i++) {
      const keys = blocker.key(byIndex[i]);
      if (!keys) continue;
      for (const k of keys) {
        let arr = buckets.get(k);
        if (!arr) { arr = []; buckets.set(k, arr); }
        arr.push(i);
      }
    }
    for (const indices of buckets.values()) {
      if (indices.length < 2) continue;
      // All-pairs within a bucket · bucket sizes should be small.
      for (let i = 0; i < indices.length; i++) {
        for (let j = i + 1; j < indices.length; j++) {
          const ai = Math.min(indices[i], indices[j]);
          const bi = Math.max(indices[i], indices[j]);
          const key = `${ai}:${bi}`;
          if (seenPairs.has(key)) continue;
          seenPairs.add(key);
          out.push({ a: byIndex[ai], b: byIndex[bi], blockerName: blocker.name });
        }
      }
    }
  }
  return out;
}

/** Score every candidate pair and return only those that meet the
 *  review threshold. Sorted by score desc. */
export function scoreCandidatePairs(candidates: Array<{ a: EntityRecord; b: EntityRecord; blockerName: string }>, minScore: number = 0.5): CandidatePair[] {
  const scored: CandidatePair[] = [];
  for (const cand of candidates) {
    if (cand.a.kind !== cand.b.kind) continue;
    const v = scoreMerge(cand.a, cand.b);
    if (v.score < minScore && !v.strongEvidence) continue;
    scored.push({ ...cand, score: v.strongEvidence ? Math.max(v.score, 0.9) : v.score, reasons: v.reasons });
  }
  scored.sort((x, y) => y.score - x.score);
  return scored;
}

/** Full corpus dedupe · returns a report with merged entities +
 *  candidate list. Never mutates the input array; the caller
 *  decides how to apply the merges. */
export type DedupeReport = {
  inputCount: number;
  candidatePairs: number;
  strongMerges: CandidatePair[];      // score ≥ 0.85 or strongEvidence
  reviewCandidates: CandidatePair[];  // 0.65 ≤ score < 0.85
  wallMs: number;
};

export function analyseCorpus(entities: EntityRecord[], opts: { blockers?: Blocker[]; mergeThreshold?: number; reviewThreshold?: number } = {}): DedupeReport {
  const t0 = performance.now();
  const blockers = opts.blockers ?? DEFAULT_BLOCKERS;
  const merge = opts.mergeThreshold ?? 0.85;
  const review = opts.reviewThreshold ?? 0.65;
  const candidates = generateCandidatePairs(entities, blockers);
  const scored = scoreCandidatePairs(candidates, review);
  const strongMerges = scored.filter((c) => c.score >= merge);
  const reviewCandidates = scored.filter((c) => c.score >= review && c.score < merge);
  return {
    inputCount: entities.length,
    candidatePairs: candidates.length,
    strongMerges,
    reviewCandidates,
    wallMs: Math.round(performance.now() - t0),
  };
}

/** Apply strong merges greedily · union-find style. Returns the new
 *  entity list with duplicates merged. Never merges kinds that
 *  differ (guarded upstream in scoreMerge). */
export function applyMerges(entities: EntityRecord[], strongMerges: CandidatePair[]): EntityRecord[] {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let cur = id;
    while (parent.get(cur) && parent.get(cur) !== cur) cur = parent.get(cur)!;
    return cur;
  };
  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };

  for (const e of entities) parent.set(e.id, e.id);
  for (const m of strongMerges) union(m.a.id, m.b.id);

  const byRoot = new Map<string, EntityRecord>();
  for (const e of entities) {
    const root = find(e.id);
    const existing = byRoot.get(root);
    byRoot.set(root, existing ? mergeEntities(existing, e) : e);
  }
  return [...byRoot.values()];
}

// ─── helpers ─────────────────────────────────────────────────────

function hostnameFromUrl(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
