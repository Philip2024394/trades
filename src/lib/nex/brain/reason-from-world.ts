// src/lib/nex/brain/reason-from-world.ts
//
// Stage 3.35 · Phase C · Multi-constraint reasoning over live
// WorldRecords (Philip 2026-08-31).
//
// CONSTITUTIONAL DOCTRINE (Philip 2026-08-31):
//
//   NEX may rank evidence. NEX may not invent evidence.
//
// Concrete rules enforced by this module:
//   1. Missing data must NEVER become a bad score. A record without
//      price data is `evidence: "unsupported"` for the price_low
//      constraint — NOT scored 0. It's excluded from that constraint's
//      contribution.
//   2. Every constraint carries an evidence state per record:
//      "supported" | "unsupported". The score aggregates only
//      supported constraints.
//   3. evidenceCoverage is surfaced explicitly:
//        sum(weight of constraints supported by the winning record)
//        / sum(all requested constraint weights)
//      Reply text differentiates coverage 1.0 (strong recommendation)
//      vs 0 < c < 1 (best available from partial evidence) vs 0
//      (no supporting data at all).
//   4. Reply NEVER quotes a numeric score like "87/100". Qualitative
//      only: "strongest match" / "best available from partial data".
//   5. When user asks for a constraint the schema doesn't publish for
//      ANY candidate, reply explicitly says so — never silently
//      redistributes weight.

import type { WorldRecord, WorldVertical } from "./world-adapters/types";

// Reused area centroids (same as recommend + compare modules).
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

// ─── Constraint types ────────────────────────────────────────────────

export type ConstraintKind =
  | "price_low"           // cheap / budget / murah / affordable
  | "rating_high"         // highly rated / best / paling bagus
  | "reviews_many"        // popular / many reviews
  | "distance_close"      // near me · slotArea implicit
  | "distance_from_area"  // near <named area>
  | "amenity"             // with pool · with wifi · dengan kolam
  | "availability";       // available now / in stock / tersedia

export type Constraint = {
  kind: ConstraintKind;
  /** Weight in the composite score · defaults to 1/N when N constraints extracted. */
  weight: number;
  /** For distance_from_area: canonical area slug ("malioboro"). For amenity: canonical amenity name ("pool"). */
  detail?: string;
};

// ─── Extraction from message ─────────────────────────────────────────

const AREA_MATCHERS: Array<[RegExp, string]> = [
  [/\bmalioboro\b/i,    "malioboro"],
  [/\bprawirotaman\b/i, "prawirotaman"],
  [/\bkraton\b/i,       "kraton"],
  [/\bkotagede\b/i,     "kotagede"],
  [/\btugu\b/i,         "tugu"],
  [/\bgondomanan\b/i,   "gondomanan"],
];

const AMENITY_MATCHERS: Array<[RegExp, string]> = [
  [/\b(pool|swimming\s?pool|kolam(\s?renang)?)\b/i, "pool"],
  [/\b(wi[- ]?fi|internet)\b/i, "wifi"],
  [/\b(breakfast|sarapan)\b/i, "breakfast"],
  [/\b(parking|parkir)\b/i, "parking"],
  [/\b(air\s?con(ditioning)?|\bac\b)\b/i, "ac"],
];

/**
 * Extract constraints from a user's message + world_query context.
 * Returns constraints with EQUAL weights (1/N) by default. Weight
 * customisation is a future extension; equal weights are the honest
 * default when the user says "cheap and close" without ranking them.
 */
