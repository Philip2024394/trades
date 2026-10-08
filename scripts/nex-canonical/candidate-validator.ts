// scripts/nex-canonical/candidate-validator.ts
//
// NEX Business Canonical · Candidate shape validator + JSONL parser.
//
// Downstream of β · pure · no DB · no network. This module reads
// Candidate objects (either in-memory or from the JSONL file β will
// eventually produce at `tests/fixtures/canonical/candidates-for-review-v1.jsonl`)
// and validates every record against the sealed `Candidate` type at
// RUNTIME, not just at the type system.
//
// Why this exists
//   The TypeScript compiler cannot enforce that a `Candidate` loaded
//   from JSON actually conforms to the shape. The generator could
//   silently drift (field rename, enum addition, status leak) and only
//   be noticed by eye-balling the JSONL. This validator makes any such
//   drift a loud, deterministic failure the first time the output is
//   loaded for review.
//
// Invariants locked by this validator (fail-closed on any violation)
//   · `status === "pending_founder_review"` (literal · one-value union)
//   · `entity_type ∈ SEALED_ENTITY_TYPES` (indirect Rule 5l guard · the
//     quarantined business_category values `event` / `portfolio` /
//     `community` / `creator` are NOT members, so any accidental
//     mapping to them as an entity_type is rejected)
//   · `generation_source.generator === "scripts/nex-canonical/generate-candidates.ts"`
//     (tamper check · prevents a hand-edited JSONL from passing review
//     as if it came from the sealed generator)
//   · `selection_score ∈ [0, 1]`
//   · `risk_categories` members ⊆ { R1..R10 }
//   · `identity.coordinates` either null OR { lat ∈ [-90,90], lng ∈ [-180,180] }
//   · all required fields present and of the expected shape · unknown
//     extra fields on any object are rejected (strict mode) because
//     the Candidate shape is sealed and extras indicate drift
//
// Scope boundary
//   · Does NOT import pg · does NOT import pg-executor · does NOT
//     import pg-fingerprint · does NOT import extract-candidates
//   · Does NOT modify the sealed candidate generator · the only read
//     is of the exported `Candidate` type and sealed enum values
//   · Does NOT open any connection · does NOT read credentials ·
//     does NOT execute SQL · does NOT run β

import {
  type Candidate,
  type EntityType,
  type RiskCategory,
  SEALED_ENTITY_TYPES,
} from "./generate-candidates";

// ═════════════════════════════════════════════════════════════════════
// §1 · Sealed enum snapshots
// ═════════════════════════════════════════════════════════════════════

/** The ten risk categories as a runtime set · parallel to the
 *  `RiskCategory` type union. Must match generate-candidates.ts §3
 *  (RISK_CATEGORIES) exactly. */
export const SEALED_RISK_CATEGORIES: readonly RiskCategory[] = [
  "R1",
  "R2",
  "R3",
  "R4",
  "R5",
  "R6",
  "R7",
  "R8",
  "R9",
  "R10",
] as const;

const RISK_CATEGORY_SET: ReadonlySet<string> = new Set(SEALED_RISK_CATEGORIES);
const ENTITY_TYPE_SET: ReadonlySet<string> = new Set(SEALED_ENTITY_TYPES);

/** The one-value sealed status · literal pin. */
export const CANDIDATE_STATUS_LITERAL = "pending_founder_review" as const;

/** The one-value sealed generator-provenance string · literal pin. */
export const CANDIDATE_GENERATOR_LITERAL =
  "scripts/nex-canonical/generate-candidates.ts" as const;

/** Set of top-level Candidate fields · strict-mode rejects any
 *  object with unknown keys at this level. */
const TOP_LEVEL_KEYS: ReadonlySet<string> = new Set([
  "candidate_id",
  "status",
  "entity_type",
  "country",
  "identity",
  "legacy_source",
  "risk_categories",
  "selection_score",
  "selection_rationale",
  "generation_source",
  "caveats",
]);

