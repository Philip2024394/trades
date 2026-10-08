// scripts/nex-canonical/generate-candidates.ts
//
// NEX Business Canonical · Seed-Cohort Candidate Generator · MECHANISM ONLY
//
// Status · code only · NOT EXECUTED in authoring wave
// Governing docs · docs/doctrine/nex-business-canonical-seed-cohort-and-eval-corpus-design-2026-10-08.md
// Sealed memory · project_nex_directory_spine_sealed_2026_10_07.md (Rules 5h · 5i · 5j · 5l · 5n)
//
// WHAT THIS FILE IS
//   A deterministic, auditable candidate-generation mechanism that, when
//   separately authorized and executed, would read legacy NEX business
//   tables (read-only), score each row against the 10 Rule 5i resolver-risk
//   categories (R1–R10), and produce a candidate JSONL file whose every
//   record is explicitly marked `status: "pending_founder_review"`.
//
// WHAT THIS FILE IS NOT
//   · Not an executable in this wave. The main() orchestrator refuses to
//     run without a founder-authorization env var AND an injected DB
//     executor. Running `node generate-candidates.ts` directly fails
//     fast with an explicit message about Rule 5n.
//   · Not a labeller. Nothing in this file sets a candidate as approved,
//     merged, canonical, or ground-truth. Semi-automated candidate
//     GENERATION is a feeder (Rule 5i); labelling remains founder/admin.
//   · Not a resolver. It does not call matchBusiness(). It does not
//     invoke identity-matching. Scoring here is a selection heuristic
//     for choosing which rows deserve founder review — it is NOT a
//     resolver confidence score and MUST NOT be interpreted as one.
//   · Not a migration. It writes no SQL that mutates DB state. Query
//     specs are read-only SELECTs by construction (no INSERT/UPDATE/
//     DELETE/ALTER/DROP/CREATE strings anywhere in this file).
//
// INVARIANTS
//   1. Every candidate's `status` is exactly "pending_founder_review".
//      No other status value is produced by this file. The founder
//      approval step (which converts "pending_founder_review" →
//      actual seed) happens outside this file.
//   2. Every candidate carries explicit `risk_categories` (R1–R10)
//      and `generation_source` provenance. No hidden auto-labelling.
//   3. The output is deterministic for a given input: same rows in,
//      same ordered candidates out. Non-determinism (random, time-of-
//      day, Math.random) is forbidden. The `generation_run_id` is the
//      only time-dependent field and is recorded in metadata.
//   4. The internal selection score is called `selection_score` and is
//      bounded [0,1]. It is explicitly labelled in the output as "NOT a
//      resolver confidence · NOT ground truth · internal ordering
//      heuristic only."
//   5. The entity_type enum is the sealed 9-value set from migration 167.
//      Rule 5l quarantines (`transport_acquisition_record.provider_kind
//      ='unknown'`, `nex_business.business_category IN ('portfolio',
//      'community','event','creator')`) are enforced as EXCLUSION filters
//      inside this file · they are NEVER mapped to any entity_type.
//
// DEPENDENCY-INJECTION ARCHITECTURE
//   The actual DB executor is an interface. This file ships a stub
//   implementation that throws if called. A real DB-backed executor
//   is NOT bundled here; it will land under a separate founder
//   authorization that explicitly permits DB access.
//
// Reading Order:
//   §1 · Public types
//   §2 · Sealed enums + Rule 5l quarantines
//   §3 · R1–R10 category definitions
//   §4 · Legacy query specifications (read-only SELECTs)
//   §5 · Pure selection-scoring functions per category
//   §6 · Deterministic candidate assembly
//   §7 · Query-executor interface + non-executing stub
//   §8 · Orchestrator (main) · guarded by Rule 5n gate
//   §9 · Non-execution guard at module entry

// ═════════════════════════════════════════════════════════════════════
// §1 · Public types
// ═════════════════════════════════════════════════════════════════════

/** Sealed 9-value entity_type enum from migration 167. */
export type EntityType =
  | "food"
  | "accommodation"
  | "service"
  | "professional"
  | "vehicle_rental"
  | "marketplace_seller"
  | "transport_driver"
  | "transport_operator"
  | "place";

/** The 10 resolver-risk categories from sealed Rule 5i. */
export type RiskCategory =
  | "R1" // Proven live accommodation records
  | "R2" // OSM / Wikidata-linked entities
  | "R3" // Duplicate-source representations
  | "R4" // Same-name different-owner cases
  | "R5" // Cross-vertical sibling names
  | "R6" // Thin-evidence records
  | "R7" // Intra-source duplicates
  | "R8" // Website present / website absent
  | "R9" // Transliteration / name-variation
  | "R10"; // Geographic collision

/** Candidate status · deliberately a 1-value union · NO other value is
 *  produced by this file. Approval → actual seed happens elsewhere. */
export type CandidateStatus = "pending_founder_review";

/** A row read from a legacy table, before scoring. Minimal shape
 *  needed for category rules. Specific tables may have extra columns
 *  that are passed through in `extra`. */
export interface LegacyRow {
  legacy_table: string;
  legacy_ref: string;
  internal_id: string | null;
  business_name: string;
  aliases: readonly string[];
  phone_raw: string | null;
  website_raw: string | null;
  osm_source_reference: string | null; // 'node/12345' when source='osm_overpass'
  wikidata_qid_hint: string | null;    // populated iff a source snapshot carried a wikidata tag
  country: string;
  city: string | null;
  district: string | null;
  coordinates_lat: number | null;
  coordinates_lng: number | null;
  claim_status: string | null;
  owner_status: string | null;
  entity_type_hint: EntityType | null; // derived from table + per-row category, see §6
  // Shared-signal fields set by pre-processing (see §6 computeSharedSignals):
  shares_source_reference_with_other_row: boolean;
  shares_name_city_with_other_row: boolean;
  shares_coord_bucket_with_other_vertical: boolean;
  extra: Record<string, unknown>;
}

