// NEX HUD · THEME contract (swappable · unlimited soul · geometry-invariant).
//
// Doctrine anchor: project_nex_themeable_architecture_constitution_2026_08_25
//   "materials · frame finish · borders · lighting · accent colour · hero
//    imagery · atmosphere · component skins → THEMEABLE without rebuilding
//    the application."
//
// Themes are pure config. Never JSX. Never subclassed frames. The HUD
// frame component reads this contract and paints itself accordingly.

import type { NexHudMode } from "./modes";

export interface NexHudTheme {
  id:       string;                                          // "titanium" | "pink" | "gold" | ...
  name:     string;                                          // display name for a future theme picker
  material: "metal" | "polymer" | "wood" | "silk" | "glass"; // for future physics-based effects
  bezel: {
    /** Bezel artwork · URL to a rectangular image the frame renders as
     *  background · SVG preferred · raster acceptable for early themes. */
    imageSrc: string;
    /** How the artwork fills the console viewport. `fill` accepts mild
     *  vertical stretch on tall phones · `contain` letterboxes · `cover`
     *  crops. Themes choose per their tolerance. */
    fit: "fill" | "contain" | "cover";
    /**
     * Material tint layer · applied over the bezel raster to change its
     * finish while preserving geometry + shine + rivets. Doctrine:
     * project_nex_bezel_material_layer_addendum_2026_08_25.
     *   { color: "#c026d3", blendMode: "color" } → pink metal
     *   { color: "#f59e0b", blendMode: "color" } → gold
     *   undefined                                → theme keeps the raster's native material
     */
    tint?: {
      color: string;
      blendMode: "color" | "overlay" | "multiply" | "screen" | "hue" | "hard-light" | "soft-light";
      opacity?: number; // default 1
    };
    /** Optional CSS filter applied to the raster · use for hue-rotate/saturate
     *  effects when a blend-mode overlay isn't sufficient. */
    filter?: string;
  };
  hero: {
    /** Default hero image shown when caller passes no override. */
    defaultSrc?: string;
    /** Multiply/screen tinting over hero. */
    tint?: string;
    /** Filter applied to the hero (`brightness(0.85) saturate(0.95)` etc). */
    filter?: string;
  };
  lighting: {
    /** Ambient glow colour behind the console viewport (subtle · used inside
     *  the aspect-locked container itself). */
    ambient: string;
    /**
     * Atmosphere painted OUTSIDE the aspect-locked frame · fills the phone
     * viewport gutter around the metal. This is what the user reads as the
     * "world the device lives in". A CSS background string · themes ship a
     * radial gradient or subtle atmospheric image so the gutter reads as
     * intentional environment, not accidental black bars (Philip 2026-08-25).
     */
    outerAtmosphere: string;
    /** LED palette per mode · themes may recolour but not remove modes. */
    ledByMode: Record<NexHudMode, string>;
  };
  accents: {
    primary:      string;   // active tool / dock highlight
    onDark:       string;   // primary readable text on dark surfaces
    onDarkMuted:  string;   // secondary text
    slotIdleBg:   string;
    slotIdleRing: string;
    slotActiveBg: string;
    slotActiveRing: string;
    slotActiveGlow: string;
  };
  atmosphere?: {
    /** Reserved for particles · haze · dew · dust future effects. */
    kind?: "none" | "particles" | "haze" | "grain";
  };
  environment?: {
    /** Below-chat zone background · defaults to transparent so hero /
     *  discovery cards / atmosphere paint through. */
    background?: string;
  };
  /**
   * Mascot recommendation metadata · Philip 2026-08-27.
   * Theme influences ORDERING in the Mascot Drawer, never AVAILABILITY.
   * `recommendedTags` are matched against Mascot.tags (universal library
   * stays intact · users may always browse everything).
   */
  mascot?: {
    recommendedTags?: string[];
  };
}

export const TITANIUM_THEME: NexHudTheme = {
  id: "titanium",
  name: "Titanium / Tech",
  material: "metal",
  bezel: {
    imageSrc: "/nex/hud-frame-v8.png",
    fit: "fill",
    // No tint · titanium keeps the raster's native brushed-steel finish.
  },
  hero: {
    defaultSrc: "/nex-app/general/hero-nex-platform.png",
    filter: "brightness(0.85) saturate(0.95)",
  },
  interior: {
    backgroundSrc: "/nex/hud-interior-bg-v1.jpg",
    backgroundFilter: "brightness(0.95)",
    speakingBackgrounds: [
      "/nex/hud-interior-bg-v2.jpg",
      "/nex/hud-interior-bg-v3.jpg",
      "/nex/hud-interior-bg-v4.jpg",
    ],
    speakingSwapMs: 900,
  },
  lighting: {
    ambient: "rgba(249,115,22,0.06)",
    outerAtmosphere:
      "radial-gradient(ellipse 90% 65% at 50% 45%, rgba(249,115,22,0.22) 0%, rgba(120,53,15,0.18) 45%, rgba(20,10,4,1) 100%)",
    ledByMode: {
      idle:        "rgba(249,115,22,0.35)",
      chatting:    "#22d3ee",
      discovering: "#10b981",
      booking:     "#f59e0b",
      image:       "#a855f7",
      document:    "#e5e7eb",
    },
  },
  accents: {
    primary:        "#f97316",
    onDark:         "rgba(245,245,245,0.95)",
    onDarkMuted:    "rgba(245,245,245,0.7)",
    slotIdleBg:     "rgba(255,255,255,0.03)",
    slotIdleRing:   "rgba(255,255,255,0.06)",
    slotActiveBg:   "rgba(249,115,22,0.15)",
    slotActiveRing: "rgba(249,115,22,0.55)",
    slotActiveGlow: "0 0 12px rgba(249,115,22,0.25)",
  },
  atmosphere: { kind: "none" },
  environment: { background: "transparent" },
  mascot: { recommendedTags: ["tech", "cool", "playful", "silver", "clean", "confident"] },
};