const IDENTITY_KEYS: ReadonlySet<string> = new Set([
  "name_canonical",
  "aliases",
  "phone_e164",
  "website_apex",
  "osm_id",
  "wikidata_qid",
  "city",
  "district",
  // Migration 178 · location-granularity wave.
  "street_line",
  "neighbourhood",
  "address",
  "coordinates",
]);

/** Sealed shape of `Candidate.identity.address` per
 *  docs/doctrine/nex-business-canonical-seed-cohort-and-eval-corpus-design-2026-10-08.md
 *  line 116. The two keys are the only permitted keys · additional
 *  keys reject · the whole value may be null. */
const CANONICAL_ADDRESS_KEYS: ReadonlySet<string> = new Set([
  "line1",
  "postal_code",
]);

const LEGACY_SOURCE_KEYS: ReadonlySet<string> = new Set([
  "table",
  "ref",
  "internal_id",
]);

const GENERATION_SOURCE_KEYS: ReadonlySet<string> = new Set([
  "generator",
  "generated_at",
  "generation_run_id",
]);

const RATIONALE_KEYS: ReadonlySet<string> = new Set([
  "risk_category",
  "contribution",
  "note",
]);

const COORDINATES_KEYS: ReadonlySet<string> = new Set(["lat", "lng"]);

// ═════════════════════════════════════════════════════════════════════
// §2 · Error class
// ═════════════════════════════════════════════════════════════════════

/** Thrown when a value under validation does not match the sealed
 *  Candidate shape. `path` indicates the location of the violation
 *  (e.g. `root.identity.coordinates.lat`). */
export class CandidateShapeError extends Error {
  readonly path: string;
  constructor(path: string, detail: string) {
    super(`CandidateShapeError at ${path}: ${detail}`);
    this.name = "CandidateShapeError";
    this.path = path;
  }
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Primitive guards
// ═════════════════════════════════════════════════════════════════════

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function assertNonEmptyString(path: string, v: unknown): string {
  if (typeof v !== "string") {
    throw new CandidateShapeError(path, `expected string, got ${typeOf(v)}`);
  }
  if (v.length === 0) {
    throw new CandidateShapeError(path, "expected non-empty string");
  }
  return v;
}

function assertStringOrNull(path: string, v: unknown): string | null {
  if (v === null) return null;
  if (typeof v !== "string") {
    throw new CandidateShapeError(
      path,
      `expected string or null, got ${typeOf(v)}`,
    );
  }
  return v;
}

function assertFiniteNumber(path: string, v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new CandidateShapeError(
      path,
      `expected finite number, got ${typeOf(v)}`,
    );
  }
  return v;
}

function assertNumberInRange(
  path: string,
  v: unknown,
  min: number,
  max: number,
): number {
  const n = assertFiniteNumber(path, v);
  if (n < min || n > max) {
    throw new CandidateShapeError(path, `${n} out of range [${min},${max}]`);
  }
  return n;
}

function assertStringArray(path: string, v: unknown): readonly string[] {
  if (!Array.isArray(v)) {
    throw new CandidateShapeError(path, `expected string[], got ${typeOf(v)}`);
  }
  for (let i = 0; i < v.length; i++) {
    if (typeof v[i] !== "string") {
      throw new CandidateShapeError(
        `${path}[${i}]`,
        `expected string, got ${typeOf(v[i])}`,
      );
    }
  }
  return v as readonly string[];
}

function assertObject(
  path: string,
  v: unknown,
  allowedKeys: ReadonlySet<string>,
): Record<string, unknown> {
  if (!isPlainObject(v)) {
    throw new CandidateShapeError(path, `expected object, got ${typeOf(v)}`);
  }
  for (const k of Object.keys(v)) {
    if (!allowedKeys.has(k)) {
      throw new CandidateShapeError(
        `${path}.${k}`,
        `unknown field · Candidate shape is sealed`,
      );
    }
  }
  return v;
}

