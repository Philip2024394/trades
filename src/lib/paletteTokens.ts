// Palette tokens — construction-native colour packs merchants can pick
// from on the mobile app templates picker. One layout, N palettes; this
// file is the single source of truth for the seed colours.
//
// A palette contains 6 tokens: page background (hero bg), primary text,
// accent (CTA / highlight), muted secondary text, heroLastWord (the
// coloured last-word in the H1 headline — a signature layout detail),
// and a chip swatch shown on the picker.
//
// Naming: trades-native material words (Chalk, Oak, Moss, Slate,
// Mortar, Iron, Hi-Vis, Brick, Timber, Steel, Copper, Concrete, Ink,
// Blush, Charcoal, Aqua, Marine, Sandstone, Emerald, Storm). Every
// palette is REF'd in docs/trade-palette-catalog.md (TP-XX) — no hex
// change without a REF and Philip's confirm.
//
// 20-palette set locked in 2026-07-15 (Phase 1 of the trade-palette
// catalog rollout). Perceptually distinct — no two look alike. Enough
// choice for App-Store abundance ("Shopify has 100+, we start with
// 20"), few enough to remain maintainable. Rejected: Forest (Moss
// covers), Neon (Iron covers), Vintage (Timber+Brick cover), Ochre
// (Brick covers), Field (Hi-Vis+Oak cover).
//
// This file is safe to import from client OR server components. The
// server-side loader `loadMerchantPalette` lives in `paletteTokens.server.ts`
// (Supabase admin is server-only and would otherwise be dragged into
// the client bundle by React components that need PaletteTokens type).

export type PaletteSlug =
  // — Current 9 (shipped through 2026-07-14) —
  | "chalk"
  | "iron"
  | "timber"
  | "oak"
  | "moss"
  | "slate"
  | "mortar"
  | "hi-vis"
  | "brick"
  // — Phase 1 expansion 2026-07-15 (11 new palettes) —
  | "steel"
  | "copper"
  | "concrete"
  | "ink"
  | "blush"
  | "charcoal"
  | "aqua"
  | "marine"
  | "sandstone"
  | "emerald"
  | "storm";

export type PaletteTokens = {
  slug:         PaletteSlug;
  displayName:  string;
  bg:           string;   // page / hero background
  text:         string;   // primary text
  accent:       string;   // CTA / highlight color
  mutedText:    string;   // secondary / meta text
  heroLastWord: string;   // colour applied to the last word in the H1
  /** Colour swatch shown on the picker chip. Usually === accent (so
   *  the swatch reads as "the button colour on this palette"). */
  chip:         string;
  /** Dark-mode flag — components can invert small elements
   *  (e.g. surface tints) that don't otherwise flip cleanly. */
  dark:         boolean;
};

