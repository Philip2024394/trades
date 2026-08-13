// validators.ts — universal schema validators enforcing PR-16 + PR-13 + PR-18
// at write time. Never bypass.
//
// PR-16 (HARD TECHNICAL CONSTRAINT): every observable-attribute field must
//        have a sibling `_confidence` field with value observed|inferred|unknown.
// PR-13:  Refacing Cases must NEVER contain a NEX-attributed price field.
// PR-18:  Refacing Cases must carry composition_provenance for every claimed
//        component (validator lives in provenance.ts · re-exported here).

import { CONFIDENCE_VALUES, isBannedFieldName, type Confidence } from "./confidence";
import type { ImagesV3Entry } from "./image-schema";
import type { RefacingCase } from "./case-schema";
import { validateCompositionProvenance } from "./provenance";

// ── PR-16 · Confidence sibling requirement ────────────────────────────────

/**
 * Fields that MUST have a `<name>_confidence` sibling. Update as schema grows.
 * The heuristic-based scanner below catches most cases automatically; this
 * explicit list is the authoritative floor.
 */
const REQUIRES_CONFIDENCE_SIBLING = new Set<string>([
  "component_role",
  "canonical_profile_ids",
  "style",
  "mood",
  "material",
  "sub_material",
  "configuration",
  "visible_tread_count",
  "orientation",
  "string_type",
  "riser_openness",
  "landing_between",
]);

/**
 * Paths where REQUIRES_CONFIDENCE_SIBLING enforcement is skipped because the
 * containing structure is system-attributed (not derived from visual evidence)
 * OR uses an aggregate `confidence` field rather than per-field siblings.
 *
 * Ban on certainty-named fields + invalid confidence values still applies —
 * only the "must-have-sibling" rule is relaxed for these paths.
 */
const PR16_EXEMPT_PATH_PATTERNS: RegExp[] = [
  /\.composition_provenance\b/,   // system-attributed provenance records (PR-18)
  /\.component_selections\b/,     // customer choice records
  /\.material_composition\b/,     // uses aggregate confidence field
  /\.intent_entries\b/,           // customer intent records
  /\.related_images\b/,           // reference cross-refs
  /\.selected_design\b/,          // snapshot of composed design (source of truth = referenced images_v3 entries)
];

function isExemptPath(path: string): boolean {
  return PR16_EXEMPT_PATH_PATTERNS.some((r) => r.test(path));
}

export class PR16ConfidenceError extends Error {
  constructor(
    public readonly field: string,
    public readonly reason:
      | "missing_confidence_sibling"
      | "invalid_confidence_value"
      | "banned_field_name",
    public readonly path?: string
  ) {
    super(
      `PR-16 violation · ${reason} · field="${field}"${path ? ` at path="${path}"` : ""}`
    );
    this.name = "PR16ConfidenceError";
  }
}

/**
 * Validate a single object literal against PR-16 rules:
 *   · no banned field names (species, tread_count, dimensions, etc.)
 *   · every REQUIRES_CONFIDENCE_SIBLING field has its `_confidence` sibling
 *   · every `_confidence` value is one of observed | inferred | unknown
 *
 * Recurses into nested objects and arrays.
 */
export function validatePR16(obj: unknown, path = "$"): void {
  if (obj === null || obj === undefined) return;
  if (typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    obj.forEach((item, i) => validatePR16(item, `${path}[${i}]`));
    return;
  }

  const record = obj as Record<string, unknown>;
  const keys = Object.keys(record);

  for (const key of keys) {
    // Banned field name check (regardless of value)
    if (isBannedFieldName(key)) {
      throw new PR16ConfidenceError(key, "banned_field_name", path);
    }

    // Required-sibling check · skip on exempt paths (system-attributed records)
    if (REQUIRES_CONFIDENCE_SIBLING.has(key) && !isExemptPath(path)) {
      const siblingKey = `${key}_confidence`;
      if (!(siblingKey in record)) {
        throw new PR16ConfidenceError(key, "missing_confidence_sibling", path);
      }
      const siblingValue = record[siblingKey];
      if (!(CONFIDENCE_VALUES as readonly string[]).includes(siblingValue as string)) {
        throw new PR16ConfidenceError(siblingKey, "invalid_confidence_value", path);
      }
    }

    // Any field that ends in `_confidence` — verify its value regardless
    if (key.endsWith("_confidence")) {
      const value = record[key];
      if (
        value !== undefined &&
        value !== null &&
        !(CONFIDENCE_VALUES as readonly string[]).includes(value as string)
      ) {
        throw new PR16ConfidenceError(key, "invalid_confidence_value", path);
      }
    }

    // Recurse into nested objects
    validatePR16(record[key], `${path}.${key}`);
  }
}

