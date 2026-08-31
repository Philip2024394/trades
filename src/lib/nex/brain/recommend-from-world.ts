// src/lib/nex/brain/recommend-from-world.ts
//
// Stage 3.35 · Phase A · Evidence-based recommendation over live
// WorldRecord data (Philip 2026-08-31).
//
// The existing recommendation.ts (Stage 3.17) ranks by area proximity
// + retrieval position over the session's entity window. It has no
// access to rating/reviewCount fields because entities are name-only.
//
// This module operates on live WorldRecord[] directly (post-adapter,
// pre-Presentation) with a COMPOSITE evidence-based ranking:
//
//   1. Bayesian rating × reviewCount (primary)
//      Prior: m=20 samples · c=4.0 mean · smooths so a single 5.0 review
//      doesn't beat a 4.7-with-500-reviews listing.
//   2. Area proximity (secondary · when user's slot area has a centroid
//      + record has coords)
//   3. Retrieval position (tie-break · preserves adapter's ordering)
//
// Composite: 0.65 × Bayesian(0-5 scale) + 0.35 × normalized proximity.
// Both terms only contribute when data exists · missing signals silently
// weight to 0 rather than fabricate a value.
//
// Constitutional invariants (per Live World doctrine):
//   · Never invents rating / reviewCount / price / distance
//   · Emits `honestGaps` for fields the schema doesn't publish
//     (e.g. accommodation has no price · says so in the reply)
//   · Bilingual reply text (EN + ID) driven by same lang detection
//   · Every claim in replyText traces to a WorldRecord field

import type { WorldRecord, WorldVertical } from "./world-adapters/types";

// Area centroids · mirrors comparison.ts + orchestrate.ts. Kept local
// so the module doesn't pull the whole orchestrator.
const AREA_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  malioboro:    { lat: -7.7929, lng: 110.3660 },
  prawirotaman: { lat: -7.8155, lng: 110.3650 },
  kraton:       { lat: -7.8050, lng: 110.3644 },
  kotagede:     { lat: -7.8271, lng: 110.4001 },
  tugu:         { lat: -7.7828, lng: 110.3671 },
  gondomanan:   { lat: -7.8010, lng: 110.3673 },
};

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Bayesian rating with prior · smooths for reviewCount sample size.
 *  Formula: ((v × r) + (m × c)) / (v + m). Returns null when rating or
 *  reviewCount missing (never invents a rating). */
function bayesianRating(rating: number | undefined, reviewCount: number | undefined): number | null {
  if (rating == null || reviewCount == null) return null;
  const v = Math.max(0, reviewCount);
  const r = rating;
  const m = 20;    // prior sample size
  const c = 4.0;   // global mean assumption (conservative)
  return ((v * r) + (m * c)) / (v + m);
}

export type ScoredWorldCandidate = {
  record: WorldRecord;
  /** Composite score · higher = better. Range roughly 0-5 (dominated
   *  by the Bayesian rating term when it exists). */
  score: number;
  /** Per-signal breakdown for debugging + Reflection. */
  signals: {
    bayesianRating: number | null;
    distanceKm: number | null;
    retrievalPosition: number;
  };
  /** Human-readable one-line reason citing the strongest signal. */
  reason: string;
};

export type WorldRecommendation =
  | {
      recommended: true;
      vertical: WorldVertical;
      pick: WorldRecord;
      pickReason: string;
      runners: Array<{ record: WorldRecord; reason: string }>;
      /** Which signal drove the pick · used by Reflection to verify. */
      primarySignal: "rating_and_reviews" | "area_proximity" | "retrieval_position";
      /** Fields the schema doesn't publish · reply surfaces these as
       *  honest gaps so the user knows what NEX CAN'T rank on. */
      honestGaps: Array<{ field: "price" | "amenities" | "availability" | "distance"; note: string }>;
      /** Bilingual reply text · caller may use either based on message language. */
      replyText: { en: string; id: string };
    }
  | {
      recommended: false;
      reason: "no_candidates" | "no_ranking_signal";
      message: { en: string; id: string };
    };

