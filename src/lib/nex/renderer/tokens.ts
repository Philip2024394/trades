// Design Token Engine · resolves theme_pack ID → concrete ThemePack values.
//
// No colours are hardcoded outside this module. Every render call resolves tokens
// once at the start · propagates them to every component.
//
// Doctrine: docs/brains/nex-design-tokens-and-marketing-intelligence-philip-2026-08-03.md

import type { ThemePack } from "./types";

const THEME_PACKS: Record<string, ThemePack> = {
  luxury_black_gold: {
    id: "luxury_black_gold",
    colors: {
      primary: "#0F0F0F", secondary: "#D4AF37", accent: "#FFFFFF",
      background: "#FFFFFF", text_primary: "#0F0F0F", text_on_primary: "#FFFFFF",
      cta_background: "#0F0F0F", cta_text: "#D4AF37",
      border: "#D4AF37", shadow: "rgba(15,15,15,0.28)",
    },
    fonts: { headline: "Montserrat", subheadline: "Montserrat", body: "Montserrat", cta: "Montserrat" },
    spacing: { section: 48, default: 24, padding_container: 32, padding_text_inner: 20, safe_margin: 15 },
    radius: { cta: 12, contact_box: 12, hero: 8 },
    icon: { size_feature: 28, size_social: 24, style: "line" },
  },

  luxury_burgundy: {
    id: "luxury_burgundy",
    colors: {
      primary: "#5C1229", secondary: "#D4AF37", accent: "#F5F5DC",
      background: "#F5F5DC", text_primary: "#5C1229", text_on_primary: "#FFFFFF",
      cta_background: "#5C1229", cta_text: "#FFFFFF",
      border: "#8B1E3F", shadow: "rgba(92,18,41,0.32)",
    },
    fonts: { headline: "Playfair Display", subheadline: "Montserrat", body: "Montserrat", cta: "Montserrat" },
    spacing: { section: 48, default: 24, padding_container: 32, padding_text_inner: 20, safe_margin: 15 },
    radius: { cta: 12, contact_box: 12, hero: 8 },
    icon: { size_feature: 28, size_social: 24, style: "line" },
  },

  modern_blue: {
    id: "modern_blue",
    colors: {
      primary: "#1E40AF", secondary: "#FFFFFF", accent: "#0F172A",
      background: "#FFFFFF", text_primary: "#0F172A", text_on_primary: "#FFFFFF",
      cta_background: "#1E40AF", cta_text: "#FFFFFF",
      border: "#93C5FD", shadow: "rgba(30,64,175,0.24)",
    },
    fonts: { headline: "Montserrat", subheadline: "Montserrat", body: "Inter", cta: "Montserrat" },
    spacing: { section: 40, default: 24, padding_container: 28, padding_text_inner: 18, safe_margin: 14 },
    radius: { cta: 10, contact_box: 10, hero: 6 },
    icon: { size_feature: 28, size_social: 24, style: "line" },
  },

  industrial_orange: {
    id: "industrial_orange",
    colors: {
      primary: "#F58220", secondary: "#0F0F0F", accent: "#FFFFFF",
      background: "#FFFFFF", text_primary: "#0F0F0F", text_on_primary: "#FFFFFF",
      cta_background: "#F58220", cta_text: "#FFFFFF",
      border: "#F58220", shadow: "rgba(245,130,32,0.30)",
    },
    fonts: { headline: "Montserrat", subheadline: "Montserrat", body: "Inter", cta: "Montserrat" },
    spacing: { section: 36, default: 20, padding_container: 28, padding_text_inner: 16, safe_margin: 12 },
    radius: { cta: 8, contact_box: 8, hero: 4 },
    icon: { size_feature: 32, size_social: 26, style: "filled" },
  },

  nature_green: {
    id: "nature_green",
    colors: {
      primary: "#4A6741", secondary: "#FFFFFF", accent: "#0F0F0F",
      background: "#FFFFFF", text_primary: "#0F0F0F", text_on_primary: "#FFFFFF",
      cta_background: "#4A6741", cta_text: "#FFFFFF",
      border: "#8FA982", shadow: "rgba(74,103,65,0.24)",
    },
    fonts: { headline: "Montserrat", subheadline: "Montserrat", body: "Inter", cta: "Montserrat" },
    spacing: { section: 40, default: 22, padding_container: 28, padding_text_inner: 18, safe_margin: 14 },
    radius: { cta: 14, contact_box: 14, hero: 8 },
    icon: { size_feature: 28, size_social: 24, style: "line" },
  },

  traditional_brown: {
    id: "traditional_brown",
    colors: {
      primary: "#6B4226", secondary: "#FFFFFF", accent: "#F5F5DC",
      background: "#FAF7F2", text_primary: "#3E2723", text_on_primary: "#FFFFFF",
      cta_background: "#6B4226", cta_text: "#FFFFFF",
      border: "#8B6B47", shadow: "rgba(107,66,38,0.24)",
    },
    fonts: { headline: "Playfair Display", subheadline: "Montserrat", body: "Georgia", cta: "Montserrat" },
    spacing: { section: 44, default: 24, padding_container: 32, padding_text_inner: 20, safe_margin: 15 },
    radius: { cta: 8, contact_box: 8, hero: 4 },
    icon: { size_feature: 28, size_social: 24, style: "line" },
  },

  aqua_teal: {
    id: "aqua_teal",
    colors: {
      primary: "#0F766E", secondary: "#FFFFFF", accent: "#0F0F0F",
      background: "#FFFFFF", text_primary: "#0F172A", text_on_primary: "#FFFFFF",
      cta_background: "#0F766E", cta_text: "#FFFFFF",
      border: "#5EEAD4", shadow: "rgba(15,118,110,0.24)",
    },
    fonts: { headline: "Montserrat", subheadline: "Montserrat", body: "Inter", cta: "Montserrat" },
    spacing: { section: 40, default: 24, padding_container: 30, padding_text_inner: 18, safe_margin: 14 },
    radius: { cta: 12, contact_box: 12, hero: 6 },
    icon: { size_feature: 28, size_social: 24, style: "line" },
  },

  premium_purple: {
    id: "premium_purple",
    colors: {
      primary: "#6B21A8", secondary: "#0F0F0F", accent: "#FFFFFF",
      background: "#FFFFFF", text_primary: "#0F0F0F", text_on_primary: "#FFFFFF",
      cta_background: "#6B21A8", cta_text: "#FFFFFF",
      border: "#A855F7", shadow: "rgba(107,33,168,0.28)",
    },
    fonts: { headline: "Montserrat", subheadline: "Montserrat", body: "Inter", cta: "Montserrat" },
    spacing: { section: 40, default: 22, padding_container: 28, padding_text_inner: 18, safe_margin: 14 },
    radius: { cta: 10, contact_box: 10, hero: 6 },
    icon: { size_feature: 28, size_social: 24, style: "filled" },
  },

  heritage_walnut_cream: {
    id: "heritage_walnut_cream",
    colors: {
      primary: "#4A2E1D", secondary: "#F5F5DC", accent: "#8B4513",
      background: "#F5F5DC", text_primary: "#3E2723", text_on_primary: "#FFFFFF",
      cta_background: "#4A2E1D", cta_text: "#FFFFFF",
      border: "#8B6B47", shadow: "rgba(74,46,29,0.28)",
    },
    fonts: { headline: "Playfair Display", subheadline: "Montserrat", body: "Georgia", cta: "Montserrat" },
    spacing: { section: 48, default: 26, padding_container: 34, padding_text_inner: 20, safe_margin: 15 },
    radius: { cta: 8, contact_box: 8, hero: 4 },
    icon: { size_feature: 26, size_social: 22, style: "line" },
  },

  corporate_grey: {
    id: "corporate_grey",
    colors: {
      primary: "#374151", secondary: "#FFFFFF", accent: "#0F0F0F",
      background: "#FFFFFF", text_primary: "#0F172A", text_on_primary: "#FFFFFF",
      cta_background: "#374151", cta_text: "#FFFFFF",
      border: "#9CA3AF", shadow: "rgba(55,65,81,0.20)",
    },
    fonts: { headline: "Inter", subheadline: "Inter", body: "Inter", cta: "Inter" },
    spacing: { section: 40, default: 24, padding_container: 28, padding_text_inner: 18, safe_margin: 14 },
    radius: { cta: 4, contact_box: 4, hero: 4 },
    icon: { size_feature: 26, size_social: 22, style: "line" },
  },

  minimal_white: {
    id: "minimal_white",
    colors: {
      primary: "#0F0F0F", secondary: "#F5F5F5", accent: "#0F0F0F",
      background: "#FFFFFF", text_primary: "#0F0F0F", text_on_primary: "#FFFFFF",
      cta_background: "#0F0F0F", cta_text: "#FFFFFF",
      border: "#E5E5E5", shadow: "rgba(0,0,0,0.10)",
    },
    fonts: { headline: "Inter", subheadline: "Inter", body: "Inter", cta: "Inter" },
    spacing: { section: 52, default: 28, padding_container: 36, padding_text_inner: 22, safe_margin: 18 },
    radius: { cta: 0, contact_box: 0, hero: 0 },
    icon: { size_feature: 24, size_social: 20, style: "line" },
  },

  nature_green_lifestyle: {
    id: "nature_green_lifestyle",
    colors: {
      primary: "#5A7A4A", secondary: "#FFFFFF", accent: "#F5F5DC",
      background: "#FFFFFF", text_primary: "#2D3E24", text_on_primary: "#FFFFFF",
      cta_background: "#5A7A4A", cta_text: "#FFFFFF",
      border: "#B5CFA5", shadow: "rgba(90,122,74,0.20)",
    },
    fonts: { headline: "Montserrat", subheadline: "Montserrat", body: "Inter", cta: "Montserrat" },
    spacing: { section: 44, default: 24, padding_container: 30, padding_text_inner: 18, safe_margin: 14 },
    radius: { cta: 20, contact_box: 20, hero: 12 },
    icon: { size_feature: 28, size_social: 24, style: "line" },
  },
};

/** Resolve a theme pack ID to a full ThemePack. Returns minimal_white as fallback. */
export function resolveTheme(id: string): ThemePack {
  return THEME_PACKS[id] ?? THEME_PACKS.minimal_white;
}

/** List all available theme pack IDs. */
export function listThemes(): readonly string[] {
  return Object.keys(THEME_PACKS);
}
