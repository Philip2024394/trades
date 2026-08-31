// src/lib/nex/brain/recommendation.ts
//
// Stage 3.17 · Phase 10 · Recommendation (Philip 2026-08-31).
//
// Consumer of Comparison (Phase 9) + Entity Intelligence (Phase 7).
// Given 2-3 candidates, produce an evidence-based ranking with a
// defensible reason. Never claims "best" without justification.
//
// v1 discipline:
//   · Deterministic · no LLM
//   · Ranking signals: area proximity (haversine to user's area slot),
//     retrieval position (fallback when no area preference)
//   · Signals we DON'T have (price, rating, amenities) are surfaced
//     as an honest "I can't rank on X" note
//   · When candidates are functionally tied (score gap below threshold),
//     honestly says "essentially tied" and asks for a tie-breaker
//   · Wrapped by orchestrator when explicit recommend intent OR
//     "which" follow-up after Comparison

import type { RecognisedEntity } from "./entities";
import type { AccommodationSlots } from "./accommodation-slots";

const RECOMMEND_TRIGGERS = [
  /\brecommend\b/i,
  /\brecommendation\b/i,
  /\bwhich (one )?(is|should i pick|would you|do you recommend|is best|is better|is closer)\b/i,
  /\bwhich would you (choose|pick|recommend)\b/i,
  /\byour (pick|recommendation|choice|suggestion)\b/i,
  /\bpick (one|the best)\b/i,
  /\brekomendasi\b/i,           // ID
  /\bpilihkan\b/i,              // ID · "pick for me"
  /\bmana yang paling (baik|dekat|murah)\b/i,  // ID
];

export function detectRecommendationIntent(message: string): boolean {
  return RECOMMEND_TRIGGERS.some((rx) => rx.test(message));
}

// ─── Area centroids (mirrors comparison.ts + orchestrate.ts) ─────────

const AREA_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  malioboro: { lat: -7.7929, lng: 110.3660 },
  prawirotaman: { lat: -7.8155, lng: 110.3650 },
  kraton: { lat: -7.8050, lng: 110.3644 },
  kotagede: { lat: -7.8271, lng: 110.4001 },
  tugu: { lat: -7.7828, lng: 110.3671 },
  gondomanan: { lat: -7.8010, lng: 110.3673 },
};

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// ─── Candidate + report types ────────────────────────────────────────

export type RecommendCandidate = {
  entity: RecognisedEntity;
  hit?: { category?: string; geo?: { lat?: number; lng?: number } | null };
};

export type ScoredCandidate = {
  candidate: RecommendCandidate;
  score: number;             // higher = better · v1 scale is metres-away (inverted)
  reason: string;
};

export type RecommendationReport =
  | {
      recommended: true;
      topPick: { canonical: string; raw: string; refId?: string };
      score: number;
      reason: string;
      runners: Array<{ canonical: string; raw: string; score: number; reason: string }>;
      /** True when the top pick's score is very close (<100m difference) to the runner-up. */
      tieBreakingNeeded: boolean;
      tieBreakerPrompt?: string;
      /** Attributes NEX honestly cannot rank on (no data). */
      cannotRankOn: Array<{ attribute: "price" | "rating" | "amenities" | "availability" | "reviews"; reason: string }>;
    }
  | {
      recommended: false;
      reason: "no_candidates" | "no_ranking_signal" | "no_recommend_intent";
      message: string;
    };

// ─── Scoring ─────────────────────────────────────────────────────────

const TIE_THRESHOLD_METRES = 100;

/** Score a candidate against the user's area preference (or fallback
 *  to retrieval position). Higher score = better recommendation. */
function scoreCandidate(
  c: RecommendCandidate,
  slots: Readonly<AccommodationSlots> | undefined,
  fallbackRank: number,
): ScoredCandidate {
  const areaSlot = slots?.area;
  const centroid = areaSlot ? AREA_CENTROIDS[areaSlot.toLowerCase()] : undefined;

  if (centroid && c.hit?.geo && typeof c.hit.geo.lat === "number" && typeof c.hit.geo.lng === "number") {
    const d = distanceKm({ lat: c.hit.geo.lat, lng: c.hit.geo.lng }, centroid);
    // Score = 1/d (closer wins) · scaled to metres for readability.
    // Use a positive scoring space: negate metres so closer → higher.
    const metres = d * 1000;
    return {
      candidate: c,
      score: -metres,
      reason: `${(d).toFixed(2)}km from ${areaSlot}`,
    };
  }

  // Fallback: use retrieval position (earlier = better).
  return {
    candidate: c,
    score: -fallbackRank,
    reason: `retrieval position #${fallbackRank + 1}`,
  };
}

