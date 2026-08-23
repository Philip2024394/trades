// NEX Food · dedupe similarity functions.
//
// Pure functions · no DB · no I/O. Testable in isolation.
// Consumed by scripts/nex-food/dedupe-scan.mjs (Phase 3).
//
// Design principles (Philip 2026-08-21 · Tempo Gelato test case):
//   Two records referring to the SAME business must be identifiable even when:
//     - name differs by suffix ("Tempo Gelato" vs "Tempo Gelato Jogja"
//       vs "Tempo Gelato Prawirotaman")
//     - address is formatted differently
//     - phone digit-formatting varies
//     - coordinates are off by a few metres (OSM node moved)
//
// Two-tier match:
//   TIER 1 · exact dedupe_hash collision   → confidence 1.00 · auto-mergeable
//   TIER 2 · fuzzy signal aggregation      → confidence 0..1  · admin-review
//
// This module is intentionally simple · no ML · no embeddings · just cheap
// deterministic heuristics that admin can trust and audit.

// ── Text normalisation ──────────────────────────────────────────────────────

/**
 * Aggressive normalisation for name comparison · strips punctuation, common
 * business-suffix noise, and locality qualifiers Yogyakarta-side.
 */
export function normaliseBusinessName(name: string): string {
  const stripSuffixes = [
    "jogja",
    "yogyakarta",
    "yogya",
    "prawirotaman",
    "malioboro",
    "kotabaru",
    "sleman",
    "bantul",
    "kotagede",
    "restoran",
    "restaurant",
    "resto",
    "cafe",
    "coffee",
    "kopi",
    "warung",
    "kedai",
  ];
  let n = name.toLowerCase();
  n = n.replace(/&/g, " and ");
  n = n.replace(/[^a-z0-9]+/g, " ").trim();
  const tokens = n.split(/\s+/).filter((t) => t.length > 0);
  const kept = tokens.filter((t) => !stripSuffixes.includes(t));
  // If stripping removed everything, fall back to the raw normalised name
  // (e.g. a place literally named "Kopi Kopi" → don't reduce to empty).
  return kept.length > 0 ? kept.join(" ") : n;
}

/** Last N digits of a phone · handles international + local formatting. */
export function normalisePhoneTail(phone: string | null | undefined, take = 6): string {
  if (!phone) return "";
  return phone.replace(/\D+/g, "").slice(-take);
}

// ── Similarity primitives ───────────────────────────────────────────────────

/** 0..1 · Jaccard on space-separated tokens. Cheap and works well for names. */
export function tokenJaccard(a: string, b: string): number {
  const A = new Set(a.split(/\s+/).filter(Boolean));
  const B = new Set(b.split(/\s+/).filter(Boolean));
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Haversine distance in metres between two lat/lng pairs · null-safe. */
export function haversineMetres(
  aLat: number | null,
  aLng: number | null,
  bLat: number | null,
  bLng: number | null
): number | null {
  if (aLat == null || aLng == null || bLat == null || bLng == null) return null;
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// ── Candidate scoring ───────────────────────────────────────────────────────

export type DedupeCandidatePair = {
  refA: string;             // public_listing_ref of candidate A
  refB: string;             // public_listing_ref of candidate B
  confidence: number;       // 0..1
  signals: {
    exactHash: boolean;
    nameJaccard: number;
    coordDistanceMetres: number | null;
    phoneTailMatch: boolean;
    categoryMatch: boolean;
  };
  reason: string;           // human-readable summary
};

export type DedupeInputRow = {
  publicListingRef: string;
  businessName: string;
  category: string;
  phone: string | null;
  coordinatesLat: number | null;
  coordinatesLng: number | null;
  dedupeHash: string;
};

/**
 * Score a single pair. Returns confidence 0..1 · rule of thumb:
 *   ≥ 0.90 · auto-mergeable (admin one-click confirm)
 *   0.70-0.90 · needs admin review
 *   < 0.70 · almost certainly not duplicates · skip
 */
export function scorePair(a: DedupeInputRow, b: DedupeInputRow): DedupeCandidatePair {
  const exactHash = a.dedupeHash === b.dedupeHash;
  const nameNormA = normaliseBusinessName(a.businessName);
  const nameNormB = normaliseBusinessName(b.businessName);
  const nameJaccard = tokenJaccard(nameNormA, nameNormB);
  const coordDistanceMetres = haversineMetres(
    a.coordinatesLat, a.coordinatesLng, b.coordinatesLat, b.coordinatesLng
  );
  const phoneTailMatch =
    normalisePhoneTail(a.phone) !== "" &&
    normalisePhoneTail(a.phone) === normalisePhoneTail(b.phone);
  const categoryMatch = a.category === b.category;

  // Score components — additive with caps.
  let score = 0;
  const reasons: string[] = [];

  if (exactHash) {
    score = 1.0;
    reasons.push("exact dedupe_hash match");
  } else {
    // Name similarity is the dominant signal.
    if (nameJaccard >= 0.9) { score += 0.55; reasons.push(`name jaccard ${nameJaccard.toFixed(2)}`); }
    else if (nameJaccard >= 0.6) { score += 0.35; reasons.push(`name jaccard ${nameJaccard.toFixed(2)}`); }
    else if (nameJaccard >= 0.4) { score += 0.15; reasons.push(`name jaccard ${nameJaccard.toFixed(2)}`); }

    // Coordinate proximity (metres) — different thresholds.
    if (coordDistanceMetres != null) {
      if (coordDistanceMetres <= 30) { score += 0.30; reasons.push(`coord ${Math.round(coordDistanceMetres)}m`); }
      else if (coordDistanceMetres <= 100) { score += 0.20; reasons.push(`coord ${Math.round(coordDistanceMetres)}m`); }
      else if (coordDistanceMetres <= 300) { score += 0.05; reasons.push(`coord ${Math.round(coordDistanceMetres)}m`); }
    }

    // Phone last-6 match is very high-signal when present.
    if (phoneTailMatch) { score += 0.25; reasons.push("phone tail-6 match"); }

    // Category disagreement is a strong NEGATIVE signal.
    if (!categoryMatch) { score -= 0.20; reasons.push("category mismatch (penalty)"); }
  }

  const confidence = Math.max(0, Math.min(1, score));

  return {
    refA: a.publicListingRef,
    refB: b.publicListingRef,
    confidence: Number(confidence.toFixed(3)),
    signals: {
      exactHash,
      nameJaccard: Number(nameJaccard.toFixed(3)),
      coordDistanceMetres: coordDistanceMetres != null ? Math.round(coordDistanceMetres) : null,
      phoneTailMatch,
      categoryMatch,
    },
    reason: reasons.join(" · ") || "no signals",
  };
}

/**
 * Scan all rows for candidate pairs. O(n²) — fine at Yogyakarta scale
 * (~1000 records). For 50k+ records, add coord-bucket blocking.
 */
export function findDuplicateCandidates(
  rows: DedupeInputRow[],
  minConfidence = 0.70
): DedupeCandidatePair[] {
  const pairs: DedupeCandidatePair[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const p = scorePair(rows[i]!, rows[j]!);
      if (p.confidence >= minConfidence) pairs.push(p);
    }
  }
  return pairs.sort((a, b) => b.confidence - a.confidence);
}
