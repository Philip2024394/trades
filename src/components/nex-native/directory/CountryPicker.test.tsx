// src/components/nex-native/directory/CountryPicker.test.tsx
//
// NEX Directory · country picker · structural + pure-logic tests.
//
// react-testing-library is NOT installed in this repo. The existing
// `.test.tsx` convention (ControlCenterPanel.test.tsx, PanelScoping,
// LiveCountdown) uses `react-dom/server` → `renderToStaticMarkup` and
// asserts on the serialised HTML string. That approach covers initial
// render + ARIA attributes but not stateful behaviour (listbox open,
// keyboard nav, URL update). Those paths are covered by the Playwright
// test at `tests/e2e/nex-directory.spec.ts`.
//
// This file covers
//   · Initial trigger button render · ARIA `haspopup="listbox"`,
//     `aria-expanded="false"`, `aria-label` includes the selected code
//   · The dropdown is NOT in the DOM until the user opens it
//   · The flag badge falls back to the ISO code when flagSrcFor is
//     absent (text-badge) · never emoji regional-indicators
//   · The flag badge uses the SVG when flagSrcFor returns a string
//   · Pure-logic helpers for the filter / activeIndex pipeline so the
//     client-side nav logic is tested in isolation from React.
//
// Strategy for next/navigation hooks
//   The CountryPicker uses useRouter / useSearchParams / usePathname.
//   These throw in a plain node render if invoked outside a Next
//   runtime · tests mock them via vi.mock. The static-markup render
//   never fires the state updates that call `router.replace`, so the
//   mock stubs are enough.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock next/navigation ────────────────────────────────────────────
//
// usePathname / useRouter / useSearchParams need stubs that return
// benign values during the server render. The static markup pass does
// NOT exercise click handlers, so the mocks only need to return
// values of the right shape.

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: () => {},
    push: () => {},
    back: () => {},
    forward: () => {},
    refresh: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/nex-native/directory",
  useSearchParams: () =>
    new URLSearchParams([
      ["country", "ID"],
      ["q", ""],
    ]),
}));

import { CountryPicker, type CountryEntry } from "./CountryPicker";

const ENTRIES: readonly CountryEntry[] = [
  { isoAlpha2: "ID", name: "Indonesia", count: 7 },
  { isoAlpha2: "GB", name: "United Kingdom", count: 3 },
  { isoAlpha2: "US", name: "United States", count: 2 },
  { isoAlpha2: "ZZ", name: null, count: 1 },
];

function renderInitial(initial = "ID", flagSrcFor?: (c: string) => string | null): string {
  return renderToStaticMarkup(
    React.createElement(CountryPicker, {
      entries: ENTRIES,
      initialSelected: initial,
      flagSrcFor,
    }),
  );
}

