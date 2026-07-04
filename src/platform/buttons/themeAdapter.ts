// Xrated Button Studio — theme adapter.
//
// Resolves a `StateOverrides` object into concrete CSS values by
// reading brand tokens. Renderers never touch `tokens[...]` directly;
// they pass the state overrides + tokens + fallback here and get back
// a plain style object.
//
// Keeping the resolution in one place means:
//   • Design Presets swap tokens; every button repaints automatically
//   • Auto-contrast tuner has one call-site to instrument
//   • Renderers stay pure JSX with zero conditional branches

import type { BrandTokens } from "@/lib/studio/sectionTypes";
import type {
  ButtonSize,
  ButtonState,
  ButtonRegistration,
  ShadowPreset,
  ShapeSpec,
  StateOverrides
} from "./types";

// ─── Size → concrete px ───────────────────────────────────────

const SIZE_HEIGHT_PX: Record<Exclude<ButtonSize, { customPx: number }>, number> = {
  xs: 28,
  sm: 36,
  md: 44,
  lg: 52,
  xl: 60
};

const SIZE_PADDING_X_PX: Record<
  Exclude<ButtonSize, { customPx: number }>,
  number
> = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24
};

const SIZE_FONT_PX: Record<
  Exclude<ButtonSize, { customPx: number }>,
  number
> = {
  xs: 11,
  sm: 12,
  md: 13,
  lg: 14,
  xl: 15
};

export function sizeToHeightPx(size: ButtonSize): number {
  return typeof size === "object" ? size.customPx : SIZE_HEIGHT_PX[size];
}

export function sizeToPaddingXPx(size: ButtonSize): number {
  return typeof size === "object"
    ? Math.max(8, Math.floor(size.customPx * 0.36))
    : SIZE_PADDING_X_PX[size];
}

export function sizeToFontPx(size: ButtonSize): number {
  return typeof size === "object"
    ? Math.max(11, Math.min(18, Math.floor(size.customPx * 0.28)))
    : SIZE_FONT_PX[size];
}

// ─── Shape → clip-path / border-radius ────────────────────────