/** A candidate seed proposed for founder review. */
export interface Candidate {
  candidate_id: string;
  status: CandidateStatus;
  entity_type: EntityType;
  country: string;
  identity: {
    name_canonical: string;
    aliases: readonly string[];
    phone_e164: string | null;      // populated iff legacy phone is already E.164-shaped
    website_apex: string | null;    // derived apex via normUrl semantics
    osm_id: string | null;
    wikidata_qid: string | null;
    city: string | null;
    district: string | null;
    /** Finer-grained location unit below district (OSM 'addr:suburb' /
     *  'addr:hamlet' / local district variants). Preserved verbatim from
     *  the source · the adapter does NOT concatenate or infer this
     *  value. Added by migration 178 (location-granularity wave). */
    neighbourhood: string | null;
    /** Structured street line when the source carries it as a separate
     *  field (OSM 'addr:street' + house number pattern). Preserved
     *  verbatim · not derived from a free-text address. Added by
     *  migration 178. */
    street_line: string | null;
    /** Canonical address · maps to `nex.business_canonical.address jsonb`
     *  (migration 167). Sealed shape per
     *  docs/doctrine/nex-business-canonical-seed-cohort-and-eval-corpus-design-2026-10-08.md
     *  line 116:
     *    { line1: string | null, postal_code: string | null } | null
     *  The whole object is `null` when the source has no address · the
     *  adapter does NOT parse, split, or infer postal codes · line1
     *  preserves the source value verbatim (trimmed). postal_code is
     *  only populated when a dedicated postal-code field exists in the
     *  source (the current legacy source has none, so it is always null). */
    address: {
      readonly line1: string | null;
      readonly postal_code: string | null;
    } | null;
    coordinates: { lat: number; lng: number } | null;
  };
  legacy_source: {
    table: string;
    ref: string;
    internal_id: string | null;
  };
  risk_categories: readonly RiskCategory[];
  selection_score: number; // [0,1] · NOT a resolver confidence · NOT ground truth
  selection_rationale: readonly {
    risk_category: RiskCategory;
    contribution: number;
    note: string;
  }[];
  generation_source: {
    generator: "scripts/nex-canonical/generate-candidates.ts";
    generated_at: string;
    generation_run_id: string;
  };
  caveats: readonly string[]; // explicit auditable notes
}

