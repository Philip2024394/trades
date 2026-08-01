// Coverage Report (Philip 2026-08-01)
//
// Shows which staircase topics have deep knowledge coverage and which are
// thin. Star rating derived from section-count per topic · relative to
// the strongest-covered topic. Guides Philip on where to author next.

import "server-only";
import { getTruthIndex, type IndexedSnippet } from "@/lib/nex/staircase-advisor/truth-index";

// Topic taxonomy · Philip's specialist categories · one keyword pattern each.
// Add/remove topics here as the domain grows.
const TOPIC_CATEGORIES: Array<{ topic: string; pattern: RegExp }> = [
  // Timbers
  { topic: "Oak",                pattern: /\boak\b/i },
  { topic: "Pine",               pattern: /\bpine\b/i },
  { topic: "Walnut",             pattern: /\bwalnut\b/i },
  { topic: "Ash",                pattern: /\bash\b/i },
  { topic: "Beech",              pattern: /\bbeech\b/i },
  { topic: "Cherry",             pattern: /\bcherry\b/i },
  { topic: "Sapele",             pattern: /\bsapele\b/i },
  { topic: "Mahogany",           pattern: /\bmahogany\b/i },
  { topic: "Lamwood",            pattern: /\blamwood\b/i },
  // Components
  { topic: "Handrail",           pattern: /\bhandrail\b/i },
  { topic: "Newel post",         pattern: /\bnewel\b/i },
  { topic: "Baluster",           pattern: /\bbaluster\b/i },
  { topic: "String",             pattern: /\b(closed[\s-]string|cut[\s-]string|open[\s-]string)\b/i },
  { topic: "Tread",              pattern: /\btread\b/i },
  { topic: "Riser",              pattern: /\briser\b/i },
  { topic: "Winder",             pattern: /\bwinder\b/i },
  { topic: "Landing",            pattern: /\blanding\b/i },
  { topic: "Nosing",             pattern: /\bnosing\b/i },
  { topic: "Bullnose / curtail", pattern: /\b(bullnose|curtail)\b/i },
  // Balustrade materials
  { topic: "Glass balustrade",   pattern: /\bglass\s+(balustrade|balusters?|panel)\b/i },
  { topic: "Metal balustrade",   pattern: /\b(metal|steel|stainless)\s+balust/i },
  // Project types
  { topic: "New build stairs",   pattern: /\bnew[\s-]build\b/i },
  { topic: "Renovation",         pattern: /\brenovat/i },
  { topic: "Loft conversion",    pattern: /\bloft\s+conversion\b/i },
  { topic: "Extension",          pattern: /\bextension\b/i },
  { topic: "Space saver",        pattern: /\bspace[\s-]saver\b/i },
  { topic: "Commercial stairs",  pattern: /\bcommercial\s+stair/i },
  // Style/design
  { topic: "Traditional style",  pattern: /\btraditional\b/i },
  { topic: "Modern style",       pattern: /\bmodern\b/i },
  { topic: "Contemporary style", pattern: /\bcontemporary\b/i },
  // Finishes
  { topic: "Finishes",           pattern: /\b(matte|gloss|lacquer|oil|stain)\b/i },
  { topic: "Carpet",             pattern: /\bcarpet\b/i },
  { topic: "LED lighting",       pattern: /\bled\s+(light|lighting)\b/i },
  // Practical
  { topic: "Installation",       pattern: /\binstall/i },
  { topic: "Manufacturing",      pattern: /\bmanufactur/i },
  { topic: "Measuring",          pattern: /\b(measurement|measuring|floor[\s-]to[\s-]floor|opening\s+size)\b/i },
  { topic: "Building regs",      pattern: /\bbuilding\s+regulation|\bdoc\s+k\b|\bpart\s+k\b/i },
  { topic: "Fire safety",        pattern: /\bfire\s+(door|safe|regulation)\b/i },
  { topic: "Maintenance",        pattern: /\bmaintenance|\brefinish|\brefinishing\b/i },
  { topic: "Noise / squeaks",    pattern: /\b(squeak|noise|creak|silent)\b/i },
  // Business
  { topic: "Warranty",           pattern: /\bwarrant/i },
  { topic: "Quotes / pricing",   pattern: /\bquote|\bpricing\b/i },
  { topic: "Delivery",           pattern: /\bdeliver/i },
  { topic: "Apprenticeship",     pattern: /\bapprentice/i },
];

export type CoverageEntry = {
  topic:          string;
  section_count:  number;
  stars:          number;    // 0-5
};

export type CoverageReport = {
  entries:      CoverageEntry[];
  strongest:    { topic: string; count: number } | null;
  thinnest:     Array<{ topic: string; count: number }>;
  generated_at: string;
};

/** Compute topic coverage from the current Truth Index. */
export function computeCoverageReport(): CoverageReport {
  const snippets = getTruthIndex();

  // Count sections mentioning each topic
  const counts = new Map<string, number>();
  for (const cat of TOPIC_CATEGORIES) counts.set(cat.topic, 0);

  for (const snippet of snippets) {
    const haystack = `${snippet.section}\n${snippet.text}`;
    for (const cat of TOPIC_CATEGORIES) {
      if (cat.pattern.test(haystack)) {
        counts.set(cat.topic, (counts.get(cat.topic) ?? 0) + 1);
      }
    }
  }

  const entries: CoverageEntry[] = Array.from(counts.entries()).map(([topic, section_count]) => ({
    topic,
    section_count,
    stars: 0, // set below
  }));

  // Convert counts to stars · relative to the strongest topic
  const maxCount = Math.max(1, ...entries.map((e) => e.section_count));
  for (const e of entries) {
    if (e.section_count === 0) {
      e.stars = 0;
    } else {
      const ratio = e.section_count / maxCount;
      // 5-star bands · 0-20% → 1 · 20-40% → 2 · etc.
      e.stars = Math.min(5, Math.max(1, Math.ceil(ratio * 5)));
    }
  }

  // Sort by count desc
  entries.sort((a, b) => b.section_count - a.section_count);

  const strongest = entries[0]?.section_count > 0
    ? { topic: entries[0].topic, count: entries[0].section_count }
    : null;

  const thinnest = entries
    .filter((e) => e.section_count === 0)
    .slice(0, 10)
    .map((e) => ({ topic: e.topic, count: 0 }));

  return {
    entries,
    strongest,
    thinnest,
    generated_at: new Date().toISOString(),
  };
}
