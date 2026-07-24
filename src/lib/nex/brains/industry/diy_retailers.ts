// UK consumer-focused DIY RETAILERS — high-street + online consumer
// brands where homeowners buy stairparts for self-fit projects.
//
// Distinguished from trade builders' merchants (Travis Perkins, Selco)
// because the audience, product range depth, and pricing model are
// different. Nex gives DIY-tone guidance here.

import type { CompanyEntry } from "./_types";

export const DIY_RETAILERS: CompanyEntry[] = [
  {
    canonical: "B&Q",
    category:  "diy_retailer",
    blurb:     "a UK national DIY retailer — they stock basic stairparts (spindles, newels, handrails) and occasional pre-made stair kits alongside general DIY supplies. Homeowner + weekend-DIY focused, not a staircase specialist",
    patterns:  [/\bb\s?&\s?q\b/i, /\bb\s?and\s?q\b/i]
  },
  {
    canonical: "Homebase",
    category:  "diy_retailer",
    blurb:     "a UK DIY retailer — they stock basic stairparts alongside general home improvement supplies. Homeowner focused, not a staircase specialist",
    patterns:  [/\bhomebase\b/i]
  },
  {
    canonical: "Wickes",
    category:  "diy_retailer",
    blurb:     "a UK national builders' merchant and DIY retailer — they stock basic stairparts (softwood spindles, newels, handrails) alongside their general building supplies, and offer a limited range of pre-made stair kits. Mixed trade + DIY, not a staircase specialist",
    patterns:  [/\bwickes\b/i]
  },
  {
    canonical: "Screwfix",
    category:  "diy_retailer",
    blurb:     "a UK trade tool + supplies retailer — they stock a limited range of stairparts (mainly handrails, brackets, fixings) alongside their tool-focused core. Not a staircase specialist",
    patterns:  [/\bscrewfix\b/i]
  },
  {
    canonical: "Toolstation",
    category:  "diy_retailer",
    blurb:     "a UK trade tool + supplies retailer — they stock a limited range of stairparts (handrails, fixings). Not a staircase specialist",
    patterns:  [/\btoolstation\b/i]
  }
];