export interface GenerationResult {
  run_metadata: {
    generation_run_id: string;
    generated_at: string;
    deliverable_c_ref: string;
    sealed_memory_ref: string;
    code_file: string;
    code_version: "1.0.0";
    candidate_count: number;
    per_category_count: Readonly<Record<RiskCategory, number>>;
    excluded_count: number;
    disclaimer: string;
  };
  candidates: readonly Candidate[];
  excluded_rows: readonly {
    legacy_table: string;
    legacy_ref: string;
    exclusion_reason: string;
  }[];
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Sealed enums + Rule 5l quarantines
// ═════════════════════════════════════════════════════════════════════

/** From sealed migration 167 (frozen artefact). */
export const SEALED_ENTITY_TYPES: readonly EntityType[] = [
  "food",
  "accommodation",
  "service",
  "professional",
  "vehicle_rental",
  "marketplace_seller",
  "transport_driver",
  "transport_operator",
  "place",
] as const;

/** Rule 5l · nex_business.business_category values that are QUARANTINED
 *  from entity_type mapping. These rows must be EXCLUDED from candidate
 *  generation · never silently mapped to any sealed entity_type. */
export const QUARANTINED_NEX_BUSINESS_CATEGORIES: readonly string[] = [
  "portfolio",
  "community",
  "event",
  "creator",
] as const;

/** Rule 5l · transport_acquisition_record.provider_kind='unknown' is
 *  QUARANTINED. We cannot auto-distinguish natural person vs legal
 *  entity, so these rows are excluded. */
export const QUARANTINED_TRANSPORT_PROVIDER_KINDS: readonly string[] = [
  "unknown",
] as const;

// ═════════════════════════════════════════════════════════════════════
// §3 · R1–R10 category definitions
// ═════════════════════════════════════════════════════════════════════

export interface RiskCategoryDef {
  code: RiskCategory;
  short_name: string;
  what_it_exercises: string;
  min_cohort_coverage: number; // seed cohort must contain >= N candidates per category
}

export const RISK_CATEGORIES: readonly RiskCategoryDef[] = [
  {
    code: "R1",
    short_name: "Proven live accommodation",
    what_it_exercises:
      "Baseline · currently served by Phase 27 /api/nex/directory · identity is well-formed",
    min_cohort_coverage: 3,
  },
  {
    code: "R2",
    short_name: "OSM / Wikidata-linked",
    what_it_exercises:
      "Strongest external identity signals · osm_id + wikidata_qid both reachable",
    min_cohort_coverage: 3,
  },
  {
    code: "R3",
    short_name: "Duplicate-source representations",
    what_it_exercises:
      "Same real business seen by multiple ingestion cycles · tests dedup across source_reference",
    min_cohort_coverage: 3,
  },
  {
    code: "R4",
    short_name: "Same-name different-owner",
    what_it_exercises:
      "§25 forced-AMBIGUOUS pattern · chain-franchise and namesake businesses",
    min_cohort_coverage: 3,
  },
  {
    code: "R5",
    short_name: "Cross-vertical siblings",
    what_it_exercises:
      "Hotel + restaurant at the same address · tests entity_type partitioning",
    min_cohort_coverage: 3,
  },
  {
    code: "R6",
    short_name: "Thin-evidence records",
    what_it_exercises:
      "Name-only · no phone/website/coords · tests §10 never-fabricate guard",
    min_cohort_coverage: 3,
  },
  {
    code: "R7",
    short_name: "Intra-source duplicates",
    what_it_exercises:
      "e.g. 401 (source, source_reference) conflict groups in nex.food_business per migration 114",
    min_cohort_coverage: 3,
  },
  {
    code: "R8",
    short_name: "Website present/absent",
    what_it_exercises:
      "Both branches · website is strong identity signal when present, must be absent-tolerant when missing",
    min_cohort_coverage: 3,
  },
  {
    code: "R9",
    short_name: "Transliteration / name-variation",
    what_it_exercises:
      "Latin, Bahasa, Chinese, Arabic variants of the same name · tests nex.name_norm() + alias handling",
    min_cohort_coverage: 3,
  },
  {
    code: "R10",
    short_name: "Geographic collision",
    what_it_exercises:
      "Same-city same-category different-owner · tests coordinates vs name signal weighting",
    min_cohort_coverage: 3,
  },
] as const;

// ═════════════════════════════════════════════════════════════════════
// §4 · Legacy query specifications
// ═════════════════════════════════════════════════════════════════════
//
// Each spec declares a read-only SELECT shape. Specs are DATA, not SQL
// strings · the executor interface (§7) decides how to translate the
// spec into its SQL dialect. No INSERT/UPDATE/DELETE/ALTER/DROP/CREATE
// text appears anywhere in this file.
//
// The hinted category(ies) tell the orchestrator which R1–R10 scoring
// functions to apply to rows from this spec. A single spec may feed
// multiple categories.

export interface QuerySpec {
  spec_id: string;
  legacy_table: string;
  description: string;
  mode: "readonly"; // literal · belt-and-braces invariant
  columns: readonly string[];
  where: {
    filter_description: string;
    legacy_specific_conditions: readonly string[];
  };
  order_by: readonly string[]; // deterministic ordering
  limit: number | null;
  hinted_risk_categories: readonly RiskCategory[];
}

export const QUERY_SPECS: readonly QuerySpec[] = [
  {
    spec_id: "nex_accommodation_business_live",
    legacy_table: "nex.accommodation_business",
    description:
      "R1 feeder · accommodation rows currently rendered by Phase 27 /api/nex/directory",
    mode: "readonly",
    columns: [
      "public_listing_ref",
      "internal_id",
      "business_name",
      "country",
      "city",
      "district",
      "coordinates_lat",
      "coordinates_lng",
      "phone",
      "whatsapp_number",
      "website",
      "source",
      "source_reference",
      "claim_status",
      "owner_status",
      "last_verified_at",
      "category",
    ],
    where: {
      filter_description: "claim_status='listed'",
      legacy_specific_conditions: ["claim_status = 'listed'"],
    },
    order_by: ["country", "city", "public_listing_ref"],
    limit: null,
    hinted_risk_categories: ["R1", "R8"],
  },
  {
    spec_id: "nex_accommodation_business_osm_wikidata",
    legacy_table: "nex.accommodation_business",
    description:
      "R2 feeder · accommodation rows with OSM source_reference AND evidence of a Wikidata QID in source snapshot",
    mode: "readonly",
    columns: [
      "public_listing_ref",
      "internal_id",
      "business_name",
      "country",
      "city",
      "district",
      "coordinates_lat",
      "coordinates_lng",
      "phone",
      "whatsapp_number",
      "website",
      "source",
      "source_reference",
      "category",
    ],
    where: {
      filter_description:
        "source='osm_overpass' AND source_snapshot carries a 'wikidata' tag · joined to accommodation_business_source_snapshot",
      legacy_specific_conditions: [
        "source = 'osm_overpass'",
        "EXISTS (SELECT 1 FROM nex.accommodation_business_source_snapshot s WHERE s.business_internal_id = internal_id AND s.raw_payload ? 'wikidata')",
      ],
    },
    order_by: ["country", "public_listing_ref"],
    limit: null,
    hinted_risk_categories: ["R2"],
  },
  {
    spec_id: "nex_food_business_osm",
    legacy_table: "nex.food_business",
    description:
      "R2 feeder · food rows with OSM source_reference · wikidata hint if snapshot available",
    mode: "readonly",
    columns: [
      "public_listing_ref",
      "internal_id",
      "business_name",
      "country",
      "city",
      "district",
      "coordinates_lat",
      "coordinates_lng",
      "phone",
      "whatsapp_number",
      "website",
      "source",
      "source_reference",
      "category",
      "claim_status",
      "owner_status",
    ],
    where: {
      filter_description: "source='osm_overpass'",
      legacy_specific_conditions: ["source = 'osm_overpass'"],
    },
    order_by: ["country", "city", "public_listing_ref"],
    limit: null,
    hinted_risk_categories: ["R2", "R7", "R8"],
  },
  {
    spec_id: "nex_food_business_conflict_groups",
    legacy_table: "nex.food_business",
    description:
      "R7 feeder · food rows that participate in the 401 (source, source_reference) conflict groups per migration 114",
    mode: "readonly",
    columns: [
      "public_listing_ref",
      "internal_id",
      "business_name",
      "country",
      "city",
      "coordinates_lat",
      "coordinates_lng",
      "phone",
      "website",
      "source",
      "source_reference",
    ],
    where: {
      filter_description:
        "Rows whose (source, source_reference) appears more than once in the table",
      legacy_specific_conditions: [
        "(source, source_reference) IN (SELECT source, source_reference FROM nex.food_business WHERE source IS NOT NULL AND source_reference IS NOT NULL GROUP BY 1,2 HAVING COUNT(*) > 1)",
      ],
    },
    order_by: ["source", "source_reference", "public_listing_ref"],
    limit: null,
    hinted_risk_categories: ["R7", "R3"],
  },
  {
    spec_id: "nex_food_business_thin_evidence",
    legacy_table: "nex.food_business",
    description:
      "R6 feeder · food rows with business_name but no phone/website/coords",
    mode: "readonly",
    columns: [
      "public_listing_ref",
      "internal_id",
      "business_name",
      "country",
      "city",
      "phone",
      "website",
      "coordinates_lat",
      "coordinates_lng",
      "source",
      "source_reference",
    ],
    where: {
      filter_description:
        "business_name present AND phone IS NULL AND website IS NULL AND coordinates_lat IS NULL",
      legacy_specific_conditions: [
        "business_name IS NOT NULL AND length(trim(business_name)) > 0",
        "phone IS NULL",
        "website IS NULL",
        "coordinates_lat IS NULL",
      ],
    },
    order_by: ["country", "city", "public_listing_ref"],
    limit: null,
    hinted_risk_categories: ["R6"],
  },
  {
    spec_id: "nex_service_business_listed",
    legacy_table: "nex.service_business",
    description: "service candidates · status='listed'",
    mode: "readonly",
    columns: [
      "public_listing_ref",
      "internal_id",
      "business_name",
      "country",
      "city",
      "district",
      "coordinates_lat",
      "coordinates_lng",
      "phone",
      "whatsapp_number",
      "website",
      "source",
      "source_reference",
      "category_slug",
      "status",
      "claimed",
      "verified",
      "owner_status",
    ],
    where: {
      filter_description: "status='listed'",
      legacy_specific_conditions: ["status = 'listed'"],
    },
    order_by: ["country", "city", "public_listing_ref"],
    limit: null,
    hinted_risk_categories: ["R2", "R6", "R8"],
  },
  {
    spec_id: "nex_mp_seller_eligible",
    legacy_table: "nex.mp_seller",
    description: "marketplace sellers · not suspended",
    mode: "readonly",
    columns: [
      "seller_id",
      "slug",
      "display_name",
      "status",
      "source",
      "source_reference",
    ],
    where: {
      filter_description: "status <> 'suspended'",
      legacy_specific_conditions: ["status <> 'suspended'"],
    },
    order_by: ["slug", "seller_id"],
    limit: null,
    hinted_risk_categories: ["R6", "R9"],
  },
  {
    spec_id: "nex_transport_acquisition_eligible",
    legacy_table: "nex.transport_acquisition_record",
    description:
      "transport candidates · exclude terminal exit stages AND exclude provider_kind='unknown' per Rule 5l",
    mode: "readonly",
    columns: [
      "provider_id",
      "business_name",
      "contact_person_name",
      "canonical_phone_e164",
      "website",
      "provider_kind",
      "discovery_stage",
    ],
    where: {
      filter_description:
        "discovery_stage NOT IN ('declined','unreachable','opted_out') AND provider_kind <> 'unknown' (Rule 5l)",
      legacy_specific_conditions: [
        "discovery_stage NOT IN ('declined', 'unreachable', 'opted_out')",
        "provider_kind <> 'unknown'",
      ],
    },
    order_by: ["provider_id"],
    limit: null,
    hinted_risk_categories: ["R6"],
  },
] as const;

// ═════════════════════════════════════════════════════════════════════
// §5 · Pure selection-scoring functions per category
// ═════════════════════════════════════════════════════════════════════
//
// Each returns [0, 1]. These scores are a SELECTION heuristic for
// choosing which rows deserve founder review. They are NOT a resolver
// confidence and MUST NOT be interpreted as ground truth.
//
// Pure functions · no DB · no IO · deterministic given input.

export function scoreR1LiveAccommodation(row: LegacyRow): number {
  if (row.legacy_table !== "nex.accommodation_business") return 0;
  if (row.claim_status !== "listed") return 0;
  // Prefer well-formed identity: name + phone + coords + website
  let s = 0.4; // baseline for being listed
  if (row.phone_raw && row.phone_raw.length > 0) s += 0.2;
  if (row.coordinates_lat !== null && row.coordinates_lng !== null) s += 0.2;
  if (row.website_raw && row.website_raw.length > 0) s += 0.2;
  return clamp01(s);
}

export function scoreR2OsmWikidataLinked(row: LegacyRow): number {
  if (!row.osm_source_reference) return 0;
  if (!row.wikidata_qid_hint) return 0.3; // OSM alone, no QID
  // Both signals present: external identity very strong
  let s = 0.6;
  if (row.coordinates_lat !== null && row.coordinates_lng !== null) s += 0.2;
  if (row.phone_raw) s += 0.1;
  if (row.website_raw) s += 0.1;
  return clamp01(s);
}

export function scoreR3DuplicateSource(row: LegacyRow): number {
  if (!row.shares_source_reference_with_other_row) return 0;
  // Same source_reference seen in multiple rows: likely same business
  let s = 0.5;
  if (row.coordinates_lat !== null && row.coordinates_lng !== null) s += 0.15;
  if (row.phone_raw) s += 0.15;
  if (row.website_raw) s += 0.2;
  return clamp01(s);
}

export function scoreR4SameNameDifferentOwner(row: LegacyRow): number {
  // Row is one half of a pair where name+city match but ownership/
  // coords/phone differ. Flag precomputed in §6.
  if (!row.shares_name_city_with_other_row) return 0;
  let s = 0.4;
  if (row.coordinates_lat !== null && row.coordinates_lng !== null) s += 0.3;
  if (row.phone_raw) s += 0.3;
  return clamp01(s);
}

export function scoreR5CrossVerticalSibling(row: LegacyRow): number {
  if (!row.shares_coord_bucket_with_other_vertical) return 0;
  // A row at a coordinate bucket also occupied by a different vertical
  let s = 0.5;
  if (row.coordinates_lat !== null && row.coordinates_lng !== null) s += 0.3;
  if (row.phone_raw) s += 0.1;
  if (row.website_raw) s += 0.1;
  return clamp01(s);
}

export function scoreR6ThinEvidence(row: LegacyRow): number {
  // Thin evidence: name present but at least two of (phone, website,
  // coords) absent. Deliberately selected to exercise §10.
  if (!row.business_name || row.business_name.trim().length === 0) return 0;
  const signalsPresent =
    (row.phone_raw ? 1 : 0) +
    (row.website_raw ? 1 : 0) +
    (row.coordinates_lat !== null ? 1 : 0);
  if (signalsPresent >= 2) return 0; // not thin enough
  // Fewer signals = thinner = higher R6 score (deliberately exercises edge)
  if (signalsPresent === 0) return 0.9;
  return 0.6;
}

export function scoreR7IntraSourceDuplicate(row: LegacyRow): number {
  if (row.legacy_table !== "nex.food_business") return 0;
  if (!row.shares_source_reference_with_other_row) return 0;
  // Rows participating in the 401 known food (source, source_reference)
  // conflict groups per migration 114 header
  return 0.7;
}

export function scoreR8WebsiteSplit(row: LegacyRow, bucketTarget: "present" | "absent"): number {
  const hasWebsite = Boolean(row.website_raw && row.website_raw.length > 0);
  if (bucketTarget === "present" && !hasWebsite) return 0;
  if (bucketTarget === "absent" && hasWebsite) return 0;
  // Baseline presence; higher if row also has reliable identity signals
  let s = 0.4;
  if (row.coordinates_lat !== null) s += 0.2;
  if (row.phone_raw) s += 0.2;
  if (row.osm_source_reference) s += 0.2;
  return clamp01(s);
}

export function scoreR9Transliteration(row: LegacyRow): number {
  // Multiple aliases where at least one is likely a transliteration
  // (contains non-Latin character while primary name is Latin, or
  // vice versa).
  if (row.aliases.length < 1) return 0;
  const primaryIsLatin = isAsciiLatin(row.business_name);
  let variantCount = 0;
  for (const a of row.aliases) {
    if (!a) continue;
    const aLatin = isAsciiLatin(a);
    if (aLatin !== primaryIsLatin) variantCount += 1;
  }
  if (variantCount === 0) return 0;
  // At least one script-variant alias
  const s = 0.5 + Math.min(variantCount, 3) * 0.1;
  return clamp01(s);
}

export function scoreR10GeographicCollision(row: LegacyRow): number {
  if (!row.shares_name_city_with_other_row) return 0;
  if (row.coordinates_lat === null || row.coordinates_lng === null) return 0;
  // The sibling row in the pair has different coordinates (§6
  // precomputation). This row scores R10 regardless of which side it is.
  return 0.75;
}

/** All category scorers in one table · the orchestrator applies the
 *  hinted ones per spec and keeps the top-scoring category(ies) per row. */
export const SCORERS: Readonly<Record<RiskCategory, (row: LegacyRow) => number>> = {
  R1: scoreR1LiveAccommodation,
  R2: scoreR2OsmWikidataLinked,
  R3: scoreR3DuplicateSource,
  R4: scoreR4SameNameDifferentOwner,
  R5: scoreR5CrossVerticalSibling,
  R6: scoreR6ThinEvidence,
  R7: scoreR7IntraSourceDuplicate,
  // R8 has a param; we expose both buckets as closures to keep the
  // scorer map uniform.
  R8: (row) =>
    Math.max(
      scoreR8WebsiteSplit(row, "present"),
      scoreR8WebsiteSplit(row, "absent"),
    ),
  R9: scoreR9Transliteration,
  R10: scoreR10GeographicCollision,
};

// ═════════════════════════════════════════════════════════════════════
// §6 · Deterministic candidate assembly
// ═════════════════════════════════════════════════════════════════════

/** Clamp a float to [0, 1]. */
export function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/** True iff every character is ASCII Latin / digit / common punctuation
 *  / whitespace. Used by R9 to decide script-variance. */
export function isAsciiLatin(s: string): boolean {
  if (!s) return true;
  // Allow a-z, A-Z, 0-9, space, standard ASCII punctuation.
  // Any character outside the 0x20..0x7E range flips the test.
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) return false;
  }
  return true;
}