function assertHasField(
  path: string,
  obj: Record<string, unknown>,
  key: string,
): unknown {
  if (!(key in obj)) {
    throw new CandidateShapeError(`${path}.${key}`, "required field missing");
  }
  return obj[key];
}

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Candidate validator
// ═════════════════════════════════════════════════════════════════════

/** Validate `x` against the sealed Candidate shape · returns the
 *  value typed as Candidate · throws CandidateShapeError on any
 *  deviation. The returned object is the same reference (no cloning
 *  or normalisation). */
export function validateCandidate(x: unknown): Candidate {
  const path = "root";
  const obj = assertObject(path, x, TOP_LEVEL_KEYS);

  // candidate_id
  const candidate_id = assertNonEmptyString(
    `${path}.candidate_id`,
    assertHasField(path, obj, "candidate_id"),
  );

  // status · literal pin
  const statusRaw = assertHasField(path, obj, "status");
  if (statusRaw !== CANDIDATE_STATUS_LITERAL) {
    throw new CandidateShapeError(
      `${path}.status`,
      `expected literal "${CANDIDATE_STATUS_LITERAL}", got ${JSON.stringify(statusRaw)}`,
    );
  }

  // entity_type · sealed enum (indirect Rule 5l guard)
  const entityTypeRaw = assertHasField(path, obj, "entity_type");
  if (typeof entityTypeRaw !== "string" || !ENTITY_TYPE_SET.has(entityTypeRaw)) {
    throw new CandidateShapeError(
      `${path}.entity_type`,
      `expected one of SEALED_ENTITY_TYPES, got ${JSON.stringify(entityTypeRaw)}`,
    );
  }
  const entity_type = entityTypeRaw as EntityType;

  // country
  const country = assertNonEmptyString(
    `${path}.country`,
    assertHasField(path, obj, "country"),
  );

  // identity (nested object)
  const identity = validateIdentity(
    `${path}.identity`,
    assertHasField(path, obj, "identity"),
  );

  // legacy_source (nested object)
  const legacy_source = validateLegacySource(
    `${path}.legacy_source`,
    assertHasField(path, obj, "legacy_source"),
  );

  // risk_categories · array of RiskCategory
  const riskCatRaw = assertHasField(path, obj, "risk_categories");
  if (!Array.isArray(riskCatRaw)) {
    throw new CandidateShapeError(
      `${path}.risk_categories`,
      `expected array, got ${typeOf(riskCatRaw)}`,
    );
  }
  const risk_categories: RiskCategory[] = [];
  for (let i = 0; i < riskCatRaw.length; i++) {
    const el = riskCatRaw[i];
    if (typeof el !== "string" || !RISK_CATEGORY_SET.has(el)) {
      throw new CandidateShapeError(
        `${path}.risk_categories[${i}]`,
        `expected RiskCategory (R1..R10), got ${JSON.stringify(el)}`,
      );
    }
    risk_categories.push(el as RiskCategory);
  }

  // selection_score ∈ [0,1]
  const selection_score = assertNumberInRange(
    `${path}.selection_score`,
    assertHasField(path, obj, "selection_score"),
    0,
    1,
  );

  // selection_rationale
  const rationaleRaw = assertHasField(path, obj, "selection_rationale");
  if (!Array.isArray(rationaleRaw)) {
    throw new CandidateShapeError(
      `${path}.selection_rationale`,
      `expected array, got ${typeOf(rationaleRaw)}`,
    );
  }
  const selection_rationale: Candidate["selection_rationale"] = rationaleRaw.map(
    (r, i) => validateRationale(`${path}.selection_rationale[${i}]`, r),
  );

  // generation_source
  const generation_source = validateGenerationSource(
    `${path}.generation_source`,
    assertHasField(path, obj, "generation_source"),
  );

  // caveats
  const caveats = assertStringArray(
    `${path}.caveats`,
    assertHasField(path, obj, "caveats"),
  );

  const validated: Candidate = {
    candidate_id,
    status: CANDIDATE_STATUS_LITERAL,
    entity_type,
    country,
    identity,
    legacy_source,
    risk_categories,
    selection_score,
    selection_rationale,
    generation_source,
    caveats,
  };
  return validated;
}

