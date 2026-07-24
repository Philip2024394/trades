// UK trade-focused BUILDERS' MERCHANTS — national + regional chains
// selling general building materials to the trade, with stairparts as
// one of many lines rather than a specialism.
//
// Consumer-DIY-focused retailers (B&Q, Homebase) live in
// diy_retailers.ts — the trade / DIY split matters because the audience
// expects different guidance from each.

import type { CompanyEntry } from "./_types";

export const BUILDING_MERCHANTS: CompanyEntry[] = [
  {
    canonical: "Travis Perkins",
    category:  "builders_merchant",
    blurb:     "a UK trade-focused national builders' merchant — they stock a range of stairparts and basic pre-made stair kits alongside general building materials. Trade-account focused. Not a staircase specialist",
    patterns:  [/\btravis\s?perkins?\b/i]
  },
  {
    canonical: "Selco",
    category:  "builders_merchant",
    blurb:     "a UK trade-focused builders' merchant — they stock stairparts and basic pre-made stair kits as part of their broader trade catalogue. Not a staircase specialist",
    patterns:  [/\bselco\b/i]
  },
  {
    canonical: "Jewson",
    category:  "builders_merchant",
    blurb:     "a UK national trade-focused builders' merchant — they stock stairparts and basic stair kits alongside general building materials. Not a staircase specialist",
    patterns:  [/\bjewson\b/i]
  },
  {
    canonical: "MKM Building Supplies",
    category:  "builders_merchant",
    blurb:     "a UK regional builders' merchant chain — they stock stairparts and basic building materials, with a trade focus. Not a staircase specialist",
    patterns:  [/\bmkm\b/i]
  },
  {
    canonical: "Buildbase",
    category:  "builders_merchant",
    blurb:     "a UK trade builders' merchant — they stock stairparts and basic stair kits within general building supplies. Not a staircase specialist",
    patterns:  [/\bbuildbase\b/i]
  },
  {
    canonical: "Bradfords",
    category:  "builders_merchant",
    blurb:     "a UK regional builders' merchant (South-West England focus) — they stock stairparts as part of their general trade catalogue. Not a staircase specialist",
    patterns:  [/\bbradfords?\b/i]
  },
  {
    canonical: "Grafton Merchanting",
    category:  "builders_merchant",
    blurb:     "a UK/Ireland-based trade builders' merchant group operating multiple regional chains including Buildbase and Selco",
    patterns:  [/\bgrafton\s?merchanting\b/i, /\bgrafton\s?group\b/i]
  }
];
