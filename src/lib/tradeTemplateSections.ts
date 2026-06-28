// Five-section template taxonomy for the gallery at /trade-off/trades.
// Each trade slug belongs to ONE or MORE sections — "Stairs", "Kitchens"
// and "Windows" deliberately appear in Installation + Manufacture + Sales
// because a stair-fitter genuinely sits in all three. Drives the section
// grouping + the search/filter on the gallery page.

import { TRADE_OFF_TRADES } from "./tradeOff";

export type TemplateSection = "service" | "installation" | "manufacture" | "sales" | "hire";

export const SECTION_META: Record<
  TemplateSection,
  { label: string; eyebrow: string; blurb: string }
> = {
  service: {
    label: "Trade Service",
    eyebrow: "Service templates",
    blurb:
      "On-site labour — quotes, callouts, and the work itself. Best for trades that visit, build, fit or repair on the customer's site."
  },
  installation: {
    label: "Trade Installation",
    eyebrow: "Installation templates",
    blurb:
      "You fit a finished product on-site — kitchens, stairs, windows, doors, EV chargers, solar. Catalogue meets labour."
  },
  manufacture: {
    label: "Manufacture",
    eyebrow: "Manufacture templates",
    blurb:
      "You make the product in your workshop and ship or fit it. Bespoke joinery, fabricated steel, made-to-measure windows and stairs."
  },
  sales: {
    label: "Trade Product Sales",
    eyebrow: "Sales templates",
    blurb:
      "Catalogue + cart. Merchants, supply yards, showrooms — customers browse, add to cart, you dispatch."
  },
  hire: {
    label: "Hire / Rental",
    eyebrow: "Hire templates",
    blurb:
      "Day / week / month rentals — tools, plant, machinery, skips, scaffolding, vans, generators, waste."
  }
};