export function parseConstraints(input: {
  message: string;
  slotArea?: string;   // from world_query.area (Malioboro etc.)
  priceCeilingIdr?: number;  // from world_query.priceCeilingIdr
}): readonly Constraint[] {
  const m = input.message.toLowerCase();
  const raw: Constraint[] = [];

  // Cheap / budget / murah
  if (/\b(cheap|cheapest|budget|affordable|inexpensive|low\s?cost|value\s?for\s?money|murah|paling\s?murah)\b/i.test(m)
      || input.priceCeilingIdr != null) {
    raw.push({ kind: "price_low", weight: 1 });
  }

  // Highly rated / best rated / top rated
  if (/\b(highly\s?rated|top\s?rated|best\s?rated|well\s?rated|high\s?rating|good\s?rating|excellent|paling\s?bagus)\b/i.test(m)) {
    raw.push({ kind: "rating_high", weight: 1 });
  }

  // Many reviews / popular
  if (/\b(popular|many\s?reviews|well\s?reviewed|lots\s?of\s?reviews|banyak\s?ulasan)\b/i.test(m)) {
    raw.push({ kind: "reviews_many", weight: 1 });
  }

  // Distance from named area (message OR slot)
  //   "near/close to X" · "dekat X" · or slotArea populated from world_query
  let areaDetail: string | undefined;
  for (const [rx, slug] of AREA_MATCHERS) {
    if (rx.test(m)) { areaDetail = slug; break; }
  }
  if (!areaDetail && input.slotArea) areaDetail = input.slotArea;
  if (areaDetail && /\b(near|close\s?to|dekat)\b/i.test(m)) {
    raw.push({ kind: "distance_from_area", weight: 1, detail: areaDetail });
  } else if (areaDetail && input.slotArea) {
    // Slot area implies user wants proximity even without explicit "near"
    raw.push({ kind: "distance_from_area", weight: 1, detail: areaDetail });
  }

  // Near me · geolocation ask (NEX can't fulfill · but signal is real)
  if (/\b(near\s?me|nearby|di\s?sekitar\s?(saya|sini))\b/i.test(m)) {
    raw.push({ kind: "distance_close", weight: 1 });
  }

  // Amenity constraints
  for (const [rx, amenity] of AMENITY_MATCHERS) {
    if (rx.test(m) && /\b(with|has|dengan|punya|ada)\b/i.test(m)) {
      raw.push({ kind: "amenity", weight: 1, detail: amenity });
    }
  }

  // Availability
  if (/\b(available|in\s?stock|open\s?now|tersedia|buka\s?sekarang)\b/i.test(m)) {
    raw.push({ kind: "availability", weight: 1 });
  }

  if (raw.length === 0) return [];

  // Normalize weights so they sum to 1.
  const perWeight = 1 / raw.length;
  return raw.map((c) => ({ ...c, weight: perWeight }));
}

// ─── Per-record constraint evaluation ────────────────────────────────

export type ConstraintEvaluation = {
  constraint: Constraint;
  /** Whether THIS RECORD has data supporting this constraint. */
  evidence: "supported" | "unsupported";
  /** Normalized score 0-1 among SUPPORTED records (undefined when unsupported). */
  score?: number;
  /** Raw evidence value for the reply text (e.g. "4.5 rating" · "Rp 500,000" · "0.14km"). */
  rawEvidence?: string;
};

type CandidateEvaluation = {
  record: WorldRecord;
  perConstraint: ConstraintEvaluation[];
  supportedWeight: number;      // sum of weights where evidence=supported
  weightedScoreSum: number;     // sum of (score × weight) over supported constraints
  /** Normalized score in [0, 1] computed over SUPPORTED weight only.
   *  When supportedWeight=0, score is undefined (record has no
   *  constraint evidence at all). */
  overallScore?: number;
  /** Per-record coverage · fraction of user's requested constraints
   *  this specific record can be assessed on. */
  coverage: number;
};

// ─── The reasoning engine ────────────────────────────────────────────

export type WorldReasoning =
  | {
      reasoned: true;
      vertical: WorldVertical;
      constraints: readonly Constraint[];
      /**
       * Global evidence coverage · fraction of user's requested
       * constraint weight that has data support for AT LEAST ONE
       * candidate. Distinguishes 1.0 (strong recommendation) from
       * 0 < c < 1 (partial · reply says so explicitly).
       */
      evidenceCoverage: number;
      /** Constraints that no candidate publishes evidence for. */
      unsupportedGlobally: readonly Constraint[];
      pick: WorldRecord;
      /** Per-constraint breakdown for the winning record. */
      pickEvaluation: readonly ConstraintEvaluation[];
      pickCoverage: number;
      runners: readonly WorldRecord[];
      replyText: { en: string; id: string };
    }
  | {
      reasoned: false;
      reason: "no_candidates" | "no_constraints" | "no_supported_constraints";
      message: { en: string; id: string };
    };