// ── PR-13 · Banned price fields on Refacing Cases ─────────────────────────

const PR13_BANNED_CASE_FIELDS = new Set<string>([
  "nex_indicative_price",
  "nex_price",
  "homeowner_price_band",
  "quoted_price",
  "estimated_price",
  "our_price",
  "starting_from",
  "member_quote_amount", // Member quotes live in their own quote surface, not the Case
]);

export class PR13PriceOnCaseError extends Error {
  constructor(public readonly field: string) {
    super(
      `PR-13 violation · Refacing Case must never contain a NEX-attributed price · found field="${field}"`
    );
    this.name = "PR13PriceOnCaseError";
  }
}

/**
 * Assert no banned price fields exist anywhere in the Case object graph.
 * Recurses through nested objects and arrays.
 */
export function validatePR13NoNexPriceOnCase(obj: unknown, path = "$"): void {
  if (obj === null || obj === undefined) return;
  if (typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    obj.forEach((item, i) => validatePR13NoNexPriceOnCase(item, `${path}[${i}]`));
    return;
  }

  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (PR13_BANNED_CASE_FIELDS.has(key)) {
      throw new PR13PriceOnCaseError(key);
    }
    validatePR13NoNexPriceOnCase(record[key], `${path}.${key}`);
  }
}

// ── Consolidated Case validator (PR-16 + PR-13 + PR-18) ────────────────────

export type CaseValidatorContext = {
  knownImageIds: Set<string>; // Current images_v3[] entry ids
};

/**
 * Full Refacing Case validation. Runs all three rules in order:
 *   1. PR-16 · confidence markers on every observable attribute
 *   2. PR-13 · no NEX-attributed price fields
 *   3. PR-18 · composition_provenance covers every claimed component role
 *
 * Throws on first failure. Callers may wrap in try/catch and shape the error
 * for API responses.
 */
export function validateRefacingCase(
  refacingCase: RefacingCase,
  ctx: CaseValidatorContext
): void {
  validatePR16(refacingCase);
  validatePR13NoNexPriceOnCase(refacingCase);

  // Derive claimed component roles from the selected design (if present).
  const claimedRoles = refacingCase.selected_design
    ? refacingCase.selected_design.component_selections.map((c) => c.component_role)
    : [];

  validateCompositionProvenance(
    refacingCase.refacing_case_id,
    claimedRoles,
    refacingCase.composition_provenance,
    ctx.knownImageIds
  );
}

// ── ImagesV3 entry validator (PR-16 only · no PR-13/18 for library entries) ─

export function validateImagesV3Entry(entry: ImagesV3Entry): void {
  validatePR16(entry);
}

// ── Convenience non-throwing variants ─────────────────────────────────────

export type ValidationResult<E extends Error> =
  | { ok: true }
  | { ok: false; error: E };

export function tryValidateRefacingCase(
  refacingCase: RefacingCase,
  ctx: CaseValidatorContext
): ValidationResult<Error> {
  try {
    validateRefacingCase(refacingCase, ctx);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export function tryValidateImagesV3Entry(
  entry: ImagesV3Entry
): ValidationResult<Error> {
  try {
    validateImagesV3Entry(entry);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

// Re-export for convenience
export type { Confidence };
