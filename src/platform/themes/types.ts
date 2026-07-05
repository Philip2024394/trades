// themeRegistry — types.
//
// A ThemeManifest is a complete visual system decision — the union of
// font pair, radius scale, section rhythm, motion tempo, and (Amendment
// 6 §RGP-6) a `futureParent` migration hint pointing at brandRegistry.
//
// Preserves the existing ThemePreset shape from
// @/lib/studio/themePresets so consumers continue working unchanged.

export type ThemePresetId =
  | "modern"
  | "corporate"
  | "luxury"
  | "industrial"
  | "minimal"
  | "creative"
  | string;

export type ThemeMotion = "restrained" | "standard" | "expressive";

export type ThemeVars = {
  "--font-heading": string;
  "--font-body": string;
  "--radius": string;
  "--section-padding": string;
  "--letter-spacing-tight": string;
};

export type ThemeManifest = {
  manifestVersion: 1;

  slug: ThemePresetId;
  name: string;
  description: string;
  version: string;

  /** Best-fit trade categories used by rank(). */
  bestForVerticals: readonly string[];

  vars: ThemeVars;
  motion: ThemeMotion;

  /** Publisher metadata. */
  publisher?: {
    name: string;
    verified: boolean;
    contactUrl?: string;
  };
};

export type FrozenThemeManifest = Readonly<ThemeManifest>;
