// src/lib/nex/category-registry.ts
//
// NEX central category registry · Task #89 Phase A seed (2026-08-22).
// Country Foundation Step 2 amendment (2026-08-22) · added REQUIRED `countries: string[]`
//   field to every entry · per project_nex_country_foundation_phased_plan_2026_08_22.
// Country Foundation Step 7 Part B · Phase 7B.1 (2026-08-22) · added OPTIONAL
//   `visual: { glyph: string; family?: string }` field to every entry per
//   project_nex_category_wheel_experience_doctrine_2026_08_22. DATA FOUNDATION ONLY —
//   the wheel component does NOT yet consume this field; that wiring lands in Phase 7B.3.
//   The existing `icon` (emoji) field is PRESERVED for backward compatibility.
//
// Philip 2026-08-22 verbatim (category-wheel amendment · CONSTITUTIONAL):
//   "There must be one canonical category identity."
//   "Wheel selects it. Brain resolves to it. Directory renders for it. Never diverge."
//
// This file is the ONE canonical source of category identity for NEX.
// Both the category wheel (src/components/nexapp/DirectoryPanel.tsx · Phase B
// migration target) and NEX Brain intent resolution (src/lib/nex-brain/* ·
// Phase B integration target) MUST read from here.
//
// Doctrine anchors:
//   project_nex_focused_category_directory_architecture_2026_08_22
//   project_nex_category_wheel_access_mandatory_2026_08_22
//   project_nex_local_directory_engine_architecture_2026_08_22
//   project_nex_task89_accommodation_spec_2026_08_22
//   project_nex_country_foundation_phased_plan_2026_08_22   (Step 2 · Step 6 · Step 7)
//   project_nex_country_scope_from_phone_country_code_2026_08_22
//   project_nex_truth_invariant_2026_08_22                 (countries list must be honest)
//   project_nex_category_wheel_experience_doctrine_2026_08_22 (Step 7 Part B · this visual field)
//
// Phase A: seed the registry with Accommodation categories (active=false ·
// wheel + Brain integration is Phase B · routes don't exist yet).
// Future: add Food categories here (Phase B follow-up · migrate wheel from
// its inline food entries) and Rentals categories (Task #90+).

export type NexVertical = "food" | "accommodation" | "rentals";

export interface CategoryEntry {
  /** Canonical id · shared across wheel · Brain · directory route · analytics.
   *  Kebab-case · lowercase · no spaces. NEVER change once shipped without
   *  a versioned rename migration. */
  id: string;

  /** Vertical this category belongs to. */
  parentVertical: NexVertical;

  /** Display names · localised. */
  displayName: {
    en: string;
    id: string;   // Bahasa Indonesia
  };

  /** Emoji/icon used by wheel + directory header. Consistent with the four-
   *  corners visual model (project_nex_four_corners_functional_model).
   *  PRESERVED for backward compatibility (Step 7 Part B doctrine).
   *  New wheel renders via `visual.glyph` — this field remains for existing
   *  consumers that haven't migrated yet. */
  icon: string;

  /** Country Foundation Step 7 Part B · Phase 7B.1 (2026-08-22) · visual metadata.
   *  New wheel + directory-header experience renders from this field, NOT from
   *  the legacy `icon` emoji. Enables Registry-driven visual scaling to hundreds
   *  of categories without per-category hand-coded visual hacks.
   *  Cross-refs:
   *    project_nex_category_wheel_experience_doctrine_2026_08_22
   *
   *  Data-foundation only in Phase 7B.1 — the wheel component is wired in Phase 7B.3.
   *  DO NOT treat this field's existence as "the wheel redesign is done." */
  visual: {
    /** Icon reference from an open-source SVG icon set (currently lucide-react ·
     *  already installed · zero new dependency). PascalCase name matching a
     *  lucide export. Never a URL, never a raw emoji. */
    glyph: string;
    /** Optional grouping · lets the wheel apply shared accent per family
     *  (e.g. all accommodation-family entries share a color mood). Free-form
     *  string · convention TBD in Phase 7B.2. */
    family?: string;
  };

  /** Focused route this category opens to. Follows Focused Category Directory
   *  doctrine · specific intent = destination · never routed through parent. */
  route: string;

  /** Whether the category is currently active in the wheel/Brain.
   *  Phase A ships everything at active=false · Phase B activates when the
   *  corresponding route + data are ready. Prevents dead wheel entries. */
  active: boolean;