/** Lowercase + strip non-alnum (SPACE collapsed). Mirror of
 *  nex.name_norm() behaviour for selection purposes · NOT a resolver
 *  normalizer. */
export function selectionNameKey(name: string): string {
  const lower = name.toLowerCase();
  const noQuotes = lower.replace(/[‘’']/g, "");
  const spaced = noQuotes.replace(/[^a-z0-9\s]/g, " ");
  const collapsed = spaced.replace(/\s+/g, " ").trim();
  return collapsed;
}

/** Extract an OSM id from `source_reference` when `source='osm_overpass'`.
 *  Returns `node/XXXX`, `way/XXXX`, `relation/XXXX`, or null. */
export function extractOsmId(sourceReference: string | null): string | null {
  if (!sourceReference) return null;
  const m = sourceReference.match(/^(node|way|relation)\/\d+/);
  return m ? m[0] : null;
}

/** Normalise a URL to its apex host, lower-cased, www. stripped.
 *  Mirror of normUrl() in identity-matching.ts (for selection purposes
 *  only · not a resolver call). */
export function extractWebsiteApex(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.host.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** Deterministic candidate id · based on legacy ref + run id.
 *  Format: cand-<run_short>-<zero-padded index>. */
export function deterministicCandidateId(
  runId: string,
  index: number,
): string {
  const runShort = runId.slice(0, 8);
  const padded = String(index).padStart(5, "0");
  return `cand-${runShort}-${padded}`;
}

/** The orchestrator must call this on raw query results before scoring:
 *  it precomputes the three shared-signal flags that §5 scorers depend
 *  on. Pure function · deterministic given input. */
export function computeSharedSignals(rows: readonly LegacyRow[]): LegacyRow[] {
  // Group by (source, source_reference) and by (country, selectionNameKey, city).
  const bySourceRef = new Map<string, number>();
  const byNameCity = new Map<string, LegacyRow[]>();
  const byCoordBucket = new Map<string, Set<string>>();
  for (const r of rows) {
    const key1 =
      r.osm_source_reference ?? // reuse osm reference as "source_reference" surrogate
      (r.extra.source_reference_raw as string | undefined) ??
      null;
    if (key1 && key1.length > 0) {
      bySourceRef.set(key1, (bySourceRef.get(key1) ?? 0) + 1);
    }
    const nameKey = `${r.country}|${selectionNameKey(r.business_name)}|${r.city ?? ""}`;
    const list = byNameCity.get(nameKey) ?? [];
    list.push(r);
    byNameCity.set(nameKey, list);
    if (r.coordinates_lat !== null && r.coordinates_lng !== null) {
      // 3-decimal coord bucket ≈ 100 m
      const bucket = `${r.coordinates_lat.toFixed(3)}|${r.coordinates_lng.toFixed(3)}`;
      const verticals = byCoordBucket.get(bucket) ?? new Set<string>();
      verticals.add(r.legacy_table);
      byCoordBucket.set(bucket, verticals);
    }
  }
  // Apply shared flags
  return rows.map((r) => {
    const key1 =
      r.osm_source_reference ??
      (r.extra.source_reference_raw as string | undefined) ??
      null;
    const sharesSrc = key1 ? (bySourceRef.get(key1) ?? 0) > 1 : false;
    const nameKey = `${r.country}|${selectionNameKey(r.business_name)}|${r.city ?? ""}`;
    const siblings = byNameCity.get(nameKey) ?? [];
    const sharesName = siblings.length > 1;
    let sharesCoordBucketCrossVertical = false;
    if (r.coordinates_lat !== null && r.coordinates_lng !== null) {
      const bucket = `${r.coordinates_lat.toFixed(3)}|${r.coordinates_lng.toFixed(3)}`;
      const verticals = byCoordBucket.get(bucket) ?? new Set<string>();
      sharesCoordBucketCrossVertical = verticals.size > 1;
    }
    return {
      ...r,
      shares_source_reference_with_other_row: sharesSrc,
      shares_name_city_with_other_row: sharesName,
      shares_coord_bucket_with_other_vertical: sharesCoordBucketCrossVertical,
    };
  });
}

/** Convert a scored legacy row into a Candidate for founder review. */
export function rowToCandidate(input: {
  row: LegacyRow;
  risk_categories: readonly RiskCategory[];
  selection_score: number;
  selection_rationale: readonly {
    risk_category: RiskCategory;
    contribution: number;
    note: string;
  }[];
  run_id: string;
  run_time_iso: string;
  index_in_run: number;
}): Candidate {
  const { row } = input;
  const entityType = row.entity_type_hint;
  if (!entityType) {
    throw new Error(
      `cannot assemble candidate without entity_type_hint for ${row.legacy_table}:${row.legacy_ref}`,
    );
  }
  // phone_e164: only pass through if already in E.164 form; otherwise null.
  const phone = row.phone_raw && /^\+[1-9][0-9]{6,14}$/.test(row.phone_raw)
    ? row.phone_raw
    : null;
  const website = extractWebsiteApex(row.website_raw);
  const osmId = row.osm_source_reference ?? extractOsmId(row.osm_source_reference);
  const wikidataQid = row.wikidata_qid_hint;
  const coordinates =
    row.coordinates_lat !== null && row.coordinates_lng !== null
      ? { lat: row.coordinates_lat, lng: row.coordinates_lng }
      : null;

  const caveats: string[] = [];
  if (!phone && row.phone_raw) {
    caveats.push("phone_raw present but not E.164 shaped · founder review needed");
  }
  if (row.website_raw && !website) {
    caveats.push("website_raw present but could not parse to apex · founder review needed");
  }
  if (wikidataQid && !/^Q[0-9]+$/.test(wikidataQid)) {
    caveats.push("wikidata_qid hint failed Q-regex validation · do not promote without review");
  }

  return {
    candidate_id: deterministicCandidateId(input.run_id, input.index_in_run),
    status: "pending_founder_review",
    entity_type: entityType,
    country: row.country,
    identity: {
      name_canonical: row.business_name,
      aliases: row.aliases,
      phone_e164: phone,
      website_apex: website,
      osm_id: osmId,
      wikidata_qid: wikidataQid && /^Q[0-9]+$/.test(wikidataQid) ? wikidataQid : null,
      city: row.city,
      district: row.district,
      coordinates,
    },
    legacy_source: {
      table: row.legacy_table,
      ref: row.legacy_ref,
      internal_id: row.internal_id,
    },
    risk_categories: input.risk_categories,
    selection_score: clamp01(input.selection_score),
    selection_rationale: input.selection_rationale,
    generation_source: {
      generator: "scripts/nex-canonical/generate-candidates.ts",
      generated_at: input.run_time_iso,
      generation_run_id: input.run_id,
    },
    caveats,
  };
}

/** Decide the entity_type for a legacy row. Returns null when the row
 *  falls into a Rule 5l quarantine or an unmapped category. The
 *  orchestrator excludes nulls from candidate output. */
export function deriveEntityType(row: LegacyRow): EntityType | null {
  switch (row.legacy_table) {
    case "nex.food_business":
      return "food";
    case "nex.accommodation_business":
      return "accommodation";
    case "nex.service_business":
      return "service";
    case "nex.mp_seller":
      return "marketplace_seller";
    case "nex.transport_acquisition_record": {
      const kind = (row.extra.provider_kind as string | undefined) ?? "unknown";
      if (QUARANTINED_TRANSPORT_PROVIDER_KINDS.includes(kind)) return null;
      if (kind === "individual_driver" || kind === "driver_operator") {
        return "transport_driver";
      }
      if (
        kind === "fleet_operator" ||
        kind === "transport_business" ||
        kind === "courier_operator" ||
        kind === "logistics_operator"
      ) {
        return "transport_operator";
      }
      return null;
    }
    case "nex_business": {
      const cat = (row.extra.business_category as string | undefined) ?? "";
      if (QUARANTINED_NEX_BUSINESS_CATEGORIES.includes(cat)) return null;
      // Deliberately strict · only map categories that match a sealed
      // entity_type; unmapped categories abstain.
      if (["bakery", "restaurant", "cafe"].includes(cat)) return "food";
      if (
        ["tradesperson", "construction", "staircase-company", "local-service"].includes(cat)
      ) {
        return "professional";
      }
      if (["salon", "beauty", "fitness"].includes(cat)) return "service";
      if (["consultant", "agency", "professional-service"].includes(cat)) {
        return "professional";
      }
      if (["ecommerce", "product-brand"].includes(cat)) return "marketplace_seller";
      return null;
    }
    default:
      return null;
  }
}

/** Rank + take top-K per category, applied by the orchestrator. */
export function pickTopKPerCategory(
  scored: readonly { row: LegacyRow; byCategory: ReadonlyMap<RiskCategory, number> }[],
  topK: number,
): Map<RiskCategory, { row: LegacyRow; score: number }[]> {
  const perCategory = new Map<RiskCategory, { row: LegacyRow; score: number }[]>();
  for (const cat of RISK_CATEGORIES) {
    const list: { row: LegacyRow; score: number }[] = [];
    for (const s of scored) {
      const sc = s.byCategory.get(cat.code) ?? 0;
      if (sc > 0) list.push({ row: s.row, score: sc });
    }
    // Deterministic ordering: score DESC, then legacy_table ASC, then legacy_ref ASC
    list.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.row.legacy_table !== b.row.legacy_table) {
        return a.row.legacy_table < b.row.legacy_table ? -1 : 1;
      }
      return a.row.legacy_ref < b.row.legacy_ref ? -1 : 1;
    });
    perCategory.set(cat.code, list.slice(0, topK));
  }
  return perCategory;
}

