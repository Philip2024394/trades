// Trade Encyclopaedia — /what-is/[trade] config.
//
// The third intent surface per trade slug:
//   /trades/[trade]   → hire one (commercial)
//   /careers/[trade]  → become one (career)
//   /what-is/[trade]  → understand what they do (informational)
//
// Ranks for the informational queries that don't fit the other
// surfaces:
//   • "what does a plumber do"
//   • "what's the difference between a plumber and a heating engineer"
//   • "what tools does an electrician use"
//   • "what does a carpenter earn"
//   • "when do I need a plasterer vs a decorator"
//
// Content is deliberately different from /careers — here we focus on
// the scope of the trade, typical jobs, tools, adjacent trades, and
// common confusions. Career + earnings + qualifications live at
// /careers/[trade].

import { CAREER_GUIDES } from "@/app/careers/config";

export type WhatIsEntry = {
  slug:            string;
  displayName:     string;
  /** One-sentence definition (used in meta description + AI-search extraction). */
  definition:      string;
  /** 2-3 paragraph body giving the full scope of the trade. */
  scope:           string[];
  /** Typical jobs a homeowner would call this trade for. */
  typicalJobs:     string[];
  /** Core tools + kit — grounds the trade in tangible reality. */
  toolsOfTrade:    string[];
  /** Adjacent trades that often work alongside — cross-links. */
  worksAlongside:  string[];
  /** Commonly-confused-with trades — the 'vs' comparisons. */
  oftenConfusedWith: Array<{
    otherSlug:    string;
    otherName:    string;
    difference:   string;
  }>;
  /** Related pointer — link to a Vault article if we have one. */
  vaultArticle?: string;
  lastReviewed:    string;
};

