// suggestionEngine — the "guided guardrails" advisor.
//
// The merchant edits their hero live. Every edit runs through here.
// If the edit pushes toward a worse outcome (unreadable text, wrong
// preset for the image type, etc.), we return a HeroSuggestion the
// UI shows as a small chip next to the offending control. Merchant
// stays in control — nothing is forced. This turns "guardrails" into
// "guidance."

import {
  contrastRatio,
  estimateEffectiveBackground,
  WCAG_AA_NORMAL
} from "./contrastCheck";
import type { HeroSlotState, HeroSuggestion } from "./types";

export function evaluateHeroSlot(
  state: HeroSlotState
): HeroSuggestion | null {
  const { image, preset, edits, hero_text_color } = state;

  // Rule 1 — brightness/vignette lower text-zone contrast below WCAG AA.
  //   Suggest: Card preset (which gives text its own solid background).
  const effectiveBg = estimateEffectiveBackground(
    image.theme_palette.surface_deep,
    edits.brightness,
    edits.vignette
  );
  const ratio = contrastRatio(hero_text_color, effectiveBg);
  if (ratio < WCAG_AA_NORMAL && preset !== "card") {
    return {
      reason: "Card layout keeps your text on a clean background so it stays readable.",
      suggest_preset: "card"
    };
  }

  // Rule 2 — merchant picked Full bleed on an image the library flags
  // as busy / needing a container. Suggest Framed.
  if (
    preset === "full_bleed" &&
    image.text_zone.container_required === true
  ) {
    return {
      reason: "This image is quite busy — Framed layout gives it room to breathe.",
      suggest_preset: "framed"
    };
  }

  // Rule 3 — image has burned-in text (like a shop sign). Any overlay
  // text fights the image. Suggest split-hero use.
  if (image.burned_in_text === true && preset !== "card") {
    return {
      reason: "This image has text of its own. Card layout keeps your headline separate.",
      suggest_preset: "card"
    };
  }

  // Rule 4 — vignette maxed out (over 30%). Usually a sign the merchant
  // is trying to darken an image to make text readable — Card preset
  // does that natively without hiding the image.
  if (edits.vignette > 30 && preset !== "card") {
    return {
      reason: "You're darkening the image a lot. Card layout does that automatically.",
      suggest_preset: "card"
    };
  }

  // Rule 5 — recommended_use says split-hero but preset is full-bleed.
  // The image is designed to sit next to text, not under it.
  if (image.recommended_use === "split-hero" && preset === "full_bleed") {
    return {
      reason: "This image works best next to text, not under it. Card layout is a good fit.",
      suggest_preset: "card"
    };
  }

  return null;
}
