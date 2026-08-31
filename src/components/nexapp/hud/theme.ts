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
    /** Alternate frame used when the right rail is collapsed via the kebab
     *  toggle (Philip 2026-08-28). Optional · if missing, the same imageSrc
     *  is reused (rail buttons just hide) · when present it's the chassis
     *  drawn without the right rail housing so bubbles + content can widen. */
    imageSrcNoRail?: string;
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
    // Stage 3.32 · v13 artwork (Philip 2026-08-31). v13 = same silhouette
    // as v12 with cleaner hex-rail housing + brighter orange accent glow.
    // Kept as .png variants: v13.png (rail visible) · v13-norail.png (rail
    // collapsed) · v13-arrival.png (muted for the pre-auth sign-on shell,
    // used by the SIGNON_THEME below).
    imageSrc: "/nex/hud-frame-v13.png",
    imageSrcNoRail: "/nex/hud-frame-v13-norail.png",
    fit: "fill",
    // No tint · titanium keeps the raster's native brushed-steel finish.
  },
  hero: {
    defaultSrc: "/nex-app/general/hero-nex-platform.png",
    filter: "brightness(0.85) saturate(0.95)",
  },
  interior: {
    // Two-hero cycle (Philip 2026-08-28) · continuously alternates between
    // hero-nex-black.png (base) and hero-nex-black-2.png (overlay) via the
    // InteriorBackgroundLayer's crossfade timer. No speaking-state gating ·
    // always cycling for ambient motion. speakingSwapMs = fade cadence.
    backgroundSrc: "/nex-app/general/hero-nex-black.png",
    backgroundFilter: undefined,
    speakingBackgrounds: [
      "/nex-app/general/hero-nex-black-2.png",
      "/nex-app/general/hero-nex-black-3.png",
      "/nex-app/general/hero-nex-black-4.png",
    ],
    speakingSwapMs: 4000,
    // Hero sequence · Philip 2026-08-28. Extended from "1 2 3 1 2 3 2 1 3"
    // to include image 4 · interleaved as a 4th punctuation after each round.
    // 12-step ordered loop played by InteriorBackgroundLayer.
    heroSequence: [
      "/nex-app/general/hero-nex-black.png",     // 1
      "/nex-app/general/hero-nex-black-2.png",   // 2
      "/nex-app/general/hero-nex-black-3.png",   // 3
      "/nex-app/general/hero-nex-black-4.png",   // 4
      "/nex-app/general/hero-nex-black.png",     // 1
      "/nex-app/general/hero-nex-black-2.png",   // 2
      "/nex-app/general/hero-nex-black-3.png",   // 3
      "/nex-app/general/hero-nex-black-4.png",   // 4
      "/nex-app/general/hero-nex-black-2.png",   // 2
      "/nex-app/general/hero-nex-black.png",     // 1
      "/nex-app/general/hero-nex-black-3.png",   // 3
      "/nex-app/general/hero-nex-black-4.png",   // 4
    ],
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
    imageSrc: "/nex/hud-frame-v13.png",
    imageSrcNoRail: "/nex/hud-frame-v13-norail.png",
    fit: "fill",
    tint: { color: "#ec4899", blendMode: "color", opacity: 0.9 },
  },
  hero: {
    defaultSrc: "/nex-app/general/hero-nex-platform.png",
    filter: "brightness(0.85) saturate(1.1) hue-rotate(280deg)",
  },
  interior: {
    backgroundSrc: "/nex-app/general/hero-nex-black.png",
    backgroundFilter: undefined,
    speakingBackgrounds: [
      "/nex-app/general/hero-nex-black-2.png",
      "/nex-app/general/hero-nex-black-3.png",
      "/nex-app/general/hero-nex-black-4.png",
    ],
    speakingSwapMs: 4000,
    // Hero sequence · Philip 2026-08-28. Extended from "1 2 3 1 2 3 2 1 3"
    // to include image 4 · interleaved as a 4th punctuation after each round.
    // 12-step ordered loop played by InteriorBackgroundLayer.
    heroSequence: [
      "/nex-app/general/hero-nex-black.png",     // 1
      "/nex-app/general/hero-nex-black-2.png",   // 2
      "/nex-app/general/hero-nex-black-3.png",   // 3
      "/nex-app/general/hero-nex-black-4.png",   // 4
      "/nex-app/general/hero-nex-black.png",     // 1
      "/nex-app/general/hero-nex-black-2.png",   // 2
      "/nex-app/general/hero-nex-black-3.png",   // 3
      "/nex-app/general/hero-nex-black-4.png",   // 4
      "/nex-app/general/hero-nex-black-2.png",   // 2
      "/nex-app/general/hero-nex-black.png",     // 1
      "/nex-app/general/hero-nex-black-3.png",   // 3
      "/nex-app/general/hero-nex-black-4.png",   // 4
    ],
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
    imageSrc: "/nex/hud-frame-v13.png",
    imageSrcNoRail: "/nex/hud-frame-v13-norail.png",
    fit: "fill",
    tint: { color: "#d4a544", blendMode: "color", opacity: 0.92 },
  },
  hero: {
    defaultSrc: "/nex-app/general/hero-nex-platform.png",
    filter: "brightness(0.82) saturate(1.15) sepia(0.15)",
  },
  interior: {
    backgroundSrc: "/nex-app/general/hero-nex-black.png",
    backgroundFilter: undefined,
    speakingBackgrounds: [
      "/nex-app/general/hero-nex-black-2.png",
      "/nex-app/general/hero-nex-black-3.png",
      "/nex-app/general/hero-nex-black-4.png",
    ],
    speakingSwapMs: 4000,
    // Hero sequence · Philip 2026-08-28. Extended from "1 2 3 1 2 3 2 1 3"
    // to include image 4 · interleaved as a 4th punctuation after each round.
    // 12-step ordered loop played by InteriorBackgroundLayer.
    heroSequence: [
      "/nex-app/general/hero-nex-black.png",     // 1
      "/nex-app/general/hero-nex-black-2.png",   // 2
      "/nex-app/general/hero-nex-black-3.png",   // 3
      "/nex-app/general/hero-nex-black-4.png",   // 4
      "/nex-app/general/hero-nex-black.png",     // 1
      "/nex-app/general/hero-nex-black-2.png",   // 2
      "/nex-app/general/hero-nex-black-3.png",   // 3
      "/nex-app/general/hero-nex-black-4.png",   // 4
      "/nex-app/general/hero-nex-black-2.png",   // 2
      "/nex-app/general/hero-nex-black.png",     // 1
      "/nex-app/general/hero-nex-black-3.png",   // 3
      "/nex-app/general/hero-nex-black-4.png",   // 4
    ],
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
 * SIGN-ON · Stage 3.32 · Philip 2026-08-31.
 *
 * Pre-authentication arrival variant. Same chassis geometry as Titanium
 * but the bezel PNG (`hud-frame-v13-arrival.png`) has:
 *   · muted top-right indicator lights (grey, not glowing orange)
 *   · no right-rail housing (the user has no capabilities to expose yet)
 *   · a single highlighted orange pill at the bottom (points at the CTA)
 *
 * Renders the sign-on flow inside the frame without the voice orb, hero
 * cycle, or rail buttons. Interior content = the sign-on form itself.
 * Once authentication completes, the shell swaps to TITANIUM_THEME +
 * lights up the rail.
 */
export const SIGNON_THEME: NexHudTheme = {
  id: "sign-on",
  name: "Sign-on / Arrival",
  material: "metal",
  bezel: {
    imageSrc: "/nex/hud-frame-v13-arrival.png",
    imageSrcNoRail: "/nex/hud-frame-v13-arrival.png",
    fit: "fill",
    // No tint · the arrival PNG already carries its own muted palette.
  },
  hero: {
    // No hero image · sign-on interior is the form itself.
    filter: "brightness(1)",
  },
  // No `interior` key · sign-on doesn't cycle backgrounds (the SignOn page
  // paints its own white interior). The other themes carry an `interior`
  // block for the nex-app hero cycle · pre-existing pattern the interface
  // doesn't formally declare yet.
  lighting: {
    ambient: "rgba(0,0,0,0)",
    outerAtmosphere: "radial-gradient(circle at 50% 30%, #1a1a1e 0%, #0a0a0c 100%)",
    ledByMode: {
      idle:        "rgba(249,115,22,0.6)",
      chatting:    "rgba(249,115,22,0.6)",
      discovering: "rgba(249,115,22,0.6)",
      booking:     "rgba(249,115,22,0.6)",
      image:       "rgba(249,115,22,0.6)",
      document:    "rgba(249,115,22,0.6)",
    },
  },
  accents: {
    primary:        "#f97316",
    onDark:         "#0a0e18",
    onDarkMuted:    "#4b5563",
    slotIdleBg:     "transparent",
    slotIdleRing:   "transparent",
    slotActiveBg:   "transparent",
    slotActiveRing: "transparent",
    slotActiveGlow: "none",
  },
  atmosphere: { kind: "none" },
  environment: { background: "#ffffff" },
  mascot: { recommendedTags: [] },
};

/**
 * Registry · lookup by id · new themes register here without touching the
 * frame component. Order = default sort in a future theme picker.
 */
export const NEX_HUD_THEME_REGISTRY: Record<string, NexHudTheme> = {
  [TITANIUM_THEME.id]:   TITANIUM_THEME,
  [PINK_METAL_THEME.id]: PINK_METAL_THEME,
  [GOLD_THEME.id]:       GOLD_THEME,
  [SIGNON_THEME.id]:     SIGNON_THEME,
  // Future themes (Carbon · Rustic · White · Heritage · Cyber) drop in as
  // pure config objects here · zero component or geometry changes.
};

export const DEFAULT_THEME_ID = "titanium";