export const WHAT_IS: WhatIsEntry[] = [
  {
    slug: "plumber",
    displayName: "Plumber",
    definition:
      "A plumber is a UK tradesperson who installs, repairs, and maintains water, drainage, and heating systems in domestic and commercial properties — everything from a leaky tap to a full central heating install.",
    scope: [
      "Plumbing in the UK covers three broad areas: potable water (cold + hot supply, taps, showers, cylinders), waste + drainage (WCs, sinks, baths, external drains, rainwater), and wet heating (radiators, underfloor heating, cylinders, pumps). Any plumber will handle the first two; heating specialists dominate the third.",
      "Under the Gas Safety (Installation and Use) Regulations 1998, work on gas appliances or gas pipework is legally restricted to Gas Safe registered engineers. Around 70% of UK plumbers hold both the Level 3 plumbing NVQ and Gas Safe registration — they're the ones who can install your boiler, gas hob, or new radiator system end-to-end.",
      "Pure plumbers (no gas rights) cover everything that doesn't touch a gas fitting: bathroom refits, waste + drainage, water tanks, radiators (fitting new ones, moving them, balancing), leak repair, and cold-water installations."
    ],
    typicalJobs: [
      "Bathroom refit (bath, basin, WC, taps, shower)",
      "Kitchen sink + dishwasher + washing machine plumbing",
      "Boiler service, repair, or replacement (Gas Safe required)",
      "New radiator install or move",
      "Blocked drain or waste pipe repair",
      "Emergency leak repair",
      "Hot water cylinder swap or replacement",
      "Wet underfloor heating install"
    ],
    toolsOfTrade: [
      "Blowtorch + solder + flux (copper joints)",
      "Pipe cutters + pipe benders",
      "Adjustable wrench + Stilsons + basin wrench",
      "PTFE tape + jointing compound",
      "Manometer + gas analyser (Gas Safe)",
      "Drain rods + drain jetter",
      "Push-fit fittings (Speedfit, Hep2O) + press-fit tooling"
    ],
    worksAlongside: [
      "electrician",
      "tiler",
      "gas-safe-engineer",
      "plasterer",
      "carpenter"
    ],
    oftenConfusedWith: [
      {
        otherSlug: "gas-safe-engineer",
        otherName: "Gas Safe engineer",
        difference: "Every Gas Safe engineer is qualified in plumbing basics; not every plumber holds Gas Safe registration. For gas work — hire a Gas Safe engineer. For water-only work — either can do it, plumbers are cheaper."
      },
      {
        otherSlug: "heating-engineer",
        otherName: "Heating engineer",
        difference: "'Heating engineer' is not a protected UK title — it's a plumber who specialises in heating systems (boilers, radiators, controls). Most UK heating engineers are also Gas Safe registered."
      }
    ],
    vaultArticle: "plumber-vs-gas-safe-engineer-uk",
    lastReviewed: "2026-07-20"
  },
  {
    slug: "electrician",
    displayName: "Electrician",
    definition:
      "An electrician is a UK tradesperson who designs, installs, tests, and maintains electrical systems — from a new socket in a bedroom to a full commercial three-phase supply.",
    scope: [
      "UK electrical work is governed by BS 7671 (the IET Wiring Regulations, currently 18th Edition) and Part P of the Building Regulations. Any work that adds a new circuit, or any work in a bathroom, kitchen, or outdoors, is notifiable — meaning it must be either self-certified by a registered Part P scheme member (NICEIC, NAPIT, ELECSA, Stroma) or notified to Building Control separately.",
      "Residential electricians handle sockets, lights, consumer units, EV chargers, security systems, network cabling, and PV/battery-storage integration. Commercial + industrial electricians work on larger three-phase systems, control panels, motors, and industrial machinery.",
      "The three sub-specialisms growing fastest in the UK 2026: EV chargepoint installers (huge demand as new-build regs mandate them), battery + solar PV retrofit specialists, and industrial control systems engineers (PLC programming + panel building)."
    ],
    typicalJobs: [
      "Full house rewire",
      "New consumer unit install",
      "Adding a socket, light point, or outdoor circuit",
      "EV chargepoint install",
      "Fault-finding (tripping RCD, dead circuit)",
      "Bathroom or kitchen rewire",
      "Solar PV + battery storage install",
      "Electrical Installation Certificate (EIC) for a house purchase"
    ],
    toolsOfTrade: [
      "Multi-function tester (insulation resistance, loop impedance, RCD test)",
      "Voltage indicator + proving unit",
      "Cable cutters + strippers + crimping tool",
      "SDS drill + long masonry bits (chasing walls)",
      "Cable draw rods + fish tape",
      "Torque screwdriver (consumer unit termination)",
      "Non-contact voltage detector"
    ],
    worksAlongside: [
      "plumber",
      "carpenter",
      "plasterer",
      "gas-safe-engineer",
      "tiler"
    ],
    oftenConfusedWith: [
      {
        otherSlug: "electrician",
        otherName: "Domestic installer",
        difference: "A 'domestic installer' has done a short adult fast-track and can self-certify residential work only. A full electrician has a Level 3 NVQ + AM2 endpoint assessment and can work commercially + industrially as well."
      }
    ],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "carpenter",
    displayName: "Carpenter / Joiner",
    definition:
      "A carpenter is a UK tradesperson who cuts, fits, and finishes structural + finish timber on-site; a joiner is the workshop counterpart, making bespoke timber items (doors, windows, staircases, kitchens) that a carpenter then installs.",
    scope: [
      "The trade splits into two halves. First-fix carpentry is structural — joists, roof timbers, studwork partitions, floor decks, staircases (fitting). Second-fix carpentry is the finish — doors, skirting, architrave, kitchen fitting, feature joinery. Most site carpenters do both.",
      "Joinery is the workshop trade — making the items that a carpenter later fits. A bench joiner cuts staircases, windows, doors, cabinets, and bespoke furniture in a shop with proper machinery. High-end bespoke joiners often install their own work end-to-end.",
      "Carpentry is one of the UK's most portable trades — qualified carpenters are welcomed on skilled-migrant routes to Australia, Canada, and the US. The Level 3 NVQ is broadly recognised."
    ],
    typicalJobs: [
      "First-fix on an extension (joists, studs, roof timbers)",
      "Fit new internal doors + architraves",
      "Fit skirting boards throughout a house",
      "Kitchen unit install",
      "Bespoke fitted wardrobes",
      "Staircase install",
      "Timber decking + garden structures",
      "Loft floor + partition for a conversion"
    ],
    toolsOfTrade: [
      "Circular saw + track saw",
      "Mitre saw (chop saw)",
      "Router + router table (joinery)",
      "Nail gun (first + second fix) + air compressor",
      "Chisels + mallet + block plane",
      "Combination square + spirit levels + laser level",
      "Cordless drill/driver + impact driver"
    ],
    worksAlongside: [
      "bricklayer",
      "plasterer",
      "electrician",
      "plumber",
      "roofer",
      "tiler"
    ],
    oftenConfusedWith: [
      {
        otherSlug: "carpenter",
        otherName: "Kitchen fitter",
        difference: "A kitchen fitter installs manufactured units (Howdens, Wren, IKEA). A carpenter/joiner can also fit kitchens — plus make bespoke units from scratch. For a fitted-brand kitchen, a fitter is faster + cheaper. For bespoke, a joiner."
      }
    ],
    vaultArticle: "kitchen-fitters-vs-bespoke-joiners-uk",
    lastReviewed: "2026-07-20"
  },
  {
    slug: "plasterer",
    displayName: "Plasterer",
    definition:
      "A plasterer is a UK tradesperson who applies wet finishes to walls + ceilings — skim, browning, render, and lime — and installs plasterboard (drylining) as the substrate for those finishes.",
    scope: [
      "The trade splits three ways. Solid plastering is the everyday work — skim over existing plaster or new plasterboard, wet-render on external walls, patching + making good. Fibrous plastering is the specialist workshop side — cast ornate ceilings, cornice, corbels, and roses in gypsum. Heritage plastering restores historic lime-and-lath ceilings in period + listed properties.",
      "Speed matters more than in most trades. A fast plasterer's day-rate income is often double a slow one's on the same ticket price — walls set on a fixed schedule regardless of the person applying them, so getting to trowel-down before the plaster goes off is a real skill.",
      "Plastering + drylining underpin almost every UK construction + renovation project. Any new-build, extension, loft conversion, or refurb needs plaster before the paint and second-fix carpentry can go on."
    ],
    typicalJobs: [
      "Skim over new plasterboard on an extension or loft conversion",
      "Full re-plaster of a room (browning + skim)",
      "Ceiling only — repair or replace after leak damage",
      "External render on a house wall",
      "Insulated plasterboard (dot + dab) install",
      "Patching + making good after electrical or plumbing work",
      "Restore or replace period cornice + ceiling roses"
    ],
    toolsOfTrade: [
      "Plaster trowel (finishing) + gauging trowel",
      "Hawk (holding board)",
      "Speedskim / featheredge trowel",
      "Mixing paddle + drill",
      "Bucket + water sprayer (mist coats + dampening)",
      "Corner trowel + internal + external corner beads",
      "Level + straight edge (rendering)"
    ],
    worksAlongside: [
      "carpenter",
      "electrician",
      "plumber",
      "tiler",
      "painter"
    ],
    oftenConfusedWith: [
      {
        otherSlug: "painter",
        otherName: "Painter + decorator",
        difference: "A plasterer creates the smooth wall surface; a painter/decorator finishes it. Some overlap — an experienced painter will patch small holes, an experienced plasterer will mist-coat their own work. But you hire them for different reasons."
      }
    ],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "roofer",
    displayName: "Roofer",
    definition:
      "A roofer is a UK tradesperson who installs and repairs pitched + flat roofs, including tiles, slate, lead work, flashings, gutters, and single-ply + felt + EPDM flat-roof coverings.",
    scope: [
      "UK roofing splits by surface type. Pitched roofers work with concrete tiles, clay tiles, and natural + reconstituted slate. Flat roofers use EPDM, GRP fibreglass, single-ply (TPO/PVC), and — increasingly rarely — traditional felt. Lead roofers are a specialist niche for heritage + church work.",
      "Every UK roofing job needs Working at Heights competence plus a CSCS card for commercial sites. HSE inspects height-work compliance often — an unqualified roofer on a commercial site is a legal issue for the main contractor.",
      "Roofing is seasonal in demand — insurance-driven storm repair peaks December-April, while planned re-roofing + new-build work peaks May-October. The best roofers keep both books running so their year is smooth."
    ],
    typicalJobs: [
      "Full re-roof (strip + felt + batten + retile)",
      "Roof repair — replace broken tiles, ridge, or valley",
      "Flat roof replacement (EPDM, GRP, or single-ply)",
      "Chimney repointing + flashing repair",
      "Gutter + fascia + soffit install",
      "Lead flashing + valley + dormer detailing",
      "Emergency storm damage patch + tarp"
    ],
    toolsOfTrade: [
      "Slate hammer + slate ripper",
      "Roofing hatchet + tile cutter",
      "Nail gun (batten fixing)",
      "Lead dresser + lead knife (soft-metal work)",
      "Ladder + roof ladder + edge protection",
      "Blowtorch (torch-on felt) or seam roller (EPDM)"
    ],
    worksAlongside: [
      "carpenter",
      "bricklayer",
      "plasterer"
    ],
    oftenConfusedWith: [
      {
        otherSlug: "roofer",
        otherName: "Flat roofer",
        difference: "A general roofer will do both pitched + flat, but most specialise. For a flat roof job (extension roof, garage roof, dormer), hire a dedicated flat roofer — the materials + technique are completely different from pitched work."
      }
    ],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "bricklayer",
    displayName: "Bricklayer",
    definition:
      "A bricklayer is a UK tradesperson who builds and repairs walls in brick, block, and stone — everything from a new-build extension shell + garden wall to a rebuilt chimney stack + full-house repointing.",
    scope: [
      "Bricklaying splits three ways in UK practice. New-build + extension shells are the biggest volume — cavity brick + block work on housebuilder sites, single- and two-storey extensions on residential jobs. Repair work covers rebuilding damaged wall sections, chimney stack replacement, and repointing weathered joints (both modern cement mortar and lime for heritage properties). Structural alterations include new openings with steel lintels, subsidence remediation, and cavity-wall injection prep.",
      "UK bricklayers appear on the Home Office Shortage Occupation List and have done since 2019 — the widening skills gap drives above-inflation wage growth in every UK region, and creates a skilled-worker visa route for overseas practitioners.",
      "Most established UK bricklayers work in gangs of 2-3 with a labourer. New-build is priced piece-rate (£450-£900 per thousand bricks laid); repair + heritage work is day-rate."
    ],
    typicalJobs: [
      "Single- or two-storey extension shell",
      "New garden wall or boundary wall",
      "Chimney stack rebuild or repair",
      "Repointing a house or a chimney",
      "New brick opening + lintel install",
      "Garage or outbuilding construction",
      "Lime-mortar heritage repair on listed properties"
    ],
    toolsOfTrade: [
      "Brick trowel + pointing trowel",
      "Spirit level (600mm + 1200mm)",
      "Brick line + line blocks",
      "Bolster + club hammer (cutting bricks)",
      "Angle grinder (chase cuts + block cuts)",
      "Mixer + mortar boards",
      "Corner blocks + gauging rod"
    ],
    worksAlongside: [
      "carpenter",
      "plasterer",
      "roofer",
      "electrician",
      "plumber"
    ],
    oftenConfusedWith: [
      {
        otherSlug: "bricklayer",
        otherName: "Stonemason",
        difference: "In UK usage they overlap significantly, but 'stonemason' implies specialisation in natural stone + heritage work (ashlar, dressed stone, listed-building repair). A bricklayer will do modern brick + block first and stonework as a secondary skill; a stonemason works the other way."
      }
    ],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "gas-safe-engineer",
    displayName: "Gas Safe engineer",
    definition:
      "A Gas Safe engineer is the only UK tradesperson legally allowed to work on gas appliances or gas pipework — statutory requirement under the Gas Safety (Installation and Use) Regulations 1998, administered by the Gas Safe Register.",
    scope: [
      "Gas Safe covers everything gas — boilers, gas hobs, gas fires, gas water heaters, and any pipework carrying gas. Around 70% of Gas Safe engineers also hold a Level 3 plumbing NVQ, meaning they handle full bathroom + heating installs end-to-end. The 30% who are Gas Safe only tend to work as boiler + commissioning specialists.",
      "Every engineer holds an ID card with a unique 7-digit licence number, verifiable at GasSafeRegister.co.uk. The register is the statutory replacement for the older CORGI scheme (which ended in 2009).",
      "Landlord CP12 gas safety certificates are legally required annually on every UK rented property — Gas Safe engineers issue these. Missing or expired CP12s carry criminal + civil liability for the landlord."
    ],
    typicalJobs: [
      "Boiler install, service, or repair",
      "Gas hob install or move",
      "Gas fire install or removal",
      "CP12 landlord gas safety certificate",
      "New gas pipe run from the meter",
      "Gas leak diagnosis + repair",
      "Boiler + cylinder swap (system boiler)",
      "First-time-fit gas central heating"
    ],
    toolsOfTrade: [
      "Manometer (gas pressure test)",
      "Combustion + flue gas analyser",
      "Gas leak detection spray + electronic gas sniffer",
      "Pipe cutter + press-fit tooling",
      "Torque wrench (boiler + cylinder connections)",
      "Benchmark commissioning log book"
    ],
    worksAlongside: ["plumber", "electrician", "carpenter"],
    oftenConfusedWith: [
      {
        otherSlug: "plumber",
        otherName: "Plumber",
        difference: "A plumber can do everything water + waste + heating that doesn't touch gas. Any gas work is legally restricted to Gas Safe engineers. Most Gas Safe engineers ARE plumbers plus gas — but not every plumber is Gas Safe registered."
      }
    ],
    vaultArticle: "plumber-vs-gas-safe-engineer-uk",
    lastReviewed: "2026-07-20"
  },
  {
    slug: "tiler",
    displayName: "Tiler",
    definition:
      "A UK tiler fits ceramic, porcelain, natural stone, and glass tiles to walls + floors — bathrooms, kitchens, wet-rooms, and floors. Substrate prep, adhesive selection, wet-area tanking, and clean grouting are the specialist skills.",
    scope: [
      "Modern UK tiling is mostly ceramic (walls) + porcelain (floors + wet areas) + natural stone (premium). Complex jobs require substrate prep (plywood overlay, self-levelling compound, primer) plus tile-backer boards on wet walls + tanking membrane in wet-rooms. Wet-room tanking is the highest-consequence sub-skill — if it fails, water damage shows up 12-24 months later.",
      "Rates work two ways. Straightforward jobs — quoted per m² (£45-£130/m² depending on tile + complexity). Feature work — day-rate (£180-£300/day). Herringbone + mixed-random + mitred external corners are always day-rate."
    ],
    typicalJobs: [
      "Full bathroom wall + floor tiling",
      "Kitchen splashback",
      "Wet-room conversion with tanking",
      "Floor tiling — porcelain, natural stone, or large-format",
      "Feature walls (herringbone, mosaic, brick-effect)",
      "Grout renewal + silicone refresh"
    ],
    toolsOfTrade: [
      "Wet tile saw + score-and-snap cutter",
      "Notched adhesive trowel + grouting float",
      "Spirit level + tile-levelling clips",
      "Angle grinder with diamond blade",
      "Tanking primer + membrane roll",
      "Mixing bucket + drill paddle"
    ],
    worksAlongside: ["plumber", "plasterer", "electrician"],
    oftenConfusedWith: [
      {
        otherSlug: "plasterer",
        otherName: "Plasterer",
        difference: "Plasterer creates the smooth wet-plaster wall substrate. Tiler works on top of a fully-dry, sound plaster surface — prime, tank if wet-area, then tile. Both trades typically arrive on the same job on different days."
      }
    ],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "landscaper",
    displayName: "Landscaper",
    definition:
      "A UK landscaper designs and builds outdoor spaces — patios, decking, driveways, garden walls, planting schemes, lawns, drainage, and water features. Combines hard-landscape (build) and soft-landscape (planting) work.",
    scope: [
      "Hard-landscape covers structural build — patios (fitted stone or porcelain), driveways (SuDS-compliant permeable paving or resin-bound), decking (timber or composite), retaining walls, garden buildings, and drainage remediation. Soft-landscape covers planting design, turf laying, hedge planting, lawn care, and border maintenance.",
      "Since 2008, new + replaced UK driveways over 5m² must comply with Sustainable Drainage Systems (SuDS) regulations — either permeable paving or a soakaway. A qualified landscaper designs, quotes, and signs this off as part of the job."
    ],
    typicalJobs: [
      "Fitted patio (sandstone, porcelain, natural stone)",
      "Timber or composite decking install",
      "New driveway (SuDS-compliant)",
      "Garden wall (brick, block, or gabion)",
      "Turf lay or full lawn renovation",
      "Planting scheme + border install",
      "Drainage remediation + soakaway"
    ],
    toolsOfTrade: [
      "Whacker plate + compaction roller",
      "Diamond disc cutter (wet-cut stone/porcelain)",
      "String line + spirit level (falls + gradient)",
      "Mixer + wheelbarrow gang",
      "Turf cutter + rotavator",
      "Chainsaw (large plant + tree work)"
    ],
    worksAlongside: ["carpenter", "bricklayer", "electrician"],
    oftenConfusedWith: [
      {
        otherSlug: "landscaper",
        otherName: "Gardener",
        difference: "Gardeners maintain — mow, weed, prune, trim hedges. Landscapers build — patios, walls, structural work, planting schemes. Overlap exists at the small end (a landscaper does maintenance for existing clients; a gardener may do small planting jobs) but the specialisms diverge quickly."
      }
    ],
    lastReviewed: "2026-07-20"
  },
  {
    slug: "painter",
    displayName: "Painter & decorator",
    definition:
      "A UK painter & decorator prepares and paints walls, ceilings, woodwork, and exteriors — plus wallpaper hanging, effect finishes, and heritage restoration. Prep (filling, sanding, priming, mist-coating) is 60-70% of the job; the visible paint coats are the last 30-40%.",
    scope: [
      "The trade splits three ways. Interior residential — walls, ceilings, woodwork, wallpaper. Exterior — masonry paint, render, gutters + downpipes, timber cladding, gloss on woodwork. Specialist finishes — lime-wash for heritage properties, spray-lacquer joinery, effect coats (Venetian polished plaster, textured finishes).",
      "The visible finish quality tracks prep quality almost linearly. A good decorator fills every hairline crack, caulks every gap, sands between coats, and cuts in clean lines with a proper brush — the finish lasts 8-10 years. A rushed decorator skips prep + masks poorly — the finish shows tape lines + roller marks + peels in 2-3 years."
    ],
    typicalJobs: [
      "Full room repaint (ceiling + walls + woodwork)",
      "Whole-house interior refresh before sale",
      "Exterior masonry + render repaint",
      "Wallpaper hanging or removal",
      "Woodwork gloss + eggshell",
      "Heritage lime-wash restoration"
    ],
    toolsOfTrade: [
      "Cutting-in brush (angled, 1-2 inch)",
      "9-inch + 12-inch roller with microfiber sleeves",
      "Filler + caulk gun",
      "Sanding block + orbital sander",
      "Masking tape + dust sheets + drop cloths",
      "Ladder + hop-up + light scaffold tower"
    ],
    worksAlongside: ["plasterer", "carpenter"],
    oftenConfusedWith: [
      {
        otherSlug: "plasterer",
        otherName: "Plasterer",
        difference: "Plasterer creates the smooth wall substrate; painter finishes it. Overlap exists — an experienced painter will patch small holes with filler; an experienced plasterer will mist-coat their own work. But for anything above a hairline crack, hire both."
      }
    ],
    lastReviewed: "2026-07-20"
  }
];

// Helpful map from what-is slug → career-guide slug (mostly 1:1).
export function careerGuideForSlug(slug: string) {
  return CAREER_GUIDES.find((g) => g.slug === slug);
}
