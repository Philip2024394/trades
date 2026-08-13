// Nex Themes · Built-in registry · Philip 2026-08-03.
//
// The AUTHORITATIVE source for built-in themes. Every built-in theme
// is defined once here in the canonical v2 shape (types.ts) and is
// consumed by:
//
//   · The client (chat/page.tsx) via GET /api/nex/themes
//   · The intent router (general-chat/route.ts) when detecting theme swaps
//   · The validator (validator.ts) at apply-time
//   · The server-repo (server-repo.ts) as the resolvable-id set
//
// AI-generated · business · and community themes will live in the
// `nex_themes_generated` / `nex_themes_business` / `nex_themes_community`
// tables when those slices ship. Built-ins never move — they are code
// artefacts versioned in git.
//
// IMMUTABILITY: Original Nex is `category: "immutable"` and cannot be
// deactivated, deleted, or overridden. Every reset returns to it. Every
// failed validation falls back to it. It is the workspace's home.

import type {
  Theme,
  ThemeAnimations,
  ThemeDesignLanguage,
  ThemeEffects,
  ThemeFonts,
  ThemeTokens,
  WallpaperConfig,
} from "./types";

// ─── Original Nex · immutable home ───────────────────────────────────

const ORIGINAL_NEX_TOKENS: ThemeTokens = {
  colors: {
    bg: "#FAFAF7",
    surface: "#FFFFFF",
    card: "#FFFFFF",
    primary: "#F97316",
    primaryHover: "#EA580C",
    secondary: "#FFF7ED",
    border: "rgba(0,0,0,0.06)",
    text: "#0A0A0A",
    muted: "rgba(0,0,0,0.6)",
    userBubble: "#F97316",
    nexBubble: "#FFFFFF",
    composer: "#FFFFFF",
    footer: "#FFFFFF",
  },
  radii: {
    card: "24px",
    button: "20px",
    input: "18px",
    bubble: "20px",
    nav: "20px",
  },
  shadows: {
    soft: "0 2px 6px rgba(0,0,0,0.04)",
    glow: "0 8px 24px rgba(0,0,0,0.06)",
    send: "0 6px 16px rgba(249,115,22,0.22)",
  },
};

const ORIGINAL_NEX_ANIMATIONS: ThemeAnimations = {
  loadingIndicator: "none",
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  transitionMs: 240,
};

const ORIGINAL_NEX_FONTS: ThemeFonts = {
  weights: [400, 500, 600, 700],
};

const ORIGINAL_NEX_EFFECTS: ThemeEffects = {
  headerBlurPx: 8,
  composerBlurPx: 0,
  navBlurPx: 0,
  bubbleBlurPx: 0,
  glass: "none",
};

const ORIGINAL_NEX_DESIGN_LANGUAGE: ThemeDesignLanguage = {
  mood: "Calm Confident",
  architecture: "Clean modern chat",
  lighting: "Daylight neutral",
  paletteNames: ["Warm Cream", "Nex Orange", "Ink Black"],
  glassStyle: "none",
  bubbleStyle: "rounded-soft",
  inputStyle: "anchored-bar",
  headerStyle: "bordered",
  iconStyle: "filled-soft",
  animation: "gentle-fade",
};

export const ORIGINAL_NEX: Theme = {
  id: "original_nex",
  displayName: "Original Nex",
  category: "immutable",
  source: "built-in",
  version: 1,

  wallpaper: null, // no wallpaper — Original Nex is the pure home

  tokens: ORIGINAL_NEX_TOKENS,
  animations: ORIGINAL_NEX_ANIMATIONS,
  fonts: ORIGINAL_NEX_FONTS,
  effects: ORIGINAL_NEX_EFFECTS,

  capabilities: {
    editable: false,          // immutable
    aiGenerated: false,
    supportsModification: false, // "less orange" doesn't apply to the home
    supportsPreview: false,   // free by default · never previewable
  },
  designLanguage: ORIGINAL_NEX_DESIGN_LANGUAGE,
};

// ─── Blossom ─────────────────────────────────────────────────────────

