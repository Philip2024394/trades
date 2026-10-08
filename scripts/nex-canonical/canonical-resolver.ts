// scripts/nex-canonical/canonical-resolver.ts
//
// NEX Canonical · Layer-B Resolver · pure identity-resolution brain.
//
// ONE QUESTION ONLY
//   Given an approved Candidate and a supplied pool of
//   CanonicalResolverInput rows, what identity relationship does the
//   evidence support?
//
// RETURNS
//   IntelligenceResult<ResolverVerdict>:
//     answered(MATCH)      · one canonical row clearly identifies this
//                            Candidate, and no other row is competing
//     answered(AMBIGUOUS)  · a canonical row scores high but another is
//                            too close to call, OR the top score is in
//                            the inconclusive band
//     answered(NO_MATCH)   · the pool was evaluated with sufficient
//                            Candidate signal and no row crossed the
//                            lower threshold
//     abstained(reason)    · we did NOT make an identity claim · the
//                            evaluation itself was not responsible
//                            (empty pool, insufficient signal, …).
//
// SEPARATION OF CONCERNS
//   · This module does NOT decide approval. The Candidate is assumed
//     approved; approval decisions live in candidate-approval.ts.
//   · This module does NOT decide whether a canonical write is
//     permitted. That lives in canonical-handoff.ts.
//   · This module does NOT modify `src/lib/nex/entity-universe/*`,
//     does NOT import identity-matching.ts, does NOT reuse Layer-A
//     scoring weights. Layer A remains out of scope.
//   · This module performs NO DB access, NO network, NO filesystem,
//     NO environment reads, NO clock, NO randomness.
//
// §10 IMMUTABLE
//   Ambiguous identity means unresolved identity.
//   Never merge on weak evidence.
//   Never duplicate merely because matching is difficult.
//   Never fabricate identity.
//   A wrong MATCH is more damaging than an AMBIGUOUS result.

import type { Candidate } from "./generate-candidates";
import { selectionNameKey } from "./generate-candidates";
import type { CanonicalResolverInput } from "./canonical-row";
import type {
  ResolverVerdict,
  ScoreBreakdown,
} from "./canonical-handoff";
import {
  abstained,
  answered,
  type AbstainedReason,
  type IntelligenceResult,
} from "./intelligence-result";

// ═════════════════════════════════════════════════════════════════════
// §1 · Thresholds · Layer-B policy
// ═════════════════════════════════════════════════════════════════════

/** Minimum score for the top candidate to be considered MATCH. */
export const MATCH_THRESHOLD = 0.85 as const;

/** Minimum score to leave the NO_MATCH band. Scores in
 *  [AMBIGUOUS_THRESHOLD, MATCH_THRESHOLD) are AMBIGUOUS by definition. */
export const AMBIGUOUS_THRESHOLD = 0.55 as const;

/** Minimum separation between the top and second-best score for a
 *  high-score result to be considered MATCH rather than AMBIGUOUS. A
 *  top of 0.95 with a 0.90 runner-up is NOT a clean match. */
export const MATCH_SEPARATION_MIN = 0.1 as const;

// ═════════════════════════════════════════════════════════════════════
// §2 · Weights · Layer-B scoring model
// ═════════════════════════════════════════════════════════════════════
//
// Each weight below is explicit and documented. They are NOT copied
// from Layer A (src/lib/nex/entity-universe/identity-matching.ts),
// which uses a different threshold/weight set for a different model.
//
// Design intuition:
//   · Strong external identifiers (OSM, Wikidata) · when they agree,
//     identity is essentially settled. When they disagree, it's a
//     veto · OSM and Wikidata IDs are globally unique and a disagreement
//     means we are looking at different entities, not fuzzy variants.
//   · Contact identifiers (phone, website) · unique in practice but
//     can be reused or re-registered. Strong positive signal, soft
//     negative signal.
//   · Name similarity · supportive but never load-bearing on its own ·
//     capped so that weak name similarity cannot overcome contradicting
//     strong IDs.
//   · Geographic proximity · meaningful at close range (same storefront)
//     and tapers quickly · never a MATCH on its own.
//   · Entity-type / country mismatch · classification errors or
//     different jurisdictions · hard caps.

