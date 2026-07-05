// Design Token Registry · default token set.
//
// The base "Xrated" token set — every value from DEFAULT_DESIGN_THEME
// flattened into DesignToken shape. Registered at module load. Other
// token sets (industry-specific, dark-mode, brand overrides) register
// via the same shape.

import { designTokenRegistry } from "./registry";
import { DEFAULT_DESIGN_THEME } from "../theme/types";
import type { DesignToken } from "./types";

const t = DEFAULT_DESIGN_THEME;

const tokens: DesignToken[] = [
  // ─── Colours ───
  { path: "color.primary", category: "color", value: t.color.primary, valueKind: "string", role: "brand-primary" },
  { path: "color.primaryHover", category: "color", value: t.color.primaryHover, valueKind: "string" },
  { path: "color.primaryInk", category: "color", value: t.color.primaryInk, valueKind: "string", role: "text-on-primary" },
  { path: "color.ink", category: "color", value: t.color.ink, valueKind: "string", role: "text-default" },
  { path: "color.inkInverse", category: "color", value: t.color.inkInverse, valueKind: "string", role: "text-inverse" },
  { path: "color.muted", category: "color", value: t.color.muted, valueKind: "string", role: "text-muted" },
  { path: "color.subtle", category: "color", value: t.color.subtle, valueKind: "string", role: "surface-subtle" },
  { path: "color.surface", category: "color", value: t.color.surface, valueKind: "string", role: "surface-base" },
  { path: "color.surfaceElevated", category: "color", value: t.color.surfaceElevated, valueKind: "string" },
  { path: "color.accent", category: "color", value: t.color.accent, valueKind: "string" },
  { path: "color.success", category: "color", value: t.color.success, valueKind: "string" },
  { path: "color.danger", category: "color", value: t.color.danger, valueKind: "string" },
  { path: "color.warning", category: "color", value: t.color.warning, valueKind: "string" },
  { path: "color.border", category: "color", value: t.color.border, valueKind: "string" },

  // ─── Typography ───
  { path: "typography.family.heading", category: "typography", value: t.font.heading, valueKind: "string" },
  { path: "typography.family.body", category: "typography", value: t.font.body, valueKind: "string" },
  { path: "typography.family.mono", category: "typography", value: t.font.mono, valueKind: "string" },
  { path: "typography.scale", category: "typography", value: t.font.scale, valueKind: "number" },
  { path: "typography.weight.regular", category: "typography", value: t.font.weightRegular, valueKind: "number" },
  { path: "typography.weight.medium", category: "typography", value: t.font.weightMedium, valueKind: "number" },
  { path: "typography.weight.bold", category: "typography", value: t.font.weightBold, valueKind: "number" },
  { path: "typography.weight.extraBold", category: "typography", value: t.font.weightExtraBold, valueKind: "number" },
  { path: "typography.leading.tight", category: "typography", value: t.font.leadingTight, valueKind: "number" },
  { path: "typography.leading.normal", category: "typography", value: t.font.leadingNormal, valueKind: "number" },
  { path: "typography.leading.relaxed", category: "typography", value: t.font.leadingRelaxed, valueKind: "number" },
  { path: "typography.tracking.tight", category: "typography", value: t.font.trackingTight, valueKind: "number" },
  { path: "typography.tracking.normal", category: "typography", value: t.font.trackingNormal, valueKind: "number" },
  { path: "typography.tracking.wide", category: "typography", value: t.font.trackingWide, valueKind: "number" },

  // ─── Spacing ───
  { path: "spacing.xs", category: "spacing", value: t.spacing.xs, valueKind: "number" },
  { path: "spacing.sm", category: "spacing", value: t.spacing.sm, valueKind: "number" },
  { path: "spacing.md", category: "spacing", value: t.spacing.md, valueKind: "number" },
  { path: "spacing.lg", category: "spacing", value: t.spacing.lg, valueKind: "number" },
  { path: "spacing.xl", category: "spacing", value: t.spacing.xl, valueKind: "number" },
  { path: "spacing.xxl", category: "spacing", value: t.spacing.xxl, valueKind: "number" },

  // ─── Radius ───
  { path: "radius.xs", category: "radius", value: t.radius.xs, valueKind: "number" },
  { path: "radius.sm", category: "radius", value: t.radius.sm, valueKind: "number" },
  { path: "radius.md", category: "radius", value: t.radius.md, valueKind: "number" },
  { path: "radius.lg", category: "radius", value: t.radius.lg, valueKind: "number" },
  { path: "radius.xl", category: "radius", value: t.radius.xl, valueKind: "number" },
  { path: "radius.full", category: "radius", value: t.radius.full, valueKind: "number" },

  // ─── Shadow ───
  { path: "shadow.none", category: "shadow", value: t.shadow.none, valueKind: "string" },
  { path: "shadow.sm", category: "shadow", value: t.shadow.sm, valueKind: "string" },
  { path: "shadow.md", category: "shadow", value: t.shadow.md, valueKind: "string" },
  { path: "shadow.lg", category: "shadow", value: t.shadow.lg, valueKind: "string" },
  { path: "shadow.xl", category: "shadow", value: t.shadow.xl, valueKind: "string" },

  // ─── Motion + easing ───
  { path: "motion.fast", category: "motion", value: t.motion.fast, valueKind: "string" },
  { path: "motion.normal", category: "motion", value: t.motion.normal, valueKind: "string" },
  { path: "motion.slow", category: "motion", value: t.motion.slow, valueKind: "string" },
  { path: "motion.ease.standard", category: "motion", value: t.motion.easeStandard, valueKind: "string" },
  { path: "motion.ease.emphasis", category: "motion", value: t.motion.easeEmphasis, valueKind: "string" },
  { path: "motion.ease.decelerate", category: "motion", value: t.motion.easeDecelerate, valueKind: "string" },

  // ─── Gradient ───
  { path: "gradient.none", category: "gradient", value: t.gradient.none, valueKind: "string" },
  { path: "gradient.subtle", category: "gradient", value: t.gradient.subtle, valueKind: "string" },
  { path: "gradient.accent", category: "gradient", value: t.gradient.accent, valueKind: "string" },
  { path: "gradient.hero", category: "gradient", value: t.gradient.hero, valueKind: "string" },

  // ─── Pattern ───
  { path: "pattern.none", category: "pattern", value: t.pattern.none, valueKind: "string" },
  { path: "pattern.grid", category: "pattern", value: t.pattern.grid, valueKind: "string" },
  { path: "pattern.dots", category: "pattern", value: t.pattern.dots, valueKind: "string" },
  { path: "pattern.noise", category: "pattern", value: t.pattern.noise, valueKind: "string" },

  // ─── Icon style ───
  { path: "icon.strokeWidth", category: "icon", value: t.iconStyle.strokeWidth, valueKind: "number" },
  { path: "icon.size.sm", category: "icon", value: t.iconStyle.sizeSm, valueKind: "number" },
  { path: "icon.size.md", category: "icon", value: t.iconStyle.sizeMd, valueKind: "number" },
  { path: "icon.size.lg", category: "icon", value: t.iconStyle.sizeLg, valueKind: "number" },

  // ─── Breakpoints ───
  // Mirror Tailwind's default breakpoints so tokens align with utility
  // class boundaries.
  { path: "breakpoint.sm", category: "breakpoint", value: 640, valueKind: "number" },
  { path: "breakpoint.md", category: "breakpoint", value: 768, valueKind: "number" },
  { path: "breakpoint.lg", category: "breakpoint", value: 1024, valueKind: "number" },
  { path: "breakpoint.xl", category: "breakpoint", value: 1280, valueKind: "number" },
  { path: "breakpoint.2xl", category: "breakpoint", value: 1536, valueKind: "number" },

  // ─── Z-index ───
  { path: "z-index.base", category: "z-index", value: 0, valueKind: "number" },
  { path: "z-index.raised", category: "z-index", value: 10, valueKind: "number" },
  { path: "z-index.sticky", category: "z-index", value: 30, valueKind: "number" },
  { path: "z-index.dropdown", category: "z-index", value: 40, valueKind: "number" },
  { path: "z-index.overlay", category: "z-index", value: 50, valueKind: "number" },
  { path: "z-index.modal", category: "z-index", value: 60, valueKind: "number" },
  { path: "z-index.toast", category: "z-index", value: 100, valueKind: "number" },

  // ─── Opacity ───
  { path: "opacity.disabled", category: "opacity", value: 0.5, valueKind: "number" },
  { path: "opacity.hover", category: "opacity", value: 0.9, valueKind: "number" },
  { path: "opacity.overlay", category: "opacity", value: 0.7, valueKind: "number" },
  { path: "opacity.subtle", category: "opacity", value: 0.06, valueKind: "number" }
];

designTokenRegistry.register({
  id: "xrated-default",
  name: "Xrated Default",
  description:
    "Platform default token set. Every value derived from DEFAULT_DESIGN_THEME. This is the base merchants inherit from.",
  version: "1.0.0",
  tokens
});
