// src/lib/nex/brain/comparison.ts
//
// Stage 3.16 · Phase 9 · Comparison (Philip 2026-08-31).
//
// Given 2-3 presented businesses from the session's entity window,
// produce a structured side-by-side comparison. Consumer of Entity
// Intelligence (Phase 7) + Reference Resolution (Phase 8) primitives.
//
// v1 discipline:
//   · Deterministic · no LLM
//   · Compares 2 or 3 businesses (2 minimum · 3 maximum for clarity)
//   · Attributes compared: name · type/category · area proximity
//     (via haversine to known centroids) · provenance source
//   · Attributes we CANNOT compare from OSM data are surfaced as
//     honest boundaries · never invented (no price / rating / amenity
//     comparisons from data we don't have)
//   · Triggers: comparison intent keywords in user message OR ≥2
//     ordinals mentioned this turn
//
// Consumes: recent presentation batch from session.entities window.
// Produces: ComparisonReport for observability + reply text for user.

import type { RecognisedEntity } from "./entities";
import { findPresentedBusinessByOffset } from "./entities";

// ─── Detection ────────────────────────────────────────────────────────

const COMPARE_TRIGGERS = [
  /\bcompare\b/i,
  /\bcomparison\b/i,
  /\bdifference between\b/i,
  /\bhow do (they|these) compare\b/i,
  /\bwhich (is|one is) (better|best|cheaper|closer)\b/i,
  /\b(show|see|see) me both\b/i,
  /\bvs\b|\bversus\b/i,
  /\bbandingkan\b/i,               // ID
  /\bbeda(nya)? antara\b/i,        // ID
  /\bmana yang lebih (baik|bagus|dekat|murah)\b/i, // ID
];

export function detectComparisonIntent(message: string): boolean {
  return COMPARE_TRIGGERS.some((rx) => rx.test(message));
}

// ─── Known area centroids (mirrors orchestrate.ts filterByArea) ──────

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

function nearestKnownArea(
  hit: { geo?: { lat?: number; lng?: number } | null } | undefined,
): { area: string; distanceKm: number } | null {
  if (!hit?.geo || typeof hit.geo.lat !== "number" || typeof hit.geo.lng !== "number") return null;
  let best: { area: string; distanceKm: number } | null = null;
  for (const [area, centroid] of Object.entries(AREA_CENTROIDS)) {
    const d = distanceKm({ lat: hit.geo.lat, lng: hit.geo.lng }, centroid);
    if (!best || d < best.distanceKm) best = { area, distanceKm: d };
  }
  return best;
}

// ─── Comparison ──────────────────────────────────────────────────────

export type CompareCandidate = {
  entity: RecognisedEntity;
  /** Hit record used to enrich the comparison (from retrieval). Optional
   *  because the pure entity-only comparison can still produce name/category. */
  hit?: {
    category?: string;
    geo?: { lat?: number; lng?: number } | null;
  };
};

export type CompareAttribute = {
  key: "name" | "type" | "area_proximity" | "provenance" | "coords";
  values: Array<{ candidateIndex: number; value: string }>;
  /** Was this attribute computable from real data? */
  supported: boolean;
  /** For unsupported attributes · why. */
  unsupportedReason?: string;
};

export type ComparisonBoundary = {
  attribute: "price" | "rating" | "amenities" | "availability" | "reviews";
  reason: string;
};

export type ComparisonReport =
  | {
      compared: true;
      candidates: Array<{ canonical: string; raw: string; refId?: string }>;
      attributes: CompareAttribute[];
      boundaries: ComparisonBoundary[];
      /** Human-readable summary composed from attributes. */
      summary: string;
    }
  | {
      compared: false;
      reason:
        | "no_comparison_intent"
        | "insufficient_candidates"      // fewer than 2 to compare
        | "no_prior_presentation"
        | "too_many_candidates";         // >3
    };

/** Select candidates to compare from ordinals in this turn's entities
 *  OR fall back to the top-N of the most-recent presentation batch. */
export function selectComparisonCandidates(
  turnEntities: ReadonlyArray<RecognisedEntity>,
  sessionWindow: ReadonlyArray<RecognisedEntity>,
  fallbackN: number = 2,
): RecognisedEntity[] {
  const ordinalNames = ["first", "second", "third", "fourth", "fifth"] as const;
  const ordinalOffsets = turnEntities
    .filter((e) => e.kind === "ordinal")
    .map((e) => ordinalNames.indexOf(e.canonical as typeof ordinalNames[number]) + 1)
    .filter((n) => n >= 1 && n <= 5);

  if (ordinalOffsets.length >= 2) {
    const resolved: RecognisedEntity[] = [];
    for (const offset of ordinalOffsets) {
      const hit = findPresentedBusinessByOffset(sessionWindow, offset);
      if (hit && !resolved.find((r) => r.id === hit.id)) resolved.push(hit);
    }
    return resolved;
  }

  // Fallback · use top-N of most-recent batch.
  const presented = sessionWindow.filter((e) => e.kind === "business_name" && e.source === "nex_reply");
  if (presented.length === 0) return [];
  const mostRecentIso = presented[presented.length - 1].atIso;
  const batch = presented.filter((e) => e.atIso === mostRecentIso);
  const sorted = batch.slice().sort((a, b) => (a.presentedOffset ?? 999) - (b.presentedOffset ?? 999));
  return sorted.slice(0, fallbackN);
}