function validateIdentity(
  path: string,
  v: unknown,
): Candidate["identity"] {
  const obj = assertObject(path, v, IDENTITY_KEYS);
  return {
    name_canonical: assertNonEmptyString(
      `${path}.name_canonical`,
      assertHasField(path, obj, "name_canonical"),
    ),
    aliases: assertStringArray(
      `${path}.aliases`,
      assertHasField(path, obj, "aliases"),
    ),
    phone_e164: assertStringOrNull(
      `${path}.phone_e164`,
      assertHasField(path, obj, "phone_e164"),
    ),
    website_apex: assertStringOrNull(
      `${path}.website_apex`,
      assertHasField(path, obj, "website_apex"),
    ),
    osm_id: assertStringOrNull(
      `${path}.osm_id`,
      assertHasField(path, obj, "osm_id"),
    ),
    wikidata_qid: assertStringOrNull(
      `${path}.wikidata_qid`,
      assertHasField(path, obj, "wikidata_qid"),
    ),
    city: assertStringOrNull(
      `${path}.city`,
      assertHasField(path, obj, "city"),
    ),
    district: assertStringOrNull(
      `${path}.district`,
      assertHasField(path, obj, "district"),
    ),
    street_line: assertStringOrNull(
      `${path}.street_line`,
      assertHasField(path, obj, "street_line"),
    ),
    neighbourhood: assertStringOrNull(
      `${path}.neighbourhood`,
      assertHasField(path, obj, "neighbourhood"),
    ),
    address: validateCanonicalAddress(
      `${path}.address`,
      assertHasField(path, obj, "address"),
    ),
    coordinates: validateCoordinates(
      `${path}.coordinates`,
      assertHasField(path, obj, "coordinates"),
    ),
  };
}

/** Pure · validate a Candidate.identity.address against the sealed
 *  { line1: string | null, postal_code: string | null } | null shape.
 *  Null-at-whole is permitted. Unknown keys are rejected (sealed shape).
 *  Each permitted key must be string | null. */
function validateCanonicalAddress(
  path: string,
  v: unknown,
): { line1: string | null; postal_code: string | null } | null {
  if (v === null) return null;
  const obj = assertObject(path, v, CANONICAL_ADDRESS_KEYS);
  return {
    line1: assertStringOrNull(
      `${path}.line1`,
      assertHasField(path, obj, "line1"),
    ),
    postal_code: assertStringOrNull(
      `${path}.postal_code`,
      assertHasField(path, obj, "postal_code"),
    ),
  };
}

function validateCoordinates(
  path: string,
  v: unknown,
): { lat: number; lng: number } | null {
  if (v === null) return null;
  const obj = assertObject(path, v, COORDINATES_KEYS);
  const lat = assertNumberInRange(
    `${path}.lat`,
    assertHasField(path, obj, "lat"),
    -90,
    90,
  );
  const lng = assertNumberInRange(
    `${path}.lng`,
    assertHasField(path, obj, "lng"),
    -180,
    180,
  );
  return { lat, lng };
}

function validateLegacySource(
  path: string,
  v: unknown,
): Candidate["legacy_source"] {
  const obj = assertObject(path, v, LEGACY_SOURCE_KEYS);
  return {
    table: assertNonEmptyString(
      `${path}.table`,
      assertHasField(path, obj, "table"),
    ),
    ref: assertNonEmptyString(
      `${path}.ref`,
      assertHasField(path, obj, "ref"),
    ),
    internal_id: assertStringOrNull(
      `${path}.internal_id`,
      assertHasField(path, obj, "internal_id"),
    ),
  };
}