export const LAYER_B_WEIGHTS = Object.freeze({
  /** When OSM id or Wikidata QID agrees exactly, score starts at this
   *  floor. One strong ID agreement is normally enough for MATCH. */
  STRONG_ID_AGREEMENT_FLOOR: 0.9,

  /** When OSM id OR Wikidata QID contradicts (both sides present, both
   *  non-null, values differ), the final score is capped here · below
   *  AMBIGUOUS_THRESHOLD · the result cannot become MATCH. */
  STRONG_ID_CONTRADICTION_CAP: 0.2,

  /** When entity_type differs between Candidate and canonical, the
   *  score is capped here. Entity type is the sealed 9-value enum from
   *  migration 167; cross-type merges are refused. */
  ENTITY_TYPE_MISMATCH_CAP: 0.3,

  /** When both sides have a non-null E.164 phone and they are equal. */
  PHONE_EXACT: 0.45,

  /** When both sides have a non-null website apex and they are equal. */
  WEBSITE_EXACT: 0.35,

  /** When normalized names are equal (via selectionNameKey / nex.name_norm). */
  NAME_EXACT: 0.35,

  /** Scaled by the token-Jaccard overlap of the two normalized names,
   *  applied only when NAME_EXACT does not apply (otherwise it would
   *  double-count). */
  NAME_JACCARD_MAX: 0.25,

  /** One-shot bonus when any Candidate alias overlaps with the
   *  canonical name or any of its aliases (after normalization). Not
   *  summed per-alias to avoid alias-stuffing exploits. */
  ALIAS_OVERLAP: 0.15,

  /** City exact (normalized) match. Small weight · many businesses
   *  share a city. */
  CITY_EXACT: 0.08,

  /** Coordinates within 50 metres. Likely same storefront. */
  COORD_WITHIN_50M: 0.15,

  /** Coordinates within 200 metres. Same immediate neighbourhood. */
  COORD_WITHIN_200M: 0.08,

  /** Coordinates within 1 kilometre. Same local area. */
  COORD_WITHIN_1KM: 0.03,
} as const);

// ═════════════════════════════════════════════════════════════════════
// §3 · Pure helpers
// ═════════════════════════════════════════════════════════════════════

/** Normalise a free-form name using the sealed TS mirror of the DB
 *  `nex.name_norm` function. We import the sealed `selectionNameKey`
 *  rather than redefining it, so the Layer-B resolver stays
 *  byte-consistent with the generator and the DB. */
function normName(s: string): string {
  return selectionNameKey(s);
}

/** Token-Jaccard overlap of two normalized names. Deterministic ·
 *  symmetric · zero on either-empty. */
function tokenJaccard(a: string, b: string): number {
  const A = new Set(a.split(/\s+/).filter((t) => t.length > 0));
  const B = new Set(b.split(/\s+/).filter((t) => t.length > 0));
  if (A.size === 0 || B.size === 0) return 0;
  let intersection = 0;
  for (const t of A) if (B.has(t)) intersection++;
  const union = A.size + B.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Haversine distance in metres between two coordinates. Pure ·
 *  deterministic (uses only `Math.sin`, `Math.cos`, `Math.asin`,
 *  `Math.sqrt`, `Math.PI`, all deterministic). */
function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(Math.max(0, h)));
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

// ═════════════════════════════════════════════════════════════════════
// §4 · scorePair · per-pair score + deterministic breakdown
// ═════════════════════════════════════════════════════════════════════

export interface PairScore {
  readonly canonical_business_id: string;
  readonly score: number;
  readonly breakdown: readonly ScoreBreakdown[];
}

/**
 * Score an approved Candidate against a single CanonicalResolverInput.
 * Pure · deterministic · does not mutate either input.
 *
 * The score lives in [0, 1]. The breakdown is an ordered list of every
 * signal that contributed non-zero score, PLUS every signal that
 * applied a cap (so a reader can see WHY a seemingly-matching pair
 * ended up below threshold).
 */
