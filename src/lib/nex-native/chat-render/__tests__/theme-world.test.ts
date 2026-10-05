// Phase 0 unit tests · chat-render/theme-world helpers.
//
// resolveBubbleShape is a pure function copied byte-for-byte from
// _portrait-bloom-shell.tsx:3541-3620. If the primitive ever drifts
// from the shell's helper this test is the fastest signal.
//
// Expected values are hand-coded against the shell's branches so a
// change in either side forces a conscious review.

import { describe, expect, it } from "vitest";
import {
  hexToRgb,
  resolveBubbleShape,
  themeRimSoft,
  themeRimStrong,
  type BubbleShapeInput,
} from "../theme-world";

const BUBBLE_RIM = "#00AFFF";
const ACCENT_MINE = "rgba(0,159,239,0.26)";
const ACCENT_PEER = "rgba(30,44,66,0.72)";

function baseInput(
  overrides: Partial<BubbleShapeInput> = {},
): BubbleShapeInput {
  return {
    preset: "classic",
    mine: true,
    deleted: false,
    bubbleRim: BUBBLE_RIM,
    accentGlassMine: ACCENT_MINE,
    accentGlassPeer: ACCENT_PEER,
    ...overrides,
  };
}

describe("hexToRgb", () => {
  it("parses six-char hex", () => {
    expect(hexToRgb("#00AFFF")).toEqual({ r: 0, g: 175, b: 255 });
    expect(hexToRgb("00AFFF")).toEqual({ r: 0, g: 175, b: 255 });
  });

  it("expands three-char hex", () => {
    expect(hexToRgb("#F0F")).toEqual({ r: 255, g: 0, b: 255 });
    expect(hexToRgb("abc")).toEqual({ r: 170, g: 187, b: 204 });
  });
});

describe("themeRimStrong / themeRimSoft", () => {
  it("themeRimStrong is 0.85 alpha", () => {
    expect(themeRimStrong("#00AFFF")).toBe("rgba(0,175,255,0.85)");
  });
  it("themeRimSoft is 0.5 alpha", () => {
    expect(themeRimSoft("#00AFFF")).toBe("rgba(0,175,255,0.5)");
  });
});

describe("resolveBubbleShape · classic preset", () => {
  it("mine · classic → sender-tail geometry + accent glass", () => {
    expect(resolveBubbleShape(baseInput({ preset: "classic", mine: true }))).toEqual({
      borderRadius: "14px 14px 4px 14px",
      background: ACCENT_MINE,
      border: `1px solid rgba(0,175,255,0.85)`,
      boxShadow:
        "0 0 14px rgba(0,159,239,0.25), 0 6px 20px rgba(0,0,0,0.45)",
    });
  });
  it("peer · classic → receiver-tail geometry + peer glass", () => {
    expect(resolveBubbleShape(baseInput({ preset: "classic", mine: false }))).toEqual({
      borderRadius: "14px 14px 14px 4px",
      background: ACCENT_PEER,
      border: "1px solid rgba(150,160,180,0.55)",
      boxShadow: "0 6px 22px rgba(0,0,0,0.55)",
    });
  });
});

describe("resolveBubbleShape · pill preset", () => {
  it("mine · pill → fully rounded, strong rim", () => {
    expect(resolveBubbleShape(baseInput({ preset: "pill", mine: true }))).toEqual({
      borderRadius: "24px",
      background: ACCENT_MINE,
      border: "1px solid rgba(0,175,255,0.85)",
      boxShadow:
        "0 0 14px rgba(0,159,239,0.25), 0 6px 20px rgba(0,0,0,0.45)",
    });
  });
  it("peer · pill → fully rounded, soft rim", () => {
    expect(resolveBubbleShape(baseInput({ preset: "pill", mine: false }))).toEqual({
      borderRadius: "24px",
      background: ACCENT_PEER,
      border: "1px solid rgba(150,160,180,0.55)",
      boxShadow: "0 6px 22px rgba(0,0,0,0.55)",
    });
  });
});