export const PALETTES: Record<PaletteSlug, PaletteTokens> = {
  // ─── LIGHT WARM ────────────────────────────────────────────────
  chalk: {
    slug: "chalk",
    displayName: "Chalk",
    bg:           "#FBF6EC",
    text:         "#1B1A17",
    accent:       "#B8860B",
    mutedText:    "#525252",
    heroLastWord: "#B8860B",
    chip:         "#B8860B",
    dark:         false
  },
  oak: {
    slug: "oak",
    displayName: "Oak",
    bg:           "#F5EDDF",
    text:         "#3D2914",
    accent:       "#8B5A2B",
    mutedText:    "#6B4423",
    heroLastWord: "#8B5A2B",
    chip:         "#8B5A2B",
    dark:         false
  },
  blush: {
    // Boutique / feminine-warm. Interior designers, curtains, wallpaper,
    // home stagers, soft furnishings. Distinct from Chalk (Chalk is
    // gold+cream; Blush is terracotta+soft-pink — more "showroom").
    slug: "blush",
    displayName: "Blush",
    bg:           "#FDF2F0",
    text:         "#451A03",
    accent:       "#C2564E",
    mutedText:    "#78716C",
    heroLastWord: "#C2564E",
    chip:         "#C2564E",
    dark:         false
  },
  sandstone: {
    // Heritage / restoration / lime plaster / listed buildings. Warmer
    // and more earthen than Chalk; more textural than Oak.
    slug: "sandstone",
    displayName: "Sandstone",
    bg:           "#F5E9D3",
    text:         "#3D2914",
    accent:       "#A0522D",
    mutedText:    "#78716C",
    heroLastWord: "#A0522D",
    chip:         "#A0522D",
    dark:         false
  },
  brick: {
    slug: "brick",
    displayName: "Brick",
    bg:           "#FBEEE6",
    text:         "#3D1E14",
    accent:       "#B7451D",
    mutedText:    "#8B4513",
    heroLastWord: "#B7451D",
    chip:         "#B7451D",
    dark:         false
  },
  copper: {
    // Artisan metalwork / coppersmiths / lead workers / heritage
    // roofers. Patina-ivory bg with copper accent.
    slug: "copper",
    displayName: "Copper",
    bg:           "#F5EFE6",
    text:         "#3D2914",
    accent:       "#B87333",
    mutedText:    "#78716C",
    heroLastWord: "#B87333",
    chip:         "#B87333",
    dark:         false
  },

  // ─── LIGHT COOL ────────────────────────────────────────────────
  slate: {
    slug: "slate",
    displayName: "Slate",
    bg:           "#EEF2F7",
    text:         "#0F172A",
    accent:       "#1E3A8A",
    mutedText:    "#475569",
    heroLastWord: "#1E3A8A",
    chip:         "#1E3A8A",
    dark:         false
  },
  aqua: {
    // Pool builders / hot-tub / spa fitters. Fresh water-leisure vibe;
    // distinct from Slate (Slate = deep-water precision; Aqua = light
    // leisure freshness).
    slug: "aqua",
    displayName: "Aqua",
    bg:           "#ECFEFF",
    text:         "#164E63",
    accent:       "#0891B2",
    mutedText:    "#64748B",
    heroLastWord: "#0891B2",
    chip:         "#0891B2",
    dark:         false
  },
  moss: {
    slug: "moss",
    displayName: "Moss",
    bg:           "#F2F5EA",
    text:         "#1F2A17",
    accent:       "#4A5D23",
    mutedText:    "#5C6B45",
    heroLastWord: "#4A5D23",
    chip:         "#4A5D23",
    dark:         false
  },
  emerald: {
    // Luxury landscapers / high-end garden designers / orangery.
    // Prestige outdoors vs Moss's utility outdoors.
    // Accent bumped 2026-07-15 from dark-teal `#065F46` (matte, cold)
    // to modern bright emerald `#059669` per Philip's ask: "modern
    // green more bright color not mat". Sits deliberately deeper than
    // reserved `#10B981` (BRAND_GREEN, in-stock indicator only per
    // feedback_dark_green_only.md) so merchant CTAs and stock chips
    // stay distinct. Text stays dark forest for AA contrast on the
    // mint bg.
    slug: "emerald",
    displayName: "Emerald",
    bg:           "#F0FDF4",
    text:         "#14532D",
    accent:       "#059669",
    mutedText:    "#6B7280",
    heroLastWord: "#059669",
    chip:         "#059669",
    dark:         false
  },
  steel: {
    // Welders / structural steel / metal fabricators. Cool silver bg,
    // electric-blue CTA — reads as precision metalwork. Distinct from
    // Iron (Iron = dark technical; Steel = light metalwork).
    slug: "steel",
    displayName: "Steel",
    bg:           "#EEF2F5",
    text:         "#0F172A",
    accent:       "#0284C7",
    mutedText:    "#64748B",
    heroLastWord: "#0284C7",
    chip:         "#0284C7",
    dark:         false
  },

  // ─── LIGHT NEUTRAL ─────────────────────────────────────────────
  ink: {
    // Architects / structural engineers / minimalist showrooms. Pure
    // paper-and-ink corporate palette. Distinct from Mortar (Mortar
    // is warm-grey stone; Ink is achromatic paper).
    slug: "ink",
    displayName: "Ink",
    bg:           "#FAFAFA",
    text:         "#0A0A0A",
    accent:       "#0A0A0A",
    mutedText:    "#525252",
    heroLastWord: "#0A0A0A",
    chip:         "#0A0A0A",
    dark:         false
  },
  concrete: {
    // Concrete specialists / formwork / resin flooring / modern
    // brutalist. Industrial grey with safety-orange CTA.
    slug: "concrete",
    displayName: "Concrete",
    bg:           "#E8E8E5",
    text:         "#0F172A",
    accent:       "#F97316",
    mutedText:    "#737373",
    heroLastWord: "#F97316",
    chip:         "#F97316",
    dark:         false
  },
  mortar: {
    // Palette #14 — repurposed 2026-07-15 per Philip from "Mortar"
    // (grey stone) to "Poppy" (bold modern red). Slug kept as
    // "mortar" for backward compat (permanent URL identifier) while
    // displayName + hex values flip to a bright red for trades that
    // want to stand out (signwriters, emergency callouts, brand-bold
    // merchants). Trade catalog assignments (bricklayer, plasterer)
    // may need reshuffling — flagged separately.
    slug: "mortar",
    displayName: "Poppy",
    bg:           "#FEF2F2",
    text:         "#450A0A",
    accent:       "#DC2626",
    mutedText:    "#7F1D1D",
    heroLastWord: "#DC2626",
    chip:         "#DC2626",
    dark:         false
  },

  // ─── DARK ──────────────────────────────────────────────────────
  iron: {
    slug: "iron",
    displayName: "Iron",
    bg:           "#0F0F0F",
    text:         "#F5F5F5",
    accent:       "#FFB300",
    mutedText:    "#B8B8B8",
    heroLastWord: "#FFB300",
    chip:         "#FFB300",
    dark:         true
  },
  charcoal: {
    // Prestige builders / luxury renovations / showroom trades.
    // Industrial-luxe — Iron's confidence but with warm copper CTA
    // instead of amber safety.
    slug: "charcoal",
    displayName: "Charcoal",
    bg:           "#1F1F1F",
    text:         "#F5F5F5",
    accent:       "#D97706",
    mutedText:    "#A3A3A3",
    heroLastWord: "#D97706",
    chip:         "#D97706",
    dark:         true
  },
  timber: {
    // Timber — warm sibling of Iron. Locked in 2026-07-15 per
    // Philip's "keep this brown as another theme" ask. Fine joiners,
    // bespoke furniture makers, high-end carpenters.
    slug: "timber",
    displayName: "Timber",
    bg:           "#1F1410",
    text:         "#F5F0EB",
    accent:       "#B8722E",
    mutedText:    "#C7B8A8",
    heroLastWord: "#B8722E",
    chip:         "#B8722E",
    dark:         true
  },
  marine: {
    // Marina / dock / boat carpentry / marine electricians. Deep-sea
    // navy bg with brass CTA — classic yacht/marine palette.
    slug: "marine",
    displayName: "Marine",
    bg:           "#0F1F3D",
    text:         "#F0F9FF",
    accent:       "#FBBF24",
    mutedText:    "#94A3B8",
    heroLastWord: "#FBBF24",
    chip:         "#FBBF24",
    dark:         true
  },
  storm: {
    // Storm damage repair / roofing repair / emergency responders.
    // Weather-hardened stormy navy with amber-warning CTA.
    slug: "storm",
    displayName: "Storm",
    bg:           "#1E293B",
    text:         "#F1F5F9",
    accent:       "#F59E0B",
    mutedText:    "#94A3B8",
    heroLastWord: "#F59E0B",
    chip:         "#F59E0B",
    dark:         true
  },

  // ─── SIGNAL / ACCENT ───────────────────────────────────────────
  "hi-vis": {
    slug: "hi-vis",
    displayName: "Hi-Vis",
    bg:           "#FEF3C7",
    text:         "#171717",
    accent:       "#F59E0B",
    mutedText:    "#78716C",
    heroLastWord: "#B45309",
    chip:         "#F59E0B",
    dark:         false
  }
};