const BLOSSOM_WALLPAPER: WallpaperConfig = {
  url: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%203,%202026,%2002_30_36%20AM.png",
  focalElement: {
    label: "Petals in the corners",
    position: "corners",
  },
  safeZone: { top: 20, bottom: 20, left: 15, right: 15 },
  overlay:
    "linear-gradient(180deg, rgba(255,245,248,0.82) 0%, rgba(255,245,248,0.94) 100%)",
};

const BLOSSOM_TOKENS: ThemeTokens = {
  colors: {
    bg: "#FFF5F8",
    surface: "#FFFDFE",
    card: "#FFFFFF",
    primary: "#EC4899",
    primaryHover: "#DB2777",
    secondary: "#FCE7F3",
    border: "#F4C8DB",
    text: "#4B3142",
    muted: "#7E5A6F",
    userBubble: "#F9C5D8",
    nexBubble: "#FFFFFF",
    composer: "#FFFFFF",
    footer: "#FFF7FA",
  },
  radii: {
    card: "28px",
    button: "22px",
    input: "18px",
    bubble: "24px",
    nav: "22px",
  },
  shadows: {
    soft: "0 2px 10px rgba(236, 72, 153, 0.10)",
    glow: "0 8px 28px rgba(236, 72, 153, 0.16)",
    send: "0 8px 24px rgba(236, 72, 153, 0.20)",
  },
};

const BLOSSOM_ANIMATIONS: ThemeAnimations = {
  loadingIndicator: "blossom-petals",
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  transitionMs: 300,
};

const BLOSSOM_FONTS: ThemeFonts = {
  heading: '"Fredoka", var(--nex-font-body), system-ui, sans-serif',
  body: '"Nunito", system-ui, -apple-system, sans-serif',
  weights: [400, 500, 600, 700],
};

const BLOSSOM_EFFECTS: ThemeEffects = {
  headerBlurPx: 12,
  composerBlurPx: 0,
  navBlurPx: 0,
  bubbleBlurPx: 0,
  glass: "none",
};

const BLOSSOM_DESIGN_LANGUAGE: ThemeDesignLanguage = {
  mood: "Soft Playful",
  architecture: "Cherry blossom garden",
  lighting: "Spring afternoon",
  paletteNames: ["Blush Pink", "Cherry Rose", "Cream White"],
  glassStyle: "none",
  bubbleStyle: "rounded-soft",
  inputStyle: "floating-pill",
  headerStyle: "solid-tint",
  iconStyle: "filled-soft",
  animation: "gentle-fade",
};

export const BLOSSOM: Theme = {
  id: "blossom",
  displayName: "Blossom",
  category: "soft",
  source: "built-in",
  version: 1,

  wallpaper: BLOSSOM_WALLPAPER,
  tokens: BLOSSOM_TOKENS,
  animations: BLOSSOM_ANIMATIONS,
  fonts: BLOSSOM_FONTS,
  effects: BLOSSOM_EFFECTS,

  capabilities: {
    editable: true,
    aiGenerated: false,
    supportsModification: true,
    supportsPreview: true,
  },
  designLanguage: BLOSSOM_DESIGN_LANGUAGE,
};

// ─── Staircase Light Cream ───────────────────────────────────────────

const STAIRCASE_LIGHT_CREAM_WALLPAPER: WallpaperConfig = {
  url: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%203,%202026,%2002_59_01%20AM.png",
  focalElement: {
    label: "Staircase in the lower-right",
    position: "bottom-right",
  },
  safeZone: { top: 30, bottom: 15, left: 20, right: 20 },
  // Grand Entrance overlay · Philip 2026-08-03 spec. Softer top-to-bottom
  // veil so the staircase and centre both breathe through the glass UI.
  // Bubbles carry their own 80% frosted backgrounds, so text legibility
  // is decoupled from wallpaper density.
  overlay:
    "linear-gradient(180deg, rgba(245, 239, 230, 0.35) 0%, rgba(245, 239, 230, 0.45) 50%, rgba(245, 239, 230, 0.55) 100%)",
};

