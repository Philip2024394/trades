// Nex Themes · canonical types · Philip 2026-08-03.
//
// This is the v2 theme shape that closes the "9.5/10 → 10/10" gap Philip
// identified: every theme is a structured design system, not a wallpaper
// with tokens. The shape carries every Refinement (1–6) captured in
// feedback_adoption_over_architecture_2026_08_02.md:
//
//   1 · Capabilities Manifest        — what the theme supports
//   2 · Design Language              — Mood · Architecture · Lighting · etc.
//   3 · Variants                     — one theme, multiple moods
//   4 · Layer Separation             — Wallpaper · Tokens · Animations · Fonts · Effects
//   5 · Validation-ready             — every field the validator inspects lives here
//   6 · Signature Focal Element      — one memorable feature at the edges
//
// Client, server-repo, validator, registry, and API routes all import from
// this file. There is exactly ONE canonical Theme shape in the system.

// ─── Layer 1 · Wallpaper ─────────────────────────────────────────────

export type WallpaperFocalPosition =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "borders"
  | "corners"
  | "center";

export type WallpaperFocalElement = {
  // Human-readable label · matches the Signature list in doctrine (e.g.
  // "Petals in the corners" · "Staircase in the lower-right").
  label: string;
  position: WallpaperFocalPosition;
};

