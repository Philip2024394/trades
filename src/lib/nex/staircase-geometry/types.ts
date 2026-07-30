// NEX Staircase Geometry Module — type contracts.
//
// Master doc: docs/nex/staircase-geometry-module.md
//
// This file locks the interface every downstream consumer uses:
//   - Measurement Solver  (produces StaircaseGeometry from MeasurementInput)
//   - Compliance validator (produces ComplianceReport from StaircaseGeometry)
//   - Manufacturing Module (produces cut lists, string metadata)
//   - Design Module        (produces appearance metadata)
//   - Renderer             (produces 3D + workshop drawings)
//   - Quoting engine       (produces price from geometry + design + manufacturing)
//   - Reference Brain chat (references geometry IDs when the user asks
//                           follow-up questions about a specific design)
//
// Design rules:
// - No logic in this file. Contracts only.
// - Every dimension carries its unit in the field name (`_mm`, `_deg`,
//   `_count`, `_ratio`). No branded types today — keeps friction low,
//   ADR-0041 discipline. Add branding only if a real bug proves the
//   need.
// - `readonly` on every field. Geometry records are immutable once
//   solved. Any change means solve again → new ID → new record.
// - Enums are string unions, not TS enum keyword. Same JSON both ways.
// - Every value that could vary MUST be typed, even when it "always"
//   looks the same, so the Solver can't silently forget a case.

// ─── Enums ────────────────────────────────────────────────────────

/** Staircase geometric layouts. Codes match the ID scheme:
 *   SF = straight_flight
 *   QT = quarter_turn (with landing or with winders — hand distinguishes)
 *   HT = half_turn
 *   WI = winder (double-winder or generic winding stair)
 *   SP = spiral
 *   CU = curved / helical
 *   AT = alternating_tread (loft-only, tightly regulated)
 */
export type StairLayout =
  | "straight_flight"
  | "quarter_turn_landing"
  | "quarter_turn_winder"
  | "half_turn_landing"
  | "half_turn_winder"
  | "double_winder"
  | "spiral"
  | "curved"
  | "alternating_tread";

/** Which way the stair turns when ascending (viewed from the bottom).
 *  Straight flights use "none" — hand is meaningless there. */
export type StairHand = "left" | "right" | "none";

/** How the tread + riser attach to the side beams.
 *  - housed: treads/risers set into routed grooves in solid strings (traditional joinery)
 *  - closed: same as housed but the string covers the sides fully — no visible step profile
 *  - open:   cut-string effect where step profile is exposed from the side
 *  - cut:    decorative cut-string with mitred riser returns
 *  Manufacturing Module owns full detail; this is the classification the geometry cares about. */
export type StringType = "housed" | "closed" | "open" | "cut";

/** Regulatory context — decides which compliance rules apply.
 *  Approved Doc K has separate figures for dwellings vs non-domestic. */
export type BuildingType =
  | "dwelling"       // private / domestic — most common
  | "non_domestic"   // offices, retail, etc.
  | "assembly"       // public buildings (schools, halls)
  | "loft_only";     // loft conversion — alternating-tread permitted with restrictions

/** Which country's / region's regulations apply. The solver reads
 *  the matching jurisdiction rules from
 *  `data/nex-staircase-geometry/jurisdictions.yaml` when validating
 *  a MeasurementInput. Added 2026-07-29 (Ireland regulation research). */
export type Jurisdiction =
  | "england"
  | "republic_of_ireland"
  // future — add only when a real project needs them:
  // | "scotland"
  // | "wales"
  // | "northern_ireland"
  ;

/** A single regulation-anchored value with its source citation.
 *  Every numeric limit the solver consumes MUST arrive as this shape,
 *  never as a bare number — Rule C (attributable origin). */
export interface RegulatedValue {
  readonly value: number;
  readonly source: "regulation" | "practical";
  readonly citation: string;
}

/** Flight-length rules — split between legal and best-practice.
 *  Philip 2026-07-29 clarification: England private allows 36
 *  consecutive risers legally (Approved Doc K), but domestic best
 *  practice is 16 before introducing a landing / turn. Ireland is
 *  stricter — 16 risers legal max. NEX should distinguish these
 *  so it can say "legally permissible but not typical practice"
 *  when a flight is between the two thresholds. */
export interface FlightRules {
  /** The regulated hard limit on consecutive risers in a single flight.
   *  Exceeding this = non_compliant. */
  readonly max_consecutive_risers: RegulatedValue;

  /** Design best-practice recommended maximum. Exceeding this does NOT
   *  fail compliance — it produces an advisory warning. Optional
   *  because some jurisdictions have no separate best-practice number. */
  readonly recommended_max_risers?: RegulatedValue;
}

/** The rules the solver applies for a specific (jurisdiction × building_type)
 *  pair. Loaded from `jurisdictions.yaml` at request time. */
