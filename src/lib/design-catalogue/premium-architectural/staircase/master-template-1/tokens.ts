// NEX Design Catalogue · Master Template 1 · design tokens (Philip 2026-08-14).
//
// One source of truth for palette + type + spacing rhythm used across
// every section of Master Template 1. Sections import from here; never
// hard-code colours or type sizes in the section renderers.
//
// Read from tmp-design-reference/golden-reference-01.png:
//   - cream backdrop with warm white cards
//   - burnished tan/gold accent
//   - deep warm brown ink
//   - Playfair (serif) roman + italic for headlines
//   - Inter (sans) for body + UI
//   - generous vertical rhythm — every section breathes

export const MT1_TOKENS = {
  color: {
    surface:      "#FFFFFF",  // page background · Philip 2026-08-14 changed cream→white
    surfaceSoft:  "#FBF6EC",  // warm cream · used for chapter-break cards (ST-A01)
    surfaceCard:  "#FFFFFF",  // trust bar + enquiry form card background
    accent:       "#B58F5E",  // burnished tan/gold
    accentDeep:   "#8E6D42",  // darker accent for CTA hover / press
    ink:          "#3A3428",  // primary text
    inkMuted:     "#6B5F52",  // secondary text
    inkFaint:     "#A79C8E",  // tertiary text · eyebrows · captions
    hairline:     "#E6DFD1",  // dividers / rules
    seal:         "#F5EBDA"   // circular seal fill background
  },
  font: {
    serif: `"Playfair Display", "Cormorant Garamond", Georgia, serif`,
    sans:  `"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`
  },
  radius: {
    button:  "8px",
    card:    "14px",
    seal:    "50%"
  },
  shadow: {
    softCard:  "0 24px 60px -30px rgba(58, 52, 40, 0.24)",
    seal:      "0 12px 40px -14px rgba(181, 143, 94, 0.55)"
  },
  spacing: {
    // Philip 2026-08-14 · compact-with-details rule · reduced ~12%
    // from the original values so the whole catalogue reads as
    // deliberately dense rather than portfolio-airy.
    heroPaddingBlock:    "clamp(56px, 7vw, 104px)",
    sectionPaddingBlock: "clamp(60px, 8.5vw, 120px)",
    columnGutter:        "clamp(28px, 5vw, 72px)"
  }
} as const;

export type Mt1Tokens = typeof MT1_TOKENS;
