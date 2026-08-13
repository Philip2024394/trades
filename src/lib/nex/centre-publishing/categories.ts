// NEX Trade Center canonical categories.
//
// The centre feed uses `category_path: string[]` on each item, and the
// filter layer does a case-insensitive substring match. This module
// centralises the canonical category names so every surface (feed API,
// filter chips, category-scoped pages like /nex-app/refacing/companies)
// uses the same value verbatim.
//
// STAIRCASE REFACING is the PARENT category for all trades that work on
// existing staircases. Related terminology (renovation · refurbishment ·
// covering · cladding · re-treading · balustrade upgrade · etc.) is
// modelled as CAPABILITIES on the seed record, NOT as separate top-level
// categories. See directorySeedLoader.ts · RefacingCapabilityKey.
//
// Rule: do not create sibling top-level categories for terminology
// variants — they fragment the feed and confuse customer search.

export const CATEGORY_STAIRCASE_REFACING = "Staircase Refacing";

/** Canonical Trade Center categories. Extend this list with care —
 *  every new value creates a filter surface + a chip + a landing page. */
export const TRADE_CENTER_CATEGORIES = [
  CATEGORY_STAIRCASE_REFACING,
  // Future: "Kitchen Refit", "Bathroom Renovation", etc.
] as const;

export type TradeCenterCategory = typeof TRADE_CENTER_CATEGORIES[number];

/** Human-friendly capability labels for the Staircase Refacing category.
 *  Keys must match RefacingCapabilityKey in directorySeedLoader.ts. */
export const REFACING_CAPABILITY_LABELS: Record<string, string> = {
  staircase_manufacture:        "Staircase manufacture",
  staircase_refurbishment:      "Staircase refurbishment",
  staircase_refacing:           "Staircase refacing",
  staircase_covering:           "Staircase covering",
  staircase_cladding:           "Staircase cladding",
  overcladding:                 "Overcladding",
  tread_replacement:            "Tread replacement",
  riser_replacement:            "Riser replacement",
  tread_and_riser_replacement:  "Tread & riser replacement",
  handrail:                     "Handrail",
  baserail:                     "Baserail",
  newel:                        "Newel post",
  baluster:                     "Baluster",
  spindle:                      "Spindle",
  glass_balustrade:             "Glass balustrade",
  stainless_steel_balustrade:   "Stainless steel balustrade",
  metal_balustrade:             "Metal balustrade",
  sanding:                      "Sanding",
  staining:                     "Staining",
  painting:                     "Painting",
  varnishing:                   "Varnishing",
  restoration:                  "Restoration",
  repair:                       "Repair",
  installation:                 "Installation",
  bespoke_joinery:              "Bespoke joinery",
};
