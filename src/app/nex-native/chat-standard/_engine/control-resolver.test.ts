// src/app/nex-native/chat-standard/_engine/control-resolver.test.ts
//
// Theme Engine · ControlsTreatment resolver · unit tests · sealed
// 2026-10-06.
//
// Covers:
//
//   A · pure palette-in → treatment-out behaviour
//   B · the universal + button stays NEX-dark regardless of palette
//   C · auto-contrast icon colour picks correctly on light / dark
//       primaries (so send buttons stay readable across every world)
//   D · composer container is solid (never the sealed-away
//       `background: "transparent"`)
//   E · header buttons are solid (never the sealed-away
//       `${accent}22` low-alpha pattern)

import { describe, test, expect } from "vitest";
import {
  resolveControlsTreatment,
  luminance,
  iconColorOn,
  PLUS_BUTTON_INK,
  type ControlsPalette,
} from "./control-resolver";

const OCEAN: ControlsPalette = {
  primary: "#2E90B5",
  secondary: "#4FC3DC",
  highlight: "#E8F7FF",
  deep: "#0A2535",
};

const COFFEE: ControlsPalette = {
  primary: "#6B3F22",
  secondary: "#C8976B",
  highlight: "#F7E7CA",
  deep: "#2A160A",
};

const BRIGHT_LIGHT_PRIMARY: ControlsPalette = {
  // Fictional future-world palette with a very light primary ·
  // tests the auto-contrast branch (icon flips to dark).
  primary: "#FFEEAA",
  secondary: "#FFD54A",
  highlight: "#FFFFFF",
  deep: "#1A1300",
};

// ─── A · pure palette-in → treatment-out ────────────────────────────

describe("A · resolver is a pure function of its palette", () => {
  test("same palette produces structurally identical treatments", () => {
    const a = resolveControlsTreatment(OCEAN);
    const b = resolveControlsTreatment(OCEAN);
    expect(a.headerButton).toEqual(b.headerButton);
    expect(a.plusButton).toEqual(b.plusButton);
    expect(a.composerContainer).toEqual(b.composerContainer);
    expect(a.sendButton(false)).toEqual(b.sendButton(false));
  });

  test("palette is echoed back on the colors field", () => {
    const t = resolveControlsTreatment(OCEAN);
    expect(t.colors.primary).toBe(OCEAN.primary);
    expect(t.colors.deep).toBe(OCEAN.deep);
    expect(t.colors.highlight).toBe(OCEAN.highlight);
    expect(t.colors.secondary).toBe(OCEAN.secondary);
  });
});

// ─── B · universal + button is NEX-dark on every world ─────────────

describe("B · + button is a UNIVERSAL NEX semantic (dark everywhere)", () => {
  test("ocean · + background is PLUS_BUTTON_INK", () => {
    const t = resolveControlsTreatment(OCEAN);
    expect(t.plusButton.background).toBe(PLUS_BUTTON_INK);
  });

  test("coffee · + background is PLUS_BUTTON_INK (never theme-coloured)", () => {
    const t = resolveControlsTreatment(COFFEE);
    expect(t.plusButton.background).toBe(PLUS_BUTTON_INK);
  });

  test("future bright-primary world · + stays PLUS_BUTTON_INK", () => {
    const t = resolveControlsTreatment(BRIGHT_LIGHT_PRIMARY);
    expect(t.plusButton.background).toBe(PLUS_BUTTON_INK);
  });

  test("+ border is theme-tinted (primary) for integration", () => {
    const ocean = resolveControlsTreatment(OCEAN);
    const coffee = resolveControlsTreatment(COFFEE);
    expect(ocean.plusButton.border).toContain(OCEAN.primary);
    expect(coffee.plusButton.border).toContain(COFFEE.primary);
  });

  test("+ active state saturates the ring (box-shadow added)", () => {
    const t = resolveControlsTreatment(OCEAN);
    expect(t.plusButtonActive.background).toBe(PLUS_BUTTON_INK);
    expect(t.plusButtonActive.boxShadow).toContain(OCEAN.primary);
  });
});

// ─── C · auto-contrast icon colour ─────────────────────────────────