export function scorePair(
  candidate: Candidate,
  canonical: CanonicalResolverInput,
): PairScore {
  const breakdown: ScoreBreakdown[] = [];

  // Country must agree. Different countries mean different jurisdictions
  // and almost certainly different real-world entities.
  if (candidate.country !== canonical.country) {
    breakdown.push({
      key: "country_mismatch_veto",
      contribution: 0,
      note: `candidate country=${candidate.country} vs canonical country=${canonical.country} · hard veto`,
    });
    return {
      canonical_business_id: canonical.canonical_business_id,
      score: 0,
      breakdown,
    };
  }

  let strongIdFloor = 0;
  let strongIdContradiction = false;

  // Strong IDs · OSM.
  if (candidate.identity.osm_id !== null && canonical.osm_id !== null) {
    if (candidate.identity.osm_id === canonical.osm_id) {
      strongIdFloor = Math.max(
        strongIdFloor,
        LAYER_B_WEIGHTS.STRONG_ID_AGREEMENT_FLOOR,
      );
      breakdown.push({
        key: "osm_id_exact",
        contribution: LAYER_B_WEIGHTS.STRONG_ID_AGREEMENT_FLOOR,
        note: `osm_id=${candidate.identity.osm_id} agrees · strong-id floor`,
      });
    } else {
      strongIdContradiction = true;
      breakdown.push({
        key: "osm_id_contradiction",
        contribution: 0,
        note: `osm_id ${candidate.identity.osm_id} vs ${canonical.osm_id} · will cap score`,
      });
    }
  }

  // Strong IDs · Wikidata.
  if (
    candidate.identity.wikidata_qid !== null &&
    canonical.wikidata_qid !== null
  ) {
    if (candidate.identity.wikidata_qid === canonical.wikidata_qid) {
      strongIdFloor = Math.max(
        strongIdFloor,
        LAYER_B_WEIGHTS.STRONG_ID_AGREEMENT_FLOOR,
      );
      breakdown.push({
        key: "wikidata_qid_exact",
        contribution: LAYER_B_WEIGHTS.STRONG_ID_AGREEMENT_FLOOR,
        note: `wikidata_qid=${candidate.identity.wikidata_qid} agrees · strong-id floor`,
      });
    } else {
      strongIdContradiction = true;
      breakdown.push({
        key: "wikidata_qid_contradiction",
        contribution: 0,
        note: `wikidata_qid ${candidate.identity.wikidata_qid} vs ${canonical.wikidata_qid} · will cap score`,
      });
    }
  }

  // Additive signals · phone, website.
  let additive = 0;
  if (
    candidate.identity.phone_e164 !== null &&
    canonical.phone_e164 !== null &&
    candidate.identity.phone_e164 === canonical.phone_e164
  ) {
    additive += LAYER_B_WEIGHTS.PHONE_EXACT;
    breakdown.push({
      key: "phone_exact",
      contribution: LAYER_B_WEIGHTS.PHONE_EXACT,
      note: `phone_e164=${candidate.identity.phone_e164}`,
    });
  }
  if (
    candidate.identity.website_apex !== null &&
    canonical.website_apex !== null &&
    candidate.identity.website_apex === canonical.website_apex
  ) {
    additive += LAYER_B_WEIGHTS.WEBSITE_EXACT;
    breakdown.push({
      key: "website_exact",
      contribution: LAYER_B_WEIGHTS.WEBSITE_EXACT,
      note: `website_apex=${candidate.identity.website_apex}`,
    });
  }

  // Name signals.
  const candNameNorm = normName(candidate.identity.name_canonical);
  const canonNameNorm = canonical.name_norm;
  if (candNameNorm === canonNameNorm && candNameNorm.length > 0) {
    additive += LAYER_B_WEIGHTS.NAME_EXACT;
    breakdown.push({
      key: "name_norm_exact",
      contribution: LAYER_B_WEIGHTS.NAME_EXACT,
      note: `name_norm="${candNameNorm}"`,
    });
  } else if (candNameNorm.length > 0 && canonNameNorm.length > 0) {
    const j = tokenJaccard(candNameNorm, canonNameNorm);
    const scaled = LAYER_B_WEIGHTS.NAME_JACCARD_MAX * j;
    if (scaled > 0) {
      additive += scaled;
      breakdown.push({
        key: "name_jaccard",
        contribution: scaled,
        note: `jaccard=${j.toFixed(3)} between "${candNameNorm}" and "${canonNameNorm}"`,
      });
    }
  }

  // Alias overlap · one-shot bonus.
  if (candidate.identity.aliases.length > 0) {
    const candAliasNorms = new Set(
      candidate.identity.aliases
        .map((a) => normName(a))
        .filter((a) => a.length > 0),
    );
    const canonAliasNorms = new Set(
      canonical.aliases.map((a) => normName(a)).filter((a) => a.length > 0),
    );
    let aliasHit = false;
    for (const a of candAliasNorms) {
      if (a === canonNameNorm || canonAliasNorms.has(a)) {
        aliasHit = true;
        break;
      }
    }
    if (!aliasHit && candNameNorm !== "") {
      for (const b of canonAliasNorms) {
        if (b === candNameNorm) {
          aliasHit = true;
          break;
        }
      }
    }
    if (aliasHit) {
      additive += LAYER_B_WEIGHTS.ALIAS_OVERLAP;
      breakdown.push({
        key: "alias_overlap",
        contribution: LAYER_B_WEIGHTS.ALIAS_OVERLAP,
        note: "at least one Candidate alias matches canonical name or alias",
      });
    }
  }

  // City exact (both sides non-null, normalized).
  if (candidate.identity.city !== null && canonical.city !== null) {
    const cityA = normName(candidate.identity.city);
    const cityB = normName(canonical.city);
    if (cityA.length > 0 && cityA === cityB) {
      additive += LAYER_B_WEIGHTS.CITY_EXACT;
      breakdown.push({
        key: "city_exact",
        contribution: LAYER_B_WEIGHTS.CITY_EXACT,
        note: `city="${cityA}"`,
      });
    }
  }

  // Coordinate proximity.
  if (
    candidate.identity.coordinates !== null &&
    canonical.coordinates !== null
  ) {
    const d = haversineMeters(
      candidate.identity.coordinates,
      canonical.coordinates,
    );
    if (d < 50) {
      additive += LAYER_B_WEIGHTS.COORD_WITHIN_50M;
      breakdown.push({
        key: "coord_within_50m",
        contribution: LAYER_B_WEIGHTS.COORD_WITHIN_50M,
        note: `distance=${d.toFixed(1)}m`,
      });
    } else if (d < 200) {
      additive += LAYER_B_WEIGHTS.COORD_WITHIN_200M;
      breakdown.push({
        key: "coord_within_200m",
        contribution: LAYER_B_WEIGHTS.COORD_WITHIN_200M,
        note: `distance=${d.toFixed(1)}m`,
      });
    } else if (d < 1000) {
      additive += LAYER_B_WEIGHTS.COORD_WITHIN_1KM;
      breakdown.push({
        key: "coord_within_1km",
        contribution: LAYER_B_WEIGHTS.COORD_WITHIN_1KM,
        note: `distance=${d.toFixed(1)}m`,
      });
    }
  }

  // Combine strongIdFloor and additive.
  // Rule: strongIdFloor is a floor · additive contributions can only
  // raise the score above the floor, never below it.
  let combined = Math.max(strongIdFloor, additive);

  // Apply caps.
  if (strongIdContradiction) {
    combined = Math.min(combined, LAYER_B_WEIGHTS.STRONG_ID_CONTRADICTION_CAP);
    breakdown.push({
      key: "strong_id_contradiction_cap",
      contribution: 0,
      note: `score capped at ${LAYER_B_WEIGHTS.STRONG_ID_CONTRADICTION_CAP} due to strong-id contradiction`,
    });
  }
  if (candidate.entity_type !== canonical.entity_type) {
    combined = Math.min(combined, LAYER_B_WEIGHTS.ENTITY_TYPE_MISMATCH_CAP);
    breakdown.push({
      key: "entity_type_mismatch_cap",
      contribution: 0,
      note: `score capped at ${LAYER_B_WEIGHTS.ENTITY_TYPE_MISMATCH_CAP} · candidate=${candidate.entity_type} vs canonical=${canonical.entity_type}`,
    });
  }

  return {
    canonical_business_id: canonical.canonical_business_id,
    score: clamp01(combined),
    breakdown,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §5 · resolveCanonical · the public entry point
// ═════════════════════════════════════════════════════════════════════

export interface ResolveCanonicalArgs {
  readonly candidate: Candidate;
  readonly pool: readonly CanonicalResolverInput[];
}

/**
 * Pure Layer-B identity resolution.
 *
 * Returns `answered(verdict)` on a successful evaluation, or
 * `abstained(reason)` when the resolver cannot responsibly produce a
 * verdict (empty pool, insufficient Candidate signal, malformed input).
 */
export function resolveCanonical(
  args: ResolveCanonicalArgs,
): IntelligenceResult<ResolverVerdict> {
  const { candidate, pool } = args;

  // Defensive · the Candidate should have passed through the validator,
  // but we treat these as pre-conditions for a responsible resolution.
  if (
    typeof candidate.identity.name_canonical !== "string" ||
    candidate.identity.name_canonical.trim().length === 0
  ) {
    return abstained({
      code: "malformed_input",
      message: "Candidate.identity.name_canonical is missing or blank",
    });
  }

  // Insufficient-signal gate. A Candidate with only a name has no
  // identity worth resolving against the canonical pool. Country +
  // entity_type alone also do not identify a specific business. We
  // require at least one of: osm_id, wikidata_qid, phone_e164,
  // website_apex, or coordinates.
  const hasStrongOrMediumSignal =
    candidate.identity.osm_id !== null ||
    candidate.identity.wikidata_qid !== null ||
    candidate.identity.phone_e164 !== null ||
    candidate.identity.website_apex !== null ||
    candidate.identity.coordinates !== null;

  if (!hasStrongOrMediumSignal) {
    return abstained({
      code: "insufficient_signal",
      message:
        "Candidate carries no osm_id, wikidata_qid, phone_e164, website_apex, or coordinates · identity cannot be resolved responsibly",
      details: {
        candidate_id: candidate.candidate_id,
        has_name: true,
        has_aliases: candidate.identity.aliases.length > 0,
        has_city: candidate.identity.city !== null,
      },
    });
  }

  if (pool.length === 0) {
    return abstained({
      code: "empty_pool",
      message:
        "canonical pool is empty · no identity relationship can be evaluated",
      details: { candidate_id: candidate.candidate_id },
    });
  }

  // Score every pool entry. Deterministic iteration order.
  const scored: PairScore[] = pool.map((entry) => scorePair(candidate, entry));

  // Deterministic ordering · score desc, then canonical_business_id asc
  // for stable tiebreaks.
  const sorted = [...scored].sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.canonical_business_id < b.canonical_business_id ? -1 : 1;
  });

  const top = sorted[0];
  const second = sorted.length > 1 ? sorted[1] : null;

  // NO_MATCH · nothing crossed the lower threshold.
  if (top.score < AMBIGUOUS_THRESHOLD) {
    const verdict: ResolverVerdict = {
      kind: "NO_MATCH",
      best_score: top.score,
    };
    return answered(verdict);
  }

  // AMBIGUOUS when: top is in [AMBIGUOUS, MATCH) OR top >= MATCH but
  // second is too close.
  const inAmbiguousBand = top.score < MATCH_THRESHOLD;
  const tooCloseToSecond =
    second !== null &&
    second.score >= AMBIGUOUS_THRESHOLD &&
    top.score - second.score < MATCH_SEPARATION_MIN;

  if (inAmbiguousBand || tooCloseToSecond) {
    const competing = sorted
      .filter((s) => s.score >= AMBIGUOUS_THRESHOLD)
      .map((s) => ({
        canonical_business_id: s.canonical_business_id,
        score: s.score,
      }));
    const verdict: ResolverVerdict = {
      kind: "AMBIGUOUS",
      competing,
      best_score: top.score,
    };
    return answered(verdict);
  }

  // MATCH · top is clearly separated.
  const verdict: ResolverVerdict = {
    kind: "MATCH",
    target_canonical_business_id: top.canonical_business_id,
    score: top.score,
    score_breakdown: top.breakdown,
  };
  return answered(verdict);
}

// ═════════════════════════════════════════════════════════════════════
// §6 · Static invariants · module-level
// ═════════════════════════════════════════════════════════════════════
//
// This module is PURE. It:
//   · does NOT import pg, pg-executor, pg-fingerprint, or
//     extract-candidates
//   · does NOT import identity-matching, entity-universe, or
//     matchBusiness · Layer A remains separate and untouched
//   · does NOT reference Supabase, dotenv, process.env, or fs
//   · does NOT use a clock (no Date.now, no new Date)
//   · does NOT use randomness (no Math.random, no randomUUID,
//     no randomBytes)
//   · does NOT execute, create, or persist any canonical write · the
//     verdict is a value, not an action
//   · does NOT make an approval decision
//   · does NOT make a canonical-write decision (that lives in
//     canonical-handoff.ts)
//
// Permitted imports: `./generate-candidates` (type-only + the sealed
// `selectionNameKey` TS mirror of `nex.name_norm`), `./canonical-row`
// (type-only), `./canonical-handoff` (type-only · reuses the already-
// sealed ResolverVerdict + ScoreBreakdown contract), `./intelligence-result`
// (answered/abstained constructors).