function validateRationale(
  path: string,
  v: unknown,
): { risk_category: RiskCategory; contribution: number; note: string } {
  const obj = assertObject(path, v, RATIONALE_KEYS);
  const rcRaw = assertHasField(path, obj, "risk_category");
  if (typeof rcRaw !== "string" || !RISK_CATEGORY_SET.has(rcRaw)) {
    throw new CandidateShapeError(
      `${path}.risk_category`,
      `expected RiskCategory, got ${JSON.stringify(rcRaw)}`,
    );
  }
  const contribution = assertFiniteNumber(
    `${path}.contribution`,
    assertHasField(path, obj, "contribution"),
  );
  const noteRaw = assertHasField(path, obj, "note");
  if (typeof noteRaw !== "string") {
    throw new CandidateShapeError(
      `${path}.note`,
      `expected string, got ${typeOf(noteRaw)}`,
    );
  }
  return {
    risk_category: rcRaw as RiskCategory,
    contribution,
    note: noteRaw,
  };
}

function validateGenerationSource(
  path: string,
  v: unknown,
): Candidate["generation_source"] {
  const obj = assertObject(path, v, GENERATION_SOURCE_KEYS);

  // generator · literal pin · tamper check
  const genRaw = assertHasField(path, obj, "generator");
  if (genRaw !== CANDIDATE_GENERATOR_LITERAL) {
    throw new CandidateShapeError(
      `${path}.generator`,
      `expected literal "${CANDIDATE_GENERATOR_LITERAL}", got ${JSON.stringify(genRaw)}`,
    );
  }
  const generated_at = assertNonEmptyString(
    `${path}.generated_at`,
    assertHasField(path, obj, "generated_at"),
  );
  const generation_run_id = assertNonEmptyString(
    `${path}.generation_run_id`,
    assertHasField(path, obj, "generation_run_id"),
  );
  return {
    generator: CANDIDATE_GENERATOR_LITERAL,
    generated_at,
    generation_run_id,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Predicate wrapper
// ═════════════════════════════════════════════════════════════════════

/** Type-guard predicate · catches CandidateShapeError and returns a
 *  boolean. Prefer `validateCandidate` when the error path is needed. */
export function isCandidate(x: unknown): x is Candidate {
  try {
    validateCandidate(x);
    return true;
  } catch (err) {
    if (err instanceof CandidateShapeError) return false;
    throw err;
  }
}

// ═════════════════════════════════════════════════════════════════════
// §6 · JSONL parser · one Candidate per line · fail-closed per line
// ═════════════════════════════════════════════════════════════════════

/** Parse a JSONL text buffer into Candidates. Each non-empty line must
 *  be a single valid Candidate JSON object. Empty lines (including a
 *  trailing newline) are permitted. Any invalid line raises a
 *  CandidateShapeError whose `path` begins with `line <N>` to pinpoint
 *  the offending record. No candidate is returned if any line fails. */
export function parseCandidateJsonl(text: string): readonly Candidate[] {
  const lines = text.split("\n");
  const out: Candidate[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.length === 0) continue; // allow blank lines, including trailing
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new CandidateShapeError(
        `line ${i + 1}`,
        `invalid JSON · ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    try {
      out.push(validateCandidate(parsed));
    } catch (err) {
      if (err instanceof CandidateShapeError) {
        throw new CandidateShapeError(
          `line ${i + 1} ${err.path}`,
          err.message.replace(/^CandidateShapeError at [^:]+: /, ""),
        );
      }
      throw err;
    }
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════════
// §7 · Static invariants · module-level
// ═════════════════════════════════════════════════════════════════════
//
// Deliberately re-asserted at the bottom of this file for grep-ability:
//
// This module is PURE. It has NO runtime dependencies beyond the sealed
// type exports from `./generate-candidates`. It does NOT:
//   · open any network connection
//   · touch the filesystem
//   · run SQL
//   · instantiate a pg Client
//   · import pg, pg-executor, pg-fingerprint, or extract-candidates
//   · reference credentials, Supabase, or any resolver surface
//   · modify the sealed candidate generator (import is read-only)
//
// This file cannot be executed with `node candidate-validator.ts`; it
// exports functions but does not implement a module entry runner.