export type WallpaperSafeZone = {
  // Percent of wallpaper reserved as low-detail so chat + composer remain
  // legible. Validator checks that focal element does not overlap.
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type WallpaperConfig = {
  url: string;
  focalElement: WallpaperFocalElement;
  safeZone: WallpaperSafeZone;
  // Optional overlay/dim to guarantee readability regardless of image.
  overlay?: string; // e.g. "linear-gradient(180deg, rgba(255,245,248,0.82) 0%, rgba(255,245,248,0.94) 100%)"
};

// ─── Layer 2 · UI Tokens ─────────────────────────────────────────────

export type ThemeColorTokens = {
  bg: string;
  surface: string;
  card: string;
  primary: string;
  primaryHover: string;
  secondary: string;
  // Optional third accent — used by luxury themes (Grand Entrance uses
  // Champagne Gold #D6B58A alongside Warm Bronze primary). Themes that
  // don't need a third accent omit it and callers must not assume presence.
  secondaryAccent?: string;
  border: string;
  text: string;
  muted: string;
  userBubble: string; // may be a gradient or a solid
  nexBubble: string;
  composer: string;
  footer: string;
};

export type ThemeRadiiTokens = {
  card: string;
  button: string;
  input: string;
  bubble: string;
  nav?: string;
};

export type ThemeShadowTokens = {
  soft: string;
  glow: string;
  send?: string;
};

export type ThemeTokens = {
  colors: ThemeColorTokens;
  radii: ThemeRadiiTokens;
  shadows: ThemeShadowTokens;
};

// ─── Layer 3 · Animations ────────────────────────────────────────────

export type ThemeAnimations = {
  // Motion signature · maps to CSS keyframes emitted by the registry.
  loadingIndicator: "blossom-petals" | "workshop-glow" | "none";
  easing: string; // e.g. "cubic-bezier(0.22, 1, 0.36, 1)"
  transitionMs: number; // baseline transition duration for the swap itself
};

// ─── Layer 4 · Fonts ─────────────────────────────────────────────────

export type ThemeFonts = {
  heading?: string; // css font-family stack · optional (default = system)
  body?: string;
  weights: number[]; // max 4 (validator enforces)
};

// ─── Layer 5 · Effects ───────────────────────────────────────────────

export type ThemeEffects = {
  headerBlurPx: number;
  composerBlurPx: number;
  navBlurPx: number;
  bubbleBlurPx: number;
  glass: "frosted" | "clear" | "ribbed" | "smoked" | "none";
};

// ─── Design Language (Refinement 2) ──────────────────────────────────
//
// The DIMENSIONS an AI can reason over when modifying a theme
// ("more golden" · "less warm" · "modern black version") without
// re-authoring the whole thing.

export type ThemeDesignLanguage = {
  mood: string; // "Luxury Modern" · "Craftsman Warm" · "Soft Playful"
  architecture: string; // "Floating oak staircase" · "Workshop bench"
  lighting: string; // "Morning sunlight" · "Spring afternoon"
  paletteNames: string[]; // ["Warm Ivory","Champagne Bronze","European Oak"]
  glassStyle: ThemeEffects["glass"];
  bubbleStyle: "rounded-pill" | "rounded-soft" | "sharp" | "speech-tail" | "cloud";
  inputStyle: "floating-pill" | "anchored-bar" | "recessed-well" | "tray";
  headerStyle: "glass-blur" | "solid-tint" | "transparent" | "bordered" | "bar-shadow";
  iconStyle: "filled-soft" | "outlined" | "duotone" | "hand-drawn" | "geometric";
  animation: "gentle-fade" | "snap" | "silky" | "glide" | "mechanical-tick";
};

// ─── Capabilities Manifest (Refinement 1) ────────────────────────────

export type ThemeCapabilities = {
  editable: boolean;
  aiGenerated: boolean;
  supportsModification: boolean;
  supportsPreview: boolean;
};

// ─── Variants (Refinement 3) ─────────────────────────────────────────

export type ThemeVariant = {
  id: string; // "morning" · "sunset" · "night" · "rain" · "winter"
  displayName: string;
  wallpaperOverride?: Partial<WallpaperConfig>;
  tokenOverrides?: Partial<ThemeTokens>;
  designLanguageOverrides?: Partial<ThemeDesignLanguage>;
  effectsOverrides?: Partial<ThemeEffects>;
};

// ─── The Theme Object ────────────────────────────────────────────────

export type ThemeCategory =
  | "immutable" // Original Nex only
  | "soft"
  | "warm-glass"
  | "luxury"
  | "military"
  | "modern-glass"
  | "industrial"
  | "seasonal"
  | "business"
  | "ai-generated"
  | "community";

export type ThemeSource =
  | "built-in"
  | "ai-generated"
  | "business"
  | "community";

export type Theme = {
  id: string;
  displayName: string;
  category: ThemeCategory;
  source: ThemeSource;
  version: number;

  // Five layers
  wallpaper: WallpaperConfig | null; // null = no wallpaper (Original Nex)
  tokens: ThemeTokens;
  animations: ThemeAnimations;
  fonts: ThemeFonts;
  effects: ThemeEffects;

  // Refinements
  capabilities: ThemeCapabilities;
  designLanguage: ThemeDesignLanguage;
  variants?: Record<string, ThemeVariant>;
};

// ─── Persistence · what the API returns to callers ───────────────────

export type ThemeActive = {
  session_id: string;
  theme_id: string;
  variant_id: string | null;
  applied_at: string; // ISO timestamp
  source: "user_choice" | "preview_grant" | "reset" | "system_fallback";
};

export type ThemeOwnership = {
  session_id: string;
  theme_id: string;
  acquired_at: string;
  source: "built-in" | "purchase" | "subscription" | "preview_converted" | "gift";
};

export type ThemePreview = {
  session_id: string;
  theme_id: string;
  granted_at: string;
  expires_at: string;
  outcome: "active" | "unlocked" | "restored" | "explored_another" | "dismissed";
};

// ─── Validator result (Refinement 5) ─────────────────────────────────

export type ValidatorGate =
  | "contrast_body"
  | "contrast_large"
  | "contrast_focus_ring"
  | "state_semantics"
  | "font_floor"
  | "motion_reduce_compat"
  | "wallpaper_size"
  | "blur_budget"
  | "animation_frame_budget"
  | "font_weight_budget";

export type ValidatorFinding = {
  gate: ValidatorGate;
  status: "pass" | "warn" | "fail";
  measured: number | string;
  threshold: number | string;
  message: string;
};

export type ValidatorReport = {
  themeId: string;
  ok: boolean; // false if any gate === "fail"
  wcagLevel: "AAA" | "AA" | "fail";
  findings: ValidatorFinding[];
};

// ─── Theme command (mirrors the general-chat contract) ───────────────

export type ThemeCommand =
  | { action: "activate"; theme_id: string; variant_id?: string }
  | { action: "reset" }
  | { action: "preview"; theme_id: string; variant_id?: string };