const STAIRCASE_LIGHT_CREAM_TOKENS: ThemeTokens = {
  colors: {
    bg: "#F5EFE6",
    surface: "rgba(255, 255, 255, 0.78)",
    card: "rgba(255, 255, 255, 0.82)",
    primary: "#B78352",           // Grand Entrance · Warm Bronze
    primaryHover: "#9A6A42",      // gradient bottom stop doubles as hover
    secondary: "#E8DFD3",         // Frosted Ivory · surface tint
    secondaryAccent: "#D6B58A",   // Champagne Gold · used for hairline accents
    border: "rgba(255, 255, 255, 0.35)",
    text: "#222222",              // Charcoal
    muted: "#7B7B7B",             // Warm Grey
    userBubble: "linear-gradient(180deg, #C99662 0%, #9A6A42 100%)",
    nexBubble: "rgba(255, 255, 255, 0.80)",
    composer: "rgba(255, 255, 255, 0.78)",
    footer: "rgba(255, 255, 255, 0.65)",
  },
  radii: {
    card: "28px",
    button: "26px",
    input: "32px",
    bubble: "26px",
    nav: "30px",
  },
  shadows: {
    soft: "0 2px 10px rgba(90, 60, 30, 0.08)",
    glow: "0 6px 18px rgba(90, 60, 30, 0.12)",
    send: "0 8px 25px rgba(120, 70, 30, 0.22)",
  },
};

const STAIRCASE_LIGHT_CREAM_ANIMATIONS: ThemeAnimations = {
  loadingIndicator: "workshop-glow",
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  transitionMs: 320,
};

const STAIRCASE_LIGHT_CREAM_FONTS: ThemeFonts = {
  weights: [400, 500, 600, 700],
};

const STAIRCASE_LIGHT_CREAM_EFFECTS: ThemeEffects = {
  headerBlurPx: 20,
  composerBlurPx: 30,
  navBlurPx: 24,
  bubbleBlurPx: 14,
  glass: "frosted",
};

const STAIRCASE_LIGHT_CREAM_DESIGN_LANGUAGE: ThemeDesignLanguage = {
  mood: "Grand Entrance",
  architecture: "£5m modern home",
  lighting: "Golden hour",
  paletteNames: ["Frosted Ivory", "Warm Bronze", "Champagne Gold", "Charcoal Ink"],
  glassStyle: "frosted",
  bubbleStyle: "rounded-pill",
  inputStyle: "floating-pill",
  headerStyle: "glass-blur",
  iconStyle: "filled-soft",
  animation: "gentle-fade",
};

export const STAIRCASE_LIGHT_CREAM: Theme = {
  id: "staircase_light_cream",
  displayName: "Grand Entrance",
  category: "luxury",
  source: "built-in",
  version: 1,

  wallpaper: STAIRCASE_LIGHT_CREAM_WALLPAPER,
  tokens: STAIRCASE_LIGHT_CREAM_TOKENS,
  animations: STAIRCASE_LIGHT_CREAM_ANIMATIONS,
  fonts: STAIRCASE_LIGHT_CREAM_FONTS,
  effects: STAIRCASE_LIGHT_CREAM_EFFECTS,

  capabilities: {
    editable: true,
    aiGenerated: false,
    supportsModification: true,
    supportsPreview: true,
  },
  designLanguage: STAIRCASE_LIGHT_CREAM_DESIGN_LANGUAGE,
};

// ─── Walnut Sanctum · first DARK theme · Philip 2026-08-03 ───────────
//
// Old-money library energy · deep walnut wood panelling with vertical
// grain · warm amber sconce top-right · cream carpeted treads · brass-
// tipped iron balusters. INVERTED from the light themes: cream text on
// dark walnut glass, not the reverse.

const STAIRCASE_WALNUT_WALLPAPER: WallpaperConfig = {
  url: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%203,%202026,%2004_30_26%20AM.png",
  focalElement: {
    label: "Staircase + sconce in the lower-right / right",
    position: "bottom-right",
  },
  safeZone: { top: 25, bottom: 20, left: 20, right: 25 },
  // Subtle radial vignette · dims corners so eye lands on centre chat
  // area · sconce glow + staircase stay visible.
  overlay:
    "radial-gradient(ellipse at center, rgba(20, 10, 5, 0.15) 0%, rgba(20, 10, 5, 0.45) 90%)",
};