  /** Keywords NEX Brain uses to resolve free-text intent to this category.
   *  Bahasa Indonesia + English coverage. Case-insensitive matching.
   *  Never make one keyword collide across two categories. */
  brainKeywords: string[];

  /** Countries where this category has real inventory · ISO 3166-1 alpha-2.
   *  Country Foundation Step 2 · 2026-08-22 · REQUIRED field.
   *  Explicit list required — no magic "ALL" values (per Truth Invariant:
   *  NEX must not claim inventory in a country where none exists).
   *  Wheel + directory filter by user's current market against this list.
   *  Cross-refs:
   *    project_nex_country_foundation_phased_plan_2026_08_22
   *    project_nex_country_scope_from_phone_country_code_2026_08_22
   *    project_nex_truth_invariant_2026_08_22 */
  countries: string[];

  /** OPTIONAL · underlying business table this category queries.
   *  Present when the category has a data-backed directory. */
  businessTable?: string;

  /** OPTIONAL · SQL predicate to filter businessTable to this category.
   *  Applied by directory route + Brain query resolution.
   *  Kept as a string for now · directory-level SQL uses it verbatim. */
  categoryFilter?: string;
}

// ── Broad + focused pattern per Q6 (Philip 2026-08-22) ──────────────
// Broad routes: one entry per vertical · covers all categories in that vertical.
// Focused routes: one entry per specific category.