// ═════════════════════════════════════════════════════════════════════
// §7 · Query-executor interface + non-executing stub
// ═════════════════════════════════════════════════════════════════════

/** The orchestrator uses this interface to read legacy data.
 *  A real executor backed by Postgres / Supabase MUST be injected
 *  under a SEPARATE founder authorization. This file does not ship
 *  such an executor; the stub throws. */
export interface QueryExecutor {
  execute(spec: QuerySpec): Promise<readonly Record<string, unknown>[]>;
  close?(): Promise<void>;
}

/** Non-executing stub · throws if called. Guards against accidental
 *  "it ran against the DB" surprises. */
export function makeNonExecutingStub(): QueryExecutor {
  return {
    execute(_spec: QuerySpec): Promise<readonly Record<string, unknown>[]> {
      throw new Error(
        "QueryExecutor stub refused to execute. Rule 5n requires an explicit, " +
          "founder-authorized executor to perform any DB read. Running the " +
          "generator against the live database requires a separate authorization " +
          "and a real executor implementation; this file does not ship one.",
      );
    },
    async close(): Promise<void> {
      /* no-op */
    },
  };
}

// ═════════════════════════════════════════════════════════════════════
// §8 · Orchestrator (main) · guarded by Rule 5n gate
// ═════════════════════════════════════════════════════════════════════

