// Staircase Advisor · Regional Terminology Layer (Philip 2026-08-02)
//
// Priority 1 intelligence layer per Philip's roadmap · "needed before global launch."
//
// GOAL: same staircase knowledge · different terminology / framing per user country.
//
// RULE (Philip 2026-08-02): "Country first → terminology second."
//
// Nex should not default to "UK standard." When the customer's country is known,
// the composer adopts regional vocabulary naturally and never labels UK components
// as the global default.
//
// SCOPE: v1 covers the country-detection + terminology-mapping + composer-hint
// primitives. Retrieval-side regional preference (article `region` field filtering)
// is a follow-up when the corpus contains regionally-tagged articles.

import "server-only";

export type Country = "UK" | "IE" | "US" | "CA" | "AU" | "NZ";

// ─── Country detection ────────────────────────────────────────────
//
// Detect from user message. Common phrasings:
//   "I'm in Ireland" · "based in the UK" · "living in Australia"
//   "my project is in California" (US signal)
//   "we're renovating in Dublin" (IE signal)

const COUNTRY_PATTERNS: Array<[RegExp, Country]> = [
  // Direct country names / adjectives
  [/\b(?:in|from|based\s+in|living\s+in|located\s+in)\s+(?:the\s+)?(?:united\s+kingdom|england|scotland|wales|northern\s+ireland|uk|britain|british)\b/i, "UK"],
  [/\b(?:in|from|based\s+in|living\s+in|located\s+in)\s+(?:the\s+)?(?:ireland|irish|republic\s+of\s+ireland)\b/i, "IE"],
  [/\b(?:in|from|based\s+in|living\s+in|located\s+in)\s+(?:the\s+)?(?:united\s+states|usa|us|america|american)\b/i, "US"],
  [/\b(?:in|from|based\s+in|living\s+in|located\s+in)\s+(?:canada|canadian)\b/i, "CA"],
  [/\b(?:in|from|based\s+in|living\s+in|located\s+in)\s+(?:australia|australian)\b/i, "AU"],
  [/\b(?:in|from|based\s+in|living\s+in|located\s+in)\s+(?:new\s+zealand|nz|kiwi)\b/i, "NZ"],
  // Cities → country signals (only high-signal ones)
  [/\b(?:in|based\s+in|from)\s+(?:london|manchester|birmingham|glasgow|edinburgh|cardiff|belfast|leeds|liverpool|bristol|newcastle)\b/i, "UK"],
  [/\b(?:in|based\s+in|from)\s+(?:dublin|cork|galway|limerick|waterford)\b/i, "IE"],
  [/\b(?:in|based\s+in|from)\s+(?:new\s+york|los\s+angeles|chicago|houston|phoenix|philadelphia|san\s+francisco|boston|miami|dallas|seattle|denver|atlanta|california|texas|florida|new\s+jersey|massachusetts)\b/i, "US"],
  [/\b(?:in|based\s+in|from)\s+(?:toronto|vancouver|montreal|calgary|ottawa|edmonton)\b/i, "CA"],
  [/\b(?:in|based\s+in|from)\s+(?:sydney|melbourne|brisbane|perth|adelaide)\b/i, "AU"],
  [/\b(?:in|based\s+in|from)\s+(?:auckland|wellington|christchurch)\b/i, "NZ"],
  // Just "im in <country>" with contraction
  [/\b(?:i'?m|i\s+am)\s+in\s+(?:the\s+)?(?:uk|england|scotland|wales|britain)\b/i, "UK"],
  [/\b(?:i'?m|i\s+am)\s+in\s+ireland\b/i, "IE"],
  [/\b(?:i'?m|i\s+am)\s+in\s+(?:the\s+)?(?:us|usa|united\s+states|america)\b/i, "US"],
  [/\b(?:i'?m|i\s+am)\s+in\s+canada\b/i, "CA"],
  [/\b(?:i'?m|i\s+am)\s+in\s+australia\b/i, "AU"],
  [/\b(?:i'?m|i\s+am)\s+in\s+new\s+zealand\b/i, "NZ"],
];

/** Detect country from a message. Returns null if no country signal. */
export function detectCountry(message: string): Country | null {
  for (const [rx, country] of COUNTRY_PATTERNS) {
    if (rx.test(message)) return country;
  }
  return null;
}

// ─── Regional terminology maps ────────────────────────────────────

export type RegionalProfile = {
  country_label:    string;              // "United States" · "Ireland" · etc.
  preferred_terms:  Record<string, string>;   // customer word → preferred term for this region
  supplier_context: string;              // one-line description of local supplier ecosystem
  measurement_units:"metric" | "imperial" | "mixed";
  composer_hint:    string;              // paragraph the system prompt gets when this country is active
};

export const REGIONAL_PROFILES: Record<Country, RegionalProfile> = {
  UK: {
    country_label:    "United Kingdom",
    preferred_terms:  {},   // UK is the corpus's implicit default · no rewrites
    supplier_context: "UK staircase manufacturers, timber merchants, and specialist joiners.",
    measurement_units:"metric",
    composer_hint:
      "CUSTOMER LOCATION · United Kingdom. Use UK staircase terminology (newel post · spindle · baserail · balustrade). " +
      "Reference UK Building Regulations Part K where regulations matter. Prefer metric measurements. " +
      "Do NOT frame UK conventions as 'the standard' — they are the local norm, not the global default.",
  },
  IE: {
    country_label:    "Ireland",
    preferred_terms:  {},   // Ireland shares UK vocabulary largely
    supplier_context: "Irish staircase manufacturers · joinery workshops · timber merchants (similar to UK market).",
    measurement_units:"metric",
    composer_hint:
      "CUSTOMER LOCATION · Ireland. Use Irish/UK staircase terminology (newel post · spindle · baserail · balustrade). " +
      "Do NOT label components as 'UK parts' — describe them as common across Ireland and the UK market. " +
      "Prefer metric measurements. Reference Irish Building Regulations if regulation matters.",
  },
  US: {
    country_label:    "United States",
    preferred_terms:  {
      spindle:       "baluster",
      spindles:      "balusters",
      baserail:      "shoe rail",
      "shoe rail":   "shoe rail",
      staircase:     "staircase",
      "stair parts": "stair parts",
    },
    supplier_context: "US staircase parts suppliers · custom stair manufacturers · millwork specialists.",
    measurement_units:"imperial",
    composer_hint:
      "CUSTOMER LOCATION · United States. Use US staircase terminology naturally · say 'baluster' (not 'spindle'), " +
      "'newel post', 'shoe rail' (the US equivalent of UK baserail), 'stair parts'. Reference IRC/IBC where building " +
      "code matters. Prefer imperial measurements (inches, feet) with metric in parentheses if the customer used metric. " +
      "Do NOT frame UK conventions as the global standard. Do NOT say 'the UK standard' unless comparing markets.",
  },
  CA: {
    country_label:    "Canada",
    preferred_terms:  {
      spindle:  "baluster",
      spindles: "balusters",
    },
    supplier_context: "Canadian staircase parts suppliers · custom stair manufacturers · millwork shops.",
    measurement_units:"mixed",
    composer_hint:
      "CUSTOMER LOCATION · Canada. Use Canadian staircase terminology · 'baluster' is common (like the US). " +
      "Mixed measurement culture — Canadian building code uses metric but residential trades often use imperial. " +
      "Consider colder-climate factors (timber movement · humidity swings) when relevant.",
  },
  AU: {
    country_label:    "Australia",
    preferred_terms:  {},
    supplier_context: "Australian staircase manufacturers · timber merchants · joinery workshops.",
    measurement_units:"metric",
    composer_hint:
      "CUSTOMER LOCATION · Australia. Use Australian staircase terminology (newel post · baluster · balustrade). " +
      "Reference AS 1657 or NCC (National Construction Code) where regulation matters. Prefer metric measurements. " +
      "Consider coastal environment (316 stainless steel · marine-grade materials) where relevant to the query.",
  },
  NZ: {
    country_label:    "New Zealand",
    preferred_terms:  {},
    supplier_context: "New Zealand staircase manufacturers · timber merchants · joinery workshops.",
    measurement_units:"metric",
    composer_hint:
      "CUSTOMER LOCATION · New Zealand. Use NZ staircase terminology (newel post · baluster · balustrade). " +
      "Reference NZBC (New Zealand Building Code) where regulation matters. Prefer metric measurements. " +
      "Consider coastal / high-UV factors where relevant.",
  },
};

/** Build the system-prompt insertion for the composer when a country is known. */
export function buildCountryHint(country: Country | undefined): string {
  if (!country) return "";
  const profile = REGIONAL_PROFILES[country];
  if (!profile) return "";
  return `\n\n## Regional layer (Philip 2026-08-02 · country-first rule)\n\n${profile.composer_hint}\n`;
}
