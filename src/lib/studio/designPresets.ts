// Studio Design Presets — one-click restyle.
//
// Each preset is a NAMED delta over the merchant's brand tokens.
// Applying a preset writes each token pair to studio_brand_tokens via
// POST /api/studio/tokens; renderers pick up the new values on next
// paint because sections read `tokens["color.accent"]` etc. at render
// time.
//
// A preset MUST NOT touch merchant content — only appearance. Fonts,
// spacing, radius, colours, weights. If a preset needs behavioural
// changes (animations, glass effects), those live as their own token
// keys on the same object.
//
// Adding a preset:
//   1. Add an entry to DESIGN_PRESETS below.
//   2. Ensure every token key referenced already exists in tokens.ts
//      DEFAULT_TOKENS (renderers only read declared keys).
//   3. Preview thumbnail: a static gradient describing the mood.

import type { BrandTokens } from "./sectionTypes";

export type DesignPresetCategory =
  | "corporate"
  | "modern"
  | "luxury"
  | "trade"
  | "minimal"
  | "expressive";

export type DesignPreset = {
  id: string;
  name: string;
  category: DesignPresetCategory;
  /** One-sentence description shown in the picker. */
  pitch: string;
  /** Industries where this preset lands well. Powers filtering. */
  bestFor: string[];
  /** Static gradient thumbnail — same tokens the picker card renders. */
  thumbnail: {
    from: string;
    to: string;
    ink: string;
    accent: string;
  };
  /** Partial token bundle applied on top of the merchant's brand.
   *  Keys not listed here stay untouched. */
  tokens: Partial<BrandTokens>;
};

// ─── Curated seed set — 10 presets across the mood spectrum ─────

