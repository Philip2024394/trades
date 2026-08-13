// TRADE_CATEGORY_REGISTRY — shared per-category configuration for the NEX Collector,
// public directory, and dashboard. Every trade category the Collector supports must
// have an entry here (Philip 2026-08-13 · lock-in).
//
// Rules:
//   · Do NOT hard-code category-specific logic into the Collector or Directory pages.
//     They read the registry so a new category is a config change, not a code fork.
//   · Do NOT collapse the four axes (directory_state · verified · lifecycle_status ·
//     refacing_qualification). Registry only supplies LABELS + FOLDER + URLS.
//   · Qualification values (A+/A/B/C/excluded) are shared across categories · the
//     EVIDENCE RUBRIC that decides which value applies is per-category (docs field).

import { CATEGORY_STAIRCASE_REFACING, REFACING_CAPABILITY_LABELS } from "./categories";

export type TradeCategoryId =
  | "staircase_refacing"
  | "staircase_manufacture"
  | "kitchens";

export type QualificationRubric = {
  "A+":       string;
  "A":        string;
  "B":        string;
  "C":        string;
  "excluded": string;
};

export type DiscoverySource = {
  label: string;
  href: string;
};

export type TradeCategoryConfig = {
  /** Machine-readable id · used in URLs like /admin/(authed)/collector/[category] */
  id: TradeCategoryId;
  /** Canonical human display name · also the value stored on seed.category */
  displayName: string;
  /** Folder under data/directory-seeds/ where seed JSON files live */
  seedFolder: string;
  /** Public directory URL where verified/listed companies appear */
  publicDirectoryUrl: string;
  /** Machine-readable primary_trade slug stored on seeds · enables filter chips */
  primaryTradeSlug: string;
  /** Human-friendly capability labels · keyed by machine slug */
  capabilityLabels: Record<string, string>;
  /** Ordered display list of capability keys (for form ordering) */
  capabilityOrder: string[];
  /** Evidence rubric for the shared A+/A/B/C/excluded qualifications */
  qualificationRubric: QualificationRubric;
  /** Whether this category is enabled in the Collector today */
  enabled: boolean;
  /** Priority — lower number = higher priority (dashboards may sort by this) */
  priority: number;
  /** Directory / search pages the operator browses (as DISCOVERY bookmarks) to
   *  find real company URLs. NEX NEVER fetches these — they exist only as
   *  human-navigable references. */
  discoverySources?: DiscoverySource[];
};

// ═════════════════════════════════════════════════════════════════════
// STAIRCASE REFACING — primary category · first to populate + test
// ═════════════════════════════════════════════════════════════════════
const STAIRCASE_REFACING: TradeCategoryConfig = {
  id: "staircase_refacing",
  displayName: CATEGORY_STAIRCASE_REFACING,
  seedFolder: "_refacing",
  publicDirectoryUrl: "/nex-app/refacing/companies",
  primaryTradeSlug: "staircase_refacing",
  capabilityLabels: REFACING_CAPABILITY_LABELS,
  capabilityOrder: [
    // Top-level service axes surfaced first for the multi-service classifier
    // (Philip 2026-08-13). Order matches the checkbox grid the worker fills in.
    "staircase_manufacture",
    "installation",
    "staircase_refurbishment",
    "staircase_refacing",
    "staircase_cladding",
    "bespoke_joinery",
    // Granular components
    "staircase_covering",
    "overcladding",
    "tread_replacement",
    "riser_replacement",
    "tread_and_riser_replacement",
    "handrail",
    "baserail",
    "newel",
    "baluster",
    "spindle",
    "glass_balustrade",
    "stainless_steel_balustrade",
    "metal_balustrade",
    "sanding",
    "staining",
    "painting",
    "varnishing",
    "restoration",
    "repair",
  ],
  qualificationRubric: {
    "A+":       "Clear evidence of working on EXISTING staircases through refacing, refurbishment, renovation, covering, cladding or replacement components.",
    "A":        "Strong existing-staircase renovation / refurbishment evidence.",
    "B":        "Likely relevant staircase trade but existing-staircase / refacing evidence needs more verification.",
    "C":        "Primarily new staircase / manufacturing work.",
    "excluded": "Not relevant to staircase refacing.",
  },
  enabled: true,
  priority: 1,
  discoverySources: [
    { label: "Checkatrade · Staircase Refurbishment · UK",         href: "https://www.checkatrade.com/Search/Staircase-Refurbishment/in/Uk" },
    { label: "Checkatrade · Staircase Refurbishment · Birmingham", href: "https://www.checkatrade.com/Search/Staircase-Refurbishment/in/Birmingham" },
    { label: "Checkatrade · Staircase Refurbishment · Leeds",      href: "https://www.checkatrade.com/Search/Staircase-Refurbishment/in/Leeds" },
    { label: "HomeRun · Staircase Refurbishment",                  href: "https://www.homerun.co.uk/staircase-refurbishment" },
  ],
};

