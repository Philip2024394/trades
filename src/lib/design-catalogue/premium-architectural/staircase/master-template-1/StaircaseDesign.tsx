// NEX Master Template 1 · Staircase Design State (Philip 2026-08-17).
//
// STANDING · FOUNDATION.
//
// A single, extensible Context that carries the customer's in-progress
// staircase design across every MT-1 section. Introduced when the wood
// selector needed selected-state persistence — but built at the design
// level, not the wood level, so subsequent selectors (finish · tread ·
// riser · string · newel · handrail · balustrade) slot in without
// another architectural change.
//
// Architectural rules:
//   • ONE source of truth per customer session. Never duplicate state.
//   • Every field is optional · a fresh visitor's design is `{}`.
//   • Never persist to storage (yet). Session-scoped. Refresh clears.
//     Persistence lives here later — one flag, one localStorage call.
//   • Fields hold canonical SLUGS (e.g. "oak" not "European Oak") so a
//     comparison / matcher in a later section can key on them cleanly.
//     Human-readable copy lives in the wood/component data records, not
//     in this state.
//   • Provider throws if `useStaircaseDesign` is used outside its tree.
//
// Not related to `SectionActivation` (which controls which SECTIONS
// are mounted). This state is about the CONTENT of the customer's
// staircase; SectionActivation is about the page's structure.

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type StaircaseDesignState = {
  /** ISO-ish country code (UK · IE · US · DE · IT · FR · etc). Written
   *  by ST-W01 wizard Q1. Drives regional terminology + regulatory
   *  hand-off routing. See `@/lib/staircase-knowledge` for the
   *  authoritative country list. */
  country?: string;
  /** Building context (primary_home · secondary_home · loft_access ·
   *  basement_access · commercial · fire_escape · outdoor · industrial).
   *  Written by ST-W01 Q2. */
  use?: string;
  /** Geometry slug (straight · quarter_turn · t_shape · half_turn ·
   *  winder · spiral · curved · double_sweep · space_saver · floating).
   *  Written by ST-W01 Q3. */
  geometry?: string;
  /** Overall material family (timber · metal · glass · concrete ·
   *  stone · mixed_*). Distinct from `wood` which is the tread SPECIES.
   *  Written by ST-W01 Q4. */
  materialFamily?: string;
  /** PRIMARY wood species slug for the whole staircase · e.g. "oak",
   *  "walnut" (Philip 2026-08-20 · repurposed from tread-only to
   *  primary/default). Written by ST-W01 Q6a_riser_wood_species (the
   *  "Which timber for your staircase?" question) — this is the
   *  default species inherited by every wood component unless the
   *  customer opts to customize per-component at Q6b_wood_customize.
   *  Also written by ST-M01 wood cards for the design-catalogue
   *  detail flow. */
  wood?: string;
  /** Optional tread override slug · null = tread inherits `wood`
   *  (primary). Populated by ST-W01 Q7a_timber_species only when the
   *  customer opted to customize wood by component at Q6b. Downstream
   *  systems (summary, Submission, specialist handoff) resolve
   *  effective tread wood as `treadWood ?? wood`. */
  treadWood?: string;
  /** Optional riser override slug · null = riser inherits `wood`.
   *  Populated by ST-W01 Q6c_riser_wood_species_override only when
   *  the customer opted to customize at Q6b. Downstream effective
   *  riser wood = `riserWood ?? wood`. Historic note: this field was
   *  previously the ONLY riser-wood writer (from the earlier Q6a
   *  before Q6a was repurposed to primary). */
  riserWood?: string;
  /** Optional handrail override slug · null = handrail inherits `wood`.
   *  Populated by ST-W01 Q9a_handrail_wood_species only when the
   *  customer opted to customize at Q6b. Downstream effective
   *  handrail wood = `handrailWood ?? wood`. When missing entirely
   *  (customer chose non-wood handrail on Q9 material picker),
   *  read Q9's material choice instead. */
  handrailWood?: string;
  /** Finish slug (natural, stained, painted, ...). Written by ST-W01 Q12. */
  finish?: string;
  /** Tread material slug (solid_timber · stone · glass · metal ·
   *  carpeted · carpet_runner). Written by ST-W01 Q7. */
  tread?: string;
  /** Riser style slug. Four possible writers depending on Q5 selection:
   *  · `Q6_riser` (generic fallback for cut_string / mono_stringer /
   *    cantilever / bolt_fixed paths): closed · open · partial.
   *  · `Q6_riser_closed_string` (closed_string path only): closed ·
   *    closed_mdf_painted · closed_stainless_brushed · open_arched ·
   *    closed_short · partial_chrome_bar · open_glass.
   *  · `Q6_riser_open_riser` (open_riser path only): open ·
   *    partial_chrome_bar · closed_stainless_brushed · closed_mdf_painted.
   *  · `Q6_riser_cut_string_double` (cut_string_double path only):
   *    open · closed_mdf_painted.
   *  All four nodes write to this same field — downstream consumers
   *  see one canonical slug regardless of which node ran. Shared slugs
   *  across nodes (e.g. `open`, `closed_mdf_painted`) are intentional
   *  — same material choice = same canonical identity. */
  riser?: string;
  /** Structural support type (closed_string · cut_string · cut_string_double ·
   *  mono_stringer · cantilever · bolt_fixed · open_riser). Written by
   *  ST-W01 Q5. Historic name `string` retained for backwards compat
   *  with earlier planning. The `open_riser` slug is a design-style
   *  shortcut (not a stringer type) — customer commits to an airy
   *  open-riser aesthetic and specialist confirms the stringer type. */
  string?: string;
  /** Newel style slug. Written by ST-W01 Q10. */
  newel?: string;
  /** Handrail material slug. Written by ST-W01 Q9. */
  handrail?: string;
  /** Handrail placement · which side of the staircase the handrail
   *  runs down (right · left · both · not_sure). Written by ST-W01
   *  Q_handrail_position. Captures whether the staircase is against a
   *  wall (handrail on the opposite side) or freestanding (handrails
   *  on both sides). Philip 2026-08-18: real commercial signal for
   *  the specialist — "if they say left side or both we know". */
  handrailPosition?: string;
  /** Balustrade type slug (spindles / glass / cable / etc). Written by
   *  ST-W01 Q8. */
  balustrade?: string;

  // ─── Project classification (Philip 2026-08-18 · one-pass expansion).
  // These are not staircase-design fields — they're project/customer/
  // commercial context that helps the specialist qualify the enquiry.
  // Written exclusively by ST-W01 (Q_property_type … Q_notes).
  // Grouped in the summary snapshot under PROJECT / CUSTOMER / COMMERCIAL.

  /** Property type slug: new_build · existing · extension · conversion ·
   *  commercial · not_sure. Written by ST-W01 Q_property_type. */
  propertyType?: string;
  /** Build stage slug for new-build projects (planning · structural_underway
   *  · plastering_complete · finished_occupied · …). Written by
   *  ST-W01 Q_build_stage. Undefined when property is not a new build. */
  buildStage?: string;
  /** Existing-staircase status for existing / extension / conversion
   *  projects (yes_replace · no_keep · new_where_none · not_sure).
   *  Written by ST-W01 Q_replace_existing. Undefined for new-build /
   *  commercial / not-sure paths. */
  replaceExisting?: string;
  /** Staircase-opening readiness (yes_ready · still_being_constructed ·
   *  not_yet · not_sure). Written by ST-W01 Q_opening_ready. */
  openingReady?: string;
  /** Customer type slug (private · developer · contractor · architect ·
   *  other). Written by ST-W01 Q_customer_type. Drives whether the VAT
   *  question is asked. */
  customerType?: string;
  /** VAT registration status for trade customers (yes · no ·
   *  not_applicable). Written by ST-W01 Q_vat_status. Undefined when
   *  the customer is a private homeowner (question skipped). */
  vatStatus?: string;
  /** Installation requirement (supply_only · supply_and_install ·
   *  not_sure). Written by ST-W01 Q_install_required. */
  installRequired?: string;
  /** Supply market (local · export · not_sure). Written by ST-W01
   *  Q_supply_market. Distinct from `country` (installation country) ·
   *  the supply market says who the product is FOR, not where the
   *  customer lives. */
  supplyMarket?: string;
  /** Destination country for export projects. Same 19-country list as
   *  Q1_country plus OTHER. Written by ST-W01 Q_export_country. Undefined
   *  when supplyMarket is local / not_sure. */
  exportCountry?: string;
  /** Buying-journey stage (exploring · planning · ready_to_order ·
   *  construction_underway · required_soon · not_sure). Written by
   *  ST-W01 Q_project_stage. Philip 2026-08-18: "one of the core
   *  fields — tells the manufacturer WHERE the customer is in the
   *  buying journey, not just what they want." */
  projectStage?: string;
  /** Freeform customer notes captured at the end of the wizard.
   *  Optional · empty string when the customer skipped the textarea.
   *  Written by ST-W01 Q_notes. */
  notes?: string;
  /** Curated example image URLs the customer flagged as similar to
   *  their existing staircase (Philip 2026-08-18 · "My Staircase
   *  Similar" button in the InstalledExamplesOverlay enlarged view).
   *  Real signal for retrofit / replacement customers: "I don't know
   *  what type this is, but I want something like this". Written from
   *  any option's Examples lightbox · specialist sees the flagged
   *  URLs in the Submission alongside the customer's design choices. */
  similarImages?: string[];

  // ─── Numeric measurements (Phase 1 · quotation adapter · 2026-08-20) ─
  // Mirrored from the NEX-side StaircaseDesignState in the same commit
  // (see src/lib/nex/staircase/design-state.ts header · "KEEP IN SYNC"
  // rule until the universal-engine extraction unifies them). All fields
  // are optional and additive — MT-1 wizard does not write them today.
  // When present, the quotation adapter uses them for deterministic
  // geometry (riser count, going, stringer length, compliance checks).

  /** Floor-to-floor height in millimetres. */
  floor_to_floor_mm?: number;
  /** Stairwell opening width in millimetres. */
  opening_width_mm?: number;
  /** Customer/company override for the going (horizontal tread depth) in mm. */
  going_mm_override?: number;
  /** Customer/company override for tread count. */
  tread_count_override?: number;
  /** Customer/company override for handrail length in mm. */
  handrail_length_mm_override?: number;
};