/** Palettes tappable in the picker + accepted by the apply-palette
 *  API. All 20 are ready as of 2026-07-15 Phase 4 ship — the picker
 *  lets merchants live-preview + install any palette on THEIR OWN
 *  canteen (via `?preview_palette=<slug>` override), so per-palette
 *  demo canteens are decorative, not blockers. Phase 3 (demo canteens
 *  for the 15 palettes without dedicated demos) is a nice-to-have
 *  that runs in parallel. */
export const READY_PALETTES: PaletteSlug[] = [
  "chalk", "oak", "blush", "sandstone", "brick", "copper",
  "slate", "aqua", "moss", "emerald", "steel",
  "ink", "concrete", "mortar",
  "iron", "charcoal", "timber", "marine", "storm",
  "hi-vis"
];

/** Ordered list for rendering the chip row on the picker card.
 *  Ordered by mood spectrum (light warm → light cool → light neutral
 *  → dark → signal) so adjacent palettes feel related and the picker
 *  reads as a curated colour wheel, not a random grid. Order matches
 *  the PALETTES declaration order above. */
export const PALETTE_ORDER: PaletteSlug[] = [
  // Light warm
  "chalk", "oak", "blush", "sandstone", "brick", "copper",
  // Light cool
  "slate", "aqua", "moss", "emerald", "steel",
  // Light neutral
  "ink", "concrete", "mortar",
  // Dark
  "iron", "charcoal", "timber", "marine", "storm",
  // Signal
  "hi-vis"
];