/**
 * PINK METAL · same chassis geometry · magenta material tint via mix-blend-mode.
 * All bezel details (rivets · chamfers · shine · LED position) preserved.
 * LED palette rehues to pink/magenta spectrum for coherent identity.
 */
export const PINK_METAL_THEME: NexHudTheme = {
  id: "pink-metal",
  name: "Pink Metal",
  material: "metal",
  bezel: {
    imageSrc: "/nex/hud-frame-v8.png",
    fit: "fill",
    tint: { color: "#ec4899", blendMode: "color", opacity: 0.9 },
  },
  hero: {
    defaultSrc: "/nex-app/general/hero-nex-platform.png",
    filter: "brightness(0.85) saturate(1.1) hue-rotate(280deg)",
  },
  interior: {
    backgroundSrc: "/nex/hud-interior-bg-v1.jpg",
    backgroundFilter: "brightness(0.95) hue-rotate(280deg)",
  },
  lighting: {
    ambient: "rgba(236,72,153,0.08)",
    outerAtmosphere:
      "radial-gradient(ellipse 90% 65% at 50% 45%, rgba(236,72,153,0.25) 0%, rgba(112,26,117,0.20) 45%, rgba(17,7,20,1) 100%)",
    ledByMode: {
      idle:        "rgba(236,72,153,0.4)",
      chatting:    "#f472b6",
      discovering: "#f0abfc",
      booking:     "#fb7185",
      image:       "#e879f9",
      document:    "#fbcfe8",
    },
  },
  accents: {
    primary:        "#ec4899",
    onDark:         "rgba(253,242,248,0.95)",
    onDarkMuted:    "rgba(253,242,248,0.7)",
    slotIdleBg:     "rgba(255,255,255,0.03)",
    slotIdleRing:   "rgba(236,72,153,0.15)",
    slotActiveBg:   "rgba(236,72,153,0.18)",
    slotActiveRing: "rgba(236,72,153,0.6)",
    slotActiveGlow: "0 0 14px rgba(236,72,153,0.35)",
  },
  atmosphere: { kind: "none" },
  environment: { background: "transparent" },
  mascot: { recommendedTags: ["pink", "cute", "love", "soft", "romantic", "girl-theme", "romance", "candlelit"] },
};

/**
 * GOLD · same chassis geometry · amber material tint · warm luxury identity.
 */
export const GOLD_THEME: NexHudTheme = {
  id: "gold",
  name: "Gold / Luxury",
  material: "metal",
  bezel: {
    imageSrc: "/nex/hud-frame-v8.png",
    fit: "fill",
    tint: { color: "#d4a544", blendMode: "color", opacity: 0.92 },
  },
  hero: {
    defaultSrc: "/nex-app/general/hero-nex-platform.png",
    filter: "brightness(0.82) saturate(1.15) sepia(0.15)",
  },
  interior: {
    backgroundSrc: "/nex/hud-interior-bg-v1.jpg",
    backgroundFilter: "brightness(0.95) sepia(0.35)",
  },
  lighting: {
    ambient: "rgba(212,165,68,0.08)",
    outerAtmosphere:
      "radial-gradient(ellipse 90% 65% at 50% 45%, rgba(212,165,68,0.26) 0%, rgba(115,80,20,0.22) 45%, rgba(24,17,6,1) 100%)",
    ledByMode: {
      idle:        "rgba(212,165,68,0.4)",
      chatting:    "#fbbf24",
      discovering: "#f59e0b",
      booking:     "#d97706",
      image:       "#fde68a",
      document:    "#fef3c7",
    },
  },
  accents: {
    primary:        "#d4a544",
    onDark:         "rgba(254,252,232,0.95)",
    onDarkMuted:    "rgba(254,252,232,0.72)",
    slotIdleBg:     "rgba(255,255,255,0.03)",
    slotIdleRing:   "rgba(212,165,68,0.15)",
    slotActiveBg:   "rgba(212,165,68,0.18)",
    slotActiveRing: "rgba(212,165,68,0.6)",
    slotActiveGlow: "0 0 14px rgba(212,165,68,0.35)",
  },
  atmosphere: { kind: "none" },
  environment: { background: "transparent" },
  mascot: { recommendedTags: ["luxury", "warm", "regal", "premium", "boss"] },
};

/**
 * Registry · lookup by id · new themes register here without touching the
 * frame component. Order = default sort in a future theme picker.
 */
export const NEX_HUD_THEME_REGISTRY: Record<string, NexHudTheme> = {
  [TITANIUM_THEME.id]:   TITANIUM_THEME,
  [PINK_METAL_THEME.id]: PINK_METAL_THEME,
  [GOLD_THEME.id]:       GOLD_THEME,
  // Future themes (Carbon · Rustic · White · Heritage · Cyber) drop in as
  // pure config objects here · zero component or geometry changes.
};

export const DEFAULT_THEME_ID = "titanium";