describe("resolveBubbleShape · square preset", () => {
  it("mine · square → 4px radius", () => {
    expect(resolveBubbleShape(baseInput({ preset: "square", mine: true }))).toMatchObject({
      borderRadius: "4px",
      background: ACCENT_MINE,
    });
  });
  it("peer · square → 4px radius + soft rim", () => {
    expect(resolveBubbleShape(baseInput({ preset: "square", mine: false }))).toMatchObject({
      borderRadius: "4px",
      border: "1px solid rgba(150,160,180,0.55)",
    });
  });
});

describe("resolveBubbleShape · outlined preset", () => {
  it("mine · outlined → transparent bg, 1.5px strong rim, soft blue glow", () => {
    expect(resolveBubbleShape(baseInput({ preset: "outlined", mine: true }))).toEqual({
      borderRadius: "12px",
      background: "rgba(2,9,20,0.30)",
      border: "1.5px solid rgba(0,175,255,0.85)",
      boxShadow: "0 0 10px rgba(0,159,239,0.18)",
    });
  });
  it("peer · outlined → transparent bg, 1.5px soft rim", () => {
    expect(resolveBubbleShape(baseInput({ preset: "outlined", mine: false }))).toEqual({
      borderRadius: "12px",
      background: "rgba(2,9,20,0.30)",
      border: "1.5px solid rgba(150,160,180,0.7)",
      boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
    });
  });
});

describe("resolveBubbleShape · gradient preset", () => {
  it("mine · gradient → sender-tail geometry + accent-tinted gradient", () => {
    const out = resolveBubbleShape(baseInput({ preset: "gradient", mine: true }));
    expect(out.borderRadius).toBe("16px 16px 6px 16px");
    expect(out.background).toContain("linear-gradient(135deg, rgba(0,175,255,0.85)55");
    expect(out.border).toBe("1px solid rgba(0,175,255,0.85)");
  });
  it("peer · gradient → receiver-tail geometry + neutral gradient", () => {
    const out = resolveBubbleShape(baseInput({ preset: "gradient", mine: false }));
    expect(out.borderRadius).toBe("16px 16px 16px 6px");
    expect(out.background).toContain("rgba(150,160,180,0.32)");
    expect(out.border).toBe("1px solid rgba(150,160,180,0.55)");
  });
});

describe("resolveBubbleShape · deleted tombstone", () => {
  it("deleted classic/outlined/gradient → 14px radius dashed rim", () => {
    for (const preset of ["classic", "outlined", "gradient"] as const) {
      expect(
        resolveBubbleShape(baseInput({ preset, deleted: true })),
      ).toEqual({
        borderRadius: "14px",
        background: "rgba(20,26,38,0.48)",
        border: "1px dashed rgba(139,169,209,0.35)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
      });
    }
  });
  it("deleted square → 4px radius dashed rim", () => {
    expect(
      resolveBubbleShape(baseInput({ preset: "square", deleted: true })),
    ).toMatchObject({ borderRadius: "4px" });
  });
  it("deleted pill → 20px radius dashed rim", () => {
    expect(
      resolveBubbleShape(baseInput({ preset: "pill", deleted: true })),
    ).toMatchObject({ borderRadius: "20px" });
  });
  it("deleted tombstone ignores mine/peer glass colours", () => {
    const mine = resolveBubbleShape(
      baseInput({ preset: "classic", deleted: true, mine: true }),
    );
    const peer = resolveBubbleShape(
      baseInput({ preset: "classic", deleted: true, mine: false }),
    );
    expect(mine).toEqual(peer);
  });
});

describe("resolveBubbleShape · exhaustive coverage", () => {
  const presets: BubbleShapeInput["preset"][] = [
    "classic",
    "pill",
    "square",
    "outlined",
    "gradient",
  ];
  it("every preset × mine × deleted branch returns a complete style object", () => {
    for (const preset of presets) {
      for (const mine of [true, false]) {
        for (const deleted of [false, true]) {
          const style = resolveBubbleShape(baseInput({ preset, mine, deleted }));
          expect(style.borderRadius).toBeTruthy();
          expect(style.background).toBeTruthy();
          expect(style.border).toBeTruthy();
          expect(style.boxShadow).toBeTruthy();
        }
      }
    }
  });
});
