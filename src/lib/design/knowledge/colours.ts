// Colour intelligence — the trade colour psychology + van colour
// guide + logo-on-van lookup + colour combos, all from Philip's
// canonical guide (batch 2: Master Colour System for UK Vans + Premium
// Styles by Trade table).

// ─── Named colours (semantic ↔ hex) ─────────────────────────────

export const COLOUR_HEX: Record<string, string> = {
  "white":          "#F5F5F5",
  "black":          "#0A0A0A",
  "anthracite":     "#2A2A2A",
  "charcoal":       "#3B3B3B",
  "silver":         "#B8B8B8",
  "grey":           "#5A5A5A",
  "slate-grey":     "#4A5568",
  "gold":           "#D4AF37",
  "brushed-gold":   "#B8894A",
  "copper":         "#B87333",
  "oak":            "#8B7355",
  "cream":          "#F5E6C8",
  "navy":           "#1E293B",
  "dark-blue":      "#1E40AF",
  "forest-green":   "#166534",
  "red":            "#B91C1C",
  "amber":          "#F59E0B",
  "orange":         "#EA580C",
  "yellow":         "#FFB300",
  "safety-yellow":  "#EAB308",
  "green":          "#22C55E"
};

// ─── Van paint colours (from batch 2 Master Colour System) ──────

export type VanColourGuide = {
  slug:        string;
  label:       string;
  hex:         string;
  rating:      1 | 2 | 3 | 4 | 5;
  bestPairings:  string[];    // colour names that read premium against this van
  avoid:         string[];    // colour names that read cheap
  fitsTrades:    string[];    // trade slugs this van colour suits
  aiHint:        string;      // how to describe it in a prompt
};

export const VAN_COLOUR_GUIDE: VanColourGuide[] = [
  { slug: "white", label: "White", hex: "#F5F5F5", rating: 5,
    bestPairings: ["black","gold","navy","silver","forest-green","copper","charcoal","oak","slate-grey","orange","dark-blue"],
    avoid: ["red","yellow","green","purple"],
    fitsTrades: ["joinery","staircases","kitchen-fitter","bathroom-fitter","plumbing","electrical","roofing","bricklayers","windows","landscaping","scaffolding","plastering"],
    aiHint: "clean white van, dark text works best; premium palette runs black + one metallic accent"
  },
  { slug: "black", label: "Black", hex: "#0A0A0A", rating: 5,
    bestPairings: ["white","gold","silver","copper","satin-grey"],
    avoid: ["black","dark-blue","dark-grey"],
    fitsTrades: ["joinery","kitchen-fitter","luxury-interior","bespoke-joinery"],
    aiHint: "black van, luxury AMG energy, use white or brand yellow with restraint"
  },
  { slug: "grey", label: "Grey", hex: "#5A5A5A", rating: 5,
    bestPairings: ["black","white","orange","copper","gold","lime","navy"],
    avoid: [],
    fitsTrades: ["roofing","industrial","groundworks","plant-hire","scaffolding"],
    aiHint: "mid-grey van, industrial-professional feel, high-contrast text"
  },
  { slug: "silver", label: "Silver", hex: "#B8B8B8", rating: 4,
    bestPairings: ["black","dark-blue","charcoal","gold","forest-green"],
    avoid: ["yellow","light-grey","white"],
    fitsTrades: ["electrical","windows","bathroom-fitter"],
    aiHint: "silver metallic van, clean corporate feel, dark bold text"
  },
  { slug: "dark-blue", label: "Dark Blue", hex: "#1E40AF", rating: 5,
    bestPairings: ["white","silver","gold","light-grey"],
    avoid: ["black","navy","dark-grey"],
    fitsTrades: ["plumbing","scaffolding","commercial"],
    aiHint: "deep blue van, corporate reliable feel, white or yellow lettering, avoid navy-on-blue"
  },
  { slug: "red", label: "Red", hex: "#B91C1C", rating: 3,
    bestPairings: ["white","black","silver"],
    avoid: ["orange","blue","purple","green"],
    fitsTrades: ["emergency","electrical","recovery"],
    aiHint: "red van, use white/black only, very restrained lettering"
  },
  { slug: "green", label: "Green", hex: "#166534", rating: 4,
    bestPairings: ["white","black","gold","cream"],
    avoid: ["bright-green"],
    fitsTrades: ["landscaping","tree-surgery","groundworks","agricultural"],
    aiHint: "dark green van, natural outdoor feel, white or gold lettering"
  },
  { slug: "yellow", label: "Yellow", hex: "#EAB308", rating: 3,
    bestPairings: ["black","dark-grey","white"],
    avoid: ["orange","gold","brown"],
    fitsTrades: ["plant-hire","utilities","highways","construction"],
    aiHint: "yellow safety van, black lettering only, restrained design"
  },
  { slug: "orange", label: "Orange", hex: "#EA580C", rating: 4,
    bestPairings: ["charcoal","white","black"],
    avoid: [],
    fitsTrades: ["plant-hire","utilities","highways","demolition"],
    aiHint: "safety orange van, high-visibility, black lettering"
  }
];

