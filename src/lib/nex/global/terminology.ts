// Regional-terminology dictionary.
//
// A very small manually curated mapping. `standard` is Nex's internal
// term; `local[country]` is what merchants in that country actually
// say. `localize()` swaps standard → local terms verbatim (case
// preserved on the first letter only).

import type { CountryCode } from "../world/types";
import type { TerminologyEntry } from "./types";

const DICTIONARY: TerminologyEntry[] = [
  {
    standard: "plasterboard",
    local: { US: "drywall", CA: "drywall", AU: "plasterboard", NZ: "plasterboard", UK: "plasterboard", IE: "plasterboard", AE: "gypsum board" }
  },
  {
    standard: "pavement",
    local: { US: "sidewalk", CA: "sidewalk", AU: "footpath", NZ: "footpath", UK: "pavement", IE: "footpath" }
  },
  {
    standard: "block paving",
    local: { US: "pavers", CA: "pavers", AU: "pavers", NZ: "pavers" }
  },
  {
    standard: "hob",
    local: { US: "stovetop", CA: "stovetop", AU: "cooktop", NZ: "cooktop" }
  },
  {
    standard: "boiler",
    local: { US: "water heater / furnace", CA: "furnace / water heater" }
  },
  {
    standard: "skirting",
    local: { US: "baseboard", CA: "baseboard", AU: "skirting board", NZ: "skirting board" }
  },
  {
    standard: "rendered",
    local: { US: "stuccoed", CA: "stuccoed" }
  },
  {
    standard: "underfloor heating",
    local: { US: "radiant floor heating", CA: "radiant floor heating" }
  },
  {
    standard: "loft",
    local: { US: "attic", CA: "attic", AU: "attic" }
  },
  {
    standard: "flat (apartment)",
    local: { US: "apartment", CA: "apartment", AU: "apartment", NZ: "apartment" }
  }
];

/** Rewrite a piece of text using the regional term for the target
 *  country. Left as verbatim if there's no local mapping for that
 *  country. Word-boundary case-insensitive match. */
export function localize(text: string, country: CountryCode): string {
  if (country === "unknown" || country === "UK") return text;   // UK is our internal reference; no rewrite needed
  let out = text;
  for (const entry of DICTIONARY) {
    const local = entry.local[country];
    if (!local || local === entry.standard) continue;
    // Match with optional trailing `s` so "plasterboards" → "drywalls".
    const re = new RegExp(`\\b${escape(entry.standard)}(s?)\\b`, "gi");
    out = out.replace(re, (_match, s: string) => {
      const swapped = s ? `${local}s` : local;
      return preserveCase(_match, swapped);
    });
  }
  return out;
}

/** For UI: what local term corresponds to a standard term? Returns
 *  the standard if no mapping. */
export function localTerm(standard: string, country: CountryCode): string {
  const entry = DICTIONARY.find((d) => d.standard === standard);
  if (!entry) return standard;
  return entry.local[country] ?? standard;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function preserveCase(from: string, to: string): string {
  if (!from || !to) return to;
  if (from[0] === from[0].toUpperCase() && from[0] !== from[0].toLowerCase()) {
    return to[0].toUpperCase() + to.slice(1);
  }
  return to;
}
