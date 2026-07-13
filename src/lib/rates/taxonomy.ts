// SOC 2020 occupation codes <=> internal trade slugs.
// NUTS-1 region codes <=> internal region labels + postcode-area
// mapping.
//
// Both mappings are ground-truth references for the government rates
// ingest pipeline. When ONS publishes rate data keyed by SOC code +
// NUTS-1, we translate through these maps into our own taxonomy.

// ─── SOC 2020 <=> trade_slug ─────────────────────────────────────
// Reference: ONS Standard Occupational Classification 2020 (SOC 2020),
// Sub-Major Group 53 (Skilled construction and building trades).
// https://www.ons.gov.uk/methodology/classificationsandstandards/standardoccupationalclassificationsoc/soc2020

export type SocCode = string;

export const SOC_TO_TRADE_SLUG: ReadonlyArray<{
  soc: SocCode;
  slug: string;
  label: string;
}> = [
  // Sub-Major Group 53 — Skilled Construction and Building Trades
  { soc: "5311", slug: "steel-erector",       label: "Steel Erector" },
  { soc: "5312", slug: "bricklaying",         label: "Bricklayer" },
  { soc: "5313", slug: "roofing",             label: "Roofer" },
  { soc: "5314", slug: "plumbing",            label: "Plumber" },
  { soc: "5315", slug: "carpentry",           label: "Carpenter / Joiner" },
  { soc: "5316", slug: "glazing",             label: "Glazier / Window Fitter" },
  { soc: "5319", slug: "construction-other",  label: "Construction Trades (other)" },
  { soc: "5321", slug: "plastering",          label: "Plasterer" },
  { soc: "5322", slug: "flooring",            label: "Floorer / Wall Tiler" },
  { soc: "5323", slug: "decorating",          label: "Painter / Decorator" },
  { soc: "5329", slug: "finishing-other",     label: "Construction Finishing (other)" },
  // Sub-Major Group 52 — Skilled Metal, Electrical and Electronic
  { soc: "5241", slug: "electrical",          label: "Electrician" },
  // Sub-Major Group 91 — Elementary Construction
  { soc: "9120", slug: "labouring",           label: "Elementary Construction Labourer" }
];

export function socToTradeSlug(soc: SocCode): string | undefined {
  return SOC_TO_TRADE_SLUG.find((r) => r.soc === soc)?.slug;
}

export function tradeSlugToSoc(slug: string): SocCode | undefined {
  return SOC_TO_TRADE_SLUG.find((r) => r.slug === slug)?.soc;
}

// ─── NUTS-1 region codes ─────────────────────────────────────────
// Reference: ONS International Territorial Levels (ITL), ITL1
// (replaced NUTS-1 in 2021 but codes are backward-compatible).

export type Nuts1Code =
  | "UKC" | "UKD" | "UKE" | "UKF" | "UKG" | "UKH"
  | "UKI" | "UKJ" | "UKK" | "UKL" | "UKM" | "UKN";

export const NUTS1_REGIONS: ReadonlyArray<{
  code: Nuts1Code;
  label: string;
  /** Postcode-area prefixes typical for the region (partial list). */
  postcodeAreas: readonly string[];
}> = [
  { code: "UKC", label: "North East",                postcodeAreas: ["NE","SR","DH","DL","TS"] },
  { code: "UKD", label: "North West",                postcodeAreas: ["M","L","BL","BB","PR","WN","WA","SK","OL","CH"] },
  { code: "UKE", label: "Yorkshire and the Humber",  postcodeAreas: ["LS","BD","HD","HX","WF","YO","HU","DN","S"] },
  { code: "UKF", label: "East Midlands",             postcodeAreas: ["LE","NG","DE","NN","LN","PE"] },
  { code: "UKG", label: "West Midlands",             postcodeAreas: ["B","CV","WS","WV","DY","TF","ST","WR","HR"] },
  { code: "UKH", label: "East of England",           postcodeAreas: ["CB","IP","NR","CO","CM","SS","SG","LU","AL","EN","IG","RM"] },
  { code: "UKI", label: "London",                    postcodeAreas: ["E","EC","N","NW","SE","SW","W","WC"] },
  { code: "UKJ", label: "South East",                postcodeAreas: ["OX","RG","GU","SL","HP","ME","CT","TN","BN","PO","SO","MK"] },
  { code: "UKK", label: "South West",                postcodeAreas: ["BS","BA","EX","PL","TQ","TR","GL","SN","SP","DT","TA","BH"] },
  { code: "UKL", label: "Wales",                     postcodeAreas: ["CF","SA","LL","NP","LD","SY"] },
  { code: "UKM", label: "Scotland",                  postcodeAreas: ["EH","G","AB","DD","KY","FK","PA","PH","IV","KA","ML","DG","TD","KW","HS","ZE"] },
  { code: "UKN", label: "Northern Ireland",          postcodeAreas: ["BT"] }
];