type StaircaseDesignCtx = {
  design: StaircaseDesignState;
  /** Set a single field. Passing `undefined` clears it (same as
   *  `clear(key)`). */
  set: <K extends keyof StaircaseDesignState>(
    key: K,
    value: StaircaseDesignState[K],
  ) => void;
  /** Clear a single field. */
  clear: (key: keyof StaircaseDesignState) => void;
  /** Reset the whole design. */
  reset: () => void;
};

const Ctx = createContext<StaircaseDesignCtx | null>(null);

export function StaircaseDesignProvider({
  children,
  initial,
}: {
  children: ReactNode;
  /** Optional starting design — useful for deep-linked "start with Oak"
   *  scenarios (?wood=oak). Not wired yet · reserved. */
  initial?: StaircaseDesignState;
}) {
  const [design, setDesign] = useState<StaircaseDesignState>(initial ?? {});

  const set = useCallback(
    <K extends keyof StaircaseDesignState>(
      key: K,
      value: StaircaseDesignState[K],
    ) => {
      setDesign((prev) => {
        // Same-reference short-circuit prevents no-op re-renders.
        if (prev[key] === value) return prev;
        const next: StaircaseDesignState = { ...prev };
        if (value === undefined) delete next[key];
        else next[key] = value;
        return next;
      });
    },
    [],
  );

  const clear = useCallback((key: keyof StaircaseDesignState) => {
    setDesign((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const reset = useCallback(() => setDesign({}), []);

  const value = useMemo<StaircaseDesignCtx>(
    () => ({ design, set, clear, reset }),
    [design, set, clear, reset],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStaircaseDesign(): StaircaseDesignCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error(
      "useStaircaseDesign must be called inside <StaircaseDesignProvider>. Wrap the MT-1 experience shell with the provider before rendering any section that reads or writes design state.",
    );
  }
  return ctx;
}
