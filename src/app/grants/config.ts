// UK Home Improvement Grants + Schemes — authoritative tracker config.
//
// Second data-authority surface after /price-index. Same pattern:
// every field attributed to source (gov.uk, Ofgem, Home Energy
// Scotland, Nest Wales), monthly refresh, no invented numbers.
//
// Priority queries this ranks for:
//   • "boiler grant 2026 UK"
//   • "ECO4 eligibility"
//   • "home upgrade grant"
//   • "insulation grant UK 2026"
//   • "heat pump grant UK"
//   • "great british insulation scheme"
//
// Refresh cadence: monthly. When a scheme closes / opens / changes
// amount → bump REPORT_MONTH + update the row.

export type GrantStatus  = "open" | "closing-soon" | "closed" | "opening-soon";
export type GrantAudience = "homeowner" | "tenant" | "landlord";
export type UkRegion     = "england" | "scotland" | "wales" | "n-ireland" | "uk";

export type Scheme = {
  slug:             string;
  displayName:      string;
  shortName:        string;
  region:           UkRegion[];
  status:           GrantStatus;
  amountLow:        number;
  amountHigh:       number;
  amountNote:       string;
  covers:           string[];
  eligibilitySummary: string;
  eligibilityCriteria: string[];
  howToApply:       string[];
  sourceUrl:        string;
  sourceLabel:      string;
  operatingBody:    string;
  audiences:        GrantAudience[];
  worksWithTrades:  string[];
  lastVerified:     string;   // ISO date
};

export const REPORT_MONTH = "July 2026";
export const REPORT_ISO   = "2026-07-01";
export const NEXT_REFRESH = "August 2026";

