// Trade Center Brand Pack — overlay token set.
//
// ─── 3-question rule ────────────────────────────────────────────────
//
// 1. Why platform?  Brand is a cross-App concern. Every App renders
//    through the Platform Design System (Amendment 9). A brand pack
//    swaps every App's visuals uniformly. If brand lived per-App,
//    the visual coherence Philip's `feedback_platform_offwhite_
//    canonical.md` memory demands is impossible.
//
// 2. Which future Apps benefit?  Every App. Marketplace, Orders,
//    Messages, Projects, Fleet, Insurance, Finance, Recruitment,
//    Training — each renders Trade Center visuals by activating this
//    brand pack. Zero App-level code change.
//
// 3. Which doc authorises?  ADR-046 + TRADE_CENTER_PLATFORM_DELTA
//    §4.3 row "Trade Center brand pack + positioning".
//
// ─── Design ─────────────────────────────────────────────────────────
//
// This is a `DesignTokenSet` registered into the existing
// `designTokenRegistry`. Activation swaps the resolver's set id;
// every component consuming tokens via `resolveToken()` picks up the
// new values on next render.
//
// Brand values match:
//   - `reference_brand_tokens.md` memory (BRAND_YELLOW #FFB300,
//     BRAND_BLACK #0A0A0A, BRAND_AMBER #F59E0B)
//   - `feedback_platform_offwhite_canonical.md` (#FBF6EC)
//   - `feedback_dark_green_only.md` (BRAND_GREEN_DARK #166534 CTAs)
//   - `feedback_hero_library_rule.md` and other design memories

import type { DesignTokenSet } from "./types";

// Named constants exposed for App-level code that legitimately needs
// them (e.g. the shell, which is platform code). Apps must NOT import
// these directly — use `resolveToken("trade-center", "color.primary")`
// so the brand pack can be swapped at runtime.
export const BRAND_YELLOW = "#FFB300";
export const BRAND_BLACK = "#0A0A0A";
export const BRAND_AMBER = "#F59E0B";
export const BRAND_GREEN = "#10B981";
export const BRAND_GREEN_DARK = "#166534";
export const BRAND_RED = "#DC2626";
export const BRAND_BLUE = "#3B82F6";
export const BRAND_OFFWHITE = "#FBF6EC";
export const BRAND_INK = "#0F172A";
export const BRAND_MUTED = "#64748B";
export const BRAND_BORDER = "#E2E8F0";

