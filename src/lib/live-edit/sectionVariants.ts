// Section variant registry.
//
// Each EditableSection type declares 2–4 layout variants. When a
// merchant drags a section into a slot with a variant hint, the
// section's variant auto-swaps to the hint. Merchants can always
// override manually via the section's own editor.

import type { EditableSectionType } from "./types";

export type SectionVariantSpec = {
  id: string;
  label: string;
  description: string;
  /** Preferred slot aspect this variant looks best in. */
  bestFor:
    | "landscape-wide"
    | "landscape"
    | "square"
    | "portrait"
    | "flexible";
};

/** Variant registry. Keys are section types; values are variant lists. */
export const SECTION_VARIANTS: Record<
  EditableSectionType,
  SectionVariantSpec[]
> = {
  hero: [
    {
      id: "full_bleed",
      label: "Full bleed",
      description: "Edge-to-edge cinematic hero",
      bestFor: "landscape-wide"
    },
    {
      id: "framed",
      label: "Framed",
      description: "Soft breathing room, magazine feel",
      bestFor: "landscape"
    },
    {
      id: "card",
      label: "Card",
      description: "Image + text card side by side",
      bestFor: "landscape"
    }
  ],
  text: [
    {
      id: "center-hero",
      label: "Centred hero",
      description: "Centred heading + subhead + CTA",
      bestFor: "landscape-wide"
    },
    {
      id: "left-aligned",
      label: "Left-aligned",
      description: "Traditional block, left-aligned",
      bestFor: "landscape"
    }
  ],
  image: [
    {
      id: "full_bleed",
      label: "Full bleed",
      description: "Edge-to-edge image",
      bestFor: "landscape-wide"
    },
    {
      id: "framed",
      label: "Framed",
      description: "Image with padding",
      bestFor: "landscape"
    }
  ],
  gallery: [
    {
      id: "2col",
      label: "2 columns",
      description: "Larger tiles, feature focus",
      bestFor: "portrait"
    },
    {
      id: "3col",
      label: "3 columns",
      description: "Standard grid",
      bestFor: "landscape"
    },
    {
      id: "4col",
      label: "4 columns",
      description: "Dense grid, portfolio-style",
      bestFor: "landscape-wide"
    }
  ],
  services: [
    {
      id: "2col",
      label: "2 cards",
      description: "Two service cards side by side",
      bestFor: "portrait"
    },
    {
      id: "3col",
      label: "3 cards",
      description: "Standard three-card grid",
      bestFor: "landscape"
    },
    {
      id: "4col",
      label: "4 cards",
      description: "Compact four-card grid",
      bestFor: "landscape-wide"
    }
  ],
  contact: [
    {
      id: "3col",
      label: "3 contact cards",
      description: "Phone / WhatsApp / Email side by side",
      bestFor: "landscape"
    },
    {
      id: "stacked",
      label: "Stacked",
      description: "One column, mobile-first",
      bestFor: "portrait"
    }
  ],
  custom: [
    {
      id: "default",
      label: "Default",
      description: "Section decides its own layout",
      bestFor: "flexible"
    }
  ]
};

export function variantsFor(type: EditableSectionType): SectionVariantSpec[] {
  return SECTION_VARIANTS[type] ?? [];
}

export function defaultVariantFor(type: EditableSectionType): string {
  return SECTION_VARIANTS[type]?.[0]?.id ?? "default";
}
