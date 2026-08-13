// Spatial Intelligence · Measurement type · pairs a value + unit + confidence.
//
// Doctrine: docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md

import type { Confidence } from "./confidence";
import type { UnitSystem } from "./units";

export type Measurement = {
  value: number;
  unit: string;                          // one of the string literals in units.ts
  system: UnitSystem;
  confidence: Confidence;
  provenance?: string;                   // e.g. "manifest#staircase_001 stringer_length_mm"
};

export function measurement(value: number, unit: string, system: UnitSystem, confidence: Confidence, provenance?: string): Measurement {
  return { value, unit, system, confidence, provenance };
}

/** Present a measurement with its band · never hide the confidence. */
export function formatMeasurement(m: Measurement): string {
  return `${m.value} ${m.unit} (${m.confidence.percent}% · ${m.confidence.level})`;
}