export function vanColour(slug: string): VanColourGuide | undefined {
  return VAN_COLOUR_GUIDE.find((v) => v.slug === slug);
}

// ─── Premium Styles by Trade (from batch 2 table) ───────────────

export type TradePalette = {
  trade:      string;
  bestVan:    string;                 // van colour slug
  colours:    string[];               // ordered: primary, secondary, accent
  style:      string;                 // e.g. "Luxury residential"
};

export const TRADE_PALETTES: TradePalette[] = [
  { trade: "joinery",         bestVan: "white",  colours: ["black","oak","gold"],       style: "Luxury residential" },
  { trade: "staircases",      bestVan: "white",  colours: ["anthracite","gold","white"], style: "Architectural" },
  { trade: "plumbing",        bestVan: "white",  colours: ["navy","white","silver"],    style: "Clean, reliable" },
  { trade: "electrical",      bestVan: "white",  colours: ["black","yellow","white"],   style: "Technical" },
  { trade: "roofing",         bestVan: "grey",   colours: ["charcoal","orange","white"], style: "Industrial" },
  { trade: "bricklayers",     bestVan: "white",  colours: ["copper","charcoal","white"], style: "Traditional craftsmanship" },
  { trade: "kitchen-fitter",  bestVan: "white",  colours: ["black","oak","white"],      style: "High-end interiors" },
  { trade: "bathroom-fitter", bestVan: "white",  colours: ["slate-grey","silver","white"], style: "Contemporary" },
  { trade: "scaffolding",     bestVan: "white",  colours: ["dark-blue","grey","white"], style: "Corporate" },
  { trade: "plant-hire",      bestVan: "yellow", colours: ["black","white","yellow"],   style: "Industrial" },
  { trade: "landscaping",     bestVan: "white",  colours: ["forest-green","gold","white"], style: "Premium outdoor living" },
  { trade: "windows",         bestVan: "white",  colours: ["navy","silver","white"],    style: "Modern home improvement" },
  { trade: "painter",         bestVan: "white",  colours: ["navy","white","dark-blue"], style: "Clean domestic" },
  { trade: "plastering",      bestVan: "white",  colours: ["grey","white","black"],     style: "Contemporary trade" },
  { trade: "loft-conversion", bestVan: "white",  colours: ["oak","charcoal","white"],   style: "Home improvement premium" }
];

export function tradePalette(slug: string): TradePalette | undefined {
  return TRADE_PALETTES.find((p) => p.trade === slug);
}

// ─── Logo Colours by Van Colour (batch 2 table) ─────────────────

export const LOGO_COLOUR_BY_VAN: Record<string, string[]> = {
  "white":  ["black","gold"],
  "black":  ["white","gold"],
  "grey":   ["black","copper"],
  "silver": ["black","dark-blue"],
  "navy":   ["white","silver"],
  "red":    ["white"],
  "green":  ["white","gold"],
  "yellow": ["black"]
};

// ─── Colour Rules ───────────────────────────────────────────────

/** Max colours per design (Rule of Three from batch 2). */
export const MAX_COLOURS_PER_DESIGN = 3;

/** 80/15/5 body/graphics/accent split for van wraps. */
export const VAN_COLOUR_SPLIT = { body_pct: 75, graphics_pct: 20, accent_pct: 5 };