/** Compute the recommendation report from a candidate set + user slots. */
export function recommendFromCandidates(
  candidates: ReadonlyArray<RecommendCandidate>,
  slots: Readonly<AccommodationSlots> | undefined,
): RecommendationReport {
  if (candidates.length === 0) {
    return {
      recommended: false,
      reason: "no_candidates",
      message: "I don't have candidates to recommend from yet · ask me to find some first.",
    };
  }

  const areaAvailable = !!slots?.area && !!AREA_CENTROIDS[slots.area.toLowerCase()];
  const anyGeo = candidates.some((c) => c.hit?.geo && typeof c.hit.geo.lat === "number");
  if (!areaAvailable && !anyGeo) {
    return {
      recommended: false,
      reason: "no_ranking_signal",
      message: "I can list them plainly, but I don't have a clear signal to rank them by yet. Tell me an area you want to be near, or ask me to compare their attributes instead.",
    };
  }

  const scored: ScoredCandidate[] = candidates.map((c, i) => scoreCandidate(c, slots, i));
  scored.sort((a, b) => b.score - a.score);

  const top = scored[0];
  const runnerUp = scored[1];

  // Tie detection · if the top two are within TIE_THRESHOLD_METRES.
  const tieBreakingNeeded = runnerUp
    ? Math.abs(top.score - runnerUp.score) < TIE_THRESHOLD_METRES
    : false;

  const cannotRankOn = [
    { attribute: "price" as const, reason: "OSM listings don't publish prices" },
    { attribute: "rating" as const, reason: "OSM listings don't carry ratings" },
    { attribute: "amenities" as const, reason: "OSM listings don't carry facility data" },
    { attribute: "availability" as const, reason: "no live booking connection" },
    { attribute: "reviews" as const, reason: "reviews aren't in the accommodation corpus" },
  ];

  const tieBreakerPrompt = tieBreakingNeeded
    ? `${top.candidate.entity.raw} and ${runnerUp?.candidate.entity.raw ?? "the runner-up"} are essentially tied on the signals I have. Want me to tie-break on area (I could try a nearby cluster), or would you rather I open the directory so you can compare them yourself?`
    : undefined;

  return {
    recommended: true,
    topPick: {
      canonical: top.candidate.entity.canonical,
      raw: top.candidate.entity.raw,
      refId: top.candidate.entity.refId,
    },
    score: top.score,
    reason: top.reason,
    runners: scored.slice(1).map((s) => ({
      canonical: s.candidate.entity.canonical,
      raw: s.candidate.entity.raw,
      score: s.score,
      reason: s.reason,
    })),
    tieBreakingNeeded,
    tieBreakerPrompt,
    cannotRankOn,
  };
}

// ─── Render ──────────────────────────────────────────────────────────

export function renderRecommendationReply(report: RecommendationReport): string {
  if (!report.recommended) return report.message;

  const lines: string[] = [];
  if (report.tieBreakingNeeded && report.tieBreakerPrompt) {
    lines.push(report.tieBreakerPrompt);
    lines.push("");
    lines.push(`Both scored close on the honest signal I have (${report.reason} vs ${report.runners[0]?.reason ?? "—"}). I can't rank on price, rating, amenities, availability, or reviews · that data isn't in the corpus.`);
    return lines.join("\n");
  }

  lines.push(`My pick would be ${report.topPick.raw} — ${report.reason}.`);
  if (report.runners.length > 0) {
    const runnerParts = report.runners.map((r) => `${r.raw} (${r.reason})`);
    lines.push(`Runners: ${runnerParts.join(", ")}.`);
  }
  lines.push("");
  lines.push("Note · this ranking is purely on distance/position from what I have. I don't have price, rating, amenity, availability, or review data to weigh in. Want me to open the directory for the top pick?");
  return lines.join("\n");
}
