// Plastering — service catalog.
//
// The curated list of services a plasterer might offer. Each service
// has a stable slug (used for aggregation across trades), a unit
// (£/sqm, £/each, etc.), a category (for UI grouping), and optional
// notes describing what's included/excluded — the "additional may
// apply" transparency lever.
//
// Trade fills in THEIR price per service. Empty rate = "not offered"
// (honest silence, per evidence-or-silence rule). Platform aggregates
// compute a network median across trades who did fill it in.
//
// Curated 2026-07-12 based on standard UK plastering trade knowledge.
// A working plasterer should sanity-check the list — flag missing
// services or ones I've mislabelled. Empty-state is fine; silence
// beats a wrong catalog entry.

export type RateUnit =
  | "sqm"           // per square metre
  | "linear-metre"  // per linear metre
  | "each"          // per item
  | "per-job"       // fixed price
  | "per-hour"
  | "per-day"
  | "percent";      // % surcharge / premium

export type PlasteringService = {
  slug: string;              // stable id, used for aggregation
  label: string;
  category: string;
  unit: RateUnit;
  description: string;
  included: string;          // what the rate covers
  excluded: string;          // what's NOT covered (drives "additional may apply")
  factsBlurb?: string;       // domain-fact for the info panel
};

export const PLASTERING_CATEGORIES = [
  { slug: "skimming",     label: "Skimming" },
  { slug: "rendering",    label: "Rendering" },
  { slug: "dry-lining",   label: "Dry-lining" },
  { slug: "ceilings",     label: "Ceilings" },
  { slug: "repairs",      label: "Repairs" },
  { slug: "specialist",   label: "Specialist finishes" }
] as const;