export function reasonFromWorld(input: {
  records: readonly WorldRecord[];
  vertical: WorldVertical;
  constraints: readonly Constraint[];
}): WorldReasoning {
  const records = input.records;
  const constraints = input.constraints;

  if (records.length === 0) {
    return {
      reasoned: false, reason: "no_candidates",
      message: {
        en: "I don't have any real matches to reason over yet.",
        id: "Belum ada hasil nyata untuk saya olah.",
      },
    };
  }
  if (constraints.length === 0) {
    return {
      reasoned: false, reason: "no_constraints",
      message: {
        en: "I didn't extract any specific priorities from your message. Try naming what matters most (cheap, close, well-rated, etc).",
        id: "Saya tidak menangkap prioritas spesifik dari pesan kamu. Sebutkan apa yang paling penting (murah, dekat, rating bagus, dll).",
      },
    };
  }

  // Evaluate every candidate against every constraint. This produces
  // per-record per-constraint evidence + raw values.
  const evaluations = records.map((r) => evaluateCandidate(r, constraints));

  // For each constraint, normalize scores across ONLY the records
  // that support it (evidence=supported). This is the "missing data
  // never becomes a bad score" rule — records without data for a
  // constraint are excluded from THAT constraint's ranking.
  normalizeSupportedScores(evaluations, constraints);

  // Aggregate: per-record weighted score over supported constraints only.
  for (const ev of evaluations) {
    let scoreSum = 0;
    let weightSum = 0;
    for (const pc of ev.perConstraint) {
      if (pc.evidence === "supported" && pc.score != null) {
        scoreSum += pc.score * pc.constraint.weight;
        weightSum += pc.constraint.weight;
      }
    }
    ev.supportedWeight = weightSum;
    ev.weightedScoreSum = scoreSum;
    ev.overallScore = weightSum > 0 ? scoreSum / weightSum : undefined;
    ev.coverage = weightSum;   // weights already sum to 1 across all constraints
  }

  // Global evidenceCoverage: fraction of constraint weight supported
  // by AT LEAST ONE candidate. Constraints supported by none are
  // globally unsupported.
  const unsupportedGlobally: Constraint[] = [];
  let globalCoverage = 0;
  for (const c of constraints) {
    const anySupport = evaluations.some((ev) =>
      ev.perConstraint.find((pc) => pc.constraint === c)?.evidence === "supported");
    if (anySupport) globalCoverage += c.weight;
    else unsupportedGlobally.push(c);
  }

  // Rank candidates by overallScore desc (only those with any
  // supported constraint qualify).
  const ranked = evaluations
    .filter((ev) => ev.overallScore != null)
    .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0));

  if (ranked.length === 0) {
    return {
      reasoned: false, reason: "no_supported_constraints",
      message: {
        en: `I have candidates, but the directory doesn't publish the data needed for your priorities (${constraints.map((c) => humanConstraint(c).en).join(", ")}). Tell me what else matters and I'll try again.`,
        id: `Saya punya kandidat, tapi direktori belum menyimpan data untuk prioritas kamu (${constraints.map((c) => humanConstraint(c).id).join(", ")}). Sebutkan apa lagi yang penting, saya coba lagi.`,
      },
    };
  }

  const winner = ranked[0];
  const runnerUps = ranked.slice(1, 3).map((r) => r.record);

  const replyText = composeReplyText({
    vertical: input.vertical,
    winner,
    runnerUps,
    constraints,
    unsupportedGlobally,
    globalCoverage,
  });

  return {
    reasoned: true,
    vertical: input.vertical,
    constraints,
    evidenceCoverage: globalCoverage,
    unsupportedGlobally,
    pick: winner.record,
    pickEvaluation: winner.perConstraint,
    pickCoverage: winner.coverage,
    runners: runnerUps,
    replyText,
  };
}

// ─── Per-candidate evaluation ───────────────────────────────────────

function evaluateCandidate(r: WorldRecord, constraints: readonly Constraint[]): CandidateEvaluation {
  const perConstraint = constraints.map((c) => evaluateConstraint(r, c));
  return {
    record: r,
    perConstraint,
    supportedWeight: 0,     // filled by aggregation step
    weightedScoreSum: 0,    // filled by aggregation step
    coverage: 0,            // filled by aggregation step
  };
}