describe("C · iconColorOn picks a contrasting foreground", () => {
  test("dark primary (ocean blue) → light icon", () => {
    const t = resolveControlsTreatment(OCEAN);
    expect(t.sendButton(false).color).toBe(OCEAN.highlight);
    expect(t.headerButtonActive.color).toBe(OCEAN.highlight);
  });

  test("dark primary (coffee espresso) → light icon", () => {
    const t = resolveControlsTreatment(COFFEE);
    expect(t.sendButton(false).color).toBe(COFFEE.highlight);
  });

  test("light primary (future-world cream) → DARK icon (auto-contrast flip)", () => {
    const t = resolveControlsTreatment(BRIGHT_LIGHT_PRIMARY);
    expect(t.sendButton(false).color).toBe(BRIGHT_LIGHT_PRIMARY.deep);
    expect(t.headerButtonActive.color).toBe(BRIGHT_LIGHT_PRIMARY.deep);
  });

  test("luminance returns higher for lighter colours", () => {
    expect(luminance("#FFFFFF")).toBeGreaterThan(luminance("#000000"));
    expect(luminance("#FFEEAA")).toBeGreaterThan(luminance("#2E90B5"));
  });

  test("iconColorOn gracefully handles malformed input (returns one option)", () => {
    const result = iconColorOn("not-a-hex", "#LIGHT", "#DARK");
    expect(["#LIGHT", "#DARK"]).toContain(result);
  });
});

// ─── D · composer container is SOLID (never transparent) ───────────

describe("D · composer container is solid themed (R3 revision 2 transparency SUPERSEDED)", () => {
  test("ocean · container background is NOT 'transparent'", () => {
    const t = resolveControlsTreatment(OCEAN);
    expect(t.composerContainer.background).not.toBe("transparent");
  });

  test("ocean · container background is the theme deep anchor", () => {
    const t = resolveControlsTreatment(OCEAN);
    expect(t.composerContainer.background).toBe(OCEAN.deep);
  });

  test("coffee · container background is the theme deep anchor", () => {
    const t = resolveControlsTreatment(COFFEE);
    expect(t.composerContainer.background).toBe(COFFEE.deep);
  });

  test("container border carries the theme primary", () => {
    const t = resolveControlsTreatment(OCEAN);
    expect(t.composerContainer.border).toContain(OCEAN.primary);
  });
});

// ─── E · header buttons are SOLID (never ${accent}22 low-alpha) ────

describe("E · header R1 buttons are solid themed (${accent}22 pattern SUPERSEDED)", () => {
  test("ocean · headerButton background is solid theme deep (not translucent)", () => {
    const t = resolveControlsTreatment(OCEAN);
    expect(t.headerButton.background).toBe(OCEAN.deep);
    // Specifically guard against the removed `${accent}22` 13%-alpha
    // pattern that caused the visibility regression.
    expect(String(t.headerButton.background)).not.toContain("22");
  });

  test("headerButton border is solid theme primary (no ${primary}99 alpha)", () => {
    const t = resolveControlsTreatment(OCEAN);
    expect(t.headerButton.border).toBe(`1px solid ${OCEAN.primary}`);
  });

  test("headerButton icon colour is theme highlight (readable on dark)", () => {
    const t = resolveControlsTreatment(OCEAN);
    expect(t.headerButton.color).toBe(OCEAN.highlight);
  });

  test("headerButtonActive is solid theme primary (no gradient alpha hack)", () => {
    const t = resolveControlsTreatment(OCEAN);
    expect(t.headerButtonActive.background).toBe(OCEAN.primary);
  });
});

// ─── F · send button theme-primary (SEND_GREEN removed) ────────────

describe("F · send button draws from theme primary (SEND_GREEN SUPERSEDED)", () => {
  test("send button background IS the theme primary · never SEND_GREEN", () => {
    const ocean = resolveControlsTreatment(OCEAN);
    const coffee = resolveControlsTreatment(COFFEE);
    expect(ocean.sendButton(false).background).toBe(OCEAN.primary);
    expect(coffee.sendButton(false).background).toBe(COFFEE.primary);
    // Guard · the removed SEND_GREEN hex must never leak into any
    // resolved style.
    const SEND_GREEN = "#8FFF6E";
    expect(String(ocean.sendButton(false).background)).not.toContain(SEND_GREEN);
    expect(String(ocean.sendButton(true).background)).not.toContain(SEND_GREEN);
    expect(String(ocean.sendButton(false).border)).not.toContain(SEND_GREEN);
  });

  test("send button disabled dims opacity without changing colour", () => {
    const t = resolveControlsTreatment(OCEAN);
    const enabled = t.sendButton(false);
    const disabled = t.sendButton(true);
    expect(enabled.background).toBe(disabled.background);
    expect(disabled.opacity).toBeLessThan(1);
    expect(enabled.opacity).toBe(1);
  });

  test("send button carries a theme-primary outer glow when enabled", () => {
    const t = resolveControlsTreatment(OCEAN);
    expect(t.sendButton(false).boxShadow).toContain(OCEAN.primary);
  });
});
