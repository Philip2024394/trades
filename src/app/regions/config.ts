// /regions — UK regional pages config.
//
// Regional layer between national /trades/[trade] and per-city
// /trades/[trade]/[city]. Ranks for regional-scope queries:
//   • "trades in the north west uk"
//   • "yorkshire builders"
//   • "scotland gas safe engineers"
//   • "south west uk tradespeople"
//
// Each region cross-references:
//   • Its member cities → /trades/[trade]/[city] combinations
//   • All 6 core trades → /trades/[trade] nationals
//   • Regional pricing multipliers → /price-index
//   • Region-specific grants → /grants (Warmer Homes Scotland,
//     Nest Wales, Affordable Warmth NI)
//   • Vault + Answers when relevant

import type { CitySlug } from "@/app/trades/[trade]/[city]/config";

export type Region = {
  slug:           string;
  displayName:    string;
  demonym:        string;               // "Northern", "London-based", "Scottish"
  cities:         CitySlug[];
  /** 2-3 sentence editorial overview of the region's trade market. */
  overview:       string;
  /** Regional pricing characterisation — refers to Price Index multiplier. */
  pricingNote:    string;
  /** Region-specific grant highlight, when one exists. */
  grantHighlight?: {
    slug:  string;      // matches /grants/#slug anchor
    label: string;
  };
  /** Notable trade-market facts about the region — evidence-first, keep to 2-4. */
  marketFacts:    string[];
};

