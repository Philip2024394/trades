// Entity resolution / deduplication.
//
// "Warung Bu Siti" and "Warung Ibu Siti" at the same coordinates
// with the same phone are ONE entity. This module decides when to
// merge observations into a single canonical entity vs. treat them
// as distinct.
//
// Deterministic — no LLM — the scoring uses:
//   · exact-match on phone (normalised)
//   · exact-match on website (host+path)
//   · coordinate proximity (haversine, m)
//   · normalised-name similarity (jaccard on tokens + Dice on trigrams)
//   · same category
//
// Threshold-based: any pair scoring ≥ 0.85 is a merge candidate. The
// pipeline then applies the merge · the loser's provenance moves to
// the winner and the loser is marked SUPERSEDED.

import type { EntityRecord } from "./types";

/** Normalise a phone-like string for comparison. */
export function normalisePhone(raw: string): string {
  if (!raw) return "";
  return raw.replace(/[^\d+]/g, "").replace(/^0/, "+62");
}

/** Normalise a name for comparison · lowercases, strips honorifics,
 *  removes duplicate whitespace. Handles non-ASCII by stripping to
 *  the ASCII backbone FIRST so word-boundary matching works on all
 *  honorifics (e.g. "café" → "cafe" → stripped). */
export function normaliseName(raw: string): string {
  if (!raw) return "";
  const ascii = raw
    .toLowerCase()
    // Fold common non-ASCII to ASCII backbone.
    .replace(/[àáâãäå]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/[ñ]/g, "n")
    .replace(/[ç]/g, "c");
  return ascii
    .replace(/\b(warung|warong|resto(ran)?|cafe|kedai|toko|hotel|villa|penginapan|guesthouse|homestay|kos-kosan|apartment|ibu|bu|pak|bapak|mas|mbak|kak|the)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): Set<string> {
  return new Set(s.split(/\s+/).filter((t) => t.length >= 2));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const inter = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : inter / union;
}

function trigrams(s: string): Set<string> {
  const out = new Set<string>();
  const padded = ` ${s} `;
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

function dice(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const inter = [...a].filter((x) => b.has(x)).length;
  return (2 * inter) / (a.size + b.size);
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export type MergeVerdict = {
  score: number;
  reasons: string[];
  /** Set to true when two independent strong signals agree (phone
   *  equals AND coordinates within 100m, for example). This is the
   *  case where we merge without waiting for name similarity. */
  strongEvidence: boolean;
};

/** Compute merge score for two entity observations. Higher = more
 *  likely the same real-world thing. */
export function scoreMerge(a: EntityRecord, b: EntityRecord): MergeVerdict {
  const reasons: string[] = [];
  let score = 0;
  let strongCount = 0;

  // Category / kind mismatch = never merge.
  if (a.kind !== b.kind) return { score: 0, reasons: ["kind_mismatch"], strongEvidence: false };
  if (a.category && b.category && a.category !== b.category) {
    reasons.push("category_differs");
    score -= 0.1;
  }

  // Phone match (normalised).
  const aPhones = new Set((a.contacts ?? []).filter((c) => c.kind === "phone" || c.kind === "whatsapp").map((c) => normalisePhone(c.value)).filter(Boolean));
  const bPhones = new Set((b.contacts ?? []).filter((c) => c.kind === "phone" || c.kind === "whatsapp").map((c) => normalisePhone(c.value)).filter(Boolean));
  const phoneOverlap = [...aPhones].some((p) => bPhones.has(p));
  if (phoneOverlap) { score += 0.5; reasons.push("phone_match"); strongCount++; }

  // Website match · compare by hostname (matches the blocker's
  // grouping semantics · found by the cross-blocker test: same host
  // with different paths should merge, not be treated as different
  // sites).
  const aWeb = new Set((a.contacts ?? []).filter((c) => c.kind === "website").map((c) => webHost(c.value)).filter((h): h is string => Boolean(h)));
  const bWeb = new Set((b.contacts ?? []).filter((c) => c.kind === "website").map((c) => webHost(c.value)).filter((h): h is string => Boolean(h)));
  const webOverlap = [...aWeb].some((w) => bWeb.has(w));
  if (webOverlap) { score += 0.35; reasons.push("website_match"); strongCount++; }

  // Coordinate proximity.
  if (typeof a.geo?.lat === "number" && typeof a.geo?.lng === "number" &&
      typeof b.geo?.lat === "number" && typeof b.geo?.lng === "number") {
    const meters = haversineMeters(a.geo.lat, a.geo.lng, b.geo.lat, b.geo.lng);
    if (meters < 50)  { score += 0.4; reasons.push(`coords_${Math.round(meters)}m`); strongCount++; }
    else if (meters < 150) { score += 0.25; reasons.push(`coords_${Math.round(meters)}m`); }
    else if (meters < 400) { score += 0.1; reasons.push(`coords_${Math.round(meters)}m`); }
    else { score -= 0.2; reasons.push(`coords_far_${Math.round(meters)}m`); }
  }

  // Name similarity.
  const aName = normaliseName(a.name);
  const bName = normaliseName(b.name);
  if (aName && bName) {
    const j = jaccard(tokens(aName), tokens(bName));
    const d = dice(trigrams(aName), trigrams(bName));
    const nameScore = 0.5 * j + 0.5 * d;
    if (nameScore >= 0.95) { score += 0.55; reasons.push(`name_ident_${nameScore.toFixed(2)}`); }
    else if (nameScore >= 0.8) { score += 0.35; reasons.push(`name_high_${nameScore.toFixed(2)}`); }
    else if (nameScore >= 0.6) { score += 0.2; reasons.push(`name_mid_${nameScore.toFixed(2)}`); }
    else if (nameScore < 0.3) { score -= 0.15; reasons.push(`name_low_${nameScore.toFixed(2)}`); }
  }

  // Same regency (moderate signal). Combined with an identical
  // normalised name this reaches the review threshold — that's the
  // "Warung Bu Siti vs Warung Ibu Siti, same city" case Philip
  // called out explicitly.
  if (a.geo?.regency && b.geo?.regency && a.geo.regency.toLowerCase() === b.geo.regency.toLowerCase()) {
    score += 0.15; reasons.push("same_regency");
  }

  const strongEvidence = strongCount >= 2 || phoneOverlap;
  return { score: Math.max(0, Math.min(1, score)), reasons, strongEvidence };
}

export type MergeThreshold = { merge: number; review: number };
export const DEFAULT_THRESHOLD: MergeThreshold = { merge: 0.85, review: 0.65 };

export function shouldMerge(a: EntityRecord, b: EntityRecord, threshold: MergeThreshold = DEFAULT_THRESHOLD): "merge" | "review" | "no_merge" {
  const v = scoreMerge(a, b);
  if (v.strongEvidence) return "merge";
  if (v.score >= threshold.merge) return "merge";
  if (v.score >= threshold.review) return "review";
  return "no_merge";
}

/** Merge b's observation into a. Returns the merged entity —
 *  a's ID, unioned provenance, unioned contacts, unioned keywords,
 *  wins on any conflicting field via freshness (b if newer). */
export function mergeEntities(a: EntityRecord, b: EntityRecord): EntityRecord {
  // Prefer the newer observation for scalar fields.
  const aLastChanged = latestChange(a);
  const bLastChanged = latestChange(b);
  const winner = bLastChanged > aLastChanged ? b : a;
  const loser  = winner === a ? b : a;

  return {
    ...winner,
    id: a.id, // keep canonical id
    provenance: [...a.provenance, ...b.provenance].filter((p, i, arr) => arr.findIndex((x) => x.walkerId === p.walkerId && x.sourceKey === p.sourceKey && x.observedAt === p.observedAt) === i),
    contacts: unionContacts(a.contacts, b.contacts),
    keywords: unique([...(a.keywords ?? []), ...(b.keywords ?? [])]),
    aliases: unique([...(a.aliases ?? []), ...(b.aliases ?? [])]),
    changeHistory: [...(a.changeHistory ?? []), ...(b.changeHistory ?? [])],
    // Preserve the loser's original name as an alias if different.
    ...(loser.name && loser.name !== winner.name ? { aliases: unique([...(a.aliases ?? []), ...(b.aliases ?? []), loser.name]) } : {}),
  };
}

function latestChange(r: EntityRecord): number {
  const times = r.provenance.map((p) => new Date(p.lastChangedAt).getTime());
  return times.length ? Math.max(...times) : 0;
}

function unionContacts(a: EntityRecord["contacts"], b: EntityRecord["contacts"]): EntityRecord["contacts"] {
  const map = new Map<string, NonNullable<EntityRecord["contacts"]>[number]>();
  for (const c of [...(a ?? []), ...(b ?? [])]) {
    const key = `${c.kind}:${c.kind === "phone" || c.kind === "whatsapp" ? normalisePhone(c.value) : c.value.toLowerCase()}`;
    const existing = map.get(key);
    if (!existing || (c.verified && !existing.verified)) map.set(key, c);
  }
  return [...map.values()];
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function webHost(raw: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch { return null; }
}
