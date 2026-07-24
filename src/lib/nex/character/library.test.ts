// Character Library — schema, loader, matcher, alternative picker.

import { describe, it, expect } from "vitest";
import { findEntry, pickAlternative, loadCharacterLibrary, libraryStats, listByCategory, _clearLibraryCache } from "./library";
import type { CompiledEntry } from "./types";

describe("Character library loader", () => {
  it("loads core volume without throwing", () => {
    _clearLibraryCache();
    const entries = loadCharacterLibrary();
    expect(entries.length).toBeGreaterThan(50);
    // Every entry must have at least one pattern + one alternative
    for (const e of entries) {
      expect(e.patterns.length).toBeGreaterThan(0);
      expect(e.alternatives.length).toBeGreaterThan(0);
      expect(e.intent).toMatch(/^[a-z0-9_]+$/);
    }
  });

  it("no duplicate intents across volumes", () => {
    _clearLibraryCache();
    const seen = new Set<string>();
    for (const e of loadCharacterLibrary()) {
      expect(seen.has(e.intent)).toBe(false);
      seen.add(e.intent);
    }
  });

  it("sorts entries by priority desc so specific patterns win", () => {
    const entries = loadCharacterLibrary();
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i - 1].priority).toBeGreaterThanOrEqual(entries[i].priority);
    }
  });

  it("stats report totals per category and tone", () => {
    const s = libraryStats();
    expect(s.total_entries).toBeGreaterThan(50);
    expect(s.total_alternatives).toBeGreaterThanOrEqual(s.total_entries);
    expect(Object.keys(s.by_category).length).toBeGreaterThan(3);
  });

  it("listByCategory groups without loss", () => {
    const g = listByCategory();
    let total = 0;
    for (const v of Object.values(g)) total += v.length;
    expect(total).toBe(loadCharacterLibrary().length);
  });
});

describe("findEntry — matcher", () => {
  it("resolves 'how old are you' to a real entry", () => {
    const e = findEntry("how old are you");
    expect(e?.intent).toBe("how_old_are_you");
  });

  it("resolves 'good morning' via start anchor", () => {
    const e = findEntry("good morning nex");
    expect(e?.intent).toBe("good_morning");
  });

  it("returns null for unmatched input", () => {
    expect(findEntry("banana pancakes")).toBeNull();
  });

  it("priority ordering — fingers_and_toes beats how_many_fingers", () => {
    const e = findEntry("how many fingers and toes do you have");
    expect(e?.intent).toBe("fingers_and_toes");
  });
});

describe("pickAlternative — deterministic per (merchant, intent, day)", () => {
  const fakeEntry: CompiledEntry = {
    intent:       "test",
    category:     "humour",
    tone:         "playful",
    tags:         [],
    priority:     1,
    version:      1,
    patterns:     [/x/],
    alternatives: ["A", "B", "C", "D"],
    volume_id:    "test"
  };

  it("returns the single alternative when only one exists", () => {
    const single: CompiledEntry = { ...fakeEntry, alternatives: ["Only"] };
    expect(pickAlternative(single, { merchantSlug: "m" })).toBe("Only");
  });

  it("same (merchant, day) returns the same alternative", () => {
    const day = new Date("2026-07-23T09:00:00Z");
    const a = pickAlternative(fakeEntry, { merchantSlug: "phil", now: day });
    const b = pickAlternative(fakeEntry, { merchantSlug: "phil", now: day });
    expect(a).toBe(b);
  });

  it("different day rotates the alternative (usually)", () => {
    const results = new Set<string>();
    for (let d = 1; d <= 20; d++) {
      const day = new Date(`2026-07-${String(d).padStart(2, "0")}T09:00:00Z`);
      results.add(pickAlternative(fakeEntry, { merchantSlug: "phil", now: day }));
    }
    // 20 days across 4 alternatives — should touch at least 2 unique
    expect(results.size).toBeGreaterThan(1);
  });

  it("different merchants can get different alternatives", () => {
    const day = new Date("2026-07-23T09:00:00Z");
    const results = new Set<string>();
    for (const slug of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      results.add(pickAlternative(fakeEntry, { merchantSlug: slug, now: day }));
    }
    expect(results.size).toBeGreaterThan(1);
  });
});