export const PLASTERING_SERVICES: PlasteringService[] = [
  // ─── Skimming ────────────────────────────────────────────────
  {
    slug: "skim-2coat-prepared",
    label: "Skim coat — 2 coats, prepared wall",
    category: "skimming",
    unit: "sqm",
    description: "Two-coat skim finish on a properly prepared wall (PVA'd, sound backing).",
    included: "Two coats multi-finish or board finish, trowel-finished ready for paint. Mist coat NOT included.",
    excluded: "Wall preparation, corner/window beads, blown plaster removal, high-ceiling premium, scaffolding.",
    factsBlurb: "One 25 kg bag of Thistle Multi-Finish covers ~10 sqm at a 2-coat application (British Gypsum spec)."
  },
  {
    slug: "skim-1coat-prepared",
    label: "Skim coat — 1 coat, prepared wall",
    category: "skimming",
    unit: "sqm",
    description: "Single skim on new plasterboard that's already taped and jointed.",
    included: "Single 2-3 mm skim, trowel-finished.",
    excluded: "Wall preparation, PVA priming, beads, tape and joint (assume already done)."
  },
  {
    slug: "skim-hardwall-backing",
    label: "Hardwall / backing coat",
    category: "skimming",
    unit: "sqm",
    description: "Undercoat plaster on masonry backgrounds before skim finish.",
    included: "One coat British Gypsum Hardwall (or equivalent) to a thickness of ~11 mm, ruled and scratched ready for skim.",
    excluded: "Skim finish (charged separately), preparation, dubbing out uneven walls."
  },
  {
    slug: "skim-multifinish",
    label: "Multi-Finish skim",
    category: "skimming",
    unit: "sqm",
    description: "British Gypsum Multi-Finish (or equivalent) as the finish coat.",
    included: "Two-coat multi-finish, sponge-floated, trowel-finished.",
    excluded: "Backing coat, wall prep, beads."
  },
  {
    slug: "skim-boardfinish",
    label: "Board Finish skim",
    category: "skimming",
    unit: "sqm",
    description: "British Gypsum Board Finish over plasterboard.",
    included: "Two-coat board finish trowel-finished.",
    excluded: "Backing coat (not typically needed on board), preparation, beads."
  },

  // ─── Rendering ───────────────────────────────────────────────
  {
    slug: "render-sand-cement",
    label: "Sand & cement render — external",
    category: "rendering",
    unit: "sqm",
    description: "Traditional sand and cement render, 2-3 coats.",
    included: "Two coats sand/cement (typically 4:1 mix), scratched and floated finish. Rules and beads included where linear.",
    excluded: "Scaffolding, top-coat finish (if painted/silicone finish separate), waterproofing, preparation of substrate."
  },
  {
    slug: "render-krend-silicone",
    label: "K-Rend / silicone render",
    category: "rendering",
    unit: "sqm",
    description: "Silicone through-coloured render (K-Rend, Weber, Parex).",
    included: "Base coat + top coat silicone render, mesh cloth between coats, brush-applied finish.",
    excluded: "Scaffolding, mesh corner beads, EPS insulation (if EWI system separate)."
  },
  {
    slug: "render-pebbledash",
    label: "Pebbledash render",
    category: "rendering",
    unit: "sqm",
    description: "Traditional pebbledash rough-cast render.",
    included: "Base coat + throw-on pebbledash finish coat.",
    excluded: "Scaffolding, preparation, pointing."
  },
  {
    slug: "render-monocouche",
    label: "Monocouche render",
    category: "rendering",
    unit: "sqm",
    description: "Single-coat monocouche render (e.g. Weber Pral M).",
    included: "Single monocouche application, sponged finish, mesh reinforcement at stress points.",
    excluded: "Scaffolding, corner beads, insulation."
  },

  // ─── Dry-lining ──────────────────────────────────────────────
  {
    slug: "dryline-plasterboard-fix",
    label: "Plasterboard fix (dry-line)",
    category: "dry-lining",
    unit: "sqm",
    description: "Fix plasterboard to walls / ceilings on dabs or timber.",
    included: "Board fix on adhesive dabs or screwed to timber/metal frame. Standard 12.5 mm board.",
    excluded: "Insulated board upgrade, sound board, tape and joint, skim, framing supply."
  },
  {
    slug: "dryline-tape-joint",
    label: "Tape and joint",
    category: "dry-lining",
    unit: "sqm",
    description: "Fill and tape plasterboard joints, sand to Q3/Q4 finish.",
    included: "Fill, tape, and 2-3 coats jointing compound, sanded to a paintable finish (Q3 standard).",
    excluded: "Board fix (charged separately), skim coat, priming for paint."
  },

  // ─── Ceilings ────────────────────────────────────────────────
  {
    slug: "ceiling-skim",
    label: "Ceiling skim",
    category: "ceilings",
    unit: "sqm",
    description: "Skim finish to existing plasterboard ceiling.",
    included: "Two-coat skim finish to ceiling, trowel-finished.",
    excluded: "Ceiling replacement, plasterboard supply, high-ceiling premium (>2.7 m), scaffolding, dust sheeting."
  },
  {
    slug: "coving-install-100mm",
    label: "Coving install — 100 mm",
    category: "ceilings",
    unit: "linear-metre",
    description: "Standard 100 mm cove installation (paper-faced or plaster).",
    included: "Cove supply, adhesive fix, mitred corners, jointed and ready for paint.",
    excluded: "Ornate/period cove (charged as specialist), scaffolding, painting."
  },
  {
    slug: "ceiling-rose-install",
    label: "Ceiling rose install",
    category: "ceilings",
    unit: "each",
    description: "Standard plaster ceiling rose fitted centrally.",
    included: "Standard rose supply and fix, jointed to ceiling.",
    excluded: "Electrical wiring (electrician separate), decorative cornice, ornate rose."
  },
  {
    slug: "cornice-repair",
    label: "Cornice repair",
    category: "ceilings",
    unit: "linear-metre",
    description: "Repair to existing ornate cornice or coving.",
    included: "Patch damaged section, remodel decorative detail to match adjacent run.",
    excluded: "Full cornice replacement, listed-building consent, specialist mould pulling."
  },

  // ─── Repairs ─────────────────────────────────────────────────
  {
    slug: "patch-repair-small",
    label: "Patch repair — small (< 0.25 sqm)",
    category: "repairs",
    unit: "each",
    description: "Small localised patch (nail hole scale, blown patch).",
    included: "Cut back to sound edges, backing + skim to blend.",
    excluded: "Damp treatment (charged separately), repainting, matching textured finishes."
  },
  {
    slug: "crack-repair",
    label: "Crack repair — filled",
    category: "repairs",
    unit: "linear-metre",
    description: "Structural crack tape and skim.",
    included: "Rake out, prime, fibre-tape, 2-3 coats filler and skim.",
    excluded: "Investigation of underlying cause, structural repairs, decorative reinstatement."
  },
  {
    slug: "damp-treatment-coat",
    label: "Damp treatment coat",
    category: "repairs",
    unit: "sqm",
    description: "Salt-inhibiting undercoat before finish.",
    included: "One coat waterproof salt-retardant render (e.g. Wykamol Renderguard).",
    excluded: "Damp source diagnosis (specialist), chemical DPC, finish skim (charged separately)."
  },
  {
    slug: "blown-plaster-remove-replace",
    label: "Blown plaster — remove and replace",
    category: "repairs",
    unit: "sqm",
    description: "Strip failing plaster and replaster.",
    included: "Hack off to bricks / block, dispose, 2-coat backing, 2-coat skim finish.",
    excluded: "Skip / waste disposal charges, damp diagnosis, disruption/dust protection."
  },

  // ─── Specialist ──────────────────────────────────────────────
  {
    slug: "venetian-polished",
    label: "Venetian polished plaster",
    category: "specialist",
    unit: "sqm",
    description: "Multi-layer decorative Italian polished plaster finish.",
    included: "3-5 coats through-coloured plaster, hand-troweled, burnished to a high sheen.",
    excluded: "Colour matching to spec, wax topcoat if bespoke, sample preparation."
  },
  {
    slug: "lime-plaster-traditional",
    label: "Traditional lime plaster",
    category: "specialist",
    unit: "sqm",
    description: "Hydraulic lime plaster on period / listed buildings.",
    included: "Two-coat NHL lime plaster, hair-reinforced base coat if required, hand-finished.",
    excluded: "Salt neutralisation, consent applications, matching listed-building specifications."
  },
  {
    slug: "ornate-cornice-new",
    label: "Ornate cornice — new install",
    category: "specialist",
    unit: "linear-metre",
    description: "Period-style ornate cornice supplied and fitted.",
    included: "Cornice supply, mitred corners, jointed to wall and ceiling.",
    excluded: "Cornice design, custom moulds, painting, listed-building surveys."
  }
];

