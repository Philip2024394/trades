// Materials · design tokens (Phase 2 UI Foundation · Philip 2026-07-28)
// Locked palette + spacing per the "Premium UI Foundation" spec.
// Every Materials surface reads from this file so a token change is one edit.

export const MT = {
  // Colour
  bg:              "#F6F3ED",
  card:            "#FFFFFF",
  primary:         "#F58220",
  primaryHover:    "#DC7217",
  primarySoft:     "#FDECD9",
  primaryBorder:   "#F9C89A",
  darkGrey:        "#3F434A",
  midGrey:         "#5B616B",
  secondaryGrey:   "#777D86",
  border:          "#D8D8D8",
  borderLight:     "#ECEAE4",
  success:         "#4F9F5B",
  successSoft:     "#E5F1E7",

  // Radius (8px grid friendly)
  radiusPill:      9999,
  radiusLg:        20,
  radiusMd:        14,
  radiusSm:        10,

  // Shadows — very soft
  shadowSoft:      "0 2px 6px rgba(15,17,21,0.04), 0 1px 2px rgba(15,17,21,0.03)",
  shadowCard:      "0 4px 14px rgba(15,17,21,0.05), 0 2px 4px rgba(15,17,21,0.03)",
  shadowLift:      "0 10px 28px rgba(15,17,21,0.09), 0 4px 10px rgba(15,17,21,0.05)",

  // Typography sizes
  fontPageTitle:   26,
  fontSection:     18,
  fontCardTitle:   17,
  fontBody:        13.5,
  fontCaption:     11.5,

  // Motion
  ease:            "cubic-bezier(0.16, 1, 0.3, 1)",
  fast:            "150ms",
  medium:          "220ms",
  slow:            "380ms",
} as const;
