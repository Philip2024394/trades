// Layout preset definitions — the 3 hero layout options a merchant
// can pick from. Each is a purely-styling choice; the same image can
// render in any preset.

import type { HeroPreset } from "./types";

export type HeroPresetSpec = {
  id: HeroPreset;
  label: string;
  description: string;
  container_padding_px: number;
  image_border_radius_px: number;
  overlay_style: "none" | "gradient" | "solid-card";
  text_position: "over-image" | "on-card";
};

export const HERO_PRESETS: Record<HeroPreset, HeroPresetSpec> = {
  full_bleed: {
    id: "full_bleed",
    label: "Full bleed",
    description: "Edge-to-edge cinematic hero. Text sits over the image.",
    container_padding_px: 0,
    image_border_radius_px: 0,
    overlay_style: "gradient",
    text_position: "over-image"
  },
  framed: {
    id: "framed",
    label: "Framed",
    description: "Image with soft breathing room. Best for detailed products.",
    container_padding_px: 16,
    image_border_radius_px: 12,
    overlay_style: "gradient",
    text_position: "over-image"
  },
  card: {
    id: "card",
    label: "Card",
    description: "Image with a text card beside it. Best for busy images or long headlines.",
    container_padding_px: 24,
    image_border_radius_px: 16,
    overlay_style: "solid-card",
    text_position: "on-card"
  }
};

export const HERO_PRESET_ORDER: HeroPreset[] = ["full_bleed", "framed", "card"];
