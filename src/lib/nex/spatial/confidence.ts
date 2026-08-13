// Spatial Intelligence · confidence bands (Philip 2026-08-04).
//
// Constitutional rule: every measurement Nex shows carries its confidence.
// Never present Estimated as Verified · never hide the band.
//
// Doctrine: docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md

export type ConfidenceLevel = "verified" | "calibrated" | "estimated" | "guess";

export type Confidence = {
  level: ConfidenceLevel;
  percent: number;                       // canonical band anchor · 100 · 96 · 82 · 45
  basis: string;                         // e.g. "measured from CAD" · "one known 762mm door reference"
};

const BAND_ANCHOR: Record<ConfidenceLevel, number> = {
  verified: 100,
  calibrated: 96,
  estimated: 82,
  guess: 45,
};

const BAND_LABEL: Record<ConfidenceLevel, string> = {
  verified: "Verified",
  calibrated: "Calibrated",
  estimated: "Estimated",
  guess: "Guess",
};

const BAND_DEFAULT_BASIS: Record<ConfidenceLevel, string> = {
  verified: "measured from CAD or authoritative source",
  calibrated: "derived from at least one known real-world reference in the image",
  estimated: "extracted by vision without an in-image reference",
  guess: "no scale reference · order-of-magnitude only",
};

/** Build a Confidence value at a canonical band. */
export function withConfidence(level: ConfidenceLevel, basis?: string): Confidence {
  return { level, percent: BAND_ANCHOR[level], basis: basis ?? BAND_DEFAULT_BASIS[level] };
}

/** Bucket a raw percent into a band. Never rounds up · Verified requires 100. */
export function bucketConfidence(percent: number): ConfidenceLevel {
  if (percent >= 100) return "verified";
  if (percent >= 90) return "calibrated";
  if (percent >= 70) return "estimated";
  return "guess";
}

/** Human-readable label for the band · never abbreviate below this. */
export function labelOf(level: ConfidenceLevel): string { return BAND_LABEL[level]; }

/** Compose two confidences · take the LOWER band + product of percentages.
 *  Used when a derived value (e.g. volume from three lengths) inherits from
 *  its inputs. */
export function combineConfidence(a: Confidence, b: Confidence): Confidence {
  const pct = Math.min(a.percent, b.percent, (a.percent * b.percent) / 100);
  const level = bucketConfidence(pct);
  return { level, percent: Math.round(pct * 10) / 10, basis: `${a.basis} × ${b.basis}` };
}

export function listConfidenceLevels(): readonly ConfidenceLevel[] {
  return ["verified", "calibrated", "estimated", "guess"];
}
