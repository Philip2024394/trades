// Quality scoring · 8-dimension composite.
//
// Every record can be scored regardless of kind. Missing dimensions
// score 0 (they drag the overall down · that's the point). The
// retrieval layer uses `overall` to rank candidates when multiple
// records match a query.

import type { EntityRecord, QualityScore, SourceTier } from "./types";
import { computeStaleness } from "./freshness";

const TIER_WEIGHT: Record<SourceTier, number> = { A: 1.0, B: 0.75, C: 0.5, D: 0.25 };

/** Weight of each dimension in the composite. Sums to 1. */
const WEIGHTS = {
  identity:      0.15,
  location:      0.10,
  contact:       0.10,
  sourceQuality: 0.15,
  freshness:     0.15,
  completeness:  0.10,
  verification:  0.15,
  conflict:      0.10,
};

export function scoreEntity(rec: EntityRecord, now: Date = new Date()): QualityScore {
  const identity =
    (rec.name && rec.name.length >= 2 ? 1 : 0);

  const location = (() => {
    if (!rec.geo) return rec.kind === "knowledge" ? 1 : 0; // pure knowledge doesn't need geo
    let s = 0;
    if (rec.geo.province) s += 0.5;
    if (rec.geo.regency || rec.geo.district) s += 0.25;
    if (typeof rec.geo.lat === "number" && typeof rec.geo.lng === "number") s += 0.25;
    return Math.min(1, s);
  })();

  const contact = (() => {
    if (rec.kind !== "business" && rec.kind !== "service" && rec.kind !== "government") return 1; // N/A
    if (!rec.contacts || rec.contacts.length === 0) return 0;
    const verified = rec.contacts.filter((c) => c.verified).length;
    return Math.min(1, verified / Math.max(1, rec.contacts.length));
  })();

  const sourceQuality = (() => {
    if (rec.provenance.length === 0) return 0;
    // Take the best source tier.
    const best = rec.provenance.reduce((min, p) => {
      const w = TIER_WEIGHT[p.sourceTier];
      return w > min ? w : min;
    }, 0);
    return best;
  })();

  const freshness = (() => {
    const stale = computeStaleness(rec.freshness, now);
    return 1 - stale;
  })();

  const completeness = (() => {
    const optionalFields: Array<keyof EntityRecord> = ["description", "keywords", "attributes", "relations"];
    const filled = optionalFields.filter((f) => {
      const v = rec[f];
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === "object" && v !== null) return Object.keys(v).length > 0;
      return v !== undefined && v !== null && v !== "";
    }).length;
    return filled / optionalFields.length;
  })();

  const verification = (() => {
    // More sources observing the same entity → more verified.
    const n = rec.provenance.length;
    if (n === 0) return 0;
    if (n === 1) return 0.5;
    if (n === 2) return 0.75;
    return 1;
  })();

  const conflict = (() => {
    // If we don't yet track conflicts explicitly, use change history
    // as a rough signal: many changes with disagreement = penalty.
    // Placeholder: 1 (no penalty) by default.
    return 1;
  })();

  const overall =
    WEIGHTS.identity      * identity +
    WEIGHTS.location      * location +
    WEIGHTS.contact       * contact +
    WEIGHTS.sourceQuality * sourceQuality +
    WEIGHTS.freshness     * freshness +
    WEIGHTS.completeness  * completeness +
    WEIGHTS.verification  * verification +
    WEIGHTS.conflict      * conflict;

  return {
    identity,
    location,
    contact,
    sourceQuality,
    freshness,
    completeness,
    verification,
    conflict,
    overall: Number(overall.toFixed(3)),
  };
}