export const DESIGN_PRESETS: DesignPreset[] = [
  {
    id: "corporate-slate",
    name: "Corporate",
    category: "corporate",
    pitch:
      "Trusted, quiet, blue-suit dependable. Safe for B2B, finance, professional services.",
    bestFor: ["consulting", "accounting", "law", "finance", "b2b-saas"],
    thumbnail: { from: "#1E293B", to: "#334155", ink: "#F8FAFC", accent: "#0EA5E9" },
    tokens: {
      "color.primary": "#0F172A",
      "color.secondary": "#334155",
      "color.accent": "#0EA5E9",
      "color.surface": "#F8FAFC",
      "color.text": "#0F172A",
      "color.muted": "#64748B",
      "font.heading":
        "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      "font.body":
        "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      "font.heading.weight": 700,
      "font.body.weight": 400,
      "radius.md": 6,
      "radius.lg": 10,
      "radius.xl": 16
    }
  },
  {
    id: "modern-clean",
    name: "Modern",
    category: "modern",
    pitch:
      "Airy, geometric, product-tour clean. What most tech startups reach for.",
    bestFor: ["saas", "product", "agency", "portfolio", "app"],
    thumbnail: { from: "#F5F5F7", to: "#FFFFFF", ink: "#1D1D1F", accent: "#0071E3" },
    tokens: {
      "color.primary": "#1D1D1F",
      "color.accent": "#0071E3",
      "color.surface": "#FFFFFF",
      "color.text": "#1D1D1F",
      "color.muted": "#6E6E73",
      "font.heading":
        "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
      "font.body":
        "'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
      "font.heading.weight": 700,
      "font.body.weight": 400,
      "radius.md": 12,
      "radius.lg": 18,
      "radius.xl": 28
    }
  },
  {
    id: "luxury-serif",
    name: "Luxury",
    category: "luxury",
    pitch:
      "Editorial serifs, cream tones, generous whitespace. Boutiques and premium services.",
    bestFor: [
      "boutique-hotel",
      "high-end-kitchen",
      "interior-design",
      "salon",
      "wedding"
    ],
    thumbnail: { from: "#FBF7EF", to: "#F0E6D2", ink: "#1A1512", accent: "#C9A87C" },
    tokens: {
      "color.primary": "#1A1512",
      "color.accent": "#C9A87C",
      "color.surface": "#FBF7EF",
      "color.text": "#1A1512",
      "color.muted": "#7A6E60",
      "font.heading":
        "'Playfair Display', Georgia, 'Times New Roman', serif",
      "font.body":
        "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
      "font.heading.weight": 700,
      "font.body.weight": 400,
      "radius.md": 4,
      "radius.lg": 8,
      "radius.xl": 12
    }
  },
  {
    id: "construction-heavy",
    name: "Construction",
    category: "trade",
    pitch:
      "Hi-vis yellow on steel-grey. Built for construction, plant hire, trades.",
    bestFor: ["construction", "plant-hire", "scaffolding", "builder", "civil"],
    thumbnail: { from: "#1F1F1F", to: "#404040", ink: "#FFFFFF", accent: "#FFB300" },
    tokens: {
      "color.primary": "#0A0A0A",
      "color.secondary": "#404040",
      "color.accent": "#FFB300",
      "color.surface": "#FFFFFF",
      "color.text": "#0A0A0A",
      "color.muted": "#525252",
      "font.heading":
        "'Barlow Condensed', 'Bebas Neue', Impact, sans-serif",
      "font.body":
        "'Inter', system-ui, -apple-system, sans-serif",
      "font.heading.weight": 800,
      "font.body.weight": 500,
      "radius.md": 4,
      "radius.lg": 8,
      "radius.xl": 12
    }
  },
  {
    id: "tradesman-yellow",
    name: "Tradesman",
    category: "trade",
    pitch:
      "Van-vinyl yellow, black, print-ready. Local plumbers, sparks, boilermen.",
    bestFor: ["plumber", "electrician", "gas-engineer", "handyman", "roofer"],
    thumbnail: { from: "#FFB300", to: "#F59E0B", ink: "#0A0A0A", accent: "#0A0A0A" },
    tokens: {
      "color.primary": "#0A0A0A",
      "color.accent": "#F59E0B",
      "color.surface": "#FFF7ED",
      "color.text": "#0A0A0A",
      "color.muted": "#78350F",
      "font.heading":
        "'Oswald', 'Bebas Neue', Impact, sans-serif",
      "font.body":
        "'Inter', system-ui, -apple-system, sans-serif",
      "font.heading.weight": 700,
      "font.body.weight": 500,
      "radius.md": 6,
      "radius.lg": 10,
      "radius.xl": 16
    }
  },
  {
    id: "minimal-ink",
    name: "Minimal",
    category: "minimal",
    pitch:
      "Type-first, ink on paper, nothing decorative. Portfolios and thoughtful brands.",
    bestFor: ["portfolio", "writer", "photographer", "artisan"],
    thumbnail: { from: "#FFFFFF", to: "#F5F5F5", ink: "#0A0A0A", accent: "#0A0A0A" },
    tokens: {
      "color.primary": "#0A0A0A",
      "color.accent": "#0A0A0A",
      "color.surface": "#FFFFFF",
      "color.text": "#0A0A0A",
      "color.muted": "#525252",
      "font.heading":
        "'Söhne', 'Inter', -apple-system, sans-serif",
      "font.body":
        "'Söhne', 'Inter', -apple-system, sans-serif",
      "font.heading.weight": 500,
      "font.body.weight": 400,
      "radius.md": 0,
      "radius.lg": 0,
      "radius.xl": 0
    }
  },
  {
    id: "glass-vibrant",
    name: "Glass",
    category: "expressive",
    pitch:
      "Frosted panels, saturated gradients, Apple-Vision-Pro energy.",
    bestFor: ["app", "product", "creative-agency", "web3"],
    thumbnail: { from: "#7C3AED", to: "#06B6D4", ink: "#FFFFFF", accent: "#06B6D4" },
    tokens: {
      "color.primary": "#0F172A",
      "color.accent": "#06B6D4",
      "color.surface": "#0F172A",
      "color.text": "#F8FAFC",
      "color.muted": "#94A3B8",
      "font.heading":
        "'Inter', -apple-system, sans-serif",
      "font.body":
        "'Inter', -apple-system, sans-serif",
      "font.heading.weight": 700,
      "font.body.weight": 400,
      "radius.md": 16,
      "radius.lg": 24,
      "radius.xl": 32
    }
  },
  {
    id: "dark-onyx",
    name: "Dark",
    category: "modern",
    pitch:
      "Deep onyx, one hot accent, cinematic hero energy. Dev tools, gaming, film.",
    bestFor: ["dev-tool", "gaming", "film", "photographer"],
    thumbnail: { from: "#000000", to: "#171717", ink: "#FAFAFA", accent: "#F97316" },
    tokens: {
      "color.primary": "#000000",
      "color.accent": "#F97316",
      "color.surface": "#0A0A0A",
      "color.text": "#FAFAFA",
      "color.muted": "#A3A3A3",
      "font.heading":
        "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace",
      "font.body":
        "'Inter', -apple-system, sans-serif",
      "font.heading.weight": 700,
      "font.body.weight": 400,
      "radius.md": 6,
      "radius.lg": 10,
      "radius.xl": 14
    }
  },
  {
    id: "bold-shout",
    name: "Bold",
    category: "expressive",
    pitch:
      "Loud type, oversized headlines, unignorable. Streetwear, D2C, hype drops.",
    bestFor: ["streetwear", "d2c", "creator", "energy-drink"],
    thumbnail: { from: "#DC2626", to: "#F59E0B", ink: "#FFFFFF", accent: "#FFFFFF" },
    tokens: {
      "color.primary": "#0A0A0A",
      "color.accent": "#DC2626",
      "color.surface": "#FFFFFF",
      "color.text": "#0A0A0A",
      "color.muted": "#525252",
      "font.heading":
        "'Anton', 'Bebas Neue', Impact, sans-serif",
      "font.body":
        "'Inter', -apple-system, sans-serif",
      "font.heading.weight": 900,
      "font.body.weight": 500,
      "radius.md": 4,
      "radius.lg": 6,
      "radius.xl": 8
    }
  },
  {
    id: "elegant-plum",
    name: "Elegant",
    category: "luxury",
    pitch:
      "Deep plum, gold accents, quiet confidence. Legal, private wealth, high-end care.",
    bestFor: ["law-firm", "private-wealth", "medical-aesthetic", "salon"],
    thumbnail: { from: "#2A1834", to: "#4C1D6B", ink: "#F5EFE7", accent: "#D4AF37" },
    tokens: {
      "color.primary": "#2A1834",
      "color.accent": "#D4AF37",
      "color.surface": "#F5EFE7",
      "color.text": "#2A1834",
      "color.muted": "#6B5875",
      "font.heading":
        "'Cormorant Garamond', Georgia, serif",
      "font.body":
        "'Lora', Georgia, 'Times New Roman', serif",
      "font.heading.weight": 600,
      "font.body.weight": 400,
      "radius.md": 4,
      "radius.lg": 6,
      "radius.xl": 10
    }
  },
  {
    id: "industrial-steel",
    name: "Industrial",
    category: "trade",
    pitch:
      "Cool steel, safety orange, riveted-panel energy. Manufacturing, engineering.",
    bestFor: ["manufacturing", "engineering", "logistics", "warehouse"],
    thumbnail: { from: "#404040", to: "#171717", ink: "#F5F5F5", accent: "#F97316" },
    tokens: {
      "color.primary": "#171717",
      "color.secondary": "#404040",
      "color.accent": "#F97316",
      "color.surface": "#F5F5F5",
      "color.text": "#171717",
      "color.muted": "#525252",
      "font.heading":
        "'Rajdhani', 'Barlow Condensed', Impact, sans-serif",
      "font.body":
        "'Inter', -apple-system, sans-serif",
      "font.heading.weight": 700,
      "font.body.weight": 500,
      "radius.md": 2,
      "radius.lg": 4,
      "radius.xl": 8
    }
  }
];

/** Turn a preset's `Partial<BrandTokens>` into the array shape the
 *  tokens API expects. Splits `"color.accent"` → `{ kind: "color",
 *  key: "accent", value }`. */
export function presetToApiPayload(
  preset: DesignPreset
): { kind: string; key: string; value: unknown }[] {
  const out: { kind: string; key: string; value: unknown }[] = [];
  for (const [tokenKey, value] of Object.entries(preset.tokens)) {
    const dot = tokenKey.indexOf(".");
    if (dot < 0) continue;
    const kind = tokenKey.slice(0, dot);
    const key = tokenKey.slice(dot + 1);
    out.push({ kind, key, value });
  }
  return out;
}