// ═════════════════════════════════════════════════════════════════════
// STAIRCASE MANUFACTURE — UK STAIRCASE JOINERY & MANUFACTURERS CAMPAIGN
// (Philip 2026-08-14 · enabled). Discovery-first: 200+ verified reachable
// company URLs must be built via DISCOVERY bookmarks before large batch
// runs. Never fabricate a domain. See docs/nex-brain/campaigns/
// UK-STAIRCASE-JOINERY-MANUFACTURE-2026-08-14.md.
// ═════════════════════════════════════════════════════════════════════
const STAIRCASE_MANUFACTURE_CAPABILITY_LABELS: Record<string, string> = {
  bespoke_new_staircases:      "Bespoke new staircases",
  standard_new_staircases:     "Standard new staircases",
  spiral_staircases:           "Spiral staircases",
  helical_staircases:          "Helical staircases",
  floating_staircases:         "Floating / cantilever staircases",
  glass_staircases:            "Glass staircases",
  steel_staircases:            "Steel staircases",
  timber_staircases:           "Timber staircases",
  concrete_staircases:         "Concrete staircases",
  commercial_staircases:       "Commercial staircases",
  residential_staircases:      "Residential staircases",
  balustrade_manufacture:      "Balustrade manufacture",
  handrail_manufacture:        "Handrail manufacture",
  newel_manufacture:           "Newel manufacture",
  installation:                "Install service",
  survey_and_design:           "Survey + design service",
  cad_drawings:                "CAD drawings",
  building_control_approval:   "Building control / regs support",
};

const STAIRCASE_MANUFACTURE: TradeCategoryConfig = {
  id: "staircase_manufacture",
  displayName: "Staircase Manufacture",
  seedFolder: "_staircase_manufacture",
  publicDirectoryUrl: "/nex-app/centre?category=Staircase+Manufacture",
  primaryTradeSlug: "staircase_manufacturer",
  capabilityLabels: STAIRCASE_MANUFACTURE_CAPABILITY_LABELS,
  capabilityOrder: [
    "bespoke_new_staircases",
    "standard_new_staircases",
    "spiral_staircases",
    "helical_staircases",
    "floating_staircases",
    "glass_staircases",
    "steel_staircases",
    "timber_staircases",
    "concrete_staircases",
    "commercial_staircases",
    "residential_staircases",
    "balustrade_manufacture",
    "handrail_manufacture",
    "newel_manufacture",
    "installation",
    "survey_and_design",
    "cad_drawings",
    "building_control_approval",
  ],
  qualificationRubric: {
    "A+":       "Clear evidence of end-to-end bespoke staircase design + manufacture + install with recent published portfolio.",
    "A":        "Strong evidence of new staircase manufacture with published portfolio (may be supply-only or install-only).",
    "B":        "Staircase-related manufacturer but scope of work unclear · needs more verification.",
    "C":        "Adjacent trade (parts-only supplier · retail-only) without full manufacture scope.",
    "excluded": "Not a staircase manufacturer.",
  },
  enabled: true,
  priority: 2,
  discoverySources: [
    // Directory / trade-listing pages — NEX never fetches these · operator browses to find company URLs.
    { label: "Checkatrade · Staircases · UK",                       href: "https://www.checkatrade.com/Search/Staircases/in/Uk" },
    { label: "Checkatrade · Joinery · UK",                          href: "https://www.checkatrade.com/Search/Joinery/in/Uk" },
    { label: "Yell · Staircase Manufacturers · UK",                 href: "https://www.yell.com/ucs/UcsSearchAction.do?keywords=staircase+manufacturers&location=United+Kingdom" },
    { label: "Yell · Joiners · UK",                                 href: "https://www.yell.com/ucs/UcsSearchAction.do?keywords=joiners&location=United+Kingdom" },
    { label: "Bark · Staircase Manufacturer · UK",                  href: "https://www.bark.com/en/gb/search/?query=staircase+manufacturer" },
    { label: "Houzz UK · Stairs & Railings professionals",          href: "https://www.houzz.co.uk/professionals/stairs-and-railings" },
    { label: "Trustatrader · Joiners & Carpenters · UK",            href: "https://www.trustatrader.com/trades/joiners-carpenters" },
    { label: "MyBuilder · Carpenters & Joiners · UK",               href: "https://www.mybuilder.com/find/carpenters-joiners" },
    { label: "British Woodworking Federation · member directory",   href: "https://www.bwf.org.uk/member-search/" },
    { label: "Institute of Carpenters · member directory",          href: "https://instituteofcarpenters.com/find-a-carpenter/" },
  ],
};