export const DEFAULT_PALETTE: PaletteTokens = PALETTES.chalk;

export function getPaletteTokens(slug: string | null | undefined): PaletteTokens {
  if (!slug) return DEFAULT_PALETTE;
  return PALETTES[slug as PaletteSlug] ?? DEFAULT_PALETTE;
}

// ─── Intensity adjustment ────────────────────────────────────
//
// Apply the merchant's chosen intensity (bold | standard | subtle)
// to a palette's accent-family colours. Standard = passthrough. Bold
// pushes saturation up ~15% so accents pop harder. Subtle mixes
// each accent toward mid-grey by ~40% so the identity softens.
//
// Only `accent`, `heroLastWord`, and `chip` are adjusted — bg + text
// are left alone (adjusting them would break contrast + readability).

export type PaletteIntensity = "bold" | "standard" | "subtle";

/** Parse a #RRGGBB hex into [r,g,b] 0-255. Returns [0,0,0] on
 *  invalid input (defensive; never throws so palette rendering
 *  never fails silently). */
function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Convert [r,g,b] 0-255 back to a #RRGGBB hex string. */
function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const h = (v: number) => clamp(v).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Convert RGB → HSL. Used for saturation adjustment. */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case R: h = ((G - B) / d + (G < B ? 6 : 0)); break;
      case G: h = ((B - R) / d + 2);               break;
      case B: h = ((R - G) / d + 4);               break;
    }
    h *= 60;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const conv = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [Math.round(conv(h + 1 / 3) * 255), Math.round(conv(h) * 255), Math.round(conv(h - 1 / 3) * 255)];
}

/** Multiply the saturation of a hex colour. `mult > 1` boosts,
 *  `< 1` desaturates. Clamped to [0, 1]. */
function adjustSaturation(hex: string, mult: number): string {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const [nr, ng, nb] = hslToRgb(h, Math.max(0, Math.min(1, s * mult)), l);
  return rgbToHex(nr, ng, nb);
}

/** Apply the merchant's intensity choice to a palette's accent
 *  colours. Non-accent fields (bg, text, mutedText) pass through
 *  unchanged. */
export function applyIntensity(
  palette: PaletteTokens,
  intensity: PaletteIntensity | undefined
): PaletteTokens {
  if (!intensity || intensity === "standard") return palette;
  const mult = intensity === "bold" ? 1.15 : 0.55;
  return {
    ...palette,
    accent:       adjustSaturation(palette.accent, mult),
    heroLastWord: adjustSaturation(palette.heroLastWord, mult),
    chip:         adjustSaturation(palette.chip, mult)
  };
}
