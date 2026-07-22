// Design Token Engine — canonical types per V3 Q15.
//
// Brand DNA is human language. Design Tokens are machine language.
// Every Studio consumes the same tokens, never Brand DNA directly.

// ─── Semantic colour tokens ─────────────────────────────────────

export type CoreTokens = {
  primary:    string;   // hex
  secondary:  string;
  accent:     string;
  background: string;
  surface:    string;
  text:       string;
  textMuted:  string;
  success:    string;
  warning:    string;
  danger:     string;
  info:       string;
};

// ─── Typography tokens ──────────────────────────────────────────

export type TypographyTokens = {
  headingFont:     string;
  bodyFont:        string;
  displayFont:     string;
  weights:         number[];        // e.g. [400, 600, 800]
  letterSpacing:   number[];        // em, e.g. [-0.02, 0, 0.06]
  lineHeight:      number[];        // e.g. [1.1, 1.4, 1.6]
};

// ─── Spacing scale (per V3 Q15) ─────────────────────────────────

export type SpacingScale = number[];   // 4/8/12/16/24/32/48/64/96
export const DEFAULT_SPACING: SpacingScale = [4, 8, 12, 16, 24, 32, 48, 64, 96];

// ─── Radius scale ───────────────────────────────────────────────

export type RadiusScale = number[];    // 0/4/8/12/16/24/9999
export const DEFAULT_RADIUS: RadiusScale = [0, 4, 8, 12, 16, 24, 9999];

// ─── Elevation ──────────────────────────────────────────────────

export type Elevation = {
  level: 0 | 1 | 2 | 3 | 4;
  webShadow:      string;
  iosShadow:      { offsetY: number; blur: number; opacity: number };
  androidShadow:  { elevation: number };
};

export const DEFAULT_ELEVATION: Elevation[] = [
  { level: 0, webShadow: "none",                                       iosShadow: { offsetY: 0, blur: 0,  opacity: 0    }, androidShadow: { elevation: 0 } },
  { level: 1, webShadow: "0 1px 2px rgba(0,0,0,0.06)",                  iosShadow: { offsetY: 1, blur: 2,  opacity: 0.06 }, androidShadow: { elevation: 1 } },
  { level: 2, webShadow: "0 4px 8px rgba(0,0,0,0.08)",                  iosShadow: { offsetY: 4, blur: 8,  opacity: 0.08 }, androidShadow: { elevation: 3 } },
  { level: 3, webShadow: "0 8px 16px rgba(0,0,0,0.10)",                 iosShadow: { offsetY: 8, blur: 16, opacity: 0.10 }, androidShadow: { elevation: 6 } },
  { level: 4, webShadow: "0 16px 32px rgba(0,0,0,0.14)",                iosShadow: { offsetY: 16, blur: 32, opacity: 0.14 }, androidShadow: { elevation: 12 } }
];

// ─── Iconography ────────────────────────────────────────────────

export type IconTokens = {
  strokeWidth:  1 | 1.5 | 2 | 2.4 | 3;
  sizes:        number[];    // 12/16/20/24/32
  style:        "outline" | "filled" | "duotone";
};

// ─── Motion (Phase 2) ───────────────────────────────────────────

export type MotionTokens = {
  fastMs:    number;    // 100
  normalMs:  number;    // 200
  slowMs:    number;    // 300
  spring:    { stiffness: number; damping: number };
};

// ─── Premium profile tokens ─────────────────────────────────────

export type PremiumProfile = "budget" | "mid" | "premium" | "luxury";
export type PremiumTokens = {
  profile:              PremiumProfile;
  whitespacePct:        number;   // 12% (budget) - 24% (luxury)
  photographyRatio:     number;   // 0.3 (budget) - 0.65 (luxury)
  informationDensity:   number;   // 6 groups (budget) - 3 groups (luxury)
  logoWeightMultiplier: number;   // 0.9 - 1.4
  visualNoise:          "low" | "medium" | "high";
};

// ─── Vehicle-surface tokens ─────────────────────────────────────

export type VehicleTokens = {
  logoWidthPct:      number;   // 11% typical for premium
  phoneHeightPct:    number;   // 6-8%
  heroPanelPct:      number;   // 28% (rear quarter)
  marginPct:         number;
  panelAngleDeg:     number;   // 24 typical for diagonal cuts
  wrapPaddingMm:     number;
  qrSizeMm:          number;
};

// ─── Print-surface tokens ───────────────────────────────────────

export type PrintTokens = {
  bleedMm:     number;   // 3
  safeAreaMm:  number;   // 5
  marginMm:    number;
  dpi:         number;   // 300 minimum
  colourMode:  "CMYK" | "RGB" | "Pantone";
};

// ─── Full DesignTokens ──────────────────────────────────────────

export type DesignTokens = {
  core:        CoreTokens;
  typography:  TypographyTokens;
  spacing:     SpacingScale;
  radius:      RadiusScale;
  elevation:   Elevation[];
  icons:       IconTokens;
  motion:      MotionTokens;
  premium:     PremiumTokens;
  vehicle:     VehicleTokens;
  print:       PrintTokens;
  version:     string;
};

export const TOKEN_ENGINE_VERSION = "1.0.0";
