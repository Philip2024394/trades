// Curated Trade Circle contexts.
//
// A "context" is an allow-list of trade slugs that make sense together
// on-site. When a customer lands on The Yard from a Plant Hire profile,
// we don't want to show them plasterers and carpenters — those trades
// have nothing to do with heavy machinery, aggregates or site delivery.
//
// The Yard page accepts ?context=<slug> and filters the feed with an
// `IN (…)` on trade_slug. Explicit exclude lists are documented next to
// each context so future editors know why a trade was left out.

import { TRADE_OFF_TRADES } from "@/lib/tradeOff";

export type TradeCircleContextSlug = "plant-hire";

export type TradeCircleContext = {
  slug: TradeCircleContextSlug;
  label: string;
  headline: string;
  body: string;
  /** Ordered allow-list of trade slugs shown in this context. */
  allowed_trades: string[];
  /** Explicit exclude list (documented for future editors). Not used
   *  at runtime — the filter uses `allowed_trades` as the whitelist. */
  intentionally_excluded: string[];
};

export const TRADE_CIRCLE_CONTEXTS: Record<TradeCircleContextSlug, TradeCircleContext> = {
  "plant-hire": {
    slug: "plant-hire",
    label: "Heavy plant & site machinery",
    headline: "Heavy plant & site machinery",
    body:
      "Trades that use, service, feed or work alongside heavy plant on-site. Machinery, aggregates, quarries, oil, fuel, parts, groundworks, demolition, cranes, transport, waste and site infrastructure.",
    allowed_trades: [
      // Plant + machinery
      "plant-hire",
      "heavy-machinery",
      "minidigger-hire",
      "crane-hire",
      "crane-operator",
      "generator-hire",
      "tool-hire",
      "van-hire",
      "scaffolding-hire",
      "scaffolder",
      // Site infrastructure
      "skip-hire",
      "waste-removal",
      "portaloo-hire",
      "storage-container-hire",
      "site-canteen",
      "site-safety",
      "ppe-supplier",
      // Groundworks, demo, drainage, water
      "groundworker",
      "demolition",
      "drainage-engineer",
      "water-drilling",
      "pump-service",
      "asbestos-removal",
      // Concrete + formwork
      "concrete-specialist",
      "concrete-finisher",
      "formworker",
      // Landscaping + tree
      "landscaper",
      "tree-surgeon",
      "driveway-installer",
      "fencing-installer",
      // Structural + trades that use heavy plant
      "bricklayer",
      "block-layer",
      "stonemason",
      "renderer",
      "general-builder",
      "metal-engineer",
      "steel-fabricator",
      // Suppliers relevant to plant work
      "aggregate-supplier",
      "landscape-supplies",
      "building-merchant",
      "builders-supplies",
      "timber-merchant",
      "ironmongery",
      "tool-shop",
      // Machinery service
      "mobile-mechanic"
    ],
    intentionally_excluded: [
      // Indoor finish trades — no plant crossover.
      "carpenter",
      "joiner",
      "trim-carpenter",
      "stair-fitter",
      "kitchen-fitter",
      "bathroom-fitter",
      "door-fitter",
      "window-fitter",
      "plasterer",
      "taper-and-finisher",
      "drywaller",
      "painter",
      "tiler",
      "flooring-installer",
      "insulation-installer",
      // Domestic services — not heavy plant.
      "damp-proofer",
      "chimney-sweep",
      "pest-control",
      "sash-window-restorer",
      "post-construction-cleaner",
      "garden-designer",
      // Building services — indoor tail.
      "electrician",
      "plumber",
      "gas-engineer",
      // Roofing sub-trades — access-based, not plant.
      "roofer",
      "fascia-and-soffit",
      "gutter-installer",
      "lead-worker",
      // Tech installers — not plant.
      "solar-installer",
      "ev-charger-installer",
      "heat-pump-installer",
      "smart-home-installer",
      "security-installer",
      "aerial-satellite-installer",
      "garage-door-installer",
      // Installers of finished goods — not plant.
      "conservatory-installer",
      "garden-room-installer",
      "awning-installer",
      "shutter-installer",
      // Manufacturers — not plant.
      "kitchen-manufacturer",
      "staircase-manufacturer",
      "door-manufacturer",
      "window-manufacturer",
      "flooring-manufacturer",
      "conservatory-manufacturer",
      "wardrobe-maker",
      "furniture-maker",
      "joinery-workshop",
      "worktop-manufacturer",
      "glass-manufacturer",
      "shed-manufacturer",
      "garden-room-manufacturer",
      // Retail showrooms + finish-trade suppliers.
      "tile-shop",
      "flooring-shop",
      "door-showroom",
      "kitchen-showroom",
      "window-showroom",
      "bathroom-showroom",
      "paint-merchant",
      "plumbing-merchant",
      "electrical-wholesaler",
      "roofing-supplies",
      "insulation-supplies"
    ]
  }
};

/** Return the allowed slug list for a context, or null if not a known context. */
export function tradeCircleAllowedFor(context: string | undefined | null): string[] | null {
  if (!context) return null;
  const c = TRADE_CIRCLE_CONTEXTS[context as TradeCircleContextSlug];
  return c ? c.allowed_trades : null;
}

/** Guard — only allow trades that exist in TRADE_OFF_TRADES for safety. */
export function tradeCircleContext(slug: string | undefined | null): TradeCircleContext | null {
  if (!slug) return null;
  const c = TRADE_CIRCLE_CONTEXTS[slug as TradeCircleContextSlug];
  if (!c) return null;
  const valid = new Set(TRADE_OFF_TRADES.map((t) => t.slug));
  return {
    ...c,
    allowed_trades: c.allowed_trades.filter((t) => valid.has(t))
  };
}