// Source of truth: trade slug → list of sections it belongs to.
// Trades not in this map default to ['service'] (safe fallback for
// any labour-only craft).
const SECTIONS_BY_TRADE: Record<string, TemplateSection[]> = {
  // ─── Existing trades — service (labour) ──────────────────────────
  drywaller: ["service"],
  plasterer: ["service"],
  electrician: ["service"],
  scaffolder: ["service"],
  tiler: ["service"],
  plumber: ["service"],
  carpenter: ["service"],
  joiner: ["service"],
  painter: ["service"],
  roofer: ["service"],
  bricklayer: ["service"],
  stonemason: ["service"],
  groundworker: ["service"],
  "general-builder": ["service"],
  "concrete-specialist": ["service"],
  renderer: ["service"],
  "taper-and-finisher": ["service"],
  landscaper: ["service"],
  "gas-engineer": ["service"],
  "concrete-finisher": ["service"],
  "crane-operator": ["service"],
  formworker: ["service"],
  "block-layer": ["service"],
  "site-safety": ["service"],
  "water-drilling": ["service"],
  demolition: ["service"],
  "site-canteen": ["service"],
  // Existing — overlap multi-section
  "fascia-and-soffit": ["service", "installation"],
  "insulation-installer": ["service", "installation"],
  "trim-carpenter": ["service", "installation"],
  "metal-engineer": ["manufacture", "service"],
  // Each topic (Kitchen / Stairs / Windows / Doors / Flooring) now
  // has dedicated Sales + Manufacture + Installation slugs, so the
  // -fitter slug stays in Installation only. Avoids three identical
  // "Kitchen Fitter" cards stacked in three different sections.
  "window-fitter": ["installation"],
  "stair-fitter": ["installation"],
  "kitchen-fitter": ["installation"],
  "security-installer": ["installation"],
  // Existing — pure sales
  "building-merchant": ["sales"],
  "builders-supplies": ["sales"],
  // Existing — hire + sales
  "tool-hire": ["hire", "sales"],
  "heavy-machinery": ["hire", "sales"],

  // ─── Phase 2 — Service additions ─────────────────────────────────
  "damp-proofer": ["service"],
  "drainage-engineer": ["service"],
  "chimney-sweep": ["service"],
  "tree-surgeon": ["service"],
  "pest-control": ["service"],
  "asbestos-removal": ["service"],
  "lead-worker": ["service", "installation"],
  "sash-window-restorer": ["service"],
  "post-construction-cleaner": ["service"],
  "garden-designer": ["service"],
  "mobile-mechanic": ["service"],
  "pump-service": ["service", "installation"],

  // ─── Installation additions ──────────────────────────────────────
  "door-fitter": ["installation"],
  "flooring-installer": ["installation"],
  "bathroom-fitter": ["installation"],
  "conservatory-installer": ["installation", "manufacture"],
  "solar-installer": ["installation"],
  "ev-charger-installer": ["installation"],
  "heat-pump-installer": ["installation"],
  "smart-home-installer": ["installation"],
  "garage-door-installer": ["installation"],
  "gutter-installer": ["installation"],
  "driveway-installer": ["installation"],
  "fencing-installer": ["installation"],
  "shutter-installer": ["installation"],
  "aerial-satellite-installer": ["installation"],
  "garden-room-installer": ["installation"],
  "awning-installer": ["installation"],

  // ─── Manufacture additions ───────────────────────────────────────
  "kitchen-manufacturer": ["manufacture", "sales"],
  "staircase-manufacturer": ["manufacture", "sales"],
  "door-manufacturer": ["manufacture", "sales"],
  "window-manufacturer": ["manufacture", "sales"],
  "flooring-manufacturer": ["manufacture", "sales"],
  "conservatory-manufacturer": ["manufacture"],
  "wardrobe-maker": ["manufacture", "installation"],
  "furniture-maker": ["manufacture", "sales"],
  "joinery-workshop": ["manufacture", "sales"],
  "worktop-manufacturer": ["manufacture", "sales"],
  "glass-manufacturer": ["manufacture", "sales"],
  "shed-manufacturer": ["manufacture", "sales"],
  "garden-room-manufacturer": ["manufacture", "sales"],
  "steel-fabricator": ["manufacture", "sales"],

  // ─── Sales additions ─────────────────────────────────────────────
  "timber-merchant": ["sales"],
  "plumbing-merchant": ["sales"],
  "electrical-wholesaler": ["sales"],
  "tile-shop": ["sales"],
  "flooring-shop": ["sales"],
  "door-showroom": ["sales"],
  "kitchen-showroom": ["sales"],
  "window-showroom": ["sales"],
  "bathroom-showroom": ["sales"],
  "paint-merchant": ["sales"],
  ironmongery: ["sales"],
  "ppe-supplier": ["sales"],
  "tool-shop": ["sales"],
  "landscape-supplies": ["sales"],
  "aggregate-supplier": ["sales"],
  "roofing-supplies": ["sales"],
  "insulation-supplies": ["sales"],

  // ─── Hire additions ──────────────────────────────────────────────
  "plant-hire": ["hire"],
  "skip-hire": ["hire"],
  "portaloo-hire": ["hire"],
  "scaffolding-hire": ["hire"],
  "generator-hire": ["hire"],
  "van-hire": ["hire"],
  "crane-hire": ["hire"],
  "waste-removal": ["hire"],
  "minidigger-hire": ["hire"],
  "storage-container-hire": ["hire"]
};

export function sectionsForTrade(slug: string): TemplateSection[] {
  return SECTIONS_BY_TRADE[slug] ?? ["service"];
}

export function tradesInSection(section: TemplateSection): string[] {
  return TRADE_OFF_TRADES.filter((t) => sectionsForTrade(t.slug).includes(section)).map(
    (t) => t.slug
  );
}

export const SECTION_ORDER: TemplateSection[] = [
  "service",
  "installation",
  "manufacture",
  "sales",
  "hire"
];