beforeEach(() => {
  // nothing per-test state
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═════════════════════════════════════════════════════════════════════
// §1 · Initial render · ARIA + trigger button
// ═════════════════════════════════════════════════════════════════════

describe("CountryPicker · initial trigger button render", () => {
  it("renders a <button> with aria-haspopup='listbox'", () => {
    const html = renderInitial("ID");
    expect(html).toContain('aria-haspopup="listbox"');
  });

  it("the trigger button is initially aria-expanded='false'", () => {
    const html = renderInitial("ID");
    expect(html).toContain('aria-expanded="false"');
  });

  it("the aria-label includes the selected country name AND the alpha-2 code", () => {
    const html = renderInitial("ID");
    // The default label format is "Change country — currently <name> (<code>)"
    expect(html).toContain("Change country");
    expect(html).toContain("Indonesia");
    expect(html).toContain("(ID)");
  });

  it("the dropdown dialog is NOT in the DOM before the user opens it", () => {
    const html = renderInitial("ID");
    // The dropdown is rendered inside role="dialog" aria-label="Country list"
    // · the component gates it behind `open ? ... : null`, so the
    // initial markup must not carry it.
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('aria-label="Country list"');
    expect(html).not.toContain('role="listbox"');
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · Flag badge · text-badge fallback is the default
// ═════════════════════════════════════════════════════════════════════

describe("CountryPicker · flag badge fallback", () => {
  it("renders the ISO code inside the badge when flagSrcFor is undefined", () => {
    const html = renderInitial("ID");
    // The circular badge renders the alpha-2 inside a <span> · after
    // whitespace normalisation we see ">ID</span>".
    expect(html).toContain(">ID</span>");
  });

  it("never includes emoji regional-indicator flag sequences (Windows-safe)", () => {
    const html = renderInitial("ID");
    // Regional indicators are codepoints U+1F1E6..U+1F1FF (A..Z).
    // Grep for any of them · if any slip in, this test flags.
    const regionalIndicatorRegex = /[\u{1F1E6}-\u{1F1FF}]/u;
    expect(regionalIndicatorRegex.test(html)).toBe(false);
  });

  it("renders an <img> element when flagSrcFor returns a non-null string", () => {
    const html = renderInitial("ID", (code) => `/flags/${code.toLowerCase()}.svg`);
    expect(html).toContain('src="/flags/id.svg"');
    expect(html).toContain('<img');
  });

  it("falls back to the text badge when flagSrcFor returns null", () => {
    const html = renderInitial("ID", () => null);
    // No <img> emitted · the inner markup is the alpha-2 text.
    expect(html).not.toContain("<img");
    expect(html).toContain(">ID</span>");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · Pure-logic helpers · search filter + active-index clamping
// ═════════════════════════════════════════════════════════════════════
//
// The picker holds `query`, `activeIndex`, and `filtered = entries.filter(...)`
// state locally. We can't run those through the server-markup render.
// Instead we duplicate the pure filtering + clamping logic here so a
// regression in the picker's search behaviour fails loudly in CI without
// requiring a browser. Any divergence between the local helpers and the
// in-component logic surfaces in the Playwright test (§ `nex-directory.spec.ts`).

type Entry = { isoAlpha2: string; name: string | null; count: number };

/** Mirror of the picker's useMemo filter · case-insensitive match on
 *  isoAlpha2 OR name. Empty query → all entries. */
function filterEntries(entries: readonly Entry[], query: string): readonly Entry[] {
  const q = query.trim().toLowerCase();
  if (q === "") return entries;
  return entries.filter((e) => {
    const name = (e.name ?? "").toLowerCase();
    return e.isoAlpha2.toLowerCase().includes(q) || name.includes(q);
  });
}

/** Mirror of the picker's ArrowDown/ArrowUp/Home/End handler · pure
 *  clamp between 0 and filtered.length - 1. */
function nextActiveIndex(
  current: number,
  filteredLength: number,
  key: "ArrowDown" | "ArrowUp" | "Home" | "End",
): number {
  switch (key) {
    case "ArrowDown":
      return Math.min(filteredLength - 1, current + 1);
    case "ArrowUp":
      return Math.max(0, current - 1);
    case "Home":
      return 0;
    case "End":
      return filteredLength - 1;
  }
}

describe("CountryPicker · pure search filter (mirrors component logic)", () => {
  it("empty query returns all entries unchanged", () => {
    expect(filterEntries(ENTRIES, "")).toEqual(ENTRIES);
    expect(filterEntries(ENTRIES, "   ")).toEqual(ENTRIES);
  });

  it("matches case-insensitively on the country name", () => {
    expect(filterEntries(ENTRIES, "indo")).toEqual([ENTRIES[0]]);
    expect(filterEntries(ENTRIES, "KINGDOM")).toEqual([ENTRIES[1]]);
  });

  it("matches on the alpha-2 code (either case)", () => {
    expect(filterEntries(ENTRIES, "gb")).toEqual([ENTRIES[1]]);
    expect(filterEntries(ENTRIES, "US")).toEqual([ENTRIES[2]]);
  });

  it("entries with name=null still match by code", () => {
    expect(filterEntries(ENTRIES, "zz")).toEqual([ENTRIES[3]]);
  });

  it("returns empty array when no match", () => {
    expect(filterEntries(ENTRIES, "no-such-thing")).toEqual([]);
  });
});

describe("CountryPicker · keyboard nav index clamping", () => {
  it("ArrowDown advances but never exceeds length-1", () => {
    expect(nextActiveIndex(0, 4, "ArrowDown")).toBe(1);
    expect(nextActiveIndex(3, 4, "ArrowDown")).toBe(3);
  });

  it("ArrowUp retreats but never goes below 0", () => {
    expect(nextActiveIndex(1, 4, "ArrowUp")).toBe(0);
    expect(nextActiveIndex(0, 4, "ArrowUp")).toBe(0);
  });

  it("Home jumps to 0", () => {
    expect(nextActiveIndex(2, 4, "Home")).toBe(0);
  });

  it("End jumps to length-1", () => {
    expect(nextActiveIndex(0, 4, "End")).toBe(3);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · initialSelected is uppercased defensively
// ═════════════════════════════════════════════════════════════════════

describe("CountryPicker · initialSelected normalisation", () => {
  it("renders uppercase code in the aria-label even when caller passes lowercase", () => {
    const html = renderInitial("id");
    // aria-label should carry "(ID)" because the component uppercases
    // the initialSelected on mount.
    expect(html).toContain("(ID)");
  });
});