// ─── Add-ons — attach to any service ─────────────────────────────

export type PlasteringAddOn = {
  slug: string;
  label: string;
  unit: RateUnit;
  description: string;
  applyWhen: string;      // trade guidance
};

export const PLASTERING_ADDONS: PlasteringAddOn[] = [
  {
    slug: "window-bead-install",
    label: "Window bead install",
    unit: "each",
    description: "Angle bead / thin-coat bead to window reveal.",
    applyWhen: "Every window / opening in the plastering area."
  },
  {
    slug: "corner-bead-install",
    label: "Corner bead install",
    unit: "linear-metre",
    description: "External corner protection bead.",
    applyWhen: "Every external plaster corner (new or damaged)."
  },
  {
    slug: "scaffolding-setup-day",
    label: "Scaffolding setup — day rate",
    unit: "per-day",
    description: "Independent tower / trestle for high-work.",
    applyWhen: "Ceilings >2.7 m, external work, or where head-room prevents ground working."
  },
  {
    slug: "high-ceiling-premium",
    label: "High ceiling premium (>2.7 m)",
    unit: "percent",
    description: "Percentage uplift for extended reach.",
    applyWhen: "Ceilings from 2.7 m to 4 m. Above 4 m usually quoted per-project."
  },
  {
    slug: "weekend-evening-surcharge",
    label: "Weekend / evening surcharge",
    unit: "percent",
    description: "% uplift for out-of-hours work.",
    applyWhen: "Client requests work outside standard 8am-5pm weekdays."
  },
  {
    slug: "removal-existing-plaster",
    label: "Removal of existing plaster",
    unit: "sqm",
    description: "Hack off failed / old plaster before new works.",
    applyWhen: "Only if existing plaster is blown, damp, or unsuitable for skim."
  },
  {
    slug: "pva-sealing-prep",
    label: "PVA sealing / preparation",
    unit: "sqm",
    description: "Diluted PVA or acrylic primer to substrate.",
    applyWhen: "Chalky, dusty, or previously painted walls needing bond promotion."
  },
  {
    slug: "travel-outside-radius",
    label: "Travel outside standard radius",
    unit: "per-hour",
    description: "Mileage / travel time beyond agreed base area.",
    applyWhen: "Jobs beyond the trade's standard 15-25 mile catchment (per trade)."
  }
];