export interface JurisdictionStaircaseRules {
  readonly rise_mm:    { readonly max: RegulatedValue; readonly min: RegulatedValue };
  readonly going_mm:   { readonly min: RegulatedValue; readonly max: RegulatedValue };
  readonly pitch_deg:  { readonly max: RegulatedValue };
  readonly headroom_mm:{ readonly min: RegulatedValue };
  readonly consistency: {
    readonly all_rises_equal:  boolean;
    readonly all_goings_equal: boolean;
    readonly source:  "regulation" | "practical";
    readonly citation: string;
  };
  /** Added 2026-07-29 (Patch 3) — flight-length rules. */
  readonly flight: FlightRules;
}

/** Qualitative bucket the solver assigns based on rise/going and pitch.
 *  Compact = space-saving, steeper. Grand = shallow, wide.
 *  Purely descriptive — never a filter. */
export type GeometryClass = "compact" | "comfortable" | "generous" | "grand";

/** Where a compliance requirement comes from. Every ComplianceCheck
 *  carries one so the answer can be defended. Never blur these. */
export type ComplianceSource =
  | "approved_document_k"     // England & Wales primary regulation
  | "bs_5395_2"               // BS 5395-2 (private stairs)
  | "bs_6180"                 // BS 6180 (barrier / balustrade loading)
  | "bwf_stair_scheme"        // BWF industry guidance
  | "workshop_practice";      // Received wisdom — informational only, never a fail

/** Severity of a single compliance finding. */
export type ComplianceSeverity = "error" | "warning" | "info";

/** Overall verdict for a solved geometry. */
export type ComplianceVerdict = "compliant" | "non_compliant" | "needs_review";

// ─── Measurement Input ────────────────────────────────────────────
//
// Everything a surveyor / architect / customer might supply. Fields
// are optional where the solver can derive a default or offer choices.
// Required fields are the ones the solver cannot proceed without —
// missing them produces a SolveResult with `ok: false` and a clear
// list of what's needed and why.

export interface MeasurementInput {
  /** Total finished floor to finished floor height in millimetres.
   *  REQUIRED. Without it no rise/going combination can be derived. */
  readonly floor_to_floor_height_mm: number;

  /** Available horizontal run for the staircase — from the face of
   *  the top nosing to the face of the bottom nosing, along the floor.
   *  Required unless the solver is exploring free-form layouts. */
  readonly available_run_length_mm?: number;

  /** Available width for the staircase between walls (or between
   *  a wall and open space). */
  readonly available_width_mm?: number;

  /** Length of the ceiling opening (aperture) at the top of the flight,
   *  measured in the direction of travel. Governs headroom. */
  readonly ceiling_opening_length_mm?: number;

  /** Width of the ceiling opening at the top of the flight. */
  readonly ceiling_opening_width_mm?: number;

  /** Minimum clear vertical distance from any tread nosing to the
   *  ceiling above (or to the underside of a trimmer). */
  readonly headroom_available_mm?: number;

  /** Surveyor preference for going depth (per-tread depth in mm).
   *  If provided, the solver constrains around it. If omitted, the
   *  solver offers a range. */
  readonly preferred_going_mm?: number;

  /** Surveyor preference for rise height. Same semantics. */
  readonly preferred_rise_mm?: number;

  /** Which layout the user wants explored. Omit to have the solver
   *  return every valid layout for the space. */
  readonly preferred_layout?: StairLayout;

  /** Which way the stair should turn. Ignored for straight flights. */
  readonly preferred_hand?: StairHand;

  /** Regulatory context — decides which compliance rules apply.
   *  REQUIRED. A dwelling stair and a public-building stair have
   *  different constraints and the solver must not guess. */
  readonly building_type: BuildingType;

  /** Which country's / region's regulations apply. REQUIRED.
   *  Added 2026-07-29 (Ireland regulation research). The solver reads
   *  the matching rules from jurisdictions.yaml. Never assume "england"
   *  as a default — force the surveyor / caller to declare it. */
  readonly jurisdiction: Jurisdiction;

  /** Free-text notes from the surveyor — not used by the solver but
   *  carried through to manufacturing / customer conversation. */
  readonly notes?: string;
}

// ─── Solved Geometry — the single source of truth ────────────────
//
// A StaircaseGeometry is the output of the Measurement Solver and the
// input to every downstream module. It's a fully-specified engineering
// record. Every field is derived deterministically from the
// MeasurementInput — same input, same geometry, same ID.

export interface StaircaseGeometry {
  /** Deterministic hash of geometry inputs — e.g. "SF-014-L-900".
   *  See docs/nex/staircase-geometry-module.md § ID convention.
   *  Not a UUID. Same measurements → same ID → same downstream. */
  readonly id: string;

  /** Which solver version produced this record. Semver of the solver
   *  package. Changes when the calculation contract changes so old
   *  records can be recognised and re-solved if needed. */
  readonly solver_version: string;

  /** Foreign key back to the MeasurementInput this was solved from.
   *  Enables full traceability — every downstream artefact can be
   *  traced back through geometry → measurement → surveyor / drawing. */
  readonly measurement_input_id: string;

  // ─── Layout ─────────────────────────────────────────────────────
  readonly layout: StairLayout;
  readonly hand:   StairHand;
  readonly geometry_class: GeometryClass;