const STAIRCASE_WALNUT_TOKENS: ThemeTokens = {
  colors: {
    bg: "#2A1810",                            // deepest walnut
    surface: "rgba(255, 245, 225, 0.08)",     // frosted warm cream veil
    card: "rgba(64, 43, 26, 0.82)",           // dark walnut glass
    primary: "#C9A05F",                       // amber sconce
    primaryHover: "#A67F45",                  // deeper amber
    secondary: "#3D2817",                     // walnut deep
    secondaryAccent: "#B8863E",               // antique brass
    border: "rgba(232, 223, 200, 0.20)",
    text: "#F0E4CE",                          // cream carpet
    muted: "#B5A78C",                         // warm dusty stone
    userBubble: "linear-gradient(180deg, #C9A05F 0%, #8B6534 100%)",
    nexBubble: "rgba(64, 43, 26, 0.72)",      // walnut glass · broad cascade value. Assistant bubble is painted BLACK FROSTED GLASS (rgba(0,0,0,0.55)) in page.tsx via .bg-white.rounded-bl-md — this token remains walnut so textarea + typing indicator stay on-theme.
    composer: "rgba(64, 43, 26, 0.68)",
    footer: "rgba(64, 43, 26, 0.55)",
  },
  radii: {
    card: "28px",
    button: "26px",
    input: "32px",
    bubble: "26px",
    nav: "30px",
  },
  shadows: {
    soft: "0 2px 10px rgba(0, 0, 0, 0.35)",
    glow: "0 6px 18px rgba(0, 0, 0, 0.45)",
    send: "0 8px 25px rgba(184, 134, 62, 0.30)",
  },
};

const STAIRCASE_WALNUT_ANIMATIONS: ThemeAnimations = {
  loadingIndicator: "workshop-glow",
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  transitionMs: 320,
};

const STAIRCASE_WALNUT_FONTS: ThemeFonts = {
  weights: [400, 500, 600, 700],
};

const STAIRCASE_WALNUT_EFFECTS: ThemeEffects = {
  headerBlurPx: 24,
  composerBlurPx: 30,
  navBlurPx: 24,
  bubbleBlurPx: 18,
  glass: "smoked",
};

const STAIRCASE_WALNUT_DESIGN_LANGUAGE: ThemeDesignLanguage = {
  mood: "Walnut Sanctum",
  architecture: "Carved walnut staircase in a private study",
  lighting: "Wall sconce · late evening",
  paletteNames: ["Deep Walnut", "Amber Sconce", "Antique Brass", "Cream Carpet"],
  glassStyle: "smoked",
  bubbleStyle: "rounded-pill",
  inputStyle: "floating-pill",
  headerStyle: "glass-blur",
  iconStyle: "filled-soft",
  animation: "gentle-fade",
};

export const STAIRCASE_WALNUT: Theme = {
  id: "staircase_walnut",
  displayName: "Walnut Sanctum",
  category: "luxury",
  source: "built-in",
  version: 1,

  wallpaper: STAIRCASE_WALNUT_WALLPAPER,
  tokens: STAIRCASE_WALNUT_TOKENS,
  animations: STAIRCASE_WALNUT_ANIMATIONS,
  fonts: STAIRCASE_WALNUT_FONTS,
  effects: STAIRCASE_WALNUT_EFFECTS,

  capabilities: {
    editable: true,
    aiGenerated: false,
    supportsModification: true,
    supportsPreview: true,
  },
  designLanguage: STAIRCASE_WALNUT_DESIGN_LANGUAGE,
};

// ─── Registry index ──────────────────────────────────────────────────

export const BUILT_IN_THEMES: Record<string, Theme> = {
  original_nex: ORIGINAL_NEX,
  blossom: BLOSSOM,
  staircase_light_cream: STAIRCASE_LIGHT_CREAM,
  staircase_walnut: STAIRCASE_WALNUT,
};

export function getBuiltInTheme(id: string): Theme | null {
  return BUILT_IN_THEMES[id] ?? null;
}

export function listBuiltInThemes(): Theme[] {
  return Object.values(BUILT_IN_THEMES);
}

// Guard for the immutable-home rule — any code path that swaps themes
// MUST call this before deleting or replacing Original Nex.
export function isImmutableTheme(id: string): boolean {
  return getBuiltInTheme(id)?.category === "immutable";
}
