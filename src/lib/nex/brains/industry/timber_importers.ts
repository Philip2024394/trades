// UK wholesale TIMBER IMPORTERS + DISTRIBUTORS — the wholesale layer
// above retail wood suppliers. Import container-scale volumes from
// overseas sawmills and distribute nationally to trade merchants,
// stair makers, and specialist wood suppliers.
//
// Homeowners rarely encounter these companies directly — they're the
// invisible backbone of UK timber supply. Trade professionals ask
// about them regularly to understand where their stock originates.

import type { CompanyEntry } from "./_types";

export const TIMBER_IMPORTERS: CompanyEntry[] = [
  {
    canonical: "James Latham",
    category:  "timber_importer",
    blurb:     "one of the UK's largest timber and panel distributors — imports and distributes hardwoods, softwoods, decorative panels and surface materials nationally from multiple UK depots. Trade-only",
    patterns:  [/\bjames\s?latham\b/i, /\blatham\s?timber\b/i]
  },
  {
    canonical: "International Timber",
    category:  "timber_importer",
    blurb:     "a UK-leading timber importer and distributor of sustainable timber and panel products — supplies trade merchants and specialist manufacturers nationally",
    patterns:  [/\binternational\s?timber\b/i]
  },
  {
    canonical: "Meyer Timber",
    category:  "timber_importer",
    blurb:     "a UK-leading importer and distributor of wood-based panels operating from national depots — trade-focused wholesale",
    patterns:  [/\bmeyer\s?timber\b/i]
  },
  {
    canonical: "BSW Timber",
    category:  "timber_importer",
    blurb:     "the UK's largest integrated forestry and timber business — sawmill and supplier of FSC-certified sawn products (fencing, landscaping, cladding, construction) to trade merchants",
    patterns:  [/\bbsw\s?timber\b/i, /\bbsw\s?group\b/i]
  },
  {
    canonical: "MJG Timber",
    category:  "timber_importer",
    blurb:     "a UK timber importer and wholesaler supplying trade merchants nationally",
    patterns:  [/\bmjg\s?timber\b/i]
  },
  {
    canonical: "Sydenhams",
    category:  "timber_importer",
    blurb:     "a UK regional (Southern England) timber importer and merchant supplying trade and construction",
    patterns:  [/\bsydenhams?\b/i]
  }
];