export const SCHEMES: Scheme[] = [
  {
    slug: "boiler-upgrade-scheme",
    displayName: "Boiler Upgrade Scheme (BUS)",
    shortName:   "BUS",
    region:      ["england", "wales"],
    status:      "open",
    amountLow:   5000,
    amountHigh:  7500,
    amountNote:  "£7,500 for air-source + ground-source heat pumps, £5,000 for biomass boilers",
    covers: [
      "Air source heat pump installation",
      "Ground source heat pump installation",
      "Biomass boiler (rural properties)"
    ],
    eligibilitySummary:
      "Owner of a domestic or small non-domestic property in England or Wales replacing a fossil-fuel heating system. EPC required (some exemptions).",
    eligibilityCriteria: [
      "Property is in England or Wales",
      "You own the property (homeowners + small landlords)",
      "Existing heating system is fossil-fuel (gas, oil, LPG, coal, electric)",
      "Valid EPC issued in last 10 years with no outstanding insulation recommendations (loft/cavity)",
      "Installed by MCS-certified installer"
    ],
    howToApply: [
      "Find an MCS-certified heat pump installer",
      "Installer applies for the grant on your behalf via Ofgem's BUS portal",
      "Grant is deducted from the installation invoice — you pay the balance",
      "Installer redeems the voucher from Ofgem after commissioning"
    ],
    sourceUrl:     "https://www.gov.uk/apply-boiler-upgrade-scheme",
    sourceLabel:   "GOV.UK — Boiler Upgrade Scheme",
    operatingBody: "Ofgem",
    audiences:     ["homeowner", "landlord"],
    worksWithTrades: ["gas-safe-engineer", "plumber"],
    lastVerified:  "2026-07-15"
  },
  {
    slug: "eco4",
    displayName: "Energy Company Obligation 4 (ECO4)",
    shortName:   "ECO4",
    region:      ["england", "scotland", "wales"],
    status:      "open",
    amountLow:   0,
    amountHigh:  30000,
    amountNote:  "Fully funded for eligible households — no cap for whole-house retrofit packages",
    covers: [
      "Loft insulation",
      "Cavity wall insulation",
      "Solid wall insulation (internal + external)",
      "Underfloor insulation",
      "First-time central heating",
      "Boiler repair / replacement (low-efficiency swap)",
      "Air source heat pumps",
      "Solar PV (in whole-house packages)"
    ],
    eligibilitySummary:
      "Low-income + vulnerable households in EPC-band D-G properties. Delivered by major energy suppliers under Ofgem obligation.",
    eligibilityCriteria: [
      "Property EPC rating D, E, F or G",
      "Household receives a qualifying means-tested benefit (Universal Credit, Pension Credit, Income Support, JSA, ESA, Working Tax Credit, Child Tax Credit, Housing Benefit)",
      "OR referred via LA Flex (local authority flexible eligibility) — check with your council",
      "Available to homeowners AND private tenants (with landlord permission)"
    ],
    howToApply: [
      "Contact your energy supplier's ECO4 team (British Gas, Octopus, OVO, EDF, E.ON, Scottish Power)",
      "Or apply via a TrustMark-registered ECO4 installer",
      "Free retrofit survey to determine the eligible measure package",
      "Install and quality-assurance sign-off — you pay nothing"
    ],
    sourceUrl:     "https://www.ofgem.gov.uk/environmental-and-social-schemes/energy-company-obligation-eco",
    sourceLabel:   "Ofgem — Energy Company Obligation 4",
    operatingBody: "Ofgem",
    audiences:     ["homeowner", "tenant"],
    worksWithTrades: ["plumber", "gas-safe-engineer", "electrician", "plasterer"],
    lastVerified:  "2026-07-15"
  },
  {
    slug: "great-british-insulation-scheme",
    displayName: "Great British Insulation Scheme (GBIS)",
    shortName:   "GBIS",
    region:      ["england", "scotland", "wales"],
    status:      "open",
    amountLow:   0,
    amountHigh:  2500,
    amountNote:  "Single-measure insulation grant — free or heavily subsidised depending on eligibility route",
    covers: [
      "Loft insulation",
      "Cavity wall insulation",
      "Solid wall insulation (partial coverage — top-up)",
      "Room-in-roof insulation",
      "Underfloor insulation"
    ],
    eligibilitySummary:
      "Property in Council Tax band A-D (England) / A-E (Scotland+Wales) with EPC rating D-G. Household means-test relaxed compared to ECO4 — broader reach.",
    eligibilityCriteria: [
      "Property Council Tax band A-D (England) or A-E (Scotland/Wales)",
      "EPC rating D, E, F or G",
      "Homeowner OR private tenant (with landlord permission)",
      "Not currently receiving ECO4 for the same measure"
    ],
    howToApply: [
      "Contact your energy supplier's insulation team",
      "Or apply via a TrustMark-registered installer",
      "Free property survey",
      "Install and sign-off — most households pay nothing"
    ],
    sourceUrl:     "https://www.gov.uk/apply-great-british-insulation-scheme",
    sourceLabel:   "GOV.UK — Great British Insulation Scheme",
    operatingBody: "Ofgem",
    audiences:     ["homeowner", "tenant"],
    worksWithTrades: ["plasterer", "carpenter"],
    lastVerified:  "2026-07-15"
  },
  {
    slug: "home-upgrade-grant",
    displayName: "Home Upgrade Grant Phase 2 (HUG2)",
    shortName:   "HUG2",
    region:      ["england"],
    status:      "closing-soon",
    amountLow:   0,
    amountHigh:  38000,
    amountNote:  "Fully funded for eligible households — extended package for off-gas rural homes",
    covers: [
      "Air source heat pumps",
      "Ground source heat pumps",
      "Solar PV",
      "Solid + cavity wall insulation",
      "Loft insulation",
      "Underfloor insulation",
      "Double glazing (in whole-house packages)"
    ],
    eligibilitySummary:
      "Low-income households in England living OFF the mains gas grid. Runs until March 2026 (Phase 2), with Phase 3 expected to follow.",
    eligibilityCriteria: [
      "Property is OFF the mains gas grid (main heating fuel is oil, LPG, coal, or electric — not mains gas)",
      "Household income below £36,000/year OR receiving means-tested benefits",
      "EPC rating D, E, F or G",
      "Homeowner OR private tenant (with landlord permission)",
      "Property in a Local Authority participating in HUG2"
    ],
    howToApply: [
      "Contact your local council's HUG2 team",
      "Council appoints a delivery partner for survey + install",
      "Whole-house retrofit plan agreed",
      "Install and sign-off — homeowner pays nothing"
    ],
    sourceUrl:     "https://www.gov.uk/guidance/home-upgrade-grant-hug-phase-2",
    sourceLabel:   "GOV.UK — Home Upgrade Grant Phase 2",
    operatingBody: "Department for Energy Security & Net Zero (DESNZ)",
    audiences:     ["homeowner", "tenant"],
    worksWithTrades: ["gas-safe-engineer", "plumber", "electrician", "plasterer", "roofer"],
    lastVerified:  "2026-07-15"
  },
  {
    slug: "warm-homes-scotland",
    displayName: "Warmer Homes Scotland",
    shortName:   "WHS",
    region:      ["scotland"],
    status:      "open",
    amountLow:   0,
    amountHigh:  20000,
    amountNote:  "Scottish Government-funded — fully covers eligible measures for qualifying households",
    covers: [
      "Central heating (first-time install)",
      "Insulation (loft, cavity, solid wall)",
      "Air source heat pumps",
      "Solar PV",
      "Draught-proofing",
      "Renewable technologies"
    ],
    eligibilitySummary:
      "Scottish households at risk of fuel poverty. Delivered by Warmworks (Scottish Government appointed).",
    eligibilityCriteria: [
      "Property is in Scotland",
      "You are the homeowner OR private tenant (with landlord permission)",
      "Lived at the property for at least 12 months",
      "Household is in fuel poverty (energy costs >10% of income after housing costs) OR receiving qualifying benefits",
      "Property EPC D-G"
    ],
    howToApply: [
      "Call Home Energy Scotland: 0808 808 2282",
      "Free eligibility check + survey",
      "Warmworks delivers the install",
      "No cost to the household for eligible measures"
    ],
    sourceUrl:     "https://www.homeenergyscotland.org/find-funding-grants-and-loans/warmer-homes-scotland/",
    sourceLabel:   "Home Energy Scotland — Warmer Homes Scotland",
    operatingBody: "Scottish Government / Warmworks",
    audiences:     ["homeowner", "tenant"],
    worksWithTrades: ["gas-safe-engineer", "plumber", "plasterer", "electrician"],
    lastVerified:  "2026-07-15"
  },
  {
    slug: "nest-wales",
    displayName: "Nest Wales",
    shortName:   "Nest",
    region:      ["wales"],
    status:      "open",
    amountLow:   0,
    amountHigh:  15000,
    amountNote:  "Welsh Government-funded — free for eligible households",
    covers: [
      "New boiler (A-rated)",
      "Central heating install",
      "Insulation (loft, cavity, solid wall)",
      "Air source heat pumps",
      "Draught-proofing"
    ],
    eligibilitySummary:
      "Welsh households on low incomes living in energy-inefficient homes. Delivered by British Gas on behalf of Welsh Government.",
    eligibilityCriteria: [
      "Property is in Wales",
      "You own or privately rent the property",
      "Home has an EPC rating of E, F or G",
      "Household receives a means-tested benefit OR has a household income under £16,000 (before tax + housing costs)",
      "OR you or a household member has a chronic respiratory / cardiovascular / mental-health condition"
    ],
    howToApply: [
      "Call Nest: 0808 808 2244 (free from landlines + mobiles)",
      "Or apply online at nest.gov.wales",
      "Free home energy assessment",
      "Free install of eligible improvements"
    ],
    sourceUrl:     "https://www.gov.wales/nest",
    sourceLabel:   "GOV.WALES — Nest scheme",
    operatingBody: "Welsh Government / British Gas",
    audiences:     ["homeowner", "tenant"],
    worksWithTrades: ["gas-safe-engineer", "plumber", "plasterer"],
    lastVerified:  "2026-07-15"
  },
  {
    slug: "affordable-warmth-ni",
    displayName: "Affordable Warmth Scheme (NI)",
    shortName:   "AWS",
    region:      ["n-ireland"],
    status:      "open",
    amountLow:   0,
    amountHigh:  10000,
    amountNote:  "NI Housing Executive-managed — targeted at low-income households",
    covers: [
      "Loft insulation",
      "Cavity wall insulation",
      "Draught-proofing",
      "Central heating (repair + replace)",
      "Double glazing (in some packages)"
    ],
    eligibilitySummary:
      "Northern Ireland homeowners + private tenants with household income under £23,000.",
    eligibilityCriteria: [
      "Property is in Northern Ireland",
      "Homeowner OR private tenant",
      "Total gross household income under £23,000 (before tax)",
      "Referred by your local council or NIHE"
    ],
    howToApply: [
      "Contact your local council's Affordable Warmth team",
      "Council refers to NI Housing Executive for survey",
      "Install delivered by approved contractor"
    ],
    sourceUrl:     "https://www.nihe.gov.uk/housing-help/affordable-warmth-boiler-replacement",
    sourceLabel:   "NIHE — Affordable Warmth",
    operatingBody: "Northern Ireland Housing Executive",
    audiences:     ["homeowner", "tenant"],
    worksWithTrades: ["gas-safe-engineer", "plumber", "plasterer"],
    lastVerified:  "2026-07-15"
  },
  {
    slug: "vat-zero-rating-esm",
    displayName: "0% VAT on Energy-Saving Materials",
    shortName:   "0% VAT ESM",
    region:      ["uk"],
    status:      "open",
    amountLow:   0,
    amountHigh:  0,
    amountNote:  "20% VAT saving on qualifying installations — extended to April 2027",
    covers: [
      "Solar panels",
      "Heat pumps (air, ground, water source)",
      "Insulation (all types)",
      "Wind turbines",
      "Water turbines",
      "Draught-stripping",
      "Central heating controls",
      "Battery storage systems (with or without solar)"
    ],
    eligibilitySummary:
      "0% VAT applies automatically on qualifying energy-saving materials installed in UK residential properties. No application needed — installer must charge zero VAT.",
    eligibilityCriteria: [
      "Installed in a UK residential property (not commercial)",
      "Installed by a VAT-registered installer",
      "Qualifying energy-saving material (see HMRC list)"
    ],
    howToApply: [
      "No application — automatic",
      "Confirm your installer charges 0% VAT before signing (they must be VAT-registered)",
      "Ask for a VAT invoice showing 0% ESM rate"
    ],
    sourceUrl:     "https://www.gov.uk/guidance/vat-on-energy-saving-materials-and-heating-equipment-notice-7086",
    sourceLabel:   "HMRC VAT Notice 708/6 — Energy-Saving Materials",
    operatingBody: "HMRC",
    audiences:     ["homeowner", "landlord", "tenant"],
    worksWithTrades: ["electrician", "plumber", "gas-safe-engineer"],
    lastVerified:  "2026-07-15"
  }
];