/** Produce a structured comparison from a candidate set. */
export function compareCandidates(candidates: ReadonlyArray<CompareCandidate>): ComparisonReport {
  if (candidates.length < 2) {
    return { compared: false, reason: "insufficient_candidates" };
  }
  if (candidates.length > 3) {
    return { compared: false, reason: "too_many_candidates" };
  }

  const attributes: CompareAttribute[] = [];

  // Name attribute
  attributes.push({
    key: "name",
    supported: true,
    values: candidates.map((c, i) => ({ candidateIndex: i, value: c.entity.raw })),
  });

  // Type attribute (from hit.category)
  const typeVals = candidates.map((c, i) => ({
    candidateIndex: i,
    value: c.hit?.category ? c.hit.category.replace(/^accommodation\./, "") : "unknown",
  }));
  attributes.push({
    key: "type",
    supported: typeVals.every((v) => v.value !== "unknown"),
    values: typeVals,
    unsupportedReason: typeVals.every((v) => v.value !== "unknown") ? undefined : "one or more candidates missing category data",
  });

  // Area proximity (nearest known centroid within reason)
  const areaVals = candidates.map((c, i) => {
    const near = nearestKnownArea(c.hit);
    if (!near) return { candidateIndex: i, value: "unknown" };
    if (near.distanceKm > 3) return { candidateIndex: i, value: `~${near.distanceKm.toFixed(1)}km from ${near.area}` };
    return { candidateIndex: i, value: `near ${near.area} (~${near.distanceKm.toFixed(1)}km)` };
  });
  attributes.push({
    key: "area_proximity",
    supported: areaVals.every((v) => v.value !== "unknown"),
    values: areaVals,
    unsupportedReason: areaVals.every((v) => v.value !== "unknown") ? undefined : "one or more candidates missing coordinates",
  });

  // Coords (raw lat/lng · low-level attribute · always supported when geo present)
  const coordsVals = candidates.map((c, i) => {
    if (c.hit?.geo && typeof c.hit.geo.lat === "number" && typeof c.hit.geo.lng === "number") {
      return { candidateIndex: i, value: `${c.hit.geo.lat.toFixed(4)}, ${c.hit.geo.lng.toFixed(4)}` };
    }
    return { candidateIndex: i, value: "unknown" };
  });
  attributes.push({
    key: "coords",
    supported: coordsVals.every((v) => v.value !== "unknown"),
    values: coordsVals,
  });

  // Provenance (source of the record) · always the OSM community-verified source for v1
  attributes.push({
    key: "provenance",
    supported: true,
    values: candidates.map((_, i) => ({ candidateIndex: i, value: "OpenStreetMap (community-verified)" })),
  });

  // Honest boundaries · attributes we cannot compare from OSM.
  const boundaries: ComparisonBoundary[] = [
    { attribute: "price", reason: "OSM listings don't publish prices" },
    { attribute: "rating", reason: "OSM listings don't carry ratings" },
    { attribute: "amenities", reason: "OSM listings don't carry facility data (pool, wifi, breakfast, aircon)" },
    { attribute: "availability", reason: "no live booking connection in the World" },
    { attribute: "reviews", reason: "reviews aren't in the accommodation corpus" },
  ];

  // Compose the summary line.
  const nameList = candidates.map((c) => c.entity.raw).join(" and ");
  const areasEqual = areaVals.every((v) => v.value === areaVals[0].value) && areaVals[0].value !== "unknown";
  const typesEqual = typeVals.every((v) => v.value === typeVals[0].value) && typeVals[0].value !== "unknown";
  const equalityNote =
    areasEqual && typesEqual ? " · same type · same area cluster" :
    areasEqual ? " · same area cluster" :
    typesEqual ? " · same type" : "";
  const summary = `Comparing ${nameList}${equalityNote}. All OpenStreetMap community listings · price/rating/amenity/availability data not available for comparison.`;

  return {
    compared: true,
    candidates: candidates.map((c) => ({ canonical: c.entity.canonical, raw: c.entity.raw, refId: c.entity.refId })),
    attributes,
    boundaries,
    summary,
  };
}

/** Compose a human-readable multi-line comparison reply. */
export function renderComparisonReply(report: ComparisonReport): string {
  if (!report.compared) {
    switch (report.reason) {
      case "insufficient_candidates":
        return "I need at least two properties to compare. Which two would you like to look at side by side?";
      case "too_many_candidates":
        return "I can compare 2 or 3 properties clearly at a time. Which specific ones would you like?";
      case "no_prior_presentation":
        return "I don't have a set of properties on hand to compare yet. Ask me to find some first.";
      case "no_comparison_intent":
      default:
        return "";
    }
  }
  const lines: string[] = [report.summary];
  const nameAttr = report.attributes.find((a) => a.key === "name");
  const typeAttr = report.attributes.find((a) => a.key === "type");
  const areaAttr = report.attributes.find((a) => a.key === "area_proximity");
  for (let i = 0; i < report.candidates.length; i++) {
    const name = nameAttr?.values[i]?.value ?? report.candidates[i].raw;
    const type = typeAttr?.values[i]?.value ?? "unknown";
    const area = areaAttr?.values[i]?.value ?? "unknown location";
    lines.push(`  · ${name} — ${type} · ${area}`);
  }
  lines.push("");
  lines.push("Want me to open the directory for either, or narrow the search another way?");
  return lines.join("\n");
}