export const CATEGORY_REGISTRY: CategoryEntry[] = [
  // ═══ FOOD ═════════════════════════════════════════════════════════
  // Migrated into the registry Task #89 Phase B 2026-08-22 · Philip Q7 mandate
  // that the registry is the ONE canonical category system for all of NEX.
  // Food's existing /food route + DirectoryPanel wheel entry preserved · this
  // registration doesn't move the routes · it names the categories so wheel +
  // Brain can share the same canonical id going forward.
  {
    id: "food",
    parentVertical: "food",
    displayName: { en: "Food", id: "Makanan" },
    icon: "🍜",
    visual: { glyph: "Utensils", family: "food" },   // Phase 7B.1
    route: "/food",
    active: true,   // shipped · active behind Task #33
    brainKeywords: ["food", "makanan", "restaurant", "restoran", "eat", "makan"],
    countries: ["ID"],   // Country Foundation Step 2 · currently Yogyakarta-only inventory
    businessTable: "nex.food_business",
    categoryFilter: undefined,   // /food shows all four food categories
  },

  // ═══ ACCOMMODATION ════════════════════════════════════════════════
  // Broad landing (Q6 · Philip 2026-08-22 confirmed "can exist" for genuine
  // broad intent · not required for Phase B initial ship).
  {
    id: "accommodation",
    parentVertical: "accommodation",
    displayName: { en: "Accommodation", id: "Penginapan" },
    icon: "🏨",
    visual: { glyph: "Bed", family: "accommodation" },   // Phase 7B.1
    route: "/accommodation",
    active: true,   // Phase B · shipped as broad landing
    brainKeywords: [
      "accommodation", "penginapan", "stay", "menginap", "tempat menginap",
      "where to stay", "somewhere to stay",
    ],
    countries: ["ID"],   // Country Foundation Step 2 · currently Yogyakarta-only
    businessTable: "nex.accommodation_business",
    categoryFilter: undefined,   // broad · no filter
  },

  // ── ACCOMMODATION · 7 focused categories (Q2) ─────────────────────
  {
    id: "hotel",
    parentVertical: "accommodation",
    displayName: { en: "Hotel", id: "Hotel" },
    icon: "🏨",
    visual: { glyph: "Hotel", family: "accommodation" },   // Phase 7B.1
    route: "/hotel",
    active: true,   // Phase B · activated · 523 discovered rows
    brainKeywords: ["hotel", "hotels", "cheap hotel", "boutique hotel"],
    countries: ["ID"],   // Country Foundation Step 2 · currently Yogyakarta-only
    businessTable: "nex.accommodation_business",
    categoryFilter: "category='hotel'",
  },
  {
    id: "villa",
    parentVertical: "accommodation",
    displayName: { en: "Villa", id: "Villa" },
    icon: "🏡",
    visual: { glyph: "Palmtree", family: "accommodation" },   // Phase 7B.1
    route: "/villa",
    active: false,
    brainKeywords: ["villa", "villas", "private villa", "family villa"],
    countries: ["ID"],   // Country Foundation Step 2 · currently Yogyakarta-only
    businessTable: "nex.accommodation_business",
    categoryFilter: "category='villa'",
  },
  {
    id: "guesthouse",
    parentVertical: "accommodation",
    displayName: { en: "Guesthouse", id: "Wisma" },
    icon: "🏠",
    visual: { glyph: "Home", family: "accommodation" },   // Phase 7B.1
    route: "/guesthouse",
    active: true,   // Phase B · activated · 201 discovered rows
    brainKeywords: ["guesthouse", "guest house", "wisma", "penginapan kecil"],
    countries: ["ID"],   // Country Foundation Step 2 · currently Yogyakarta-only
    businessTable: "nex.accommodation_business",
    categoryFilter: "category='guesthouse'",
  },
  {
    id: "homestay",
    parentVertical: "accommodation",
    displayName: { en: "Homestay", id: "Homestay" },
    icon: "🏘️",
    visual: { glyph: "HeartHandshake", family: "accommodation" },   // Phase 7B.1
    route: "/homestay",
    active: false,
    brainKeywords: ["homestay", "homestays", "rumah warga"],
    countries: ["ID"],   // Country Foundation Step 2 · currently Yogyakarta-only
    businessTable: "nex.accommodation_business",
    categoryFilter: "category='homestay'",
  },
  {
    id: "resort",
    parentVertical: "accommodation",
    displayName: { en: "Resort", id: "Resort" },
    icon: "🌴",
    visual: { glyph: "Sun", family: "accommodation" },   // Phase 7B.1
    route: "/resort",
    active: false,
    brainKeywords: ["resort", "resorts", "spa resort", "beach resort"],
    countries: ["ID"],   // Country Foundation Step 2 · currently Yogyakarta-only
    businessTable: "nex.accommodation_business",
    categoryFilter: "category='resort'",
  },
  {
    id: "hostel",
    parentVertical: "accommodation",
    displayName: { en: "Hostel", id: "Hostel" },
    icon: "🛏️",
    visual: { glyph: "Users", family: "accommodation" },   // Phase 7B.1
    route: "/hostel",
    active: true,   // Phase B · activated · 73 discovered rows
    brainKeywords: ["hostel", "hostels", "backpacker", "dorm"],
    countries: ["ID"],   // Country Foundation Step 2 · currently Yogyakarta-only
    businessTable: "nex.accommodation_business",
    categoryFilter: "category='hostel'",
  },
  {
    id: "apartment",
    parentVertical: "accommodation",
    displayName: { en: "Apartment", id: "Apartemen" },
    icon: "🏢",
    visual: { glyph: "Building2", family: "accommodation" },   // Phase 7B.1
    route: "/apartment",
    active: false,
    brainKeywords: ["apartment", "apartments", "apartemen", "long stay", "serviced apartment"],
    countries: ["ID"],   // Country Foundation Step 2 · currently Yogyakarta-only
    businessTable: "nex.accommodation_business",
    categoryFilter: "category='apartment'",
  },
  {
    // Task #89 Phase A · Kos added 2026-08-22 · Philip explicit.
    // Indonesian residential monthly rental · traditional shared boarding house ·
    // common near universities · Walker classification is CONSERVATIVE ·
    // name-based detection only · never inferred from cheap-looking building.
    // Kos can exist as a NEX destination even if Walker classifies zero on first
    // pass · registry entry legitimises it for future admin/enrichment placement.
    id: "kos",
    parentVertical: "accommodation",
    displayName: { en: "Kos (monthly rental)", id: "Kos" },
    icon: "🛖",
    visual: { glyph: "KeyRound", family: "accommodation" },   // Phase 7B.1 · monthly rental = key
    route: "/kos",
    active: true,   // Phase B · activated · 81 discovered rows (name-based detection working)
    brainKeywords: ["kos", "kost", "kosan", "indekos", "kos-kosan", "monthly rental", "boarding house"],
    countries: ["ID"],   // Country Foundation Step 2 · Indonesian-specific category · only ever ID
    businessTable: "nex.accommodation_business",
    categoryFilter: "category='kos'",
  },

  // ── FOOD (Phase B follow-up · seed entries · registry migration deferred until
  //    the existing DirectoryPanel.tsx wheel is refactored to read from here) ──
  //
  // Deliberately EMPTY here for Phase A. When Phase B activates the
  // accommodation wheel entries, we can copy the existing DirectoryPanel
  // inline food categories into this registry as a separate step.
];

// ── Helpers ────────────────────────────────────────────────────────

