// NEX · staircase design state (canonical).
//
// This is the NEX-level shape of a customer's in-progress staircase
// design. Duplicated intentionally from MT-1's
// `StaircaseDesign.tsx` for now — the fields MUST stay identical so
// chat writes (via NEX Brain) and wizard writes (via MT-1) target
// the same slots.
//
// Why not import from MT-1 directly:
//   1. Prevents pulling MT-1's React runtime into server-only paths.
//   2. Keeps NEX Brain decoupled from any specific master template.
//      Future MT-2, MT-3 will share this same design state; today it
//      lives inside MT-1 for historical reasons.
//   3. Post-extraction (per the Universal Engine doctrine 2026-08-18),
//      the authoritative state lives at
//      `src/lib/staircase-quotation-engine/state.ts` and both MT-1
//      and this NEX file re-export from there.
//
// KEEP IN SYNC with MT-1's StaircaseDesignState until the extraction
// unifies them. Any field added to one MUST be added to the other in
// the same commit.
//
// Doctrine references:
//   - constitution_nex_architecture_provider_independent_router_2026_08_20.md
//     (NEX Router · sub-systems layer)
//   - project_nex_quotation_engine_universal_engine_themed_per_company_2026_08_18.md
//     (Universal Engine · extraction target for this shape)
//   - project_nex_full_experience_phase_plan_2026_08_20.md
//     (Phase 1 · chat writes to this state via updateStaircaseDesign tool)

export type StaircaseDesignState = {
  /** ISO-ish country code (UK · IE · US · DE · IT · FR · etc). */
  country?: string;
  /** Building context (primary_home · secondary_home · loft_access ·
   *  basement_access · commercial · fire_escape · outdoor · industrial). */
  use?: string;
  /** Geometry slug (straight · quarter_turn · t_shape · half_turn ·
   *  winder · spiral · curved · double_sweep · space_saver · floating). */
  geometry?: string;
  /** Overall material family (timber · metal · glass · concrete ·
   *  stone · mixed_*). Distinct from `wood` (primary species). */
  materialFamily?: string;
  /** PRIMARY wood species slug for the whole staircase · e.g. "oak",
   *  "walnut". Default inherited by every wood component unless the
   *  customer opts to customize per-component. */
  wood?: string;
  /** Optional tread override slug · null = tread inherits `wood`. */
  treadWood?: string;
  /** Optional riser override slug · null = riser inherits `wood`. */
  riserWood?: string;
  /** Optional handrail override slug · null = handrail inherits `wood`. */
  handrailWood?: string;
  /** Finish slug (natural, stained, painted, ...). */
  finish?: string;
  /** Tread material slug (solid_timber · stone · glass · metal ·
   *  carpeted · carpet_runner). */
  tread?: string;
  /** Riser style slug (closed / open / partial · plus variants like
   *  closed_mdf_painted / open_arched / partial_chrome_bar / etc). */
  riser?: string;
  /** Structural support type (closed_string · cut_string ·
   *  cut_string_double · mono_stringer · cantilever · bolt_fixed ·
   *  open_riser). Historic name `string` for backwards compat. */
  string?: string;
  /** Newel style slug. */
  newel?: string;
  /** Handrail material slug. */
  handrail?: string;
  /** Handrail placement · left · right · both · not_sure. */
  handrailPosition?: string;
  /** Balustrade type slug (spindles · glass · cable · etc). */
  balustrade?: string;

  // ─── Project classification ────────────────────────────────
  propertyType?: string;
  buildStage?: string;
  replaceExisting?: string;
  openingReady?: string;
  customerType?: string;
  vatStatus?: string;
  installRequired?: string;
  supplyMarket?: string;
  exportCountry?: string;
  projectStage?: string;
  notes?: string;

  // ─── Reference images (from photo-reference shortcut,
  //      Vibe Studio, or customer uploads) ─────────────────────
  similarImages?: string[];

  // ─── Numeric measurements (Phase 1 · quotation adapter · 2026-08-20) ─
  // Optional numeric inputs the deterministic quotation engine needs to
  // derive tread/riser count, stringer length, handrail length, and Doc K
  // compliance checks. All optional and backward-compatible — pre-existing
  // consumers and persisted states remain valid without any migration.
  // Nothing writes these fields today from the wizard; NEX Brain will
  // populate them via the future updateStaircaseDesign tool as customers
  // volunteer measurements in chat. When absent, the adapter emits a
  // clear warning and returns quantities of 0 for dimensional lines.
  //
  // KEEP IN SYNC with MT-1's StaircaseDesignState — mirrored there in the
  // same commit per the extraction-in-progress rule (this file's header).

  /** Floor-to-floor height in millimetres. Distance from finished floor
   *  level of the lower storey to finished floor level of the upper
   *  storey. Drives riser count = ceil(floor_to_floor_mm / max_rise_mm). */
  floor_to_floor_mm?: number;
  /** Stairwell opening width in millimetres. Not the same as staircase
   *  width — this is the aperture in the upper floor the stairs pass
   *  through. Used for headroom checks and geometry constraints. */
  opening_width_mm?: number;
  /** Customer/company override for the going (horizontal tread depth) in
   *  millimetres. When absent the engine picks the compliant going from
   *  the 2R+G formula against the derived rise. When present, replaces
   *  the derived value (engine still validates against Doc K minimum). */
  going_mm_override?: number;
  /** Customer/company override for tread count. When absent the engine
   *  derives from floor_to_floor_mm ÷ max_rise. When present, replaces
   *  the derived value (rise_actual back-solved from floor_to_floor). */
  tread_count_override?: number;
  /** Customer/company override for handrail length in millimetres. When
   *  absent the engine derives from stringer_length (parallel to raked
   *  stringer) plus landing runs per geometry. When present, replaces
   *  the derived value entirely — useful for retrofits where handrail
   *  measurement is already taken. */
  handrail_length_mm_override?: number;
};

/** Empty state — starting point for a new customer session. */
export const EMPTY_DESIGN_STATE: StaircaseDesignState = {};