function evaluateConstraint(r: WorldRecord, c: Constraint): ConstraintEvaluation {
  switch (c.kind) {
    case "price_low": {
      if (r.price == null) return { constraint: c, evidence: "unsupported" };
      return { constraint: c, evidence: "supported", rawEvidence: `Rp ${r.price.toLocaleString("id-ID")}` };
    }
    case "rating_high": {
      if (r.rating == null || r.reviewCount == null) return { constraint: c, evidence: "unsupported" };
      // Bayesian smoothing: same formula as recommend-from-world so
      // "5.0 with 1 review" doesn't beat "4.7 with 500 reviews".
      const bayes = ((r.reviewCount * r.rating) + (20 * 4.0)) / (r.reviewCount + 20);
      return { constraint: c, evidence: "supported", rawEvidence: `${r.rating.toFixed(1)} (${r.reviewCount} reviews)`, score: bayes / 5 };
    }
    case "reviews_many": {
      if (r.reviewCount == null) return { constraint: c, evidence: "unsupported" };
      return { constraint: c, evidence: "supported", rawEvidence: `${r.reviewCount} reviews` };
    }
    case "distance_from_area": {
      const centroid = c.detail ? AREA_CENTROIDS[c.detail] : undefined;
      if (!centroid || r.latitude == null || r.longitude == null) {
        return { constraint: c, evidence: "unsupported" };
      }
      const d = distanceKm({ lat: r.latitude, lng: r.longitude }, centroid);
      return { constraint: c, evidence: "supported", rawEvidence: `${d.toFixed(2)}km from ${c.detail}` };
    }
    case "distance_close":
      // NEX has no geolocation source · always unsupported.
      return { constraint: c, evidence: "unsupported" };
    case "amenity": {
      const list = r.amenities ?? [];
      const has = c.detail ? list.some((a) => a.toLowerCase().includes(c.detail!.toLowerCase())) : false;
      return { constraint: c, evidence: list.length > 0 ? "supported" : "unsupported", rawEvidence: has ? `has ${c.detail}` : `no ${c.detail}`, score: has ? 1 : 0 };
    }
    case "availability": {
      if (r.availability == null) return { constraint: c, evidence: "unsupported" };
      const ok = r.availability === "available";
      return { constraint: c, evidence: "supported", rawEvidence: r.availability, score: ok ? 1 : r.availability === "limited" ? 0.5 : 0 };
    }
  }
}

// ─── Per-constraint score normalization ─────────────────────────────

function normalizeSupportedScores(
  evaluations: CandidateEvaluation[],
  constraints: readonly Constraint[],
): void {
  for (const c of constraints) {
    // Collect supported evaluations for this constraint.
    const supported = evaluations
      .map((ev) => ev.perConstraint.find((pc) => pc.constraint === c)!)
      .filter((pc) => pc.evidence === "supported");
    if (supported.length === 0) continue;

    // Score kinds that need cross-candidate normalization:
    //   price_low         → best = lowest
    //   rating_high       → best = highest Bayesian (already computed)
    //   reviews_many      → best = highest count
    //   distance_from_area → best = lowest
    if (c.kind === "price_low") {
      const min = Math.min(...supported.map((pc) => extractPrice(pc)!));
      const max = Math.max(...supported.map((pc) => extractPrice(pc)!));
      const range = Math.max(1, max - min);
      for (const pc of supported) {
        const p = extractPrice(pc)!;
        pc.score = 1 - ((p - min) / range);  // cheapest = 1
      }
    } else if (c.kind === "distance_from_area") {
      const min = Math.min(...supported.map((pc) => extractDistance(pc)!));
      const max = Math.max(...supported.map((pc) => extractDistance(pc)!));
      const range = Math.max(0.01, max - min);
      for (const pc of supported) {
        const d = extractDistance(pc)!;
        pc.score = 1 - ((d - min) / range);  // closest = 1
      }
    } else if (c.kind === "reviews_many") {
      const min = Math.min(...supported.map((pc) => extractReviews(pc)!));
      const max = Math.max(...supported.map((pc) => extractReviews(pc)!));
      const range = Math.max(1, max - min);
      for (const pc of supported) {
        const rv = extractReviews(pc)!;
        pc.score = (rv - min) / range;  // most reviews = 1
      }
    }
    // rating_high, amenity, availability · scores were assigned at
    // evaluation time · no cross-candidate normalization needed.
  }
}

function extractPrice(pc: ConstraintEvaluation): number | undefined {
  const m = pc.rawEvidence?.match(/Rp\s+([\d.,]+)/);
  return m ? Number(m[1].replace(/[.,]/g, "")) : undefined;
}
function extractDistance(pc: ConstraintEvaluation): number | undefined {
  const m = pc.rawEvidence?.match(/([\d.]+)km/);
  return m ? Number(m[1]) : undefined;
}
function extractReviews(pc: ConstraintEvaluation): number | undefined {
  const m = pc.rawEvidence?.match(/^(\d+) reviews/);
  return m ? Number(m[1]) : undefined;
}

// ─── Human-friendly constraint labels + reply composition ───────────

