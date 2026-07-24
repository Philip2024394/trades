// MP answer router.

import { parseBasketRequest } from "./basket";
import { searchProducts } from "./search";
import { rankListings } from "./ranking";
import { UNAVAILABLE_TODAY, evidenceFor, type RankedListing, type SearchResult } from "./types";
import { opportunitySlot, resolveResultLimit } from "../util/limit";

export type MPQuestion =
  | { kind: "find_material"; ask: string }
  | { kind: "compare_prices"; ask: string }
  | { kind: "unavailable" }
  | { kind: "none" };

export function classifyMPQuestion(text: string): MPQuestion {
  const t = text.toLowerCase().trim();
  if (!t) return { kind: "none" };

  if (/\bcompare\s+prices?\b|\bcompare\s+(timber|paint|blocks?|bricks?|plasterboard|tiles?)\s+prices?\b/.test(t)) return { kind: "compare_prices", ask: text };
  if (/\bi\s+need\s+\d/.test(t)
   || /\bfind\s+(me\s+)?\d/.test(t)
   || /\bfind\s+(me\s+)?(cheaper|the\s+cheapest)\b/.test(t)
   || /\bbuy\s+(today'?s\s+)?materials?\b/.test(t)
   || /\bwho\s+sells\b/.test(t)
   || /\bprice\s+(?:this|the)\s+(bathroom|kitchen|extension|loft)\b/.test(t)) {
    return { kind: "find_material", ask: text };
  }
  if (/\bwhat'?s\s+missing\s+from\s+the\s+marketplace\b|\bwhat\s+can'?t\s+you\s+buy\b/.test(t)) return { kind: "unavailable" };

  return { kind: "none" };
}

export type AnswerMPInput = {
  question:      MPQuestion;
  merchantSlug?: string;
  origin?:       { lat: number; lng: number };
};

export async function answerMP(input: AnswerMPInput): Promise<{ speak: string; data?: SearchResult }> {
  switch (input.question.kind) {
    case "find_material":
    case "compare_prices": {
      const parsed = parseBasketRequest(input.question.ask);
      const listings = await searchProducts({ keyword: parsed.keyword, origin: input.origin, limit: 20 });
      const ranked = await rankListings({ listings });
      const warnings: string[] = [];
      if (parsed.parsed_confidence === "low") warnings.push(parsed.parse_reason);
      if (parsed.hint_area_m2 !== null && parsed.qty === null) warnings.push(`Area hint ${parsed.hint_area_m2} m² — for a precise per-unit quantity route through the estimator ("estimate ${parsed.hint_area_m2}m² of ${parsed.keyword}").`);
      const result: SearchResult = {
        request:      { raw: input.question.ask, keyword: parsed.keyword, qty: parsed.qty, unit: parsed.unit, hint_area_m2: parsed.hint_area_m2 ?? undefined, parsed_confidence: parsed.parsed_confidence, parse_reason: parsed.parse_reason },
        results:      ranked,
        warnings,
        unavailable:  UNAVAILABLE_TODAY,
        evidence:     evidenceFor("MP search+rank", ["hammerex_xrated_products", "hammerex_canteen_products", "app_products_merchant_offers"])
      };
      return { speak: formatSearch(result), data: result };
    }
    case "unavailable": {
      const lines = ["What the platform can't buy for you yet:"];
      for (const u of UNAVAILABLE_TODAY) lines.push(`- ${u}`);
      lines.push("");
      lines.push("Add those sources and I'll fold them in without any code change.");
      return { speak: lines.join("\n") };
    }
    case "none":
      return { speak: "" };
  }
}

function formatSearch(r: SearchResult): string {
  const lines: string[] = [];
  if (r.results.length === 0) {
    lines.push(`No listings on the platform for "${r.request.keyword}".`);
    if (r.request.parsed_confidence === "low") lines.push(r.request.parse_reason);
    return lines.join("\n");
  }
  const limit = resolveResultLimit(r.request.raw);
  lines.push(`Top ${limit} for "${r.request.keyword}"${r.request.qty ? ` (${r.request.qty} ${r.request.unit ?? ""})` : ""}:`);
  const shown = r.results.slice(0, limit);
  for (const rl of shown) lines.push(`- [${rl.score}] ${rl.listing.name} · ${rl.reason}`);
  // Pad with opportunity slots up to the resolved limit.
  for (let i = shown.length; i < limit; i++) lines.push(`- ${opportunitySlot("product")}`);
  if (r.warnings.length > 0) {
    lines.push("");
    for (const w of r.warnings) lines.push(`- ${w}`);
  }
  return lines.join("\n");
}

// Re-export the formatter for callers that need it.
export { formatSearch };
export type { RankedListing };