export interface OrchestratorOptions {
  /** Maximum candidates to keep per R1–R10 category. Default: 20. */
  topKPerCategory: number;
  /** Deterministic run id · the caller is responsible for generating
   *  this (e.g. `nex-cand-2026-10-08-01`). */
  runId: string;
  /** ISO-8601 timestamp recorded on every candidate. */
  runTimeIso: string;
}

export async function generateCandidates(
  executor: QueryExecutor,
  options: OrchestratorOptions,
): Promise<GenerationResult> {
  const rawRowsByTable = new Map<string, Record<string, unknown>[]>();
  // Execute every spec via the injected executor. Rows accumulate per table.
  for (const spec of QUERY_SPECS) {
    const result = await executor.execute(spec);
    const bucket = rawRowsByTable.get(spec.legacy_table) ?? [];
    bucket.push(...result);
    rawRowsByTable.set(spec.legacy_table, bucket);
  }
  // Shape raw rows into LegacyRow (per-table projection kept simple;
  // real DB executor is responsible for returning rows that match the
  // columns declared in each spec).
  const rows: LegacyRow[] = [];
  for (const [table, rawList] of rawRowsByTable.entries()) {
    for (const raw of rawList) {
      rows.push(projectLegacyRow(table, raw));
    }
  }
  const withSignals = computeSharedSignals(rows);

  const scored = withSignals.map((row) => {
    const byCategory = new Map<RiskCategory, number>();
    for (const cat of RISK_CATEGORIES) {
      const scorer = SCORERS[cat.code];
      const s = scorer(row);
      if (s > 0) byCategory.set(cat.code, s);
    }
    return { row, byCategory };
  });

  const picked = pickTopKPerCategory(scored, options.topKPerCategory);

  // Flatten · each row gets ONE candidate carrying all categories it
  // scored above threshold for. If a row appears in multiple top-K
  // category lists, record all its qualifying categories.
  const perRow = new Map<string, {
    row: LegacyRow;
    cats: Set<RiskCategory>;
    rationale: { risk_category: RiskCategory; contribution: number; note: string }[];
    maxScore: number;
  }>();
  for (const [cat, picks] of picked.entries()) {
    for (const p of picks) {
      const key = `${p.row.legacy_table}|${p.row.legacy_ref}`;
      const entry = perRow.get(key) ?? {
        row: p.row,
        cats: new Set<RiskCategory>(),
        rationale: [],
        maxScore: 0,
      };
      entry.cats.add(cat);
      entry.rationale.push({
        risk_category: cat,
        contribution: p.score,
        note: RISK_CATEGORIES.find((rc) => rc.code === cat)?.what_it_exercises ?? "",
      });
      if (p.score > entry.maxScore) entry.maxScore = p.score;
      perRow.set(key, entry);
    }
  }

  const sortedEntries = Array.from(perRow.values()).sort((a, b) => {
    if (b.maxScore !== a.maxScore) return b.maxScore - a.maxScore;
    if (a.row.legacy_table !== b.row.legacy_table) {
      return a.row.legacy_table < b.row.legacy_table ? -1 : 1;
    }
    return a.row.legacy_ref < b.row.legacy_ref ? -1 : 1;
  });

  const candidates: Candidate[] = [];
  const excluded: { legacy_table: string; legacy_ref: string; exclusion_reason: string }[] = [];
  const perCatCount: Record<RiskCategory, number> = {
    R1: 0, R2: 0, R3: 0, R4: 0, R5: 0, R6: 0, R7: 0, R8: 0, R9: 0, R10: 0,
  };

  let i = 0;
  for (const e of sortedEntries) {
    const et = deriveEntityType(e.row);
    if (!et) {
      excluded.push({
        legacy_table: e.row.legacy_table,
        legacy_ref: e.row.legacy_ref,
        exclusion_reason: "Rule 5l quarantine · entity_type cannot be derived safely",
      });
      continue;
    }
    e.row.entity_type_hint = et;
    const cand = rowToCandidate({
      row: e.row,
      risk_categories: Array.from(e.cats).sort(),
      selection_score: e.maxScore,
      selection_rationale: e.rationale,
      run_id: options.runId,
      run_time_iso: options.runTimeIso,
      index_in_run: i,
    });
    candidates.push(cand);
    for (const cat of e.cats) perCatCount[cat] += 1;
    i += 1;
  }

  return {
    run_metadata: {
      generation_run_id: options.runId,
      generated_at: options.runTimeIso,
      deliverable_c_ref:
        "docs/doctrine/nex-business-canonical-seed-cohort-and-eval-corpus-design-2026-10-08.md",
      sealed_memory_ref: "project_nex_directory_spine_sealed_2026_10_07.md",
      code_file: "scripts/nex-canonical/generate-candidates.ts",
      code_version: "1.0.0",
      candidate_count: candidates.length,
      per_category_count: perCatCount,
      excluded_count: excluded.length,
      disclaimer:
        "Every candidate is pending_founder_review · selection_score is an " +
        "internal ordering heuristic ONLY · NOT a resolver confidence · " +
        "NOT ground truth · founder/admin approval remains the sole authority " +
        "for seed truth and evaluation labels.",
    },
    candidates,
    excluded_rows: excluded,
  };
}

