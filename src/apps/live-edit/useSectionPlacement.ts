// useSectionPlacement — hook every EditableSection uses to read its
// current variant + slot from context. This is what makes variant-
// aware placement Just Work: when a merchant drags a Services
// section from slot_services (3col) to slot_hero (which prefers 3col
// too) the section re-reads its variant here and re-renders.
//
// Returns a safe default when there's no shell (public preview).

"use client";

import { useEditModeOptional } from "./EditModeContext";

export type SectionPlacementRead = {
  slotId: string | null;
  variant: string;
};

export function useSectionPlacement(
  sectionId: string,
  fallbackVariant: string
): SectionPlacementRead {
  const ctx = useEditModeOptional();
  const placement = ctx?.placements[sectionId];
  if (!placement) {
    return { slotId: null, variant: fallbackVariant };
  }
  return { slotId: placement.slotId, variant: placement.variant };
}