/** Take a UK postcode (or partial) and return the NUTS-1 region.
 *  Falls back to undefined if the area prefix isn't recognised —
 *  callers should treat that as "unknown region" honestly. */
export function postcodeToNuts1(postcode: string): Nuts1Code | undefined {
  const upper = postcode.trim().toUpperCase();
  // Extract the alphabetic prefix (postcode area).
  const match = upper.match(/^([A-Z]{1,2})/);
  if (!match) return undefined;
  const area = match[1];
  for (const region of NUTS1_REGIONS) {
    if (region.postcodeAreas.includes(area)) return region.code;
  }
  return undefined;
}

export function nuts1ToLabel(code: Nuts1Code): string | undefined {
  return NUTS1_REGIONS.find((r) => r.code === code)?.label;
}

// ─── UK Cities — postcode-area based ───────────────────────────────
// Major UK cities that a trade would consider a distinct market from
// their surrounding region. Not exhaustive — new cities added as
// verified user-submission volume warrants a distinct bucket.

export type CitySlug = string;

export const UK_CITIES: ReadonlyArray<{
  slug: CitySlug;
  label: string;
  regionCode: Nuts1Code;
  postcodeAreas: readonly string[];
}> = [
  // North East
  { slug: "newcastle",   label: "Newcastle upon Tyne", regionCode: "UKC", postcodeAreas: ["NE"] },
  { slug: "sunderland",  label: "Sunderland",          regionCode: "UKC", postcodeAreas: ["SR"] },
  { slug: "middlesbrough", label: "Middlesbrough",     regionCode: "UKC", postcodeAreas: ["TS"] },
  // North West
  { slug: "manchester",  label: "Manchester",          regionCode: "UKD", postcodeAreas: ["M","SK","OL"] },
  { slug: "liverpool",   label: "Liverpool",           regionCode: "UKD", postcodeAreas: ["L"] },
  { slug: "preston",     label: "Preston",             regionCode: "UKD", postcodeAreas: ["PR"] },
  { slug: "bolton",      label: "Bolton",              regionCode: "UKD", postcodeAreas: ["BL"] },
  { slug: "chester",     label: "Chester",             regionCode: "UKD", postcodeAreas: ["CH"] },
  // Yorkshire and the Humber
  { slug: "leeds",       label: "Leeds",               regionCode: "UKE", postcodeAreas: ["LS"] },
  { slug: "bradford",    label: "Bradford",            regionCode: "UKE", postcodeAreas: ["BD"] },
  { slug: "sheffield",   label: "Sheffield",           regionCode: "UKE", postcodeAreas: ["S"] },
  { slug: "york",        label: "York",                regionCode: "UKE", postcodeAreas: ["YO"] },
  { slug: "hull",        label: "Hull",                regionCode: "UKE", postcodeAreas: ["HU"] },
  // East Midlands
  { slug: "nottingham",  label: "Nottingham",          regionCode: "UKF", postcodeAreas: ["NG"] },
  { slug: "leicester",   label: "Leicester",           regionCode: "UKF", postcodeAreas: ["LE"] },
  { slug: "derby",       label: "Derby",               regionCode: "UKF", postcodeAreas: ["DE"] },
  // West Midlands
  { slug: "birmingham",  label: "Birmingham",          regionCode: "UKG", postcodeAreas: ["B"] },
  { slug: "coventry",    label: "Coventry",            regionCode: "UKG", postcodeAreas: ["CV"] },
  { slug: "wolverhampton", label: "Wolverhampton",     regionCode: "UKG", postcodeAreas: ["WV"] },
  { slug: "stoke",       label: "Stoke-on-Trent",      regionCode: "UKG", postcodeAreas: ["ST"] },
  // East of England
  { slug: "cambridge",   label: "Cambridge",           regionCode: "UKH", postcodeAreas: ["CB"] },
  { slug: "norwich",     label: "Norwich",             regionCode: "UKH", postcodeAreas: ["NR"] },
  { slug: "ipswich",     label: "Ipswich",             regionCode: "UKH", postcodeAreas: ["IP"] },
  { slug: "chelmsford",  label: "Chelmsford",          regionCode: "UKH", postcodeAreas: ["CM"] },
  // London
  { slug: "london",      label: "London",              regionCode: "UKI", postcodeAreas: ["E","EC","N","NW","SE","SW","W","WC"] },
  // South East
  { slug: "brighton",    label: "Brighton",            regionCode: "UKJ", postcodeAreas: ["BN"] },
  { slug: "oxford",      label: "Oxford",              regionCode: "UKJ", postcodeAreas: ["OX"] },
  { slug: "reading",     label: "Reading",             regionCode: "UKJ", postcodeAreas: ["RG"] },
  { slug: "southampton", label: "Southampton",         regionCode: "UKJ", postcodeAreas: ["SO"] },
  { slug: "portsmouth",  label: "Portsmouth",          regionCode: "UKJ", postcodeAreas: ["PO"] },
  { slug: "milton-keynes", label: "Milton Keynes",     regionCode: "UKJ", postcodeAreas: ["MK"] },
  // South West
  { slug: "bristol",     label: "Bristol",             regionCode: "UKK", postcodeAreas: ["BS"] },
  { slug: "bath",        label: "Bath",                regionCode: "UKK", postcodeAreas: ["BA"] },
  { slug: "plymouth",    label: "Plymouth",            regionCode: "UKK", postcodeAreas: ["PL"] },
  { slug: "exeter",      label: "Exeter",              regionCode: "UKK", postcodeAreas: ["EX"] },
  { slug: "bournemouth", label: "Bournemouth",         regionCode: "UKK", postcodeAreas: ["BH"] },
  // Wales
  { slug: "cardiff",     label: "Cardiff",             regionCode: "UKL", postcodeAreas: ["CF"] },
  { slug: "swansea",     label: "Swansea",             regionCode: "UKL", postcodeAreas: ["SA"] },
  { slug: "newport-wales", label: "Newport (Wales)",   regionCode: "UKL", postcodeAreas: ["NP"] },
  // Scotland
  { slug: "glasgow",     label: "Glasgow",             regionCode: "UKM", postcodeAreas: ["G"] },
  { slug: "edinburgh",   label: "Edinburgh",           regionCode: "UKM", postcodeAreas: ["EH"] },
  { slug: "aberdeen",    label: "Aberdeen",            regionCode: "UKM", postcodeAreas: ["AB"] },
  { slug: "dundee",      label: "Dundee",              regionCode: "UKM", postcodeAreas: ["DD"] },
  // Northern Ireland
  { slug: "belfast",     label: "Belfast",             regionCode: "UKN", postcodeAreas: ["BT"] }
];