export const REGIONS: Region[] = [
  {
    slug: "greater-london",
    displayName: "Greater London",
    demonym:     "London-based",
    cities:      ["london"],
    overview:
      "Greater London is the UK's highest-density trade market — every trade slug is well-represented, with specialists in every borough. London is also the UK's most expensive region for construction work, with day rates typically 30-40% above the national average across all trades.",
    pricingNote:
      "London day rates run £260-£480 for most core trades — the highest in the UK per the UK Trade Price Index. Emergency callout premium is also the widest, at 40-60% above standard rates.",
    marketFacts: [
      "35% average premium over the UK national mean across all core trades",
      "Highest concentration of Gas Safe engineers per capita in the UK",
      "Heat pump + EV charger installer demand growing fastest in outer boroughs (Zone 3-6)"
    ]
  },
  {
    slug: "north-west",
    displayName: "North West",
    demonym:     "North West",
    cities:      ["manchester", "liverpool"],
    overview:
      "The North West spans Manchester, Liverpool, and the surrounding conurbations — a dense trade market driven by ongoing housing regeneration + a large private-rented sector requiring frequent trade callouts. Manchester's tech + services growth has pulled skilled trades in from across the region.",
    pricingNote:
      "Manchester trades price at roughly the UK national average (multiplier ~1.02×). Liverpool sits slightly below at 0.92× — a genuine bargain for cross-region homeowners willing to hire a Merseyside firm for a nearby Cheshire or Wirral job.",
    marketFacts: [
      "Housing-association work drives high, steady trade demand year-round",
      "One of the strongest UK apprenticeship networks — CITB North West placements grew 12% year-on-year",
      "Retrofit + insulation work heavy under ECO4 + Great British Insulation Scheme"
    ]
  },
  {
    slug: "yorkshire",
    displayName: "Yorkshire",
    demonym:     "Yorkshire",
    cities:      ["leeds", "sheffield", "bradford"],
    overview:
      "Yorkshire's trade market centres on Leeds + Sheffield with strong satellite demand in Bradford, York, Huddersfield, and Wakefield. Established family firms dominate — many trades are second- or third-generation, giving the region unusually deep specialism in heritage brickwork, stone repair, and traditional joinery.",
    pricingNote:
      "Both Leeds and Sheffield sit below the UK national average — Leeds at 0.98×, Sheffield at 0.92×. Yorkshire is one of the most cost-effective UK regions for trade labour without sacrificing quality.",
    marketFacts: [
      "Highest concentration of natural stone masons in the UK — driven by heritage stock",
      "Sheffield: home to a dense specialist metalwork + engineering trade cluster",
      "Strong CITB apprenticeship completion rates — trades pipeline is genuinely healthy"
    ]
  },
  {
    slug: "west-midlands",
    displayName: "West Midlands",
    demonym:     "Midlands-based",
    cities:      ["birmingham"],
    overview:
      "The West Midlands is anchored by Birmingham — the UK's second-largest city and one of the most active trade markets outside London. Wolverhampton, Coventry, and Solihull round out the regional demand base. HS2 construction has pulled skilled trades into the region for major infrastructure work, tightening local availability.",
    pricingNote:
      "Birmingham prices roughly at the UK national average (0.98×). Regional demand around HS2 sites has driven a small premium in specialist trades — steelfixers + concrete finishers command above-average day rates.",
    marketFacts: [
      "Birmingham is the UK's largest local authority — trade demand density rivals inner London",
      "HS2 construction has shifted skilled labour supply patterns since 2021",
      "Growing retrofit + heat-pump demand in West Midlands Combined Authority housing stock"
    ]
  },
  {
    slug: "south-west",
    displayName: "South West",
    demonym:     "South West",
    cities:      ["bristol", "plymouth"],
    overview:
      "The South West combines the urban demand of Bristol + Bath with the heritage-property complexity of Cornwall, Devon, Somerset, Dorset, and Gloucestershire. Trades in this region are often specialists in period building repair — lime plaster, stone masonry, thatch, and heritage joinery command a significant regional premium.",
    pricingNote:
      "Bristol prices at 1.10× the UK national average — the second-highest region after London. Rural South West trades price at or above Bristol rates due to travel + call-out costs.",
    marketFacts: [
      "Highest concentration of heritage + listed-building specialists outside London",
      "Bath + Cornwall lime plaster work commands 30-50% premium over standard skim rates",
      "Retrofit demand accelerating as coastal properties tighten insulation to modern regs"
    ]
  },
  {
    slug: "scotland",
    displayName: "Scotland",
    demonym:     "Scottish",
    cities:      ["edinburgh", "glasgow"],
    overview:
      "Scotland has its own building standards regime, its own apprenticeship pathway (SVQ via SDS), and its own grant landscape (Warmer Homes Scotland, Home Energy Scotland). Edinburgh + Glasgow are the two anchor markets — Aberdeen + Dundee round out the demand base.",
    pricingNote:
      "Edinburgh at 1.05× national average; Glasgow at 0.95×. Highland + Islands work carries a significant travel premium — often 20-40% over central-belt rates.",
    grantHighlight: {
      slug:  "warm-homes-scotland",
      label: "Warmer Homes Scotland"
    },
    marketFacts: [
      "Scottish Building Standards differ from England/Wales — verify installer familiarity",
      "Warmer Homes Scotland delivers fully-funded retrofit to eligible households",
      "SVQ-qualified tradespeople certified via SDS — verify against City & Guilds equivalence when hiring"
    ]
  },
  {
    slug: "north-east",
    displayName: "North East",
    demonym:     "North East",
    cities:      ["newcastle"],
    overview:
      "The North East spans Newcastle, Sunderland, Middlesbrough, and Durham. Historically one of the UK's most cost-effective trade regions — day rates run 8-12% below the national average across all core trades. Nissan + regional automotive supply chain drive specialist industrial-trade demand around Sunderland.",
    pricingNote:
      "Newcastle at 0.90× UK national average — the lowest multiplier in the Price Index. North East trades often travel across the region for jobs, so booking early matters more than negotiating rate.",
    marketFacts: [
      "Most cost-effective mainland UK region for trade labour",
      "Strong industrial trades cluster around Nissan Sunderland + Teesside supply chain",
      "Housing retrofit demand growing under Great British Insulation Scheme"
    ]
  },
  // ─── Batch 2026-07-20 expansion (7 → 11 regions) ─────────
  {
    slug: "wales",
    displayName: "Wales",
    demonym:     "Welsh",
    cities:      ["cardiff"],
    overview:
      "Wales operates its own building standards regime + its own funded home-improvement scheme (Nest). Cardiff is the anchor market — Swansea, Newport, and Wrexham round out the demand base. Rural Wales carries a travel premium (10-25% over Cardiff rates).",
    pricingNote:
      "Cardiff prices roughly at the UK national average (~1.00×). Trades in rural Mid + North Wales price a travel premium of 10-25% above central-belt rates.",
    grantHighlight: {
      slug:  "nest-wales",
      label: "Nest Wales"
    },
    marketFacts: [
      "Welsh Building Regulations differ from England — verify installer familiarity",
      "Nest scheme delivers fully-funded retrofit to eligible Welsh households (British Gas administered on behalf of Welsh Government)",
      "Welsh Government committed to 20,000 low-carbon homes by 2026 — retrofit + heat pump demand accelerating"
    ]
  },
  {
    slug: "northern-ireland",
    displayName: "Northern Ireland",
    demonym:     "Northern Irish",
    cities:      ["belfast"],
    overview:
      "Northern Ireland is a distinct regulatory environment — separate Building Control, separate energy-efficiency grants (Affordable Warmth Scheme), and a different apprenticeship pathway (via CITB NI). Belfast is the anchor market; Derry-Londonderry, Newtownabbey, and Lisburn round out the demand base.",
    pricingNote:
      "Belfast typically prices 5-10% below the UK national average. Northern Ireland trades often work cross-border — jobs in border counties may pull ROI-based crews with different qualification recognition.",
    grantHighlight: {
      slug:  "affordable-warmth-ni",
      label: "Affordable Warmth Scheme (NI)"
    },
    marketFacts: [
      "NI Housing Executive runs the Affordable Warmth Scheme for eligible low-income households",
      "Building Control operates separately from England/Wales — verify installer familiarity with NI regs",
      "Cross-border work with Republic of Ireland is common in border counties — check qualification recognition"
    ]
  },
  {
    slug: "east-midlands",
    displayName: "East Midlands",
    demonym:     "East Midlands-based",
    cities:      ["nottingham"],
    overview:
      "The East Midlands covers Nottingham, Leicester, Derby, Lincoln, and Northampton. A dense industrial + logistics economy (East Midlands Airport, HS2 East Midlands Hub) drives strong commercial + residential trade demand. Historically undersupplied by trade platforms — real gap for verified directory coverage.",
    pricingNote:
      "Nottingham prices at roughly the UK national average (0.98×). Derby + Leicester similar; Lincoln + rural East Midlands 5-10% below.",
    marketFacts: [
      "HS2 East Midlands Hub construction has tightened skilled-trade supply since 2021",
      "One of the fastest-growing UK regions for domestic + light-industrial construction",
      "Strong CITB apprenticeship network — Loughborough College is a major trade training centre"
    ]
  },
  {
    slug: "south-east",
    displayName: "South East",
    demonym:     "South East",
    cities:      ["southampton"],
    overview:
      "The South East is the UK's second most economically active region after Greater London. Southampton, Brighton, Portsmouth, Reading, and Milton Keynes drive demand across a wide + mostly affluent housing stock. Trades price 15-25% above the UK national average — closer to London than the North.",
    pricingNote:
      "Southampton at 1.15× UK national average; Reading + Brighton similar. Trades in the South East consistently price above the national mean — high housing values sustain premium pricing.",
    marketFacts: [
      "One of the UK's highest-density home-improvement spending regions",
      "Strong demand for heritage + Georgian/Victorian property restoration",
      "London commuter belt drives high renovation activity — homeowners upgrading before or after moving out of London"
    ]
  }
];

export function isValidRegion(s: string): s is Region["slug"] {
  return REGIONS.some((r) => r.slug === s);
}

export const HUB_FAQS = [
  {
    q: "Does The Networkers cover every UK region?",
    a: `Currently ${REGIONS.length} regions with dedicated pages: ${REGIONS.map((r) => r.displayName).join(", ")}. Coverage expands as we add new cities to /trades/[trade]/[city] — every new city automatically slots into its region page.`
  },
  {
    q: "How are the regional pricing multipliers calculated?",
    a: "From The Networkers' UK Trade Price Index — a monthly-refreshed dataset combining live listings + industry benchmarks (BCIS, Gas Safe Register, RICS). Full methodology at /price-index."
  },
  {
    q: "Are there region-specific UK grants?",
    a: "Yes — Warmer Homes Scotland (Scotland only), Nest Wales (Wales only), Home Upgrade Grant Phase 2 (England off-gas-grid), and Affordable Warmth Scheme (Northern Ireland only). Every scheme + eligibility rule at /grants."
  }
];