export function shapeToStyle(shape: ShapeSpec): Partial<React.CSSProperties> {
  switch (shape.kind) {
    case "rect":
      return { borderRadius: shape.radiusPx };
    case "rounded":
      return {
        borderTopLeftRadius: shape.perCornerPx[0],
        borderTopRightRadius: shape.perCornerPx[1],
        borderBottomRightRadius: shape.perCornerPx[2],
        borderBottomLeftRadius: shape.perCornerPx[3]
      };
    case "pill":
      return { borderRadius: 999 };
    case "circle":
      return { borderRadius: "50%", aspectRatio: "1 / 1" };
    case "capsule":
      return { borderRadius: 999 };
    case "cut_corners": {
      const d = Math.max(4, shape.depthPx);
      const inset = `${d}px`;
      const clipMap: Record<string, string> = {
        tl: `polygon(${inset} 0, 100% 0, 100% 100%, 0 100%, 0 ${inset})`,
        tr: `polygon(0 0, calc(100% - ${inset}) 0, 100% ${inset}, 100% 100%, 0 100%)`,
        br: `polygon(0 0, 100% 0, 100% calc(100% - ${inset}), calc(100% - ${inset}) 100%, 0 100%)`,
        bl: `polygon(0 0, 100% 0, 100% 100%, ${inset} 100%, 0 calc(100% - ${inset}))`,
        both: `polygon(${inset} 0, calc(100% - ${inset}) 0, 100% ${inset}, 100% calc(100% - ${inset}), calc(100% - ${inset}) 100%, ${inset} 100%, 0 calc(100% - ${inset}), 0 ${inset})`
      };
      return { clipPath: clipMap[shape.corner] };
    }
    case "diamond":
      return { clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" };
    case "hex":
      return {
        clipPath:
          "polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)"
      };
    case "arrow":
      return shape.direction === "right"
        ? {
            clipPath:
              "polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%)"
          }
        : {
            clipPath:
              "polygon(16px 0, 100% 0, 100% 100%, 16px 100%, 0 50%)"
          };
    case "ribbon":
      return {
        clipPath:
          "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)"
      };
    case "ticket":
      return {
        clipPath:
          "polygon(0 0, 100% 0, 100% 40%, 96% 50%, 100% 60%, 100% 100%, 0 100%, 0 60%, 4% 50%, 0 40%)"
      };
    case "svg_mask":
      return {
        maskImage: `url(${shape.url})`,
        WebkitMaskImage: `url(${shape.url})`,
        maskSize: "100% 100%",
        WebkitMaskSize: "100% 100%",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat"
      };
  }
}

// ─── Shadow presets ─────────────────────────────────────────

export function shadowToStyle(preset: ShadowPreset, accent: string): string {
  switch (preset) {
    case "none":
      return "none";
    case "soft":
      return "0 2px 6px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)";
    case "hard":
      return "0 4px 0 rgba(0,0,0,0.9)";
    case "floating":
      return "0 12px 32px rgba(0,0,0,0.16), 0 4px 8px rgba(0,0,0,0.08)";
    case "glow":
      return `0 0 0 3px ${withAlpha(accent, 0.18)}, 0 8px 24px ${withAlpha(accent, 0.35)}`;
    case "inner":
      return "inset 0 2px 4px rgba(0,0,0,0.12)";
    case "long":
      return "6px 6px 0 rgba(0,0,0,0.16), 12px 12px 0 rgba(0,0,0,0.08)";
    case "glass":
      return "0 8px 32px rgba(31,38,135,0.18), inset 0 1px 0 rgba(255,255,255,0.16)";
    case "ambient":
      return "0 24px 48px rgba(0,0,0,0.12)";
    case "layered":
      return "0 2px 4px rgba(0,0,0,0.08), 0 8px 16px rgba(0,0,0,0.08), 0 24px 32px rgba(0,0,0,0.06)";
    case "neumorphic":
      return "8px 8px 16px rgba(163,177,198,0.6), -8px -8px 16px rgba(255,255,255,0.9)";
  }
}

// ─── State resolver ──────────────────────────────────────────

/** Compose `default` + specific state overrides. Returns concrete CSS
 *  values that a renderer can splat into a style prop. */
export function resolveState(
  registration: Pick<ButtonRegistration, "states">,
  state: ButtonState,
  tokens: BrandTokens
): {
  background: string;
  ink: string;
  border: string;
  borderWidth: number;
  shadow: string;
  transform: string;
  opacity: number;
} {
  const base = registration.states.default ?? {};
  const layer = state === "default" ? base : { ...base, ...(registration.states[state] ?? {}) };
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const primary = (tokens["color.primary"] as string) ?? "#0A0A0A";
  const surface = (tokens["color.surface"] as string) ?? "#FFFFFF";

  const background =
    layer.backgroundLiteral ??
    (layer.backgroundToken ? String(tokens[layer.backgroundToken] ?? accent) : accent);
  const ink =
    layer.inkLiteral ??
    (layer.inkToken ? String(tokens[layer.inkToken] ?? primary) : primary);
  const border =
    layer.borderLiteral ??
    (layer.borderToken ? String(tokens[layer.borderToken] ?? "transparent") : "transparent");

  const transformParts: string[] = [];
  if (layer.scale !== undefined) transformParts.push(`scale(${layer.scale})`);
  if (layer.translateXPx !== undefined) transformParts.push(`translateX(${layer.translateXPx}px)`);
  if (layer.translateYPx !== undefined) transformParts.push(`translateY(${layer.translateYPx}px)`);

  return {
    background,
    ink,
    border,
    borderWidth: layer.borderWidthPx ?? 0,
    shadow: shadowToStyle(layer.shadowPreset ?? "none", accent),
    transform: transformParts.length > 0 ? transformParts.join(" ") : "none",
    opacity: layer.opacity ?? 1
  };
}

// ─── Colour helpers ─────────────────────────────────────────

/** Add alpha channel to a `#rrggbb` colour. Falls back to the input if
 *  it's not a 6-digit hex. */
export function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const a = Math.max(0, Math.min(1, alpha));
  const aa = Math.round(a * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${aa}`;
}
