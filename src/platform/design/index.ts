// Xrated Design System — public API barrel.
//
// The single import surface for every consumer (Studio, App runtime,
// AI SDK, preview surfaces). Importing this module also triggers
// side-effect registration of every built-in component.

import "./components";

// ─── Registry ──────────────────────────────────────
export { designSystemRegistry } from "./registry";
export type { DesignSystemRegistry } from "./registry";

// ─── Types ─────────────────────────────────────────
export type {
  AnyDesignComponentRegistration,
  ContentShape,
  DesignComponentCategory,
  DesignComponentInstance,
  DesignComponentRegistration,
  DesignComponentRendererProps,
  EditableProp,
  EditablePropKind,
  FrozenDesignComponent,
  ResponsiveBehaviour,
  ResponsiveMode
} from "./types";

// ─── Theme ─────────────────────────────────────────
export { DesignThemeProvider, useDesignTheme } from "./theme/context";
export type { DesignTheme } from "./theme/types";
export { DEFAULT_DESIGN_THEME } from "./theme/types";
export {
  PALETTES,
  brandTokensToDesignTheme,
  getPalette,
  listPalettes
} from "./theme/palettes";
export type { PaletteId } from "./theme/palettes";

// ─── Content preservation ─────────────────────────
export { applyReplacement } from "./content/preservation";
export type { PreservationResult } from "./content/preservation";

// ─── Preview harness ──────────────────────────────
export {
  DesignPreview,
  DesignPreviewCustom,
  DesignInstancePreview
} from "./preview/harness";