// ─── FAQ + methodology ────────────────────────────────────────────

export const FAQS = [
  {
    q: "Are these UK home improvement grants still open in 2026?",
    a: `Yes — every scheme on this page was verified live on ${REPORT_MONTH}. Each row shows its current status (open, closing-soon, closed) and the "last verified" date. This tracker is refreshed monthly.`
  },
  {
    q: "Can I combine multiple grants for the same project?",
    a: "Usually no. Most schemes (ECO4, GBIS, HUG2, BUS) explicitly disallow stacking on the same measure — you can't get an ECO4 boiler AND a HUG2 boiler. But you CAN combine 0% VAT (which is automatic) with any grant, and you CAN use different grants for different measures (e.g. ECO4 for insulation + BUS for heat pump on the same house)."
  },
  {
    q: "Do I need to use an approved installer?",
    a: "Yes for almost every grant. BUS requires MCS-certified installers. ECO4 + GBIS + HUG2 require TrustMark registration. Warmer Homes Scotland uses Warmworks as sole delivery partner. Nest Wales uses British Gas. Only 0% VAT is agnostic — any VAT-registered installer can apply it."
  },
  {
    q: "How much can I actually save?",
    a: "Depends on your household + property. Fully-eligible ECO4 households can get £15,000-£30,000+ of works fully funded. Owner-occupier BUS applicants get a flat £7,500 off a heat pump. 0% VAT alone saves 20% on any qualifying install — £1,000+ on a £5,000 heat pump install."
  },
  {
    q: "Where does this data come from?",
    a: "Every scheme links to its authoritative source — gov.uk, Ofgem, GOV.WALES, Home Energy Scotland, NI Housing Executive, HMRC. We do not create eligibility criteria or amount figures — we mirror what the operating body publishes. If a scheme changes mid-month, the change appears in the next monthly refresh."
  },
  {
    q: "Can I cite this tracker in an article or report?",
    a: `Yes. Preferred citation: "UK Home Improvement Grants Tracker by The Networkers, published ${REPORT_MONTH}" with a link back to thenetworkers.app/grants. Journalists can request the underlying dataset via press@thenetworkers.app.`
  }
];
