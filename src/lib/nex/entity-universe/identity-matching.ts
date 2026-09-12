// src/lib/nex/entity-universe/identity-matching.ts
//
// NEX Entity Universe · Business identity matching
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Agent Runtime Phase B
//
// §10 IMMUTABLE · Ambiguous identity means unresolved identity.
//   · Never merge on weak evidence.
//   · Never duplicate merely because matching is difficult.
//   · Never fabricate identity.
//
// Composes deterministic heuristics only — no LLM, no fuzzy magic.
// The matcher returns a score and a categorical verdict. Callers
// (persistence · lifecycle) are responsible for the actual create/merge
// decision.

import type {
  BusinessIdentity,
  BusinessPlacement,
  LocationRef,
} from "./types";

// ── Input shape ───────────────────────────────────────────────────

export type CandidateRecord = {
  /** Best-effort primary name for the observed record. */
  name: string;
  /** Optional alternate names observed for the same record. */
  alternate_names?: string[];
  /** Placement context — where this observation was recorded. */
  location: LocationRef;
  /** Placement-level contact channels observed with this record. */
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  /** Owner NEX id when known — a hard match on this alone is HIGH
   *  confidence. */
  owner_nex_id: string | null;
};

export type IdentityMatchVerdict =
  | "MATCH"          // score ≥ MATCH_THRESHOLD
  | "AMBIGUOUS"      // MATCH_THRESHOLD > score ≥ AMBIGUOUS_THRESHOLD
  | "NO_MATCH";      // score < AMBIGUOUS_THRESHOLD

export type IdentityMatchResult = {
  verdict: IdentityMatchVerdict;
  best_business_id: string | null;
  score: number;
  score_breakdown: { key: string; contribution: number; note: string }[];
  /** Every candidate that scored above AMBIGUOUS_THRESHOLD, sorted desc.
   *  Callers may inspect this to explain ambiguity to the user. */
  competing_matches: { business_id: string; score: number }[];
};

// ── Thresholds ────────────────────────────────────────────────────
// Deliberately conservative: an AMBIGUOUS verdict is far cheaper than
// a wrong merge that permanently poisons two businesses into one.

const MATCH_THRESHOLD = 0.85;
const AMBIGUOUS_THRESHOLD = 0.55;

// ── Normalization helpers ─────────────────────────────────────────

