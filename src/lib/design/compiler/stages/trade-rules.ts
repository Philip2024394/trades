// Stage 5 — Trade Rules.
//
// Every UK trade has visual conventions that signal competence to a
// homeowner. This stage looks the trade up in a lightweight rulebook
// and appends preservations to the IR so downstream sections respect
// them. Purely deterministic. Extend by adding entries here.

import type { Constraint } from "../ir";

export const TRADE_RULES_VERSION = "1.0.0";

type TradeRulebook = {
  slug:          string;
  must_show:     string[];      // e.g. Gas Safe number for gas engineers
  visual_cues:   string[];      // e.g. copper pipe imagery for plumbers
  never_show:    string[];      // e.g. no cartoons for gas engineers
};

const TRADE_RULES: TradeRulebook[] = [
  {
    slug: "plumbing",
    must_show:   ["24/7 emergency chip if applicable", "Gas Safe number if gas-qualified", "landline OR mobile"],
    visual_cues: ["clean copper pipe", "chrome fittings", "modern boiler visible"],
    never_show:  ["cartoon plumbers", "handshake stock photo", "burst pipe imagery on vans"]
  },
  {
    slug: "electrical",
    must_show:   ["NICEIC or NAPIT badge if qualified", "24hr call-out language", "mobile"],
    visual_cues: ["consumer unit", "amber warning tape motif", "safe hand gestures"],
    never_show:  ["exposed live wires", "cartoon lightning", "hi-vis over face"]
  },
  {
    slug: "joinery",
    must_show:   ["carpentry portfolio strip", "before/after image", "phone"],
    visual_cues: ["timber grain texture", "chisel work", "warm oak tones"],
    never_show:  ["cheap MDF products", "flat-pack imagery"]
  },
  {
    slug: "roofing",
    must_show:   ["insurance-approved badge if applicable", "free-quote CTA", "mobile"],
    visual_cues: ["ridge tiles", "scaffolding line", "sky/roofline photography"],
    never_show:  ["worker without harness", "damaged tiles as hero"]
  },
  {
    slug: "landscaping",
    must_show:   ["before/after strip", "seasonal availability chip", "email or WhatsApp"],
    visual_cues: ["mature planting", "sandstone or slate paving", "warm evening light"],
    never_show:  ["overgrown 'nightmare' imagery", "generic bag-of-turf"]
  },
  {
    slug: "gas",
    must_show:   ["Gas Safe registration number", "engineer name", "24hr emergency"],
    visual_cues: ["combi boiler", "clean whites/blues", "confident engineer posture"],
    never_show:  ["cartoon flames", "gas leak imagery", "exposed pipes"]
  }
];

/** Return the trade's rulebook, or null if we don't know the trade. */
export function findTradeRules(trade: string): TradeRulebook | null {
  const key = trade.toLowerCase();
  return TRADE_RULES.find((t) => key.includes(t.slug)) ?? null;
}

/** Convert a rulebook into IR constraints. Preservations feed into the
 *  constraint-resolver stage — the compiler treats them the same as
 *  vehicle / print preservations. */
export function tradeRulesToConstraints(trade: string): Constraint[] {
  const rules = findTradeRules(trade);
  if (!rules) return [];
  const constraints: Constraint[] = [];
  for (const cue of rules.visual_cues) {
    constraints.push({ kind: "require",  target: cue,       source: "trade-rules", reason: `${rules.slug} visual convention` });
  }
  for (const forbid of rules.never_show) {
    constraints.push({ kind: "forbid",   target: forbid,    source: "trade-rules", reason: `${rules.slug} audience filter` });
  }
  for (const must of rules.must_show) {
    constraints.push({ kind: "require",  target: must,      source: "trade-rules", reason: `${rules.slug} credibility signal` });
  }
  return constraints;
}