export function postcodeToCity(postcode: string): CitySlug | undefined {
  const upper = postcode.trim().toUpperCase();
  const match = upper.match(/^([A-Z]{1,2})/);
  if (!match) return undefined;
  const area = match[1];
  // Try longest-match first so "SW" wins over "S" for London.
  const sorted = [...UK_CITIES].sort((a, b) => {
    const aMax = Math.max(...a.postcodeAreas.map((p) => p.length));
    const bMax = Math.max(...b.postcodeAreas.map((p) => p.length));
    return bMax - aMax;
  });
  for (const city of sorted) {
    if (city.postcodeAreas.includes(area)) return city.slug;
  }
  return undefined;
}

export function citySlugToLabel(slug: CitySlug): string | undefined {
  return UK_CITIES.find((c) => c.slug === slug)?.label;
}

export function citySlugToRegion(slug: CitySlug): Nuts1Code | undefined {
  return UK_CITIES.find((c) => c.slug === slug)?.regionCode;
}

/** Cities that share a region — useful when a city has too little
 *  data and we need to widen the search. */
export function citiesInRegion(regionCode: Nuts1Code): ReadonlyArray<{ slug: CitySlug; label: string }> {
  return UK_CITIES.filter((c) => c.regionCode === regionCode)
    .map((c) => ({ slug: c.slug, label: c.label }));
}
