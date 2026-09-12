// NEX Workforce v2 · Slice 4 · Bbox Validator · fail-closed
// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE
//   Pure deterministic validator for geographic bounding boxes attached to a
//   nex_workforce.work_item and consumed by Overpass-family capabilities.
//   Discovered during 2026-09-04 Second Controlled Proving Cycle that the
//   overpass_observe_and_stage capability defaulted to a WHOLE-WORLD bbox
//   ({-90,-180}→{90,180}) when workItem.bbox_json was absent · this is now
//   an absolute prohibition.
//
// USAGE
//   import { validateBbox, BboxInvalidError } from "./bbox_validator.mjs";
//   validateBbox(workItem.bbox_json);   // throws BboxInvalidError if unsafe
//
// SHAPE
//   { sw: { lat: number, lon: number }, ne: { lat: number, lon: number } }
//
// RULES (Section 5 of Slice 4 authorization + Section 4 hard safety)
//   1. bbox must be a plain object · not null / undefined / string / array
//   2. bbox.sw and bbox.ne must both be plain objects
//   3. sw.lat / sw.lon / ne.lat / ne.lon must all be finite numbers
//   4. -90 <= lat <= 90 (both south and north)
//   5. -180 <= lon <= 180 (both west and east)
//   6. sw.lat < ne.lat (south strictly less than north · no zero-height boxes)
//   7. sw.lon < ne.lon (west strictly less than east · no anti-meridian
//      crossing yet · Indonesia never straddles the anti-meridian so this
//      simplification is safe for the current acquisition scope)
//   8. (ne.lat - sw.lat) <= MAX_SPAN_DEGREES
//   9. (ne.lon - sw.lon) <= MAX_SPAN_DEGREES
//
// PROPOSED MAX_SPAN_DEGREES = 2.0 · REQUIRES PHILIP APPROVAL BEFORE PRODUCTION
//   Justification (documented in Slice 4 deliverable · Section "Design
//   decisions requiring approval"):
//     · Jakarta metro area                ≈ 0.29° lat × 0.35° lon (fits)
//     · Denpasar/Bali                     ≈ 1.0° lat × 1.5° lon  (fits)
//     · Surabaya metro                    ≈ 0.5° lat × 0.5° lon  (fits)
//     · Any single Indonesian province except Papua fits ≤ 2°
//     · Whole Indonesia (~11° × ~47°) is REJECTED (correct)
//     · Whole world (180° × 360°)         REJECTED (the original bug)
//   If the acquisition model needs a larger single-work-item scope, the
//   correct fix is to split into multiple work_items rather than widen this
//   limit. This constant is intentionally small · Philip must explicitly
//   approve any increase before it ships to Project B.
export const MAX_SPAN_DEGREES = 2.0;

export class BboxInvalidError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = "BboxInvalidError";
    this.code = "BBOX_INVALID";
    Object.assign(this, meta);
  }
}

// Predicate helpers · deliberately un-inlined for readable error reporting.
function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}
function inClosed(v, lo, hi) {
  return v >= lo && v <= hi;
}

/**
 * Validate a bbox object. Throws BboxInvalidError on the FIRST rule violation
 * with a specific reason code + the offending field. Returns void on success.
 *
 * NEVER returns a "corrected" bbox. NEVER falls back. NEVER widens.
 */
export function validateBbox(bbox) {
  // Rule 1 · shape
  if (bbox === null || bbox === undefined) {
    throw new BboxInvalidError("bbox is missing (null / undefined)", { reason: "missing" });
  }
  if (!isPlainObject(bbox)) {
    throw new BboxInvalidError(`bbox must be a plain object · got ${typeof bbox}`, { reason: "not_object" });
  }
  // Rule 2 · sw + ne present as plain objects
  if (!isPlainObject(bbox.sw)) {
    throw new BboxInvalidError("bbox.sw missing or not an object", { reason: "sw_shape" });
  }
  if (!isPlainObject(bbox.ne)) {
    throw new BboxInvalidError("bbox.ne missing or not an object", { reason: "ne_shape" });
  }
  const { sw, ne } = bbox;
  // Rule 3 · all four numbers finite
  for (const [k, v] of [["sw.lat", sw.lat], ["sw.lon", sw.lon], ["ne.lat", ne.lat], ["ne.lon", ne.lon]]) {
    if (!isFiniteNumber(v)) {
      throw new BboxInvalidError(`${k} must be a finite number · got ${typeof v}${typeof v === "number" ? `(${v})` : ""}`, { reason: "not_finite", field: k });
    }
  }
  // Rule 4 · lat range
  if (!inClosed(sw.lat, -90, 90)) {
    throw new BboxInvalidError(`sw.lat out of range · ${sw.lat} not in [-90, 90]`, { reason: "lat_range", field: "sw.lat" });
  }
  if (!inClosed(ne.lat, -90, 90)) {
    throw new BboxInvalidError(`ne.lat out of range · ${ne.lat} not in [-90, 90]`, { reason: "lat_range", field: "ne.lat" });
  }
  // Rule 5 · lon range
  if (!inClosed(sw.lon, -180, 180)) {
    throw new BboxInvalidError(`sw.lon out of range · ${sw.lon} not in [-180, 180]`, { reason: "lon_range", field: "sw.lon" });
  }
  if (!inClosed(ne.lon, -180, 180)) {
    throw new BboxInvalidError(`ne.lon out of range · ${ne.lon} not in [-180, 180]`, { reason: "lon_range", field: "ne.lon" });
  }
  // Rule 6 · south < north (no zero-height, no inverted)
  if (!(sw.lat < ne.lat)) {
    throw new BboxInvalidError(`sw.lat must be strictly less than ne.lat · got sw=${sw.lat} ne=${ne.lat}`, { reason: "lat_inverted" });
  }
  // Rule 7 · west < east (no anti-meridian crossing in current scope · no zero-width)
  if (!(sw.lon < ne.lon)) {
    throw new BboxInvalidError(`sw.lon must be strictly less than ne.lon · got sw=${sw.lon} ne=${ne.lon}`, { reason: "lon_inverted" });
  }
  // Rule 8+9 · max span per dimension
  const latSpan = ne.lat - sw.lat;
  const lonSpan = ne.lon - sw.lon;
  if (latSpan > MAX_SPAN_DEGREES) {
    throw new BboxInvalidError(`latitude span exceeds MAX_SPAN_DEGREES · ${latSpan.toFixed(4)}° > ${MAX_SPAN_DEGREES}°`, { reason: "lat_span_too_large", latSpan });
  }
  if (lonSpan > MAX_SPAN_DEGREES) {
    throw new BboxInvalidError(`longitude span exceeds MAX_SPAN_DEGREES · ${lonSpan.toFixed(4)}° > ${MAX_SPAN_DEGREES}°`, { reason: "lon_span_too_large", lonSpan });
  }
}

/**
 * Convenience wrapper for capabilities: assert bbox is valid, then return a
 * frozen shallow copy. If invalid, throws BboxInvalidError (which capabilities
 * classify as CATASTROPHIC · agent then fail_softs · after max_attempts →
 * dead_letter · operator inspects and fixes city_catalogue.bbox_json).
 */
export function requireValidBbox(bbox) {
  validateBbox(bbox);
  return Object.freeze({
    sw: Object.freeze({ lat: bbox.sw.lat, lon: bbox.sw.lon }),
    ne: Object.freeze({ lat: bbox.ne.lat, lon: bbox.ne.lon }),
  });
}
