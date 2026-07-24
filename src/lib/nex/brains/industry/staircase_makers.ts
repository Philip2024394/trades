// UK staircase MANUFACTURERS — companies that build complete
// staircases (kit-form, semi-assembled, or bespoke).
//
// This category does NOT include stairparts suppliers (see
// stairparts_suppliers.ts) or general builders' merchants that
// happen to stock the odd stair kit (see building_merchants.ts).

import type { CompanyEntry } from "./_types";

export const STAIRCASE_MAKERS: CompanyEntry[] = [
  {
    canonical: "StairBox",
    category:  "staircase_maker",
    blurb:     "a UK staircase manufacturer with an online configurator, based in Stoke-on-Trent",
    patterns:  [/\bstair\s?box\b/i, /\bstairbox\b/i]
  },
  {
    canonical: "OVOMS",
    category:  "staircase_maker",
    blurb:     "a London-based bespoke staircase manufacturer with a 3D online configurator",
    patterns:  [/\bovoms\b/i]
  },
  {
    canonical: "Pear Stairs",
    category:  "staircase_maker",
    blurb:     "a UK staircase manufacturer offering both trade-kit and bespoke work",
    patterns:  [/\bpear\s?stairs?\b/i]
  },
  {
    canonical: "Complete Stair Systems",
    category:  "staircase_maker",
    blurb:     "a UK staircase and spiral-staircase manufacturer",
    patterns:  [/\bcomplete\s?stair\s?systems?\b/i]
  },
  {
    canonical: "British Spirals & Castings",
    category:  "staircase_maker",
    blurb:     "a UK specialist manufacturer of spiral and helical staircases",
    patterns:  [/\bbritish\s?spirals?\b/i]
  },
  {
    canonical: "Multi-Turn",
    category:  "staircase_maker",
    blurb:     "a UK bespoke staircase manufacturer",
    patterns:  [/\bmulti[\s-]?turn\b/i]
  },
  {
    canonical: "TKstairs",
    category:  "staircase_maker",
    blurb:     "a UK staircase manufacturer",
    patterns:  [/\btkstairs?\b/i, /\btk\s?stairs?\b/i]
  },
  {
    canonical: "Stairplan",
    category:  "staircase_maker",
    blurb:     "a UK staircase manufacturer offering online-ordered and bespoke work",
    patterns:  [/\bstairplan\b/i]
  },
  {
    canonical: "Trade Stairs",
    category:  "staircase_maker",
    blurb:     "a UK trade-focused staircase manufacturer",
    patterns:  [/\btrade\s?stairs?\b/i]
  },
  {
    canonical: "DAB Stairs",
    category:  "staircase_maker",
    blurb:     "a UK staircase manufacturer",
    patterns:  [/\bdab\s?stairs?\b/i]
  },
  {
    canonical: "Meer End",
    category:  "staircase_maker",
    blurb:     "a UK bespoke staircase manufacturer",
    patterns:  [/\bmeer\s?end\b/i]
  },
  {
    canonical: "Bisca",
    category:  "staircase_maker",
    blurb:     "a UK luxury bespoke staircase manufacturer",
    patterns:  [/\bbisca\b/i]
  },
  {
    canonical: "Spiral UK",
    category:  "staircase_maker",
    blurb:     "a UK specialist spiral and helical staircase manufacturer",
    patterns:  [/\bspiral\.?uk\b/i, /\bspiral\s+uk\b/i]
  },
  {
    canonical: "Woodside Stairs",
    category:  "staircase_maker",
    blurb:     "a UK staircase manufacturer",
    patterns:  [/\bwoodside\s?stairs?\b/i]
  },
  {
    canonical: "Stairway Joinery",
    category:  "staircase_maker",
    blurb:     "a UK staircase joinery manufacturer",
    patterns:  [/\bstairway\s?joinery\b/i]
  },
  {
    canonical: "First Step Designs",
    category:  "staircase_maker",
    blurb:     "a UK bespoke staircase manufacturer",
    patterns:  [/\bfirst\s?step\s?designs?\b/i]
  }
];