// ═════════════════════════════════════════════════════════════════════
// KITCHENS — registered but DISABLED. Kept in the registry as ongoing
// proof that the architecture is generic across unrelated trade
// categories. Re-enable if/when prioritised.
// ═════════════════════════════════════════════════════════════════════
const KITCHEN_CAPABILITY_LABELS: Record<string, string> = {
  kitchen_design:          "Kitchen design",
  kitchen_supply:          "Kitchen supply",
  kitchen_installation:    "Kitchen installation",
  kitchen_refit:           "Kitchen refit (existing kitchen)",
  worktop_supply:          "Worktop supply",
  worktop_installation:    "Worktop installation",
  cabinet_manufacture:     "Cabinet manufacture",
  cabinet_installation:    "Cabinet installation",
  appliance_supply:        "Appliance supply",
  appliance_installation:  "Appliance installation",
  splashback_supply:       "Splashback supply",
  splashback_installation: "Splashback installation",
  plumbing:                "Plumbing (kitchen)",
  electrical:              "Electrical (kitchen)",
  extraction:              "Extraction / ventilation",
  tiling:                  "Tiling",
  bespoke_joinery:         "Bespoke joinery",
  restoration:             "Kitchen restoration / refresh",
};

const KITCHENS: TradeCategoryConfig = {
  id: "kitchens",
  displayName: "Kitchens",
  seedFolder: "_kitchens",
  publicDirectoryUrl: "/nex-app/kitchens/companies", // Route to be built when this category is prioritised
  primaryTradeSlug: "kitchen_trade",
  capabilityLabels: KITCHEN_CAPABILITY_LABELS,
  capabilityOrder: [
    "kitchen_design",
    "kitchen_supply",
    "kitchen_installation",
    "kitchen_refit",
    "worktop_supply",
    "worktop_installation",
    "cabinet_manufacture",
    "cabinet_installation",
    "appliance_supply",
    "appliance_installation",
    "splashback_supply",
    "splashback_installation",
    "plumbing",
    "electrical",
    "extraction",
    "tiling",
    "bespoke_joinery",
    "restoration",
  ],
  qualificationRubric: {
    "A+":       "Clear evidence of full kitchen design + supply + installation with recent completed jobs.",
    "A":        "Strong evidence of kitchen supply OR installation with published portfolio.",
    "B":        "Kitchen trade but scope of work unclear · needs additional verification.",
    "C":        "Adjacent trade (worktop-only, appliance-only, etc.) without full kitchen scope.",
    "excluded": "Not a kitchen trade.",
  },
  enabled: false,
  priority: 99,
};

// ═════════════════════════════════════════════════════════════════════
// REGISTRY
// ═════════════════════════════════════════════════════════════════════
export const TRADE_CATEGORY_REGISTRY: Record<TradeCategoryId, TradeCategoryConfig> = {
  staircase_refacing:    STAIRCASE_REFACING,
  staircase_manufacture: STAIRCASE_MANUFACTURE,
  kitchens:              KITCHENS,
};

export function getTradeCategory(id: string): TradeCategoryConfig | null {
  return (TRADE_CATEGORY_REGISTRY as Record<string, TradeCategoryConfig>)[id] ?? null;
}

export function listEnabledCategories(): TradeCategoryConfig[] {
  return Object.values(TRADE_CATEGORY_REGISTRY)
    .filter((c) => c.enabled)
    .sort((a, b) => a.priority - b.priority);
}