export const tradeCenterBrandPack: DesignTokenSet = {
  id: "trade-center",
  name: "Trade Center",
  description:
    "Construction OS brand pack. Off-white surface, yellow-dot marker, dark-green CTAs. Applied platform-wide without changing any App code.",
  version: "1.0.0",
  tokens: [
    // ─── Colour — surfaces ───────────────────────────────────────
    { path: "color.surface.base", category: "color", value: BRAND_OFFWHITE, valueKind: "string",
      description: "Canonical off-white platform surface (see feedback_platform_offwhite_canonical.md)." },
    { path: "color.surface.emphasis", category: "color", value: BRAND_BLACK, valueKind: "string",
      description: "Dark surface — hero banners, top bar, brand chip background." },
    { path: "color.surface.subtle", category: "color", value: "#F5F0E4", valueKind: "string",
      description: "Slightly darker off-white for nested containers on the base surface." },

    // ─── Colour — brand ──────────────────────────────────────────
    { path: "color.brand.primary", category: "color", value: BRAND_YELLOW, valueKind: "string",
      description: "The yellow-dot canonical brand mark. See feedback_network_logo_yellow_dot.md." },
    { path: "color.brand.accent", category: "color", value: BRAND_AMBER, valueKind: "string",
      description: "Amber accent — used for construction-worker mood cues (project_yard_mood_characters.md)." },
    { path: "color.brand.ink", category: "color", value: BRAND_BLACK, valueKind: "string",
      description: "Brand ink — canonical text on light surfaces." },

    // ─── Colour — action (CTA) ───────────────────────────────────
    { path: "color.action.primary", category: "color", value: BRAND_GREEN_DARK, valueKind: "string",
      description: "Dark green CTAs — feedback_dark_green_only.md canonical rule." },
    { path: "color.action.primary.hover", category: "color", value: "#14532D", valueKind: "string" },
    { path: "color.action.primary.active", category: "color", value: "#052E16", valueKind: "string" },
    { path: "color.action.secondary", category: "color", value: BRAND_BLACK, valueKind: "string",
      description: "Secondary CTA — black chip on off-white surfaces." },
    { path: "color.action.danger", category: "color", value: BRAND_RED, valueKind: "string" },

    // ─── Colour — state ──────────────────────────────────────────
    { path: "color.state.live", category: "color", value: BRAND_GREEN, valueKind: "string",
      description: "Live / in-stock indicator only (NOT for CTAs — see feedback_dark_green_only.md)." },
    { path: "color.state.warning", category: "color", value: BRAND_AMBER, valueKind: "string" },
    { path: "color.state.info", category: "color", value: BRAND_BLUE, valueKind: "string" },

    // ─── Colour — text ──────────────────────────────────────────
    { path: "color.text.default", category: "color", value: BRAND_INK, valueKind: "string" },
    { path: "color.text.muted", category: "color", value: BRAND_MUTED, valueKind: "string" },
    { path: "color.text.inverse", category: "color", value: BRAND_OFFWHITE, valueKind: "string" },
    { path: "color.text.brand", category: "color", value: BRAND_YELLOW, valueKind: "string",
      description: "Yellow accent text on dark surfaces (e.g. HOST chip)." },

    // ─── Colour — border ────────────────────────────────────────
    { path: "color.border.subtle", category: "color", value: "rgba(139,69,19,0.10)", valueKind: "string",
      description: "Warm sepia hairline used across canteen surfaces." },
    { path: "color.border.default", category: "color", value: "rgba(139,69,19,0.15)", valueKind: "string" },
    { path: "color.border.strong", category: "color", value: BRAND_BORDER, valueKind: "string" },
    { path: "color.border.focus", category: "color", value: BRAND_YELLOW, valueKind: "string" },

    // ─── Typography ─────────────────────────────────────────────
    { path: "typography.family.body", category: "typography",
      value: "Inter, 'SF Pro Text', system-ui, sans-serif", valueKind: "string" },
    { path: "typography.family.display", category: "typography",
      value: "Inter, 'SF Pro Display', system-ui, sans-serif", valueKind: "string" },
    { path: "typography.family.mono", category: "typography",
      value: "'JetBrains Mono', 'SF Mono', monospace", valueKind: "string" },
    { path: "typography.size.xs", category: "typography", value: 11, valueKind: "number" },
    { path: "typography.size.sm", category: "typography", value: 13, valueKind: "number",
      description: "13px absolute floor for readable copy — feedback_typography_wcag.md." },
    { path: "typography.size.base", category: "typography", value: 15, valueKind: "number" },
    { path: "typography.size.md", category: "typography", value: 17, valueKind: "number" },
    { path: "typography.size.lg", category: "typography", value: 22, valueKind: "number" },
    { path: "typography.size.xl", category: "typography", value: 28, valueKind: "number" },
    { path: "typography.size.2xl", category: "typography", value: 36, valueKind: "number" },

    // ─── Spacing (4/8 rhythm) ───────────────────────────────────
    { path: "spacing.xs", category: "spacing", value: 4, valueKind: "number" },
    { path: "spacing.sm", category: "spacing", value: 8, valueKind: "number" },
    { path: "spacing.md", category: "spacing", value: 12, valueKind: "number" },
    { path: "spacing.lg", category: "spacing", value: 16, valueKind: "number" },
    { path: "spacing.xl", category: "spacing", value: 24, valueKind: "number" },
    { path: "spacing.2xl", category: "spacing", value: 32, valueKind: "number" },
    { path: "spacing.3xl", category: "spacing", value: 48, valueKind: "number" },

    // ─── Radius ─────────────────────────────────────────────────
    { path: "radius.sm", category: "radius", value: 4, valueKind: "number" },
    { path: "radius.md", category: "radius", value: 8, valueKind: "number" },
    { path: "radius.lg", category: "radius", value: 12, valueKind: "number" },
    { path: "radius.pill", category: "radius", value: 9999, valueKind: "number" },

    // ─── Shadow (hyper-flat, 5 levels) ──────────────────────────
    { path: "shadow.1", category: "shadow", value: "0 1px 2px rgba(0,0,0,0.05)", valueKind: "string" },
    { path: "shadow.2", category: "shadow", value: "0 4px 12px rgba(0,0,0,0.08)", valueKind: "string" },
    { path: "shadow.3", category: "shadow", value: "0 12px 32px rgba(0,0,0,0.12)", valueKind: "string" },
    { path: "shadow.4", category: "shadow", value: "0 24px 64px rgba(0,0,0,0.20)", valueKind: "string" },

    // ─── Motion (3 durations, 2 easings) ────────────────────────
    { path: "motion.duration.fast", category: "motion", value: "100ms", valueKind: "string" },
    { path: "motion.duration.base", category: "motion", value: "200ms", valueKind: "string" },
    { path: "motion.duration.slow", category: "motion", value: "300ms", valueKind: "string" },
    { path: "motion.easing.out", category: "motion", value: "cubic-bezier(0.16, 1, 0.3, 1)", valueKind: "string" },
    { path: "motion.easing.in", category: "motion", value: "cubic-bezier(0.4, 0, 0.68, 0.06)", valueKind: "string" },

    // ─── Breakpoints ───────────────────────────────────────────
    { path: "breakpoint.sm", category: "breakpoint", value: 640, valueKind: "number" },
    { path: "breakpoint.md", category: "breakpoint", value: 768, valueKind: "number" },
    { path: "breakpoint.lg", category: "breakpoint", value: 1024, valueKind: "number" },
    { path: "breakpoint.xl", category: "breakpoint", value: 1280, valueKind: "number" }
  ]
};

// ─── Active-brand-pack context ─────────────────────────────────────

let activeBrandPackId: string = "trade-center";

/** Swap the active brand pack at runtime. Every subsequent
 *  `resolveToken()` call resolves against the new pack. Emits a
 *  `preferences.theme_changed` event so downstream systems (analytics,
 *  audit, cache invalidation) can react — everything emits per
 *  ADR-045 (Amendment 5).
 */
export function applyBrandPack(packId: string): void {
  activeBrandPackId = packId;
  // Emit event so downstream consumers know the brand changed.
  // Deliberate late import to avoid boot-order coupling.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bus = require("@/platform/runtime/eventBus");
    if (typeof bus.emit === "function") {
      bus.emit({
        kind: "preferences.theme_changed",
        payload: { packId },
        occurredAt: new Date().toISOString()
      });
    }
  } catch {
    // Boot-time or unwired — swallow. Test harness triggers this
    // path before the runtime is fully initialised.
  }
}

export function activeBrandPack(): string {
  return activeBrandPackId;
}
