// Page slot system — the foundation of section reorder + snap +
// variant-aware placement.
//
// A page is an ordered list of named slots. Each slot holds one
// section. Each slot declares an aspect hint + per-type variant
// preferences so when a merchant drags a section into a different
// slot, the platform auto-adjusts the section's layout variant.
//
// Merchants can drag any section to any slot. The platform never
// blocks a placement — it just suggests + defaults smartly.

import type { EditableSectionType } from "./types";

export type SlotAspectHint =
  | "landscape-wide" // banner-style, above-the-fold hero
  | "landscape" // typical content, wider than tall
  | "square" // grid-style, equal width/height
  | "portrait" // narrow, stackable
  | "flexible"; // fits anything

export type SlotVariantHints = Partial<Record<EditableSectionType, string>>;

export type PageSlot = {
  id: string;
  order: number;
  name: string;
  aspectHint: SlotAspectHint;
  /** Preferred variant per section type. When a section is dropped
   *  into this slot, its layout variant auto-adjusts to the hint. */
  variantHints: SlotVariantHints;
  /** When empty, prompt the merchant with this text. */
  emptyPrompt?: string;
};

/** Default landing page template — the shape most tradesperson sites
 *  end up with. Merchants can leave slots empty (no section) or drag
 *  in any section type. */
export const LANDING_PAGE_SLOTS: PageSlot[] = [
  {
    id: "slot_hero",
    order: 0,
    name: "Above the fold",
    aspectHint: "landscape-wide",
    variantHints: {
      hero: "full_bleed",
      services: "3col",
      gallery: "3col"
    },
    emptyPrompt: "Big impression above the fold — usually a hero image."
  },
  {
    id: "slot_intro",
    order: 1,
    name: "Value proposition",
    aspectHint: "landscape",
    variantHints: {
      text: "center-hero",
      services: "3col",
      contact: "3col"
    },
    emptyPrompt: "Tell visitors why to pick you."
  },
  {
    id: "slot_services",
    order: 2,
    name: "What you do",
    aspectHint: "landscape",
    variantHints: {
      services: "3col",
      text: "center-hero",
      gallery: "3col"
    },
    emptyPrompt: "Show the services you offer."
  },
  {
    id: "slot_proof",
    order: 3,
    name: "Proof (before / after)",
    aspectHint: "landscape",
    variantHints: {
      custom: "single",
      services: "3col"
    },
    emptyPrompt: "Before/after transformations of recent jobs."
  },
  {
    id: "slot_gallery",
    order: 4,
    name: "Portfolio grid",
    aspectHint: "landscape-wide",
    variantHints: {
      gallery: "4col",
      services: "4col"
    },
    emptyPrompt: "A gallery of recent work."
  },
  {
    id: "slot_contact",
    order: 5,
    name: "Get in touch",
    aspectHint: "landscape",
    variantHints: {
      contact: "3col",
      text: "center-hero"
    },
    emptyPrompt: "Phone, WhatsApp, email — the essentials."
  },
  {
    id: "slot_cta",
    order: 6,
    name: "Closing CTA",
    aspectHint: "landscape",
    variantHints: {
      text: "center-hero",
      contact: "stacked"
    },
    emptyPrompt: "Final call to action before the footer."
  }
];

export function slotById(
  slots: PageSlot[],
  id: string
): PageSlot | undefined {
  return slots.find((s) => s.id === id);
}

/** Given a section type + a slot, return the recommended variant to
 *  apply when the section lands in that slot. Falls back to the
 *  section's current variant if the slot has no hint for its type. */
export function preferredVariantForSlot(
  slot: PageSlot,
  sectionType: EditableSectionType,
  currentVariant: string
): string {
  return slot.variantHints[sectionType] ?? currentVariant;
}
