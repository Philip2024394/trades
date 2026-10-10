// UK postcode validator · public barrel.
//
// Pure, dependency-free validator for BS 7666 UK postcodes. Callers pass any
// user-supplied string; the module returns a canonicalised uppercase form plus
// the outward and inward components, or a fully-null result when the input is
// not a valid postcode.
//
// Regex per BS 7666 / Royal Mail:
//   outward = [A-Z]{1,2}[0-9][A-Z0-9]?    (covers A9, A9A, A99, AA9, AA9A, AA99)
//   inward  = [0-9][A-Z]{2}
//
// Deliberate exclusion (documented per run spec.md § decision_summary):
//   GIR 0AA (legacy Girobank) is REJECTED. It falls outside the BS 7666 shape
//   and its practical use has been discontinued. If a future caller needs it,
//   add an explicit opt-in flag rather than widening the core regex.

/**
 * Result of validating a candidate UK postcode string.
 *
 * When `valid === true`, all three of `formatted`, `outward`, `inward` are
 * non-null strings and satisfy `formatted === outward + " " + inward`.
 * When `valid === false`, all three are `null`. No partial success shape.
 */
export interface UkPostcodeValidationResult {
  valid: boolean;
  formatted: string | null;
  outward: string | null;
  inward: string | null;
}

// Anchored regex operating on the pre-normalised (uppercased, whitespace-
// collapsed) candidate. The internal separator is `\s*` so callers may
// submit "SW1A1AA" or "SW1A 1AA" — both match identically.
const UK_POSTCODE_REGEX = /^([A-Z]{1,2}[0-9][A-Z0-9]?)\s*([0-9][A-Z]{2})$/;

// Sentinel returned for every non-valid path so callers get a stable shape.
const INVALID_RESULT: UkPostcodeValidationResult = Object.freeze({
  valid: false,
  formatted: null,
  outward: null,
  inward: null,
});

/**
 * Validate a UK postcode.
 *
 * Accepts any string with mixed case and arbitrary internal whitespace
 * (spaces, tabs, newlines, double-spaces). Returns a canonical uppercase
 * `"OUTWARD INWARD"` form when valid, or a fully-null invalid result.
 *
 * Defensive: if a caller passes a non-string (e.g. body-parsed JSON where
 * TypeScript could not fully prove the type), this returns the invalid
 * result instead of throwing. Callers casting `input as string` from
 * `unknown` sources are safe.
 */
export function validateUkPostcode(input: string): UkPostcodeValidationResult {
  // Runtime guard: TS declares `input: string`, but real callers often pass
  // values whose type is only known at runtime (JSON.parse, form data, etc).
  // Refuse rather than throw — cleaner contract for pipeline callers.
  if (typeof input !== "string") {
    return { ...INVALID_RESULT };
  }

  // Collapse all whitespace runs to single spaces, trim, uppercase.
  // Uppercasing is ASCII-safe here: the regex is ASCII-only, so any
  // Cyrillic/Greek homoglyph will fail the match regardless of case.
  const normalised = input.replace(/\s+/g, " ").trim().toUpperCase();

  if (normalised.length === 0) {
    return { ...INVALID_RESULT };
  }

  const match = UK_POSTCODE_REGEX.exec(normalised);
  if (match === null) {
    return { ...INVALID_RESULT };
  }

  const outward = match[1];
  const inward = match[2];

  // Regex groups 1 and 2 are guaranteed present by a successful match, but
  // narrow the type explicitly so we never return a string|undefined.
  if (typeof outward !== "string" || typeof inward !== "string") {
    return { ...INVALID_RESULT };
  }

  return {
    valid: true,
    formatted: `${outward} ${inward}`,
    outward,
    inward,
  };
}
