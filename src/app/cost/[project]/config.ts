// Programmatic /cost/[project] and /cost/[project]/[city] config.
//
// Every project is a fully-authored construction cost breakdown tuned
// for high-intent search + AI-search snippet extraction. Numbers are
// UK 2026 industry data — refresh quarterly by hand until we auto-
// derive from live Counter listings (Phase 2 of the SEO roadmap).
//
// The regional multiplier map lets one project scale to 10+ cities
// without hand-authoring each. London runs 25-40% above national;
// North East + Wales run 10-15% below.

export type ProjectSlug =
  | "kitchen-extension"
  | "loft-conversion"
  | "bathroom-refit"
  | "house-rewire"
  | "new-boiler";

export const PROJECTS: ProjectSlug[] = [
  "kitchen-extension",
  "loft-conversion",
  "bathroom-refit",
  "house-rewire",
  "new-boiler"
];

// Cost regional multiplier vs national average.
export const CITY_MULTIPLIER: Record<string, number> = {
  london:     1.35,
  bristol:    1.10,
  edinburgh:  1.05,
  manchester: 1.02,
  leeds:      0.98,
  birmingham: 0.98,
  glasgow:    0.95,
  liverpool:  0.92,
  sheffield:  0.92,
  newcastle:  0.90
};

export type CostSize = {
  slug:       string;
  label:      string;
  lowGbp:     number;
  highGbp:    number;
  /** One-line describing what fits this bucket. */
  scope:      string;
  /** Typical duration in weeks. */
  weeksLow:   number;
  weeksHigh:  number;
};

export type ProjectContent = {
  singular:      string;           // "kitchen extension"
  headline:      string;           // "How much does a kitchen extension cost?"
  /** ~40-word expert definition — tuned for AI-snippet quotation. */
  aiAnswer:      string;
  /** 200-400 word body copy — SEO body. */
  bodyIntro:     string;
  /** 3-4 tier size buckets with cost ranges + typical duration. */
  sizes:         CostSize[];
  /** Materials vs Labour split % — helps informed budgeting. */
  materialsPct:  number;
  labourPct:     number;
  /** Notes on planning permission / building regs. */
  regsNote:      string;
  /** 5-6 FAQs. */
  faqs:          { q: string; a: string }[];
  /** Trades this project needs. */
  tradesNeeded:  string[];
  /** Trades to cross-link into. */
  relatedTrades: string[];
  /** Optional per-project hero override. Bypasses pickHeroForTrade
   *  and pins a specific image on this page. Documented in the hero
   *  library under sibling_group_id "cost-project-covers". */
  heroOverride?: {
    imageUrl:  string;
    subject:   string;
    widthPx?:  number;
    heightPx?: number;
  };
};