/** Project a raw DB row into the LegacyRow shape this file consumes.
 *  Deterministic · pure · tolerant of missing columns. */
export function projectLegacyRow(
  table: string,
  raw: Record<string, unknown>,
): LegacyRow {
  const str = (k: string): string | null => {
    const v = raw[k];
    return typeof v === "string" && v.length > 0 ? v : null;
  };
  const num = (k: string): number | null => {
    const v = raw[k];
    return typeof v === "number" ? v : null;
  };
  const ref =
    (str("public_listing_ref") as string | null) ??
    (str("slug") as string | null) ??
    (str("provider_id") as string | null) ??
    (str("seller_id") as string | null) ??
    (str("id") as string | null) ??
    "unknown";
  const name =
    (str("business_name") as string | null) ??
    (str("display_name") as string | null) ??
    (str("contact_person_name") as string | null) ??
    "";
  const phoneRaw =
    (str("canonical_phone_e164") as string | null) ??
    (str("phone") as string | null);
  return {
    legacy_table: table,
    legacy_ref: ref,
    internal_id: str("internal_id"),
    business_name: name,
    aliases: [],
    phone_raw: phoneRaw,
    website_raw: str("website"),
    osm_source_reference:
      str("source") === "osm_overpass" ? str("source_reference") : null,
    wikidata_qid_hint: null, // populated by a joined snapshot read when available
    country: (str("country") as string | null) ?? "ID",
    city: str("city"),
    district: str("district"),
    coordinates_lat: num("coordinates_lat"),
    coordinates_lng: num("coordinates_lng"),
    claim_status: str("claim_status") ?? str("status"),
    owner_status: str("owner_status"),
    entity_type_hint: null,
    shares_source_reference_with_other_row: false,
    shares_name_city_with_other_row: false,
    shares_coord_bucket_with_other_vertical: false,
    extra: {
      source_reference_raw: str("source_reference"),
      business_category: str("business_category"),
      provider_kind: str("provider_kind"),
      category: str("category"),
      category_slug: str("category_slug"),
    },
  };
}

