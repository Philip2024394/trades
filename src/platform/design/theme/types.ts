// Xrated Design System — theme schema.
//
// A DesignTheme is what every component reads via useDesignTheme().
// It is the strongly-typed presentation of a merchant's brand tokens
// — components never touch raw hex codes.

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
  };
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
    scale: 1
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
    slow: "400ms ease-out"
  }
};