export function recommendFromWorld(input: {
  records: readonly WorldRecord[];
  vertical: WorldVertical;
  slotArea?: string;   // e.g. "malioboro" from world_query.area
  limit?: number;      // default 3
}): WorldRecommendation {
  const records = input.records;
  if (records.length === 0) {
    return {
      recommended: false,
      reason: "no_candidates",
      message: {
        en: "I don't have any real matches to recommend from yet.",
        id: "Belum ada hasil nyata untuk direkomendasikan.",
      },
    };
  }

  const centroid = input.slotArea ? AREA_CENTROIDS[input.slotArea] : undefined;

  // Score every candidate deterministically.
  const scored: ScoredWorldCandidate[] = records.map((r, i) => {
    const bayes = bayesianRating(r.rating, r.reviewCount);
    const dist = centroid && r.latitude != null && r.longitude != null
      ? distanceKm({ lat: r.latitude, lng: r.longitude }, centroid)
      : null;

    // Composite score:
    //   · Bayesian rating (0-5 scale) contributes 0.65 weight ONLY when
    //     both rating + reviewCount present.
    //   · Proximity contributes 0.35 weight ONLY when centroid + coords
    //     present. Proximity term = 5 × (1 - min(dist/3, 1)) so within
    //     ≤3km of the area gets a proportional bonus.
    //   · Retrieval position provides a tiny tie-break signal so
    //     equally-scored candidates keep the adapter's ordering.
    const bayesTerm = bayes != null ? 0.65 * bayes : 0;
    const proxTerm = dist != null ? 0.35 * (5 * Math.max(0, 1 - Math.min(dist / 3, 1))) : 0;
    const posTerm = -0.01 * i;  // ~0.01 nudge per position
    const score = bayesTerm + proxTerm + posTerm;

    // Human-readable reason: pick the strongest contributor.
    let reason: string;
    if (bayes != null && r.rating != null && r.reviewCount != null) {
      reason = `rating ${r.rating.toFixed(1)} · ${r.reviewCount} reviews`;
      if (dist != null) reason += ` · ${dist.toFixed(2)}km from ${input.slotArea}`;
    } else if (dist != null) {
      reason = `${dist.toFixed(2)}km from ${input.slotArea}`;
    } else {
      reason = "retrieval position (no rating or distance evidence)";
    }

    return {
      record: r,
      score,
      signals: { bayesianRating: bayes, distanceKm: dist, retrievalPosition: i },
      reason,
    };
  });

  // Sort descending by score. Stable so equal scores keep adapter order.
  scored.sort((a, b) => b.score - a.score);

  const top = scored[0];
  const bothTermsZero = top.signals.bayesianRating == null && top.signals.distanceKm == null;
  if (bothTermsZero) {
    return {
      recommended: false,
      reason: "no_ranking_signal",
      message: {
        en: "I have matches, but the directory doesn't publish rating, review, or distance data I can rank on. Tell me what matters most and I'll try again.",
        id: "Saya punya kandidat, tapi direktori belum menyimpan data rating, ulasan, atau jarak untuk saya beri peringkat. Ceritakan apa yang paling penting, saya coba lagi.",
      },
    };
  }

  // Determine primary signal for the pick.
  const primarySignal: WorldRecommendation extends { recommended: true; primarySignal: infer P } ? P : never =
    top.signals.bayesianRating != null && top.signals.bayesianRating >= 3
      ? "rating_and_reviews"
      : top.signals.distanceKm != null
        ? "area_proximity"
        : "retrieval_position";

  // Runners (top 2 after pick · at most 2 to keep reply concise).
  const runners = scored.slice(1, 3).map((s) => ({
    record: s.record,
    reason: s.reason,
  }));

  // Honest gaps · per-vertical field availability. Only surface gaps
  // that are DOCTRINALLY relevant to ranking (price, amenities,
  // availability, distance without coords).
  const honestGaps: WorldRecommendation extends { recommended: true; honestGaps: infer H } ? H : never = [];
  // Price · accommodation + food + service schemas don't publish it.
  if (input.vertical === "accommodation" || input.vertical === "food" || input.vertical === "service") {
    honestGaps.push({
      field: "price",
      note: input.vertical === "accommodation"
        ? "the directory doesn't currently publish room prices"
        : "the directory doesn't currently publish prices",
    });
  }
  // Distance · when no area centroid or record lacks coords.
  if (!centroid) {
    honestGaps.push({
      field: "distance",
      note: "you didn't tell me a target area, so I can't rank by proximity",
    });
  }
  // Amenities · accommodation-only (schema publishes for accommodation).
  if (input.vertical !== "accommodation") {
    honestGaps.push({
      field: "amenities",
      note: "no facility/amenity data for this vertical",
    });
  }

  const replyText = composeReplyText({
    vertical: input.vertical,
    pick: top,
    runners: scored.slice(1, 3),
    primarySignal,
    honestGaps,
    slotArea: input.slotArea,
  });

  return {
    recommended: true,
    vertical: input.vertical,
    pick: top.record,
    pickReason: top.reason,
    runners,
    primarySignal,
    honestGaps,
    replyText,
  };
}