export const PROJECT_CONTENT: Record<ProjectSlug, ProjectContent> = {
  "kitchen-extension": {
    heroOverride: {
      imageUrl:  "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2006_46_58%20AM.png",
      subject:   "UK single-storey rear kitchen extension with bifold doors and open-plan living",
      widthPx:   1536,
      heightPx:  1024
    },
    singular:  "kitchen extension",
    headline:  "How much does a kitchen extension cost?",
    aiAnswer:  "A single-storey rear kitchen extension in the UK costs £30,000-£75,000 depending on size, finish, and location. Includes foundations, walls, roof, glazing, plastering, electrics, plumbing, and a mid-range kitchen fit.",
    bodyIntro: "A kitchen extension is the most common home improvement in the UK — most family homes gain an extra 15-30m² of living space by pushing the back wall out and combining kitchen + dining + family room into one open-plan area. Costs split roughly 55% construction (build shell), 25% kitchen (units + worktops + appliances), 10% MEP (mechanical, electrical, plumbing), and 10% finishes (flooring, paint, tile). Permitted Development covers most rear extensions up to 3m single-storey (4m for detached); anything larger, side-return, or wrap-around needs planning permission. Building Regulations approval applies regardless. Expect 12-24 weeks total including design, planning, tender, build, and finish.",
    sizes: [
      { slug: "small",  label: "Small (15-20m²)",       lowGbp: 30000, highGbp: 45000, scope: "Rear extension 3m depth, PD-compliant, mid-range finish",  weeksLow: 10, weeksHigh: 16 },
      { slug: "medium", label: "Medium (20-30m²)",      lowGbp: 45000, highGbp: 65000, scope: "Rear extension 4m + side return, needs planning, mid-range", weeksLow: 14, weeksHigh: 20 },
      { slug: "large",  label: "Large (30-50m²)",       lowGbp: 65000, highGbp: 110000, scope: "Wrap-around or double-height, structural steels, premium finish", weeksLow: 18, weeksHigh: 28 }
    ],
    materialsPct:  55,
    labourPct:     45,
    regsNote:      "Permitted Development applies to rear extensions up to 3m (semi) or 4m (detached). Anything larger — planning permission. Building Regs approval always required. Party Wall notice to neighbours if within 3m of shared wall.",
    faqs: [
      { q: "How long does a kitchen extension take from start to finish?",     a: "12-24 weeks total: 4-8 weeks design + planning, 2-4 weeks tender + surveys, 10-14 weeks build + finish. Larger projects (50m²+) can run 30+ weeks." },
      { q: "Do I need planning permission for a kitchen extension?",           a: "Rear extensions up to 3m single-storey (4m detached) qualify for Permitted Development — no permission needed. Side-return, two-storey, or larger sizes need full planning permission (8-13 week decision)." },
      { q: "What's the cheapest way to do a kitchen extension?",               a: "Small (15m²) rear extension with a mid-range kitchen from £30,000. Cost savings: keep the same footprint (no side wall), use trussed rafter roof over pitched-tile, standard aluminium bi-folds over sliding glass, and choose off-the-shelf units over bespoke." },
      { q: "Do I need an architect for a kitchen extension?",                  a: "Not strictly — a good design-and-build contractor can handle PD-compliant designs. For anything needing planning, a chartered architect or architectural technologist is worth the £2,500-£6,000 fee." },
      { q: "How much value does a kitchen extension add?",                     a: "In UK 2026 data, a well-built kitchen extension adds roughly 10-15% to property value — usually 1.3-1.8× the build cost is recovered on sale. Best ROI in London + South East." },
      { q: "Can I live in my house during a kitchen extension?",               a: "Yes — most homeowners stay. Expect 3-4 weeks with no working kitchen (temporary microwave + kettle setup in another room), noisy days during structural work, and dust. Most contractors dust-sheet the boundary." }
    ],
    tradesNeeded:  ["general-builder", "bricklayer", "carpenter", "plumber", "electrician", "plasterer", "roofer"],
    relatedTrades: ["carpenter", "electrician", "plumber"]
  },
  "loft-conversion": {
    singular:  "loft conversion",
    headline:  "How much does a loft conversion cost?",
    aiAnswer:  "A standard UK loft conversion costs £30,000-£65,000. Type depends on roof: Velux (rooflight only) from £25,000, dormer £45,000-£65,000, hip-to-gable £55,000-£75,000, mansard £70,000-£100,000+. Most are Permitted Development.",
    bodyIntro: "A loft conversion is the highest-value-per-£ home improvement in the UK — adds a bedroom (usually with en-suite) and typically 20% to property value while using space you already own. Four main types: Velux (rooflight only, cheapest, limited headroom), dormer (bump-out box, most common, best headroom), hip-to-gable (converts a hip roof to gable-end + dormer, larger space), mansard (rebuilds roof at steep angle, biggest space, needs planning). Most conversions are Permitted Development if within volume limits (40m³ terrace, 50m³ semi/detached). Structural work is the critical path — new floor joists sit on new steel beams. Expect 6-10 weeks build.",
    sizes: [
      { slug: "velux",       label: "Velux (basic)",         lowGbp: 25000, highGbp: 40000,  scope: "Rooflights only, no dormer. Best when existing headroom is good.",   weeksLow: 4,  weeksHigh: 7  },
      { slug: "dormer",      label: "Dormer",                lowGbp: 45000, highGbp: 65000,  scope: "Box dormer at rear, en-suite included. Most common.",              weeksLow: 6,  weeksHigh: 9  },
      { slug: "hip-to-gable",label: "Hip-to-gable + dormer", lowGbp: 55000, highGbp: 75000,  scope: "Rebuild hip end as gable + rear dormer. Semi-detached only.",     weeksLow: 8,  weeksHigh: 11 },
      { slug: "mansard",     label: "Mansard",               lowGbp: 70000, highGbp: 110000, scope: "Full roof rebuild at 72°. Biggest space, planning permission needed.", weeksLow: 10, weeksHigh: 14 }
    ],
    materialsPct:  50,
    labourPct:     50,
    regsNote:      "Velux + dormer usually Permitted Development if within volume limits (40m³ terrace, 50m³ semi/detached). Mansard always needs planning. Building Regs always required — structural, fire escape, insulation, staircase, headroom.",
    faqs: [
      { q: "Do I need planning permission for a loft conversion?",  a: "Most don't. Velux and rear dormers within volume limits (40m³ terrace, 50m³ semi/detached) are Permitted Development. Mansards, side dormers, and larger volume conversions need full planning permission (8-13 weeks)." },
      { q: "How long does a loft conversion take?",                 a: "Velux 4-7 weeks, dormer 6-9 weeks, hip-to-gable 8-11 weeks, mansard 10-14 weeks. Add 4-8 weeks upfront for design + Building Regs application, plus planning weeks if needed." },
      { q: "Can I live at home during a loft conversion?",          a: "Yes — most homeowners stay. Access is via a hatch first (external scaffold used for materials), then the new staircase is cut in near the end. Noisy days during structural steels going in (2-3 days) but generally liveable." },
      { q: "What's the minimum head height for a loft conversion?", a: "You need at least 2.2m from finished floor to underside of roof at the ridge, and 1.9m at any point where a stair lands. Most 1930s+ houses have this; older Victorian houses often don't and need a full rebuild of the roof (mansard territory)." },
      { q: "Do I need building regulations for a loft conversion?", a: "Always. Building Regs cover structural (new floor joists + steel), fire escape (protected staircase), insulation (U-value 0.18), and headroom. Notify Local Authority Building Control OR use an Approved Inspector before starting work." },
      { q: "How much value does a loft conversion add?",            a: "UK 2026 data: adds ~20% to property value on average. £45,000 dormer conversion on a £400,000 semi typically adds £80,000+ to sale price — one of the best ROI improvements in UK housing." }
    ],
    tradesNeeded:  ["general-builder", "carpenter", "plumber", "electrician", "plasterer", "roofer", "structural-engineer"],
    relatedTrades: ["carpenter", "roofer", "plumber"]
  },
  "bathroom-refit": {
    singular:  "bathroom refit",
    headline:  "How much does a new bathroom cost?",
    aiAnswer:  "A UK bathroom refit costs £3,500-£12,000 depending on size + finish. Budget suite + tiling from £3,500, mid-range with shower enclosure + wall-hung units £6,500-£8,500, premium (walk-in wet room + luxury units) £10,000+.",
    bodyIntro: "A bathroom refit typically takes 5-10 days for a domestic-size bathroom. The cost split: 25-35% suite (bath, WC, basin, taps), 20% tiles + waterproofing, 20% labour (plumber + tiler + electrician), 10% shower enclosure or bath screen, 15% surprises (rotten floor, hidden pipe issues). Wet rooms cost 20-30% more than a standard shower enclosure due to full tanking + gradient floor + drain. Bathroom plumbing has its own subset of Building Regs (Part G — waste + water) and any new circuit needs Part P electrical certification. Most refits are done by a bathroom fitter (a plumber who specialises) or a small team of plumber + tiler + electrician.",
    sizes: [
      { slug: "budget",  label: "Budget refit",       lowGbp: 3500,  highGbp: 5500,  scope: "Like-for-like swap, budget suite + tile-over-existing",           weeksLow: 1, weeksHigh: 2 },
      { slug: "midrange",label: "Mid-range refit",    lowGbp: 5500,  highGbp: 8500,  scope: "New suite, wall-hung units, full-height tile, LED lighting",    weeksLow: 1, weeksHigh: 2 },
      { slug: "premium", label: "Premium / wet room", lowGbp: 8500,  highGbp: 15000, scope: "Wet room, walk-in shower, underfloor heating, premium suite",  weeksLow: 2, weeksHigh: 3 }
    ],
    materialsPct:  60,
    labourPct:     40,
    regsNote:      "Building Regs apply: Part G (waste + water), Part L (energy), Part P (any new electrical circuit — inc lighting near bath). Notify LABC or use an Approved Inspector before work starts.",
    faqs: [
      { q: "How much does a new bathroom cost in the UK?",           a: "£3,500-£15,000. Budget refits (like-for-like swap, mid-range suite) from £3,500; mid-range with new tiles + wall-hung units £5,500-£8,500; premium wet rooms with underfloor heating £8,500-£15,000+." },
      { q: "How long does a bathroom refit take?",                   a: "5-10 working days for a standard bathroom. Wet rooms take 10-14 days due to full tanking + tile prep. Add a day either side for strip-out and snagging." },
      { q: "Do I need building regs for a new bathroom?",            a: "Yes — Part G (waste + water) and Part P (any new electrical circuit) both apply. Notify Local Authority Building Control OR use an Approved Inspector before work starts. Cost typically £250-£450." },
      { q: "Can one person fit a full bathroom?",                    a: "A bathroom fitter can do most of it solo (strip, first-fix plumbing, second-fix, tiling). Complex tiling or feature walls often bring in a specialist tiler. New electrical circuits legally require a Part P electrician." },
      { q: "Is a wet room worth the extra cost?",                    a: "Wet rooms cost 20-30% more than enclosed showers but add significant resale value + accessibility. Best for smaller bathrooms where a shower enclosure would waste space, or households planning to age in place." },
      { q: "How much do bathroom tiles cost per m²?",                a: "Ceramic wall tiles £15-£40/m² supply, £30-£55/m² fitted. Porcelain floor tiles £30-£75/m² supply, £50-£95/m² fitted (large-format porcelain 600×1200mm sits at the top end). Natural stone (marble, travertine) £80-£200+/m² fitted." }
    ],
    tradesNeeded:  ["plumber", "tiler", "electrician", "bathroom-fitter"],
    relatedTrades: ["plumber", "electrician"]
  },
  "house-rewire": {
    singular:  "house rewire",
    headline:  "How much does a full house rewire cost?",
    aiAnswer:  "A UK full house rewire costs £3,500-£7,500. 2-bed flat £2,500-£4,000; 3-bed semi £3,500-£5,500; 4-bed detached £5,500-£7,500+. Includes new consumer unit, cabling, sockets, switches, testing, and EICR certificate.",
    bodyIntro: "A full rewire replaces every cable, socket, switch, and consumer unit in the house — bringing electrics up to the current 18th Edition wiring regs. Most homes need a rewire every 30-40 years; before then it's usually possible to do a partial rewire (kitchen + bathroom + consumer unit swap) for £1,500-£3,000. Full rewires take 7-14 days for a 3-bed depending on chasing (surface-mount clip-direct cheaper + faster; buried-in-wall traditional but ties in plastering). All notifiable work — legally requires Part P registered installer (NICEIC, NAPIT, ELECSA). On completion the electrician issues an EICR (Electrical Installation Condition Report) which is a legal document for insurance + house sales.",
    sizes: [
      { slug: "flat",     label: "2-bed flat",        lowGbp: 2500, highGbp: 4000, scope: "New consumer unit, cabling, ~15 sockets, ~10 lights, EICR",           weeksLow: 1, weeksHigh: 2 },
      { slug: "semi",     label: "3-bed semi",        lowGbp: 3500, highGbp: 5500, scope: "New consumer unit, cabling, ~25 sockets, ~18 lights, EICR",           weeksLow: 2, weeksHigh: 3 },
      { slug: "detached", label: "4-bed detached",    lowGbp: 5500, highGbp: 7500, scope: "New consumer unit, cabling, ~35 sockets, ~25 lights, garage, EICR",  weeksLow: 2, weeksHigh: 3 },
      { slug: "listed",   label: "Listed / Victorian",lowGbp: 7500, highGbp: 12000,scope: "Sympathetic install with hidden runs, Listed Building Consent",       weeksLow: 3, weeksHigh: 5 }
    ],
    materialsPct:  35,
    labourPct:     65,
    regsNote:      "All work is notifiable under Part P. Must be done by a Part P registered installer (NICEIC, NAPIT, or ELECSA). Completion certificate + EICR both issued — keep for insurance + future house sale.",
    faqs: [
      { q: "How much does a full house rewire cost?",              a: "2-bed flat £2,500-£4,000, 3-bed semi £3,500-£5,500, 4-bed detached £5,500-£7,500. Add £1,500-£4,500 for listed / heritage properties needing sympathetic hidden runs." },
      { q: "How long does a full rewire take?",                    a: "3-bed semi typically 7-14 working days. Includes strip-out, cable runs, sockets + switches, consumer unit, testing, and issuing the EICR + install cert. Longer for larger houses or heritage buildings." },
      { q: "Can I live at home during a rewire?",                  a: "Difficult but possible — power's off room-by-room, so plan around bedrooms + kitchen. Most homeowners move out for the 2 weeks or stay with family. Kitchen out for at least 5 days, hot water disrupted." },
      { q: "How often should a house be rewired?",                 a: "Every 30-40 years typically. Signs you need one: cloth-covered cables in loft, round-pin sockets, no RCD protection on consumer unit, discoloured sockets, tripping breakers frequently. Get an EICR (£150-£300) to confirm." },
      { q: "Do I need to move furniture for a rewire?",            a: "The electrician will need clear access to every wall — sockets, switches, cable runs. Most owners move furniture to the middle of each room and cover in dust sheets. Skirting sometimes lifts to feed cables." },
      { q: "What's an EICR and why do I need one?",                a: "Electrical Installation Condition Report — a legal document confirming the installation is safe. Legally required for rental properties every 5 years; recommended every 10 years for homeowners and on purchase. Insurance + house sales often ask for one." }
    ],
    tradesNeeded:  ["electrician"],
    relatedTrades: ["electrician", "plasterer"]
  },
  "new-boiler": {
    singular:  "new boiler install",
    headline:  "How much does a new boiler cost?",
    aiAnswer:  "A UK combi boiler installation costs £1,650-£3,500 fitted. Budget install (like-for-like swap) from £1,650; system upgrade (new location, extra rads, thermostat) £2,500-£3,500; high-efficiency A-rated with 10-year warranty £3,000-£4,500.",
    bodyIntro: "A boiler swap is the most common domestic gas job — most UK boilers last 10-15 years before efficiency drops enough to justify replacement. A combi is the default for most UK homes (compact, no hot water tank, on-demand hot water); system boilers still exist for larger homes with high hot water demand. Any gas boiler work is legally restricted to Gas Safe registered engineers — check the register before hiring. Manufacturer warranties (5-10 years) only apply when installed by an approved installer of that brand (Worcester Accredited, Vaillant Advance, etc.) — worth the small install premium for the extended warranty.",
    sizes: [
      { slug: "like-for-like", label: "Like-for-like combi swap", lowGbp: 1650, highGbp: 2500, scope: "Same location, existing pipework, budget combi (Ideal, Baxi)", weeksLow: 1, weeksHigh: 1 },
      { slug: "premium-swap",  label: "Premium combi swap",       lowGbp: 2400, highGbp: 3500, scope: "Worcester Accredited or Vaillant Advance install, 10-yr warranty", weeksLow: 1, weeksHigh: 1 },
      { slug: "system-upgrade",label: "System upgrade",           lowGbp: 3000, highGbp: 5500, scope: "New location, extra rads, smart thermostat, power flush",         weeksLow: 1, weeksHigh: 2 }
    ],
    materialsPct:  70,
    labourPct:     30,
    regsNote:      "All gas work is legally restricted to Gas Safe registered engineers. New boiler installs are notifiable — installer must issue a Gas Safe Building Regs Compliance Certificate on completion. Boiler Plus (2018) requires programmable thermostat + weather/load compensation OR smart thermostat.",
    faqs: [
      { q: "How much does a new combi boiler cost fitted?",       a: "Like-for-like swap £1,650-£2,500. Premium Worcester or Vaillant install with 10-year warranty £2,400-£3,500. Full system upgrade (relocation + new rads + smart thermostat) £3,000-£5,500." },
      { q: "How long does a boiler installation take?",           a: "Like-for-like swap 1 day. Relocation or system upgrade 2-3 days. Includes strip-out, new boiler + pipework, flush, commissioning, and Gas Safe cert." },
      { q: "Do I need a power flush with a new boiler?",          a: "Manufacturers require it for warranty on most installs. £350-£650 extra. Skipping it voids the warranty and can shorten boiler life by 3-5 years due to sludge damage." },
      { q: "Should I choose Worcester, Vaillant, or Ideal?",      a: "Worcester Bosch = premium, best warranty (up to 12 years accredited installer), highest reliability scores. Vaillant = similar quality, slightly cheaper. Ideal Logic = budget, 7-year warranty, decent but shorter lifespan (~10 years vs 12-15 for premium brands)." },
      { q: "Can I get a grant for a new boiler?",                 a: "ECO4 grant scheme funds new boilers for low-income households with certain benefits (Pension Credit, Universal Credit). Boiler Upgrade Scheme (BUS) offers £7,500 towards air-source heat pumps replacing gas boilers." },
      { q: "How often should a boiler be serviced?",              a: "Annually. Cost £75-£120 per service. Required to maintain manufacturer warranty. Landlords legally required to have annual gas safety checks (CP12) on every gas appliance in rented property." }
    ],
    tradesNeeded:  ["plumber"],
    relatedTrades: ["plumber", "electrician"]
  }
};

export function isValidProject(s: string): s is ProjectSlug {
  return (PROJECTS as string[]).includes(s);
}
