// UK stairparts + mouldings SUPPLIERS — specialist companies that
// supply components (spindles, newel posts, handrails, decorative
// mouldings) to trade, DIY retail, and other manufacturers.
//
// These companies do NOT build complete staircases. That's a common
// homeowner confusion and Nex must correct it whenever asked.

import type { CompanyEntry } from "./_types";

export const STAIRPARTS_SUPPLIERS: CompanyEntry[] = [
  {
    canonical: "Richard Burbidge",
    category:  "parts_supplier",
    blurb:     "a UK stairparts and timber mouldings supplier — they supply spindles, newel posts, handrails, and decorative mouldings to trade, DIY, and retail markets, with outlets in the UK and Ireland. They do NOT build complete staircases; they supply the components that go INTO staircases",
    patterns:  [/\brichard\s?burbidge\b/i, /\bburbidge\b/i]
  },
  {
    canonical: "Cheshire Mouldings",
    category:  "parts_supplier",
    blurb:     "a Warrington-based UK stairparts and mouldings supplier — they supply spindles, newel posts, handrails, and timber mouldings to trade merchants and DIY retail. They do NOT build complete staircases; they supply components",
    patterns:  [/\bcheshire\s?mouldings?\b/i, /\bcheshire\s?moldings?\b/i]
  },
  {
    canonical: "Jackson Woodturners",
    category:  "parts_supplier",
    blurb:     "a UK stairparts supplier specialising in turned spindles, newel posts, and handrails for trade and retail. They do NOT build complete staircases; they supply turned wooden components",
    patterns:  [/\bjackson\s?woodturners?\b/i]
  },
  {
    canonical: "Stair Parts Direct",
    category:  "parts_supplier",
    blurb:     "a UK stairparts retailer supplying spindles, newel posts, handrails, and starting steps. They supply components, not complete staircases",
    patterns:  [/\bstair\s?parts?\s?direct\b/i]
  },
  {
    canonical: "Central Joinery Group",
    category:  "parts_supplier",
    blurb:     "a UK stairparts manufacturer supplying components (spindles, newels, handrails, treads) to trade and retail. They supply components, not complete staircases",
    patterns:  [/\bcentral\s?joinery\s?group\b/i]
  },
  {
    canonical: "Traditional Products",
    category:  "parts_supplier",
    blurb:     "a UK timber stairparts manufacturer supplying spindles, newel posts and handrails to trade and retail",
    patterns:  [/\btraditional\s?products?\b/i]
  },
  {
    canonical: "P&L Joinery",
    category:  "parts_supplier",
    blurb:     "a UK stairparts supplier offering treads, risers, spindles and bespoke stair components",
    patterns:  [/\bp\s?&\s?l\s?joinery\b/i, /\bp\s?and\s?l\s?joinery\b/i]
  },
  {
    canonical: "Stair Parts Online",
    category:  "parts_supplier",
    blurb:     "a UK online stairparts retailer",
    patterns:  [/\bstair\s?parts?\s?online\b/i]
  },
  {
    canonical: "Timber Mouldings Direct",
    category:  "parts_supplier",
    blurb:     "a UK timber mouldings and stairparts supplier offering profiled timbers for trade and retail",
    patterns:  [/\btimber\s?mouldings?\s?direct\b/i]
  }
];