// ─── Reply text composition ─────────────────────────────────────────

function composeReplyText(input: {
  vertical: WorldVertical;
  pick: ScoredWorldCandidate;
  runners: ScoredWorldCandidate[];
  primarySignal: "rating_and_reviews" | "area_proximity" | "retrieval_position";
  honestGaps: Array<{ field: string; note: string }>;
  slotArea?: string;
}): { en: string; id: string } {
  const p = input.pick.record;
  const rEn: string[] = [];
  const rId: string[] = [];

  // Opening: "I'd start with X" + reason.
  rEn.push(`I'd start with ${p.name}.`);
  rId.push(`Saya sarankan mulai dengan ${p.name}.`);

  // Primary-signal reason.
  if (input.primarySignal === "rating_and_reviews" && p.rating != null && p.reviewCount != null) {
    rEn.push(`Among the matching listings it has the strongest rating/review evidence (${p.rating.toFixed(1)} across ${p.reviewCount} reviews).`);
    rId.push(`Di antara kandidat, dia punya rating/ulasan terkuat (${p.rating.toFixed(1)} dari ${p.reviewCount} ulasan).`);
  } else if (input.primarySignal === "area_proximity" && input.pick.signals.distanceKm != null && input.slotArea) {
    rEn.push(`It's the closest to ${input.slotArea} at ${input.pick.signals.distanceKm.toFixed(2)}km.`);
    rId.push(`Paling dekat ke ${input.slotArea}, ${input.pick.signals.distanceKm.toFixed(2)}km.`);
  } else {
    rEn.push(`It's the top result from the adapter (no rating or distance evidence available).`);
    rId.push(`Ini hasil teratas dari adapter (tidak ada evidensi rating atau jarak).`);
  }

  // Runners.
  if (input.runners.length > 0) {
    const runnerNamesEn = input.runners.map((r) => r.record.name).join(" · ");
    const runnerNamesId = runnerNamesEn;
    rEn.push(`Runners-up: ${runnerNamesEn}.`);
    rId.push(`Berikutnya: ${runnerNamesId}.`);

    // Contrast note for the top runner.
    const topRunner = input.runners[0];
    if (topRunner.signals.bayesianRating != null && topRunner.record.rating != null && topRunner.record.reviewCount != null
        && input.primarySignal !== "rating_and_reviews") {
      rEn.push(`${topRunner.record.name} has ${topRunner.record.rating.toFixed(1)} across ${topRunner.record.reviewCount} reviews.`);
      rId.push(`${topRunner.record.name} punya ${topRunner.record.rating.toFixed(1)} dari ${topRunner.record.reviewCount} ulasan.`);
    } else if (topRunner.signals.distanceKm != null && input.slotArea && input.primarySignal === "rating_and_reviews") {
      rEn.push(`${topRunner.record.name} is ${topRunner.signals.distanceKm.toFixed(2)}km from ${input.slotArea}.`);
      rId.push(`${topRunner.record.name} berjarak ${topRunner.signals.distanceKm.toFixed(2)}km dari ${input.slotArea}.`);
    }
  }

  // Honest gaps · always append so user knows what NEX can't rank on.
  if (input.honestGaps.length > 0) {
    const priceGap = input.honestGaps.find((g) => g.field === "price");
    const distGap = input.honestGaps.find((g) => g.field === "distance");
    if (priceGap && distGap) {
      rEn.push(`I can't compare price because ${priceGap.note}, and I couldn't rank by distance because ${distGap.note}.`);
      rId.push(`Saya tidak bisa membandingkan harga karena ${priceGap.note}, dan tidak bisa memberi peringkat berdasarkan jarak karena ${distGap.note}.`);
    } else if (priceGap) {
      rEn.push(`I can't compare price because ${priceGap.note}.`);
      rId.push(`Saya tidak bisa membandingkan harga karena ${priceGap.note}.`);
    } else if (distGap) {
      rEn.push(`I couldn't rank by distance because ${distGap.note}.`);
      rId.push(`Saya tidak bisa memberi peringkat berdasarkan jarak karena ${distGap.note}.`);
    }
  }

  return {
    en: rEn.join(" "),
    id: rId.join(" "),
  };
}