function humanConstraint(c: Constraint): { en: string; id: string } {
  switch (c.kind) {
    case "price_low":          return { en: "price",              id: "harga" };
    case "rating_high":        return { en: "rating",             id: "rating" };
    case "reviews_many":       return { en: "review count",       id: "jumlah ulasan" };
    case "distance_from_area": return { en: `distance from ${c.detail}`, id: `jarak dari ${c.detail}` };
    case "distance_close":     return { en: "distance from you",  id: "jarak dari kamu" };
    case "amenity":            return { en: `${c.detail} amenity`,id: `fasilitas ${c.detail}` };
    case "availability":       return { en: "availability",       id: "ketersediaan" };
  }
}

function composeReplyText(input: {
  vertical: WorldVertical;
  winner: CandidateEvaluation;
  runnerUps: readonly WorldRecord[];
  constraints: readonly Constraint[];
  unsupportedGlobally: readonly Constraint[];
  globalCoverage: number;
}): { en: string; id: string } {
  const en: string[] = [];
  const id: string[] = [];
  const winName = input.winner.record.name;
  const supportedConstraints = input.constraints.filter((c) =>
    !input.unsupportedGlobally.includes(c));

  const isFullCoverage = input.globalCoverage >= 0.999;
  const isZeroCoverage = input.globalCoverage <= 0.001;

  if (isFullCoverage) {
    // Full coverage · "strongest match" is honest because every requested
    // constraint had evidence available for the ranking.
    en.push(`Based on your priorities, ${winName} is the strongest match on all requested criteria.`);
    id.push(`Berdasarkan prioritas kamu, ${winName} adalah pilihan terkuat pada semua kriteria yang diminta.`);
  } else if (isZeroCoverage) {
    en.push(`I can't assess any of your priorities against the directory data. I have candidates but no supporting evidence for what you asked about.`);
    id.push(`Saya tidak bisa menilai prioritas kamu berdasarkan data direktori. Saya punya kandidat tapi tidak ada bukti pendukung untuk yang kamu tanyakan.`);
  } else {
    // Partial coverage · constitutional wording (Philip 2026-08-31):
    // NEVER "strongest match" · always "best available match from partial
    // evidence" so no future consumer can interpret it as an overall
    // ranking. This is the doctrinal fix for evidenceCoverage < 1.0.
    const supportedLabelsEn = supportedConstraints.map((c) => humanConstraint(c).en).join(" and ");
    const supportedLabelsId = supportedConstraints.map((c) => humanConstraint(c).id).join(" dan ");
    en.push(`Based on the available ${supportedLabelsEn} data, ${winName} is the best available match from partial evidence.`);
    id.push(`Berdasarkan data ${supportedLabelsId} yang tersedia, ${winName} adalah pilihan terbaik dari bukti parsial yang ada.`);
  }

  // Per-constraint evidence details for the winner (only supported).
  const winnerDetails = input.winner.perConstraint
    .filter((pc) => pc.evidence === "supported" && pc.rawEvidence)
    .map((pc) => `${humanConstraint(pc.constraint).en}: ${pc.rawEvidence}`)
    .join(" · ");
  const winnerDetailsId = input.winner.perConstraint
    .filter((pc) => pc.evidence === "supported" && pc.rawEvidence)
    .map((pc) => `${humanConstraint(pc.constraint).id}: ${pc.rawEvidence}`)
    .join(" · ");
  if (winnerDetails) {
    en.push(`(${winnerDetails})`);
    id.push(`(${winnerDetailsId})`);
  }

  // Explicit callout for globally-unsupported constraints.
  if (input.unsupportedGlobally.length > 0) {
    const missEn = input.unsupportedGlobally.map((c) => humanConstraint(c).en).join(", ");
    const missId = input.unsupportedGlobally.map((c) => humanConstraint(c).id).join(", ");
    en.push(`${missEn.charAt(0).toUpperCase()}${missEn.slice(1)} data isn't published, so I can't assess that part of your request.`);
    id.push(`Data ${missId} tidak dipublikasikan, jadi saya tidak bisa menilai bagian permintaan kamu itu.`);
  }

  // Runners-up
  if (input.runnerUps.length > 0) {
    const runnerNames = input.runnerUps.map((r) => r.name).join(" · ");
    en.push(`Runners-up: ${runnerNames}.`);
    id.push(`Berikutnya: ${runnerNames}.`);
  }

  // No redundant coverage disclosure · the opening line already contains
  // "best available match from partial evidence" in the partial case ·
  // repeating would be noise. Constitutional wording consistent across
  // the whole reply (Philip 2026-08-31 tightening).

  return { en: en.join(" "), id: id.join(" ") };
}