  // ─── Counts ─────────────────────────────────────────────────────
  readonly risers_count: number;
  readonly treads_count: number;    // = risers_count - 1 for a single flight

  // ─── Primary dimensions (mm) ────────────────────────────────────
  readonly floor_height_mm: number;
  readonly rise_mm: number;
  readonly going_mm: number;
  readonly going_total_mm: number;  // sum of goings along the walking line
  readonly pitch_deg: number;
  readonly walking_line_length_mm: number;
  readonly headroom_mm: number;

  // ─── Widths (mm) ────────────────────────────────────────────────
  readonly overall_width_mm: number;   // outside face to outside face of strings
  readonly clear_width_mm: number;     // between strings (or between wall + string)

  // ─── Strings (mm) ───────────────────────────────────────────────
  readonly string_type: StringType;
  readonly left_string_thickness_mm:  number;
  readonly right_string_thickness_mm: number;
  readonly string_length_mm: number;   // developed length along the string

  // ─── Turn detail (only populated for non-straight layouts) ──────
  readonly landings?: readonly Landing[];
  readonly winders?:  readonly WinderSet[];

  // ─── Compliance summary ────────────────────────────────────────
  readonly compliance: ComplianceReport;

  // ─── Provenance ────────────────────────────────────────────────
  readonly solved_at: string;   // ISO 8601
  readonly notes?: string;      // solver-generated observations (never invented)
}

/** A landing between flights. Its own geometry with a link back to
 *  the parent StaircaseGeometry.id. */
export interface Landing {
  readonly index: number;                    // 0-based position in the ascent
  readonly at_riser_count: number;           // which riser precedes this landing
  readonly length_mm: number;                // along direction of travel
  readonly width_mm: number;                 // across the landing
  readonly height_from_floor_mm: number;     // top-of-landing above finished floor
  readonly quarter_or_half: "quarter" | "half";
}

/** A set of winder treads (kite winders, splayed treads) forming a turn. */
export interface WinderSet {
  readonly index: number;
  readonly at_riser_count: number;
  readonly count: number;                    // number of winder treads in this turn
  readonly total_turn_deg: number;           // usually 90 or 180
  readonly walking_line_offset_mm: number;   // distance from inside string
}

// ─── Compliance ───────────────────────────────────────────────────

export interface ComplianceReport {
  readonly verdict: ComplianceVerdict;
  readonly checks: readonly ComplianceCheck[];
  /** Human-readable summary — one line per check, useful for surveyors
   *  reading the report at the bottom of a workshop drawing. */
  readonly summary_lines: readonly string[];
}

export interface ComplianceCheck {
  /** Stable identifier for the rule so telemetry / test suites can
   *  reference it. e.g. "ADK_1.6_max_rise_dwelling". */
  readonly rule_id: string;

  /** Which authority the rule comes from. Never blur sources — the
   *  same numeric limit from a BS vs a BWF guide has different weight. */
  readonly source: ComplianceSource;

  /** Regulation clause / paragraph reference. Free-text; must be
   *  accurate. e.g. "Approved Document K paragraph 1.6".
   *  Empty string ONLY for workshop_practice checks. */
  readonly citation: string;

  /** Human-readable statement of what's being checked. */
  readonly description: string;

  /** The value the rule requires (formatted with unit). */
  readonly expected: string;

  /** The value the geometry actually produces (formatted with unit). */
  readonly actual: string;

  readonly passed: boolean;
  readonly severity: ComplianceSeverity;
}

// ─── Solver contract ──────────────────────────────────────────────

export interface SolveResult {
  /** true if at least one valid geometry was found. false when
   *  measurements are missing, the space is impossible, or every
   *  candidate layout failed compliance. */
  readonly ok: boolean;

  /** The recommended geometry — the solver's best-fit answer given
   *  the constraints. Only present when ok is true. */
  readonly primary_geometry?: StaircaseGeometry;

  /** Additional valid geometries for the same measurement input.
   *  Useful when the user hasn't decided on layout or width and wants
   *  to compare. Ordered by geometry_class (comfortable > grand > compact
   *  when not user-constrained). */
  readonly alternatives: readonly StaircaseGeometry[];

  /** When ok is false: named measurements the solver needs before it
   *  can proceed. e.g. ["ceiling_opening_length_mm", "headroom_available_mm"] */
  readonly missing_measurements: readonly string[];

  /** Human-readable explanations of the derivation chain. One line
   *  per derived value. e.g. "Rise 200mm ÷ 14 risers = 200mm each
   *  (Approved Doc K max 220mm dwelling)." */
  readonly solver_notes: readonly string[];

  /** Non-fatal issues surveyors should know about — awkward
   *  proportions, tight compliance margins, unusual constraints. */
  readonly warnings: readonly string[];
}

// ─── Deferred (not in Patch 0) ────────────────────────────────────
//
// Manufacturing metadata (top_tread treatment, cut lists, wedges,
// assembly sequence) lives in `src/lib/nex/staircase-manufacturing/types.ts`
// and is built once the geometry solver has been used at least once
// end-to-end. Same for Design (appearance) and Renderer contracts.
// Building them speculatively now would violate ADR-0041.
