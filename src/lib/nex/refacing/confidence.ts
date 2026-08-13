// Confidence — PR-16 attribute-level epistemic marker.
//
// PR-16 LOCKED (architecture memory · Philip 2026-08-12):
//   "NEX may interpret, question, suggest and warn — but never silently
//    convert an inference into a customer instruction."
//
// Every field in a Refacing Case or in `images_v3[]` that describes an
// observable attribute MUST carry a sibling `<field>_confidence` field with
// one of the three values below. Missing = schema rejection at write time.
//
// The confidence value is applied at the ATTRIBUTE level, not just the image
// level. A single image may have `sub_material_confidence: 'observed'` and
// `dimensions_confidence: 'unknown'`.

export const CONFIDENCE_VALUES = ["observed", "inferred", "unknown"] as const;
export type Confidence = (typeof CONFIDENCE_VALUES)[number];

/**
 * Type guard — is this value a valid Confidence?
 */
export function isConfidence(v: unknown): v is Confidence {
  return typeof v === "string" && (CONFIDENCE_VALUES as readonly string[]).includes(v);
}

/**
 * A value with its epistemic marker · never separate the two.
 */
export type Attested<T> = {
  value: T;
  confidence: Confidence;
};

export function attest<T>(value: T, confidence: Confidence): Attested<T> {
  return { value, confidence };
}

/**
 * PR-16 field-naming rule (documented for developers, enforced by CI drift-catcher).
 *
 * If your field describes something derived from visual evidence alone, the
 * field name itself must hedge:
 *
 *   BANNED               → REQUIRED
 *   `species`            → `likely_species`   (or `sub_material` on an image entry)
 *   `tread_count`        → `visible_tread_count`
 *   `configuration`      → `configuration` + `configuration_confidence` sibling
 *   `baluster_type`      → `component_role: 'baluster'` + `sub_material` on entry
 *   `dimensions`         → NOT PRESENT (dimensions come from survey, not photo)
 *   `regulation_status`  → NOT PRESENT (compliance is a survey concern)
 *
 * See docs/refacing/PR-12-EXECUTION-SPEC.md §7.2 for the full banned-vs-required
 * table.
 */
export const PR_16_BANNED_FIELD_NAMES = [
  "species",
  "tread_count",
  "staircase_step_count",
  "baluster_type",
  "dimensions",
  "regulation_status",
  "structural_condition",
] as const;

export function isBannedFieldName(name: string): boolean {
  return (PR_16_BANNED_FIELD_NAMES as readonly string[]).includes(name);
}
