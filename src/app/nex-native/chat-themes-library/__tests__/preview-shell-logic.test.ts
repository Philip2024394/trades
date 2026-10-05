// Phase 2 unit tests · pure helpers used by ImmersivePreviewShell.

import { describe, expect, it } from "vitest";
import {
  appendLocalMessage,
  buildPreviewUrl,
  canSendLocalMessage,
  evaluateSwipe,
  LOCAL_MESSAGE_LIMIT,
  navigateIndex,
  type LocalMessage,
} from "../_preview-shell-logic";

const empty: LocalMessage[] = [];
const seedTwo: LocalMessage[] = [
  { id: "m1", text: "one", mine: true },
  { id: "m2", text: "two", mine: true },
];
const seedThree: LocalMessage[] = [
  { id: "m1", text: "one", mine: true },
  { id: "m2", text: "two", mine: true },
  { id: "m3", text: "three", mine: true },
];

describe("appendLocalMessage", () => {
  it("appends when under the limit", () => {
    const out = appendLocalMessage(empty, "hello");
    expect(out).toHaveLength(1);
    expect(out[0]?.text).toBe("hello");
    expect(out[0]?.mine).toBe(true);
  });

  it("trims whitespace and drops empty input", () => {
    expect(appendLocalMessage(empty, "   ").length).toBe(0);
    expect(appendLocalMessage(empty, "")).toEqual(empty);
    expect(appendLocalMessage(empty, "  hi  ")[0]?.text).toBe("hi");
  });

  it("stops at LOCAL_MESSAGE_LIMIT", () => {
    expect(LOCAL_MESSAGE_LIMIT).toBe(3);
    expect(appendLocalMessage(seedThree, "four")).toBe(seedThree); // same ref · no mutation
    expect(appendLocalMessage(seedTwo, "three").length).toBe(3);
  });

  it("never mutates the input array", () => {
    const copy = [...seedTwo];
    appendLocalMessage(seedTwo, "three");
    expect(seedTwo).toEqual(copy);
  });
});

describe("canSendLocalMessage", () => {
  it("true below the limit", () => {
    expect(canSendLocalMessage(empty)).toBe(true);
    expect(canSendLocalMessage(seedTwo)).toBe(true);
  });
  it("false at the limit", () => {
    expect(canSendLocalMessage(seedThree)).toBe(false);
  });
});

describe("evaluateSwipe", () => {
  it("stays none for sub-threshold deltas", () => {
    const d = evaluateSwipe(10, 300);
    expect(d.direction).toBe("none");
    expect(d.progress).toBeCloseTo(10 / 48, 3);
  });

  it("commits prev on a slow but long rightward swipe", () => {
    const d = evaluateSwipe(60, 500);
    expect(d.direction).toBe("prev");
    expect(d.progress).toBe(1);
  });

  it("commits next on a slow but long leftward swipe", () => {
    const d = evaluateSwipe(-60, 500);
    expect(d.direction).toBe("next");
    expect(d.progress).toBe(1);
  });

  it("commits on a fast short swipe (velocity gate)", () => {
    // 30 px in 50 ms = 0.6 px/ms > 0.5 threshold AND |30| >= 24
    const d = evaluateSwipe(-30, 50);
    expect(d.direction).toBe("next");
  });

  it("rejects a fast swipe shorter than 24 px", () => {
    const d = evaluateSwipe(-20, 20); // 1.0 px/ms but only 20 px
    expect(d.direction).toBe("none");
  });

  it("handles zero elapsed time without dividing by zero", () => {
    const d = evaluateSwipe(100, 0);
    // 100 ≥ 48 so distance gate commits even without a velocity signal
    expect(d.direction).toBe("prev");
  });
});

describe("navigateIndex", () => {
  it("wraps prev at zero", () => {
    expect(navigateIndex(0, "prev", 5)).toBe(4);
  });
  it("wraps next at end", () => {
    expect(navigateIndex(4, "next", 5)).toBe(0);
  });
  it("walks forward normally", () => {
    expect(navigateIndex(2, "next", 5)).toBe(3);
  });
  it("walks backward normally", () => {
    expect(navigateIndex(2, "prev", 5)).toBe(1);
  });
  it("returns null for an empty array", () => {
    expect(navigateIndex(0, "next", 0)).toBeNull();
  });
});

describe("buildPreviewUrl", () => {
  it("adds preview param when opening", () => {
    expect(buildPreviewUrl("/x", "", "theme-7")).toBe("/x?preview=theme-7");
  });

  it("removes preview param when closing", () => {
    expect(buildPreviewUrl("/x", "preview=theme-7", null)).toBe("/x");
  });

  it("preserves other params alongside", () => {
    expect(buildPreviewUrl("/x", "e=theme_updated&m=theme-0", "theme-3")).toBe(
      "/x?e=theme_updated&m=theme-0&preview=theme-3",
    );
  });

  it("replaces an existing preview id", () => {
    expect(buildPreviewUrl("/x", "preview=old", "new")).toBe("/x?preview=new");
  });

  it("returns bare pathname when all params removed", () => {
    expect(buildPreviewUrl("/x", "preview=t", null)).toBe("/x");
  });
});