/** Look up a category by canonical id. */
export function getCategory(id: string): CategoryEntry | undefined {
  return CATEGORY_REGISTRY.find((c) => c.id === id);
}

/** All active categories for a given vertical. */
export function categoriesForVertical(vertical: NexVertical): CategoryEntry[] {
  return CATEGORY_REGISTRY.filter((c) => c.parentVertical === vertical && c.active);
}

/** All active categories · used by the wheel to build its menu.
 *  Preserves entry order · caller decides visual grouping. */
export function activeCategories(): CategoryEntry[] {
  return CATEGORY_REGISTRY.filter((c) => c.active);
}

/** Active categories filtered to a given country · ISO 3166-1 alpha-2.
 *  Country Foundation Step 2 · 2026-08-22.
 *
 *  Filters by BOTH active=true AND user's country appearing in the entry's
 *  countries array. Returns EMPTY for countries where NEX has no active
 *  inventory (e.g. activeCategoriesForCountry('GB') currently returns []
 *  because no active category declares 'GB' — Truth Invariant: NEX must not
 *  claim inventory in a country where none exists).
 *
 *  Cross-refs:
 *    project_nex_country_foundation_phased_plan_2026_08_22
 *    project_nex_truth_invariant_2026_08_22
 *    project_nex_country_scope_from_phone_country_code_2026_08_22 */
export function activeCategoriesForCountry(country: string): CategoryEntry[] {
  return CATEGORY_REGISTRY.filter((c) => c.active && c.countries.includes(country));
}

/** Result of an NL intent resolution against the registry.
 *  Country Foundation Step 6 (2026-08-22) · every result carries the country
 *  context that produced it, so callers can respond honestly. */
export type IntentResolution =
  | { kind: "matched_active";              category: CategoryEntry; country: string }
  | { kind: "matched_active_wrong_country"; category: CategoryEntry; country: string; availableCountries: string[] }
  | { kind: "matched_inactive";            category: CategoryEntry; country: string }   // Brain knows the category · not yet activated (regardless of country)
  | { kind: "unknown";                     country: string };

/** Resolve a natural-language phrase to a category via keyword matching,
 *  scoped to the caller's current-market country.
 *
 *  Country Foundation Step 6 (2026-08-22) · country-aware Brain intent resolution.
 *
 *  Four resolution outcomes:
 *    matched_active                → keyword matched, category active, and country IS in
 *                                    category.countries. Directory + inventory available in this market.
 *    matched_active_wrong_country  → keyword matched, category active, but country NOT in
 *                                    category.countries. Brain understood but can't route
 *                                    to a directory that has inventory here. Caller should
 *                                    respond honestly (e.g. "I understand you want hotels
 *                                    but I don't have UK hotel listings yet"). Includes
 *                                    availableCountries so the caller can name where it IS.
 *    matched_inactive              → keyword matched, category NOT active in the Registry
 *                                    (regardless of country). Categories like villa that Brain
 *                                    understands but haven't shipped. Caller returns empty state.
 *    unknown                       → no keyword matched. Brain doesn't understand.
 *
 *  Philip 2026-08-22 Phase B rule (verbatim, extended for country by Step 6):
 *    "For Villa, Brain may correctly understand and resolve villa, but because Villa is
 *    currently inactive/has zero verified inventory, it must return the appropriate
 *    empty/not-yet-available state rather than inventing listings or silently redirecting
 *    to Guesthouse."
 *
 *  Same principle now applies to country: hotel exists globally in the Registry, but if
 *  the user is in a country with no hotel inventory, we return matched_active_wrong_country
 *  rather than silently showing another country's inventory.
 *
 *  Caller responsibility: pass a valid ISO 3166-1 alpha-2 country. Normalise raw URL /
 *  user input via `normalizeDirectoryCountry` from `@/lib/nex/directoryCountry` first.
 *  This function does NOT validate the country string — malformed values simply won't
 *  match any category's countries array. */
export function resolveIntent(phrase: string, country: string): IntentResolution {
  const p = phrase.toLowerCase();
  for (const c of CATEGORY_REGISTRY) {
    for (const kw of c.brainKeywords) {
      if (p.includes(kw.toLowerCase())) {
        if (!c.active) {
          return { kind: "matched_inactive", category: c, country };
        }
        if (c.countries.includes(country)) {
          return { kind: "matched_active", category: c, country };
        }
        return {
          kind: "matched_active_wrong_country",
          category: c,
          country,
          availableCountries: [...c.countries],
        };
      }
    }
  }
  return { kind: "unknown", country };
}
