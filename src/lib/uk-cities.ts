// uk-cities — canonical catalog of UK cities/large towns for
// SEO surface expansion.
//
// Consumers:
//   /find/[city]                  — homeowner landing page (uses full entry)
//   /trade-off/[trade]/[city]     — trade × city listing page
//   sitemap.ts                    — emits every trade × city permutation
//
// Adding a city here immediately (a) unlocks the /find/{city} route,
// (b) adds every /trade-off/{trade}/{city} permutation to the sitemap,
// (c) shows the city in cross-links on other pages.
//
// `postcodePrefixes` is optional — only the six original launch cities
// have hand-curated lists. Future additions can add prefixes as
// needed; the routes work either way.

export type UkCity = {
  slug:             string;   // URL slug (lowercase, hyphenated)
  displayName:      string;   // Title Case for headings
  county:           string;   // "West Yorkshire", "Greater London", etc.
  regionLabel:      string;   // "the North West", "Scotland", "London"
  postcodePrefixes?: string[]; // optional — for merchant filtering
  population?:      number;   // approx 2021 census — used for sort weight
};

/** All supported UK cities. Sorted roughly by population so the
 *  most-searched cities emit high in the sitemap. Populations are
 *  approximate — used for sort weight only, not shown to users. */
export const UK_CITIES: UkCity[] = [
  { slug: "london",              displayName: "London",              county: "Greater London",    regionLabel: "London",             population: 9648000, postcodePrefixes: ["E1", "E2", "E3", "E8", "E9", "N1", "N4", "N5", "N7", "N16", "SE1", "SE10", "SE15", "SW2", "SW9", "SW11", "SW16", "W1", "W6", "W10", "W11", "W12", "NW1", "NW3", "NW5", "NW6", "EC1", "EC2"] },
  { slug: "birmingham",          displayName: "Birmingham",          county: "West Midlands",     regionLabel: "the Midlands",       population: 1157600, postcodePrefixes: ["B1", "B2", "B3", "B4", "B5", "B12", "B15", "B16", "B17", "B18"] },
  { slug: "manchester",          displayName: "Manchester",          county: "Greater Manchester", regionLabel: "the North West",    population:  568996, postcodePrefixes: ["M1", "M2", "M3", "M4", "M8", "M11", "M12", "M13", "M14", "M15", "M16", "M19", "M20", "M21", "M22"] },
  { slug: "glasgow",             displayName: "Glasgow",             county: "Scotland",          regionLabel: "Scotland",           population:  635130, postcodePrefixes: ["G1", "G2", "G3", "G4", "G11", "G12", "G13", "G14", "G20", "G21", "G22"] },
  { slug: "liverpool",           displayName: "Liverpool",           county: "Merseyside",        regionLabel: "the North West",     population:  486100, postcodePrefixes: ["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L15", "L17", "L18"] },
  { slug: "leeds",               displayName: "Leeds",               county: "West Yorkshire",    regionLabel: "West Yorkshire",     population:  812000, postcodePrefixes: ["LS1", "LS2", "LS3", "LS4", "LS6", "LS7", "LS8", "LS9", "LS11", "LS12"] },
  { slug: "sheffield",           displayName: "Sheffield",           county: "South Yorkshire",   regionLabel: "South Yorkshire",    population:  584853 },
  { slug: "edinburgh",           displayName: "Edinburgh",           county: "Scotland",          regionLabel: "Scotland",           population:  527620 },
  { slug: "bristol",             displayName: "Bristol",             county: "Somerset",          regionLabel: "the South West",     population:  467099 },
  { slug: "cardiff",             displayName: "Cardiff",             county: "Wales",             regionLabel: "Wales",              population:  372089 },
  { slug: "leicester",           displayName: "Leicester",           county: "Leicestershire",    regionLabel: "the East Midlands",  population:  368600 },
  { slug: "belfast",             displayName: "Belfast",             county: "Northern Ireland",  regionLabel: "Northern Ireland",   population:  345418 },
  { slug: "coventry",            displayName: "Coventry",            county: "West Midlands",     regionLabel: "the Midlands",       population:  345324 },
  { slug: "bradford",            displayName: "Bradford",            county: "West Yorkshire",    regionLabel: "West Yorkshire",     population:  546400 },
  { slug: "nottingham",          displayName: "Nottingham",          county: "Nottinghamshire",   regionLabel: "the East Midlands",  population:  337100 },
  { slug: "kingston-upon-hull",  displayName: "Kingston upon Hull",  county: "East Yorkshire",    regionLabel: "Yorkshire",          population:  267014 },
  { slug: "newcastle-upon-tyne", displayName: "Newcastle upon Tyne", county: "Tyne and Wear",     regionLabel: "the North East",     population:  300196 },
  { slug: "stoke-on-trent",      displayName: "Stoke-on-Trent",      county: "Staffordshire",     regionLabel: "the Midlands",       population:  256375 },
  { slug: "southampton",         displayName: "Southampton",         county: "Hampshire",         regionLabel: "the South Coast",    population:  253651 },
  { slug: "derby",               displayName: "Derby",               county: "Derbyshire",        regionLabel: "the East Midlands",  population:  261400 },
  { slug: "portsmouth",          displayName: "Portsmouth",          county: "Hampshire",         regionLabel: "the South Coast",    population:  208100 },
  { slug: "brighton",            displayName: "Brighton",            county: "East Sussex",       regionLabel: "the South Coast",    population:  277965 },
  { slug: "plymouth",            displayName: "Plymouth",            county: "Devon",             regionLabel: "the South West",     population:  264200 },
  { slug: "northampton",         displayName: "Northampton",         county: "Northamptonshire",  regionLabel: "the East Midlands",  population:  224610 },
  { slug: "reading",             displayName: "Reading",             county: "Berkshire",         regionLabel: "the South East",     population:  318014 },
  { slug: "luton",               displayName: "Luton",               county: "Bedfordshire",      regionLabel: "the East of England", population: 225262 },
  { slug: "wolverhampton",       displayName: "Wolverhampton",       county: "West Midlands",     regionLabel: "the Midlands",       population:  263700 },
  { slug: "bolton",              displayName: "Bolton",              county: "Greater Manchester", regionLabel: "the North West",    population:  296400 },
  { slug: "aberdeen",            displayName: "Aberdeen",            county: "Scotland",          regionLabel: "Scotland",           population:  198590 },
  { slug: "bournemouth",         displayName: "Bournemouth",         county: "Dorset",            regionLabel: "the South Coast",    population:  198727 },
  { slug: "norwich",             displayName: "Norwich",             county: "Norfolk",           regionLabel: "the East of England", population: 143135 },
  { slug: "swindon",             displayName: "Swindon",             county: "Wiltshire",         regionLabel: "the South West",     population:  222970 },
  { slug: "swansea",             displayName: "Swansea",             county: "Wales",             regionLabel: "Wales",              population:  246563 },
  { slug: "southend-on-sea",     displayName: "Southend-on-Sea",     county: "Essex",             regionLabel: "the East of England", population: 182305 },
  { slug: "middlesbrough",       displayName: "Middlesbrough",       county: "North Yorkshire",   regionLabel: "the North East",     population:  141980 },
  { slug: "milton-keynes",       displayName: "Milton Keynes",       county: "Buckinghamshire",   regionLabel: "the South East",     population:  287060 },
  { slug: "sunderland",          displayName: "Sunderland",          county: "Tyne and Wear",     regionLabel: "the North East",     population:  169740 },
  { slug: "warrington",          displayName: "Warrington",          county: "Cheshire",          regionLabel: "the North West",     population:  210900 },
  { slug: "peterborough",        displayName: "Peterborough",        county: "Cambridgeshire",    regionLabel: "the East of England", population: 202259 },
  { slug: "huddersfield",        displayName: "Huddersfield",        county: "West Yorkshire",    regionLabel: "West Yorkshire",     population:  162949 },
  { slug: "oxford",              displayName: "Oxford",              county: "Oxfordshire",       regionLabel: "the South East",     population:  151584 },
  { slug: "cambridge",           displayName: "Cambridge",           county: "Cambridgeshire",    regionLabel: "the East of England", population: 145818 },
  { slug: "york",                displayName: "York",                county: "North Yorkshire",   regionLabel: "Yorkshire",          population:  202800 },
  { slug: "poole",               displayName: "Poole",               county: "Dorset",            regionLabel: "the South Coast",    population:  151500 },
  { slug: "preston",             displayName: "Preston",             county: "Lancashire",        regionLabel: "the North West",     population:  147800 },
  { slug: "ipswich",             displayName: "Ipswich",             county: "Suffolk",           regionLabel: "the East of England", population: 144957 },
  { slug: "telford",             displayName: "Telford",             county: "Shropshire",        regionLabel: "the Midlands",       population:  142723 },
  { slug: "slough",              displayName: "Slough",              county: "Berkshire",         regionLabel: "the South East",     population:  164793 },
  { slug: "blackpool",           displayName: "Blackpool",           county: "Lancashire",        regionLabel: "the North West",     population:  141000 },
  { slug: "watford",             displayName: "Watford",             county: "Hertfordshire",     regionLabel: "the East of England", population: 102000 },
  { slug: "rotherham",           displayName: "Rotherham",           county: "South Yorkshire",   regionLabel: "South Yorkshire",    population:  109691 },
  { slug: "colchester",          displayName: "Colchester",          county: "Essex",             regionLabel: "the East of England", population: 194706 },
  { slug: "blackburn",           displayName: "Blackburn",           county: "Lancashire",        regionLabel: "the North West",     population:  117963 },
  { slug: "cheltenham",          displayName: "Cheltenham",          county: "Gloucestershire",   regionLabel: "the South West",     population:  116447 },
  { slug: "exeter",              displayName: "Exeter",              county: "Devon",             regionLabel: "the South West",     population:  130428 },
  { slug: "chesterfield",        displayName: "Chesterfield",        county: "Derbyshire",        regionLabel: "the East Midlands",  population:  103801 },
  { slug: "basildon",            displayName: "Basildon",            county: "Essex",             regionLabel: "the East of England", population: 107123 },
  { slug: "basingstoke",         displayName: "Basingstoke",         county: "Hampshire",         regionLabel: "the South East",     population:  113776 },
  { slug: "chelmsford",          displayName: "Chelmsford",          county: "Essex",             regionLabel: "the East of England", population: 168310 },
  { slug: "worcester",           displayName: "Worcester",           county: "Worcestershire",    regionLabel: "the Midlands",       population:  103872 },
  { slug: "wigan",               displayName: "Wigan",               county: "Greater Manchester", regionLabel: "the North West",    population:  103608 },
  { slug: "st-helens",           displayName: "St Helens",           county: "Merseyside",        regionLabel: "the North West",     population:  102555 },
  { slug: "doncaster",           displayName: "Doncaster",           county: "South Yorkshire",   regionLabel: "South Yorkshire",    population:  109805 },
  { slug: "gloucester",          displayName: "Gloucester",          county: "Gloucestershire",   regionLabel: "the South West",     population:  132000 },
  { slug: "woking",              displayName: "Woking",              county: "Surrey",            regionLabel: "the South East",     population:  105367 },
  { slug: "solihull",            displayName: "Solihull",            county: "West Midlands",     regionLabel: "the Midlands",       population:  126577 },
  { slug: "eastbourne",          displayName: "Eastbourne",          county: "East Sussex",       regionLabel: "the South Coast",    population:  103745 },
  { slug: "crawley",             displayName: "Crawley",             county: "West Sussex",       regionLabel: "the South East",     population:  118493 },
  { slug: "gillingham",          displayName: "Gillingham",          county: "Kent",              regionLabel: "the South East",     population:  108000 },
  { slug: "halifax",             displayName: "Halifax",             county: "West Yorkshire",    regionLabel: "West Yorkshire",     population:   88134 },
  { slug: "grimsby",             displayName: "Grimsby",             county: "Lincolnshire",      regionLabel: "the East Midlands",  population:   88243 },
  { slug: "rochdale",            displayName: "Rochdale",            county: "Greater Manchester", regionLabel: "the North West",    population:  107926 },
  { slug: "wakefield",           displayName: "Wakefield",           county: "West Yorkshire",    regionLabel: "West Yorkshire",     population:  109766 },
  { slug: "salford",             displayName: "Salford",             county: "Greater Manchester", regionLabel: "the North West",    population:  103886 },
  { slug: "sale",                displayName: "Sale",                county: "Greater Manchester", regionLabel: "the North West",    population:   55234 },
  { slug: "hartlepool",          displayName: "Hartlepool",          county: "County Durham",     regionLabel: "the North East",     population:   92016 },
  { slug: "southport",           displayName: "Southport",           county: "Merseyside",        regionLabel: "the North West",     population:   90381 },
  { slug: "stockport",           displayName: "Stockport",           county: "Greater Manchester", regionLabel: "the North West",    population:  105878 },
  { slug: "sutton-coldfield",    displayName: "Sutton Coldfield",    county: "West Midlands",     regionLabel: "the Midlands",       population:   95107 },
  { slug: "barnsley",            displayName: "Barnsley",            county: "South Yorkshire",   regionLabel: "South Yorkshire",    population:   96888 },
  { slug: "burnley",             displayName: "Burnley",             county: "Lancashire",        regionLabel: "the North West",     population:   87059 },
  { slug: "nuneaton",            displayName: "Nuneaton",            county: "Warwickshire",      regionLabel: "the Midlands",       population:   88813 },
  { slug: "hemel-hempstead",     displayName: "Hemel Hempstead",     county: "Hertfordshire",     regionLabel: "the East of England", population:  95985 },
  { slug: "hastings",            displayName: "Hastings",            county: "East Sussex",       regionLabel: "the South Coast",    population:   91053 },
  { slug: "high-wycombe",        displayName: "High Wycombe",        county: "Buckinghamshire",   regionLabel: "the South East",     population:  125257 },
  { slug: "maidstone",           displayName: "Maidstone",           county: "Kent",              regionLabel: "the South East",     population:  113137 },
  { slug: "redditch",            displayName: "Redditch",            county: "Worcestershire",    regionLabel: "the Midlands",       population:   85000 },
  { slug: "weston-super-mare",   displayName: "Weston-super-Mare",   county: "Somerset",          regionLabel: "the South West",     population:   82103 },
  { slug: "carlisle",            displayName: "Carlisle",            county: "Cumbria",           regionLabel: "the North West",     population:  108387 },
  { slug: "chester",             displayName: "Chester",             county: "Cheshire",          regionLabel: "the North West",     population:  118925 },
  { slug: "st-albans",           displayName: "St Albans",           county: "Hertfordshire",     regionLabel: "the East of England", population:  147373 },
  { slug: "bath",                displayName: "Bath",                county: "Somerset",          regionLabel: "the South West",     population:   94782 },
  { slug: "lincoln",             displayName: "Lincoln",             county: "Lincolnshire",      regionLabel: "the East Midlands",  population:  103800 },
  { slug: "scunthorpe",          displayName: "Scunthorpe",          county: "Lincolnshire",      regionLabel: "the East Midlands",  population:   82334 },
  { slug: "guildford",           displayName: "Guildford",           county: "Surrey",            regionLabel: "the South East",     population:   77057 },
  { slug: "kettering",           displayName: "Kettering",           county: "Northamptonshire",  regionLabel: "the East Midlands",  population:   63675 },
  { slug: "loughborough",        displayName: "Loughborough",        county: "Leicestershire",    regionLabel: "the East Midlands",  population:   59932 },
  { slug: "bury",                displayName: "Bury",                county: "Greater Manchester", regionLabel: "the North West",    population:   78723 },
  { slug: "mansfield",           displayName: "Mansfield",           county: "Nottinghamshire",   regionLabel: "the East Midlands",  population:  110500 },
  { slug: "dundee",              displayName: "Dundee",              county: "Scotland",          regionLabel: "Scotland",           population:  148270 },
  { slug: "newport",             displayName: "Newport",             county: "Wales",             regionLabel: "Wales",              population:  159587 },
  { slug: "wrexham",             displayName: "Wrexham",             county: "Wales",             regionLabel: "Wales",              population:   65692 }
];

/** Map slug → full record for O(1) lookup. */
export const UK_CITY_BY_SLUG: Record<string, UkCity> = UK_CITIES.reduce(
  (acc, c) => { acc[c.slug] = c; return acc; },
  {} as Record<string, UkCity>
);

/** Case-insensitive lookup by display name (for DB queries where the
 *  merchant `city` column is stored as free-text Title Case). */
export function findCityByName(name: string): UkCity | null {
  const n = name.trim().toLowerCase();
  return UK_CITIES.find((c) => c.displayName.toLowerCase() === n) ?? null;
}

/** All slugs — for sitemap iteration. */
export function allCitySlugs(): string[] {
  return UK_CITIES.map((c) => c.slug);
}

/** Nearby cities in the same region (for cross-linking). Excludes
 *  the origin city itself. Returned in population order (biggest first). */
export function nearbyCities(originSlug: string, limit = 8): UkCity[] {
  const origin = UK_CITY_BY_SLUG[originSlug];
  if (!origin) return [];
  return UK_CITIES
    .filter((c) => c.slug !== originSlug && c.regionLabel === origin.regionLabel)
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
    .slice(0, limit);
}