// ─── Facts for the panel — sourced references, no fabrication ────

export const PLASTERING_FACTS = [
  {
    label: "ONS occupation code",
    value: "SOC 2020 · 5321 Plasterer",
    source: "ONS Standard Occupational Classification 2020",
    sourceUrl: "https://www.ons.gov.uk/methodology/classificationsandstandards/standardoccupationalclassificationsoc/soc2020"
  },
  {
    label: "Government hourly baseline (ASHE)",
    value: "See ONS ASHE Table 15 for the current release",
    source: "ONS Annual Survey of Hours and Earnings",
    sourceUrl: "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkingtime/bulletins/annualsurveyofhoursandearnings/latest"
  },
  {
    label: "Material coverage — Multi-Finish",
    value: "25 kg bag ~ 10 sqm at 2-coat application (~2-3 mm)",
    source: "British Gypsum Multi-Finish product data",
    sourceUrl: "https://www.british-gypsum.com/products/thistle-multi-finish"
  },
  {
    label: "Material coverage — Hardwall",
    value: "25 kg bag ~ 1.6 sqm at 11 mm thickness",
    source: "British Gypsum Hardwall product data",
    sourceUrl: "https://www.british-gypsum.com/products/thistle-hardwall"
  },
  {
    label: "CITB skills reference",
    value: "See CITB Skills Network annual construction rates report",
    source: "CITB (Construction Industry Training Board)",
    sourceUrl: "https://www.citb.co.uk/about-citb/skills-network/"
  }
];

/** Local-storage helpers so trades can save their rate menu without
 *  the server-backed schema (Phase 4). Persists per trade_id. */
const STORAGE_KEY_PREFIX = "tc.rates.plastering.";

export type SavedRate = {
  slug: string;
  gbpAmount: number;
  notes?: string;
};

export type CustomRate = {
  slug: string;         // generated
  label: string;
  unit: RateUnit;
  gbpAmount: number;
  notes?: string;
};

export type SavedPlasteringMenu = {
  services: SavedRate[];
  addons: SavedRate[];
  custom: CustomRate[];
  updatedAt: string;
};

export function loadSavedMenu(tradeId: string): SavedPlasteringMenu | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + tradeId);
    if (!raw) return null;
    return JSON.parse(raw) as SavedPlasteringMenu;
  } catch {
    return null;
  }
}

export function saveMenu(tradeId: string, menu: SavedPlasteringMenu) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY_PREFIX + tradeId,
      JSON.stringify({ ...menu, updatedAt: new Date().toISOString() })
    );
  } catch {
    /* silent */
  }
}
