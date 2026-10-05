// Phase 1 unit tests · scaleConfigForTile.
//
// Pure function used by _phone-tile.tsx to adapt a theme's full
// wallpaper_config (tuned for a 390×844 chat) down to a 160–220 px
// tile. Scales particle/sparkle counts and omits mist entirely.

import { describe, expect, it } from "vitest";
import { scaleConfigForTile } from "../_phone-tile";

describe("scaleConfigForTile", () => {
  it("returns null for null input", () => {
    expect(scaleConfigForTile(null)).toBeNull();
    expect(scaleConfigForTile(undefined)).toBeNull();
  });

  it("preserves bubbleStyle verbatim", () => {
    const out = scaleConfigForTile({
      bubbleStyle: { preset: "gradient" },
    });
    expect(out?.bubbleStyle?.preset).toBe("gradient");
  });

  it("scales sparkle count by ÷4 clamped to [3, 8]", () => {
    expect(
      scaleConfigForTile({ sparkle: { color: "#FFF", count: 24 } })?.sparkle
        ?.count,
    ).toBe(6);
    expect(
      scaleConfigForTile({ sparkle: { color: "#FFF", count: 60 } })?.sparkle
        ?.count,
    ).toBe(8);
    expect(
      scaleConfigForTile({ sparkle: { color: "#FFF", count: 4 } })?.sparkle
        ?.count,
    ).toBe(3);
    expect(
      scaleConfigForTile({ sparkle: { color: "#FFF" } })?.sparkle?.count,
    ).toBe(6); // default 24 ÷ 4
  });

  it("scales particleDrift count by ÷4 clamped to [2, 6]", () => {
    expect(
      scaleConfigForTile({
        particleDrift: { color: "#FFF", count: 16 },
      })?.particleDrift?.count,
    ).toBe(4);
    expect(
      scaleConfigForTile({
        particleDrift: { color: "#FFF", count: 48 },
      })?.particleDrift?.count,
    ).toBe(6);
    expect(
      scaleConfigForTile({
        particleDrift: { color: "#FFF", count: 2 },
      })?.particleDrift?.count,
    ).toBe(2);
    expect(
      scaleConfigForTile({ particleDrift: { color: "#FFF" } })?.particleDrift
        ?.count,
    ).toBe(4); // default 16 ÷ 4
  });

  it("preserves sparkle/particle colour, size, speed verbatim", () => {
    const out = scaleConfigForTile({
      sparkle: {
        color: "rgba(255,230,160,0.85)",
        count: 26,
        size: 2,
        twinkleSeconds: 2.5,
      },
      particleDrift: {
        color: "rgba(255,170,80,0.52)",
        count: 18,
        size: 4,
        speedSeconds: 14,
      },
    });
    expect(out?.sparkle?.color).toBe("rgba(255,230,160,0.85)");
    expect(out?.sparkle?.size).toBe(2);
    expect(out?.sparkle?.twinkleSeconds).toBe(2.5);
    expect(out?.particleDrift?.color).toBe("rgba(255,170,80,0.52)");
    expect(out?.particleDrift?.size).toBe(4);
    expect(out?.particleDrift?.speedSeconds).toBe(14);
  });

  it("drops mistDrift entirely · too heavy for tile size", () => {
    const out = scaleConfigForTile({
      mistDrift: { color: "rgba(220,235,225,0.45)", count: 8 },
      sparkle: { color: "#FFF", count: 24 },
    });
    expect(out?.mistDrift).toBeUndefined();
    expect(out?.sparkle?.count).toBe(6);
  });

  it("handles the vitamins production config end-to-end (migration 137)", () => {
    const vitamins = {
      bubbleStyle: { preset: "outlined" as const },
      particleDrift: {
        color: "rgba(255,170,80,0.52)",
        count: 18,
        size: 4,
        speedSeconds: 14,
      },
      sparkle: {
        color: "rgba(255,230,160,0.85)",
        count: 26,
        size: 2,
        twinkleSeconds: 2.5,
      },
    };
    const out = scaleConfigForTile(vitamins);
    expect(out?.bubbleStyle?.preset).toBe("outlined");
    expect(out?.particleDrift?.count).toBe(4); // 18 ÷ 4 = 4
    expect(out?.sparkle?.count).toBe(6); // 26 ÷ 4 = 6
    expect(out?.mistDrift).toBeUndefined();
  });

  it("handles the motorbike production config end-to-end (migration 136)", () => {
    const motorbike = {
      bubbleStyle: { preset: "outlined" as const },
      particleDrift: {
        color: "rgba(180,200,220,0.42)",
        count: 14,
        size: 3,
        speedSeconds: 20,
      },
      sparkle: {
        color: "rgba(220,235,255,0.75)",
        count: 20,
        size: 2,
        twinkleSeconds: 3,
      },
    };
    const out = scaleConfigForTile(motorbike);
    expect(out?.bubbleStyle?.preset).toBe("outlined");
    expect(out?.particleDrift?.count).toBe(3); // 14 ÷ 4 = 3
    expect(out?.sparkle?.count).toBe(5); // 20 ÷ 4 = 5
  });

  it("omitted fields stay omitted · doesn't invent properties", () => {
    const out = scaleConfigForTile({ bubbleStyle: { preset: "pill" } });
    expect(out?.sparkle).toBeUndefined();
    expect(out?.particleDrift).toBeUndefined();
    expect(out?.mistDrift).toBeUndefined();
  });
});
