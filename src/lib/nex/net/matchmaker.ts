// Matchmaker — parses "find me a bricklayer near M25" style briefs
// and returns ranked NetworkBusiness matches. Uses directory search.

import { findBusinesses } from "./directory";
import { evidenceFor, type MatchIntent, type MatchResult } from "./types";

/** Trade aliases we normalise before searching the listings table.
 *  Extend as more trade-name variants appear. */
const TRADE_ALIASES: Record<string, string> = {
  brickie:      "bricklayer",
  brickies:     "bricklayer",
  bricklayers:  "bricklayer",
  sparkie:      "electrician",
  sparkies:     "electrician",
  sparky:       "electrician",
  chippie:      "carpenter",
  chippies:     "carpenter",
  chippy:       "carpenter",
  plasterers:   "plasterer",
  scaffolders:  "scaffolder",
  roofers:      "roofer",
  builders:     "builder",
  plumbers:     "plumber",
  joiners:      "joiner",
  decorators:   "painter"
};

const TRADE_KEYWORDS = [
  "bricklayer","brickie","brickies","electrician","sparkie","sparky","carpenter","chippie","chippies","chippy",
  "joiner","joiners","plumber","plumbers","roofer","roofers","builder","builders","plasterer","plasterers",
  "scaffolder","scaffolders","tiler","tilers","painter","painters","decorator","decorators",
  "landscaper","landscapers","gas-engineer","heating-engineer","glazier","glaziers",
  "drywaller","kitchen-fitter","bathroom-fitter","structural-engineer","architect","surveyor"
];

/** Parse "find me a bricklayer near M25", "recommend a scaffolder in Manchester". */
export function parseMatchIntent(text: string): MatchIntent | null {
  const t = text.toLowerCase().trim();
  if (!t) return null;

  const tradeMatch = TRADE_KEYWORDS.find((k) => new RegExp(`\\b${k.replace(/-/g, "[- ]")}\\b`).test(t));
  if (!tradeMatch) return null;
  const trade = TRADE_ALIASES[tradeMatch] ?? tradeMatch;

  let area: string | undefined;
  const nearPostcode = t.match(/\b(?:near|around|in|at)\s+([a-z]{1,2}\d{1,2})\b/i);
  if (nearPostcode) {
    area = nearPostcode[1].toUpperCase();
  } else {
    const nearCity = t.match(/\b(?:near|around|in|at)\s+([a-z][a-z\s-]{2,30}?)(?:$|[?.,!])/i);
    if (nearCity) area = nearCity[1].trim();
  }

  let urgency: MatchIntent["urgency"] | undefined;
  if (/\btoday\b/.test(t))                          urgency = "today";
  else if (/\bthis\s+week\b|\bthis\s+wk\b/.test(t)) urgency = "this_week";

  return { trade, area, urgency };
}

export type FindMatchesInput = {
  brief:        string;
  excludeSlugs?: string[];       // usually the caller's own listing
};

export async function findMatches(opts: FindMatchesInput): Promise<MatchResult | null> {
  const intent = parseMatchIntent(opts.brief);
  if (!intent) return null;
  const evidence = evidenceFor("matchmaker over hammerex_trade_off_listings", ["hammerex_trade_off_listings"]);

  const isPostcode = intent.area && /^[A-Z]{1,2}\d{1,2}$/.test(intent.area);
  const matches = await findBusinesses({
    trade:            intent.trade,
    city:             !isPostcode ? intent.area : undefined,
    postcode_prefix:  isPostcode ? intent.area : undefined,
    exclude_slugs:    opts.excludeSlugs,
    limit:            15
  });

  const noteParts: string[] = [];
  if (intent.urgency) noteParts.push(`Availability filter for '${intent.urgency}' not applied — no live availability source.`);
  if (matches.length === 0) noteParts.push(`No ${intent.trade}s found${intent.area ? ` for ${intent.area}` : ""} on the platform yet.`);
  const note = noteParts.length > 0 ? noteParts.join(" ") : `Match by trade${intent.area ? ` + area (${intent.area})` : ""} — distance-sort skipped because origin lat/lng wasn't supplied.`;

  return { intent, matches, note, evidence };
}