function normName(s: string): string {
  return s.toLowerCase()
    .replace(/[‘’']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normName(s).split(" ").filter(Boolean);
}

/** Jaccard token overlap · deterministic, symmetric, order-free. */
function tokenJaccard(a: string, b: string): number {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function normPhone(p: string | null): string | null {
  if (!p) return null;
  const stripped = p.replace(/[^\d]/g, "");
  if (stripped.length < 6) return null;
  // Keep trailing 8-11 digits to allow +62/0/62 prefix variation.
  return stripped.slice(-9);
}

function normUrl(u: string | null): string | null {
  if (!u) return null;
  try {
    const url = new URL(u.startsWith("http") ? u : `https://${u}`);
    return url.host.replace(/^www\./, "").toLowerCase();
  } catch { return null; }
}

// ── The matcher ────────────────────────────────────────────────────

export type CandidatePool = ReadonlyArray<{
  identity: BusinessIdentity;
  placements: ReadonlyArray<BusinessPlacement>;
}>;

export function matchBusiness(input: {
  candidate: CandidateRecord;
  pool: CandidatePool;
}): IdentityMatchResult {
  const { candidate, pool } = input;
  const breakdowns: { business_id: string; score: number; parts: { key: string; contribution: number; note: string }[] }[] = [];

  for (const entry of pool) {
    const parts: { key: string; contribution: number; note: string }[] = [];
    let score = 0;

    // 1 · Owner NEX id → dispositive HIGH
    if (candidate.owner_nex_id && entry.identity.owner_nex_id
        && candidate.owner_nex_id === entry.identity.owner_nex_id) {
      score += 1.0;
      parts.push({ key: "owner_nex_id", contribution: 1.0, note: "exact owner_nex_id match · dispositive" });
    }

    // 2 · Name overlap (Jaccard against primary + alternates)
    const nameCandidates = [entry.identity.name, ...entry.identity.alternate_names];
    let bestName = 0;
    let bestNameSource = "";
    for (const n of nameCandidates) {
      const j = tokenJaccard(candidate.name, n);
      if (j > bestName) { bestName = j; bestNameSource = n; }
      for (const alt of candidate.alternate_names ?? []) {
        const ja = tokenJaccard(alt, n);
        if (ja > bestName) { bestName = ja; bestNameSource = n; }
      }
    }
    if (bestName > 0) {
      score += bestName * 0.45;
      parts.push({ key: "name_jaccard", contribution: bestName * 0.45, note: `matched against '${bestNameSource}' j=${bestName.toFixed(2)}` });
    }

    // 3 · Phone continuity across any placement
    const cPhone = normPhone(candidate.phone) || normPhone(candidate.whatsapp);
    if (cPhone) {
      for (const p of entry.placements) {
        const pPhone = normPhone(p.phone) || normPhone(p.whatsapp);
        if (pPhone && pPhone === cPhone) {
          score += 0.35;
          parts.push({ key: "phone_continuity", contribution: 0.35, note: `matched placement ${p.placement_id} phone` });
          break;
        }
      }
    }

    // 4 · Website continuity across any placement
    const cWeb = normUrl(candidate.website);
    if (cWeb) {
      for (const p of entry.placements) {
        const pWeb = normUrl(p.website);
        if (pWeb && pWeb === cWeb) {
          score += 0.25;
          parts.push({ key: "website_continuity", contribution: 0.25, note: `matched placement ${p.placement_id} host ${cWeb}` });
          break;
        }
      }
    }

    // 5 · Location continuity signal.
    //     · same city → +0.15 bonus (real continuity signal · e.g.
    //       branch of same business in the same municipality).
    //     · same province different city → +0.05 bonus.
    //     · no overlap + no phone/web/owner → -0.20 penalty so a
    //       cross-city name-only match lands in AMBIGUOUS not MATCH
    //       (§25 "same name different owners → AMBIGUOUS").
    let sameCity = false;
    let sameProvince = false;
    for (const p of entry.placements) {
      if (p.location.city_slug === candidate.location.city_slug) { sameCity = true; break; }
      if (p.location.province_code && p.location.province_code === candidate.location.province_code) sameProvince = true;
    }
    if (sameCity) {
      score += 0.15;
      parts.push({ key: "same_city", contribution: 0.15, note: `matched city ${candidate.location.city_slug}` });
    } else if (sameProvince) {
      score += 0.05;
      parts.push({ key: "same_province", contribution: 0.05, note: `matched province ${candidate.location.province_code}` });
    } else if (!cPhone && !cWeb && !candidate.owner_nex_id) {
      score -= 0.20;
      parts.push({ key: "cross_city_name_only_penalty", contribution: -0.20, note: "no location/phone/web/owner continuity across cities" });
    }

    // Clamp
    if (score > 1) score = 1;
    if (score < 0) score = 0;

    breakdowns.push({ business_id: entry.identity.business_id, score, parts });
  }

  breakdowns.sort((a, b) => b.score - a.score);
  const best = breakdowns[0];
  const bestScore = best?.score ?? 0;

  let verdict: IdentityMatchVerdict = "NO_MATCH";
  if (bestScore >= MATCH_THRESHOLD) verdict = "MATCH";
  else if (bestScore >= AMBIGUOUS_THRESHOLD) verdict = "AMBIGUOUS";

  // §10 · When two candidates are within 0.10 of each other and both
  // above AMBIGUOUS_THRESHOLD, force AMBIGUOUS regardless of raw score
  // (do not silently prefer the first one).
  if (verdict === "MATCH" && breakdowns.length >= 2) {
    const second = breakdowns[1].score;
    if (bestScore - second < 0.10 && second >= AMBIGUOUS_THRESHOLD) {
      verdict = "AMBIGUOUS";
    }
  }

  const competing = breakdowns
    .filter((b) => b.score >= AMBIGUOUS_THRESHOLD)
    .map((b) => ({ business_id: b.business_id, score: b.score }));

  return {
    verdict,
    best_business_id: verdict === "MATCH" ? (best?.business_id ?? null) : null,
    score: bestScore,
    score_breakdown: best?.parts ?? [],
    competing_matches: competing,
  };
}

export const _internal = { MATCH_THRESHOLD, AMBIGUOUS_THRESHOLD };