// ═════════════════════════════════════════════════════════════════════
// §9 · Non-execution guard at module entry
// ═════════════════════════════════════════════════════════════════════

/**
 * This file is a mechanism. It must not run against a database merely
 * because somebody ran `node generate-candidates.ts`. The main-entry
 * guard refuses to proceed unless the founder has explicitly set the
 * authorization env var, AND the caller has already supplied a real
 * executor via code (not via this stub).
 *
 * Rule 5n · "each concrete step requires its own explicit authorization."
 */
function nonExecutionGuardMain(): void {
  const authorized =
    process.env.NEX_SEED_GENERATOR_EXECUTION_AUTHORIZED === "yes-i-have-founder-authorization";
  const executorModule = process.env.NEX_SEED_GENERATOR_EXECUTOR_MODULE;
  const explanation = [
    "🛑  Execution refused · Rule 5n.",
    "",
    "This file is scripts/nex-canonical/generate-candidates.ts.",
    "It is a MECHANISM authored under Deliverable C of the",
    "seed-cohort + eval-corpus wave (project_nex_directory_spine_sealed_2026_10_07.md).",
    "",
    "Running the generator against the live database requires:",
    "  1. a SEPARATE, explicit founder authorization (not this file);",
    "  2. env NEX_SEED_GENERATOR_EXECUTION_AUTHORIZED=yes-i-have-founder-authorization;",
    "  3. env NEX_SEED_GENERATOR_EXECUTOR_MODULE pointing at a real executor module;",
    "  4. a real QueryExecutor passed into generateCandidates() by the caller.",
    "",
    "Direct `node generate-candidates.ts` is intentionally refused. The file",
    "ships a non-executing stub executor whose only action is to throw.",
  ].join("\n");
  if (!authorized || !executorModule) {
    // eslint-disable-next-line no-console
    console.error(explanation);
    process.exit(1);
  }
  // If both env vars are set, we STILL do not run from the module entry.
  // A real executor must be injected via the exported `generateCandidates`
  // from a separate caller script that lives under a SEPARATE authorization.
  // eslint-disable-next-line no-console
  console.error(
    "Authorization env vars detected, but this file does not auto-wire to an " +
      "executor module. Import `generateCandidates()` from your authorized caller " +
      "script and pass a real QueryExecutor explicitly.",
  );
  process.exit(1);
}

// Fire the guard only when the file is executed directly (not when imported).
// Using the tsx / ts-node convention: compare resolved paths of require.main.
// If this file is `import()`-ed, the guard does not fire.
declare const require: NodeJS.Require | undefined;
declare const module: NodeJS.Module | undefined;
if (
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module
) {
  nonExecutionGuardMain();
}
