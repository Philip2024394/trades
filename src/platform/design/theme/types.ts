// Xrated Design System — theme schema.
//
// A DesignTheme is what every component reads via useDesignTheme().
// It is the strongly-typed presentation of a merchant's brand tokens
// — components never touch raw hex codes.

// ─── Full design language (Constitution v1 Amendment 1) ─────────
//
// Every theme controls the complete visual system: colours, typography,
// spacing, radius, elevation, shadows, gradients, icon styles,
// animation presets, and dark-mode + brand overrides. AI generates
// themes by swapping token sets — not by hand-tuning per-component.

export type DesignTheme = {
  color: {
    primary: string;
    primaryHover: string;
    primaryInk: string;
    ink: string;
    inkInverse: string;
    muted: string;
    subtle: string;
    surface: string;
    surfaceElevated: string;
    accent: string;
    success: string;
    danger: string;
    warning: string;
    border: string;
  };
  font: {
    family: string;
    heading: string;
    body: string;
    mono: string;
    /** Multiplier applied to px sizes across every component. Enables
     *  merchant-level "increase all text 10%" without editing each
     *  component. */
    scale: number;
    /** Weight scale — theme decides what "extra-bold" resolves to.
     *  Presets swap this to change the visual "weight" of a whole
     *  theme without touching component code. */
    weightRegular: number;
    weightMedium: number;
    weightBold: number;
    weightExtraBold: number;
    /** Line-height scale as unitless multipliers. */
    leadingTight: number;
    leadingNormal: number;
    leadingRelaxed: number;
    /** Letter-spacing scale in em. Negative values tighten display
     *  type; positive values open up caption text. */
    trackingTight: number;
    trackingNormal: number;
    trackingWide: number;
  };
  radius: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  shadow: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  /** Named animation registry. Components reference these strings; the
   *  theme decides the exact timing / easing so a merchant can change
   *  every "fade" in one place. */
  motion: {
    fast: string;
    normal: string;
    slow: string;
    /** Named easing curves — themes can swap between calm, snappy,
     *  bouncy vocabularies. */
    easeStandard: string;
    easeEmphasis: string;
    easeDecelerate: string;
  };
  /** Gradient presets used by heroes, cards, backgrounds. Each entry
   *  is a full CSS `background` value. */
  gradient: {
    none: string;
    subtle: string;
    accent: string;
    hero: string;
  };
  /** Pattern preset URLs (data URIs or public paths). Used by
   *  containers.overlay + hero backgrounds. */
  pattern: {
    none: string;
    grid: string;
    dots: string;
    noise: string;
  };
  /** Icon style — themes decide the default stroke width + size
   *  vocabulary. Lucide icons in every component respect these. */
  iconStyle: {
    strokeWidth: number;
    sizeSm: number;
    sizeMd: number;
    sizeLg: number;
  };
  /** Effect intensity — global dial for shadows + motion + backgrounds.
   *  "restrained" → most primitives use `none`; "expressive" → medium
   *  defaults; "premium" → animated + shadowed everywhere. Composers
   *  can respect this in AI-generated layouts. */
  effect: "restrained" | "expressive" | "premium";
  /** Colour-mode this theme is authored for. Presets default to
   *  "light"; dark variants swap surface / ink pairs. */
  mode: "light" | "dark";
  /** Optional brand overrides — merchants can supply a small subset
   *  of the theme to override for their own brand. Applied on top of
   *  the base preset by the runtime. */
  brandOverrides?: Partial<Pick<
    DesignTheme,
    "color" | "font" | "radius" | "shadow" | "gradient" | "iconStyle"
  >>;
};

/** The default Xrated theme — Hammerex yellow + industrial black. */
export const DEFAULT_DESIGN_THEME: DesignTheme = {
  color: {
    primary: "#FFB300",
    primaryHover: "#E5A500",
    primaryInk: "#0A0A0A",
    ink: "#0A0A0A",
    inkInverse: "#FFFFFF",
    muted: "#737373",
    subtle: "#F5F5F5",
    surface: "#FFFFFF",
    surfaceElevated: "#FAFAFA",
    accent: "#FFB300",
    success: "#10B981",
    danger: "#DC2626",
    warning: "#F59E0B",
    border: "#E5E5E5"
  },
  font: {
    family:
      "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    heading:
      "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    body:
      "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
    scale: 1,
    weightRegular: 400,
    weightMedium: 600,
    weightBold: 700,
    weightExtraBold: 800,
    leadingTight: 1.1,
    leadingNormal: 1.5,
    leadingRelaxed: 1.75,
    trackingTight: -0.015,
    trackingNormal: 0,
    trackingWide: 0.15
  },
  radius: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    full: 9999
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48
  },
  shadow: {
    none: "none",
    sm: "0 1px 2px rgba(0,0,0,0.05)",
    md: "0 2px 4px rgba(0,0,0,0.08)",
    lg: "0 4px 12px rgba(0,0,0,0.10)",
    xl: "0 8px 24px rgba(0,0,0,0.12)"
  },
  motion: {
    fast: "120ms ease-out",
    normal: "220ms ease-out",
    slow: "400ms ease-out",
    easeStandard: "cubic-bezier(0.16, 1, 0.3, 1)",
    easeEmphasis: "cubic-bezier(0.2, 0, 0, 1)",
    easeDecelerate: "cubic-bezier(0, 0, 0.2, 1)"
  },
  gradient: {
    none: "none",
    subtle:
      "linear-gradient(180deg, rgba(255,179,0,0.04) 0%, rgba(255,255,255,0) 100%)",
    accent:
      "linear-gradient(135deg, #FFB300 0%, #E5A500 100%)",
    hero:
      "linear-gradient(180deg, rgba(10,10,10,0.55) 0%, rgba(10,10,10,0.85) 100%)"
  },
  pattern: {
    none: "none",
    grid:
      "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><path d='M40 0L0 0 0 40' fill='none' stroke='rgba(0,0,0,0.05)'/></svg>\")",
    dots:
      "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.08) 1px, transparent 0)",
    noise:
      "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='200' height='200' filter='url(%23n)' opacity='0.4'/></svg>\")"
  },
  iconStyle: {
    strokeWidth: 2,
    sizeSm: 14,
    sizeMd: 18,
    sizeLg: 22
  },
  effect: "expressive",
  mode: "light"
};
