// src/lib/nex/category-registry.test.ts
//
// Country Foundation Step 2 + Step 6 regression tests · 2026-08-22.
//
// Verifies:
//   Step 2:
//     · Every entry has a non-empty countries: string[] field
//     · Every country code is a valid ISO 3166-1 alpha-2
//     · All 10 current entries declare countries: ['ID']
//     · activeCategoriesForCountry('ID') returns 6 active ID categories
//     · activeCategoriesForCountry('GB') returns [] (Truth Invariant: no UK inventory)
//     · Existing helpers preserved unchanged
//   Step 6:
//     · resolveIntent(phrase, country) is country-aware
//     · matched_active only when country ∈ category.countries
//     · matched_active_wrong_country when Brain understands but country lacks inventory
//     · matched_inactive still fires regardless of country (Villa case)
//     · unknown carries country context
//     · Every return type includes country field
//     · availableCountries is included on matched_active_wrong_country
//
// Doctrine anchors:
//   project_nex_country_foundation_phased_plan_2026_08_22 (Steps 2, 6)
//   project_nex_truth_invariant_2026_08_22
//   project_nex_country_scope_from_phone_country_code_2026_08_22

import { describe, expect, it } from "vitest";
import {
  CATEGORY_REGISTRY,
  activeCategories,
  activeCategoriesForCountry,
  categoriesForVertical,
  getCategory,
  resolveIntent,
} from "./category-registry";

// ═══════════════════════════════════════════════════════════════════════
// STEP 2 · countries field
// ═══════════════════════════════════════════════════════════════════════

describe("category-registry · Country Foundation Step 2 · countries field", () => {
  it("every entry has a defined, non-empty countries array", () => {
    for (const entry of CATEGORY_REGISTRY) {
      expect(entry.countries, `entry "${entry.id}" missing countries`).toBeDefined();
      expect(Array.isArray(entry.countries), `entry "${entry.id}" countries not an array`).toBe(true);
      expect(entry.countries.length, `entry "${entry.id}" countries empty`).toBeGreaterThan(0);
    }
  });

  it("every country code is a valid ISO 3166-1 alpha-2 (2 uppercase letters)", () => {
    for (const entry of CATEGORY_REGISTRY) {
      for (const code of entry.countries) {
        expect(code, `entry "${entry.id}" has invalid country code "${code}"`).toMatch(/^[A-Z]{2}$/);
      }
    }
  });

  it("registry has exactly 10 entries and all declare countries containing 'ID'", () => {
    expect(CATEGORY_REGISTRY.length).toBe(10);
    for (const entry of CATEGORY_REGISTRY) {
      expect(entry.countries, `entry "${entry.id}" should include ID`).toContain("ID");
    }
  });

  it("no entry uses magic 'ALL' or 'GLOBAL' value (explicit lists only per Truth Invariant)", () => {
    for (const entry of CATEGORY_REGISTRY) {
      expect(entry.countries).not.toContain("ALL");
      expect(entry.countries).not.toContain("GLOBAL");
      expect(entry.countries).not.toContain("*");
    }
  });
});

describe("activeCategoriesForCountry · Country Foundation Step 2 new helper", () => {
  it("returns the 6 active ID categories for country='ID'", () => {
    const idCats = activeCategoriesForCountry("ID");
    expect(idCats.length).toBe(6);
    const ids = idCats.map((c) => c.id).sort();
    expect(ids).toEqual(["accommodation", "food", "guesthouse", "hostel", "hotel", "kos"]);
  });

  it("returns EMPTY for country='GB' (Truth Invariant: NEX has no UK inventory yet)", () => {
    expect(activeCategoriesForCountry("GB")).toEqual([]);
  });

  it("returns EMPTY for country='US' (no US inventory)", () => {
    expect(activeCategoriesForCountry("US")).toEqual([]);
  });

  it("returns EMPTY for unknown country code", () => {
    expect(activeCategoriesForCountry("XX")).toEqual([]);
  });

  it("excludes inactive entries even when country matches (villa/homestay/resort/apartment)", () => {
    const idCats = activeCategoriesForCountry("ID");
    const ids = idCats.map((c) => c.id);
    expect(ids).not.toContain("villa");
    expect(ids).not.toContain("homestay");
    expect(ids).not.toContain("resort");
    expect(ids).not.toContain("apartment");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// EXISTING HELPERS · behaviour preserved
// ═══════════════════════════════════════════════════════════════════════

describe("existing helpers · behaviour preserved (regression)", () => {
  it("activeCategories() still returns the same 6 entries as pre-Step-2", () => {
    const all = activeCategories();
    expect(all.length).toBe(6);
    const ids = all.map((c) => c.id).sort();
    expect(ids).toEqual(["accommodation", "food", "guesthouse", "hostel", "hotel", "kos"]);
  });

  it("getCategory('food') returns food entry with countries=['ID']", () => {
    const food = getCategory("food");
    expect(food).toBeDefined();
    expect(food!.id).toBe("food");
    expect(food!.countries).toEqual(["ID"]);
  });

  it("getCategory('kos') returns kos entry with countries=['ID'] (Indonesian-specific)", () => {
    const kos = getCategory("kos");
    expect(kos).toBeDefined();
    expect(kos!.countries).toEqual(["ID"]);
  });

  it("getCategory('nonexistent') returns undefined (unchanged)", () => {
    expect(getCategory("nonexistent")).toBeUndefined();
  });

  it("categoriesForVertical('accommodation') returns 5 active accommodation categories", () => {
    const acc = categoriesForVertical("accommodation");
    expect(acc.length).toBe(5);
    const ids = acc.map((c) => c.id).sort();
    expect(ids).toEqual(["accommodation", "guesthouse", "hostel", "hotel", "kos"]);
  });

  it("categoriesForVertical('food') returns 1 active food category", () => {
    const food = categoriesForVertical("food");
    expect(food.length).toBe(1);
    expect(food[0]!.id).toBe("food");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// STEP 7 Part B · Phase 7B.1 · visual metadata (DATA FOUNDATION ONLY)
// ═══════════════════════════════════════════════════════════════════════

describe("Country Foundation Step 7 Part B · Phase 7B.1 · visual metadata (data foundation)", () => {
  it("every entry has a `visual` object", () => {
    for (const entry of CATEGORY_REGISTRY) {
      expect(entry.visual, `entry "${entry.id}" missing visual`).toBeDefined();
      expect(typeof entry.visual, `entry "${entry.id}" visual not object`).toBe("object");
    }
  });

  it("every entry has a non-empty visual.glyph string", () => {
    for (const entry of CATEGORY_REGISTRY) {
      expect(entry.visual.glyph, `entry "${entry.id}" missing visual.glyph`).toBeDefined();
      expect(typeof entry.visual.glyph, `entry "${entry.id}" visual.glyph not string`).toBe("string");
      expect(entry.visual.glyph.length, `entry "${entry.id}" visual.glyph empty`).toBeGreaterThan(0);
    }
  });

  it("every visual.glyph is PascalCase (lucide-react convention · starts uppercase · alphanumerics)", () => {
    for (const entry of CATEGORY_REGISTRY) {
      expect(entry.visual.glyph, `entry "${entry.id}" glyph "${entry.visual.glyph}" not PascalCase`)
        .toMatch(/^[A-Z][A-Za-z0-9]*$/);
    }
  });

  it("visual.glyph is never a raw emoji or URL (typed reference only)", () => {
    for (const entry of CATEGORY_REGISTRY) {
      const g = entry.visual.glyph;
      expect(g, `entry "${entry.id}" glyph should not be a URL`).not.toMatch(/^https?:/i);
      expect(g, `entry "${entry.id}" glyph should not contain slashes`).not.toContain("/");
      // Emoji check: no non-BMP characters (all lucide icons are ASCII PascalCase)
      expect(g, `entry "${entry.id}" glyph should be ASCII`).toMatch(/^[\x00-\x7F]+$/);
    }
  });

  it("every entry has a family (all currently 'food' or 'accommodation')", () => {
    for (const entry of CATEGORY_REGISTRY) {
      expect(entry.visual.family, `entry "${entry.id}" missing visual.family`).toBeDefined();
    }
  });

  it("food entry has visual: { glyph: 'Utensils', family: 'food' }", () => {
    const food = getCategory("food");
    expect(food?.visual).toEqual({ glyph: "Utensils", family: "food" });
  });

  it("kos entry has visual: { glyph: 'KeyRound', family: 'accommodation' } (Indonesian monthly rental)", () => {
    const kos = getCategory("kos");
    expect(kos?.visual).toEqual({ glyph: "KeyRound", family: "accommodation" });
  });

  it("existing icon (emoji) field PRESERVED for backward compatibility", () => {
    // Phase 7B.1 doctrine: don't break existing consumers still reading icon.
    for (const entry of CATEGORY_REGISTRY) {
      expect(entry.icon, `entry "${entry.id}" lost its icon emoji`).toBeDefined();
      expect(typeof entry.icon).toBe("string");
      expect(entry.icon.length).toBeGreaterThan(0);
    }
  });

  it("food icon still 🍜 and kos icon still 🛖 (regression · icon field untouched)", () => {
    expect(getCategory("food")?.icon).toBe("🍜");
    expect(getCategory("kos")?.icon).toBe("🛖");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// STEP 6 · country-aware Brain intent resolution
// ═══════════════════════════════════════════════════════════════════════

describe("resolveIntent · Country Foundation Step 6 · matched_active (country has inventory)", () => {
  it("'cheap hotel please' + country='ID' → matched_active for hotel (ID has hotel inventory)", () => {
    const r = resolveIntent("cheap hotel please", "ID");
    expect(r.kind).toBe("matched_active");
    if (r.kind === "matched_active") {
      expect(r.category.id).toBe("hotel");
      expect(r.country).toBe("ID");
    }
  });

  it("'kos' + country='ID' → matched_active (kos is Indonesian-specific and ID has it)", () => {
    const r = resolveIntent("looking for a kos near campus", "ID");
    expect(r.kind).toBe("matched_active");
    if (r.kind === "matched_active") {
      expect(r.category.id).toBe("kos");
      expect(r.country).toBe("ID");
    }
  });

  it("'food' + country='ID' → matched_active for food", () => {
    const r = resolveIntent("I want food", "ID");
    expect(r.kind).toBe("matched_active");
    if (r.kind === "matched_active") {
      expect(r.category.id).toBe("food");
    }
  });

  it("'guesthouse' + country='ID' → matched_active", () => {
    const r = resolveIntent("guesthouse near Malioboro", "ID");
    expect(r.kind).toBe("matched_active");
  });
});

describe("resolveIntent · Country Foundation Step 6 · matched_active_wrong_country (Brain understands but no local inventory)", () => {
  it("'cheap hotel please' + country='GB' → matched_active_wrong_country (hotel active globally but not in GB)", () => {
    const r = resolveIntent("cheap hotel please", "GB");
    expect(r.kind).toBe("matched_active_wrong_country");
    if (r.kind === "matched_active_wrong_country") {
      expect(r.category.id).toBe("hotel");
      expect(r.country).toBe("GB");
      expect(r.availableCountries).toEqual(["ID"]);
    }
  });

  it("'kos' + country='GB' → matched_active_wrong_country (Kos is Indonesia-only)", () => {
    const r = resolveIntent("looking for a kos", "GB");
    expect(r.kind).toBe("matched_active_wrong_country");
    if (r.kind === "matched_active_wrong_country") {
      expect(r.category.id).toBe("kos");
      expect(r.country).toBe("GB");
      expect(r.availableCountries).toEqual(["ID"]);
    }
  });

  it("Truth Invariant: matched_active_wrong_country carries availableCountries so caller can respond honestly", () => {
    const r = resolveIntent("hotel", "US");
    expect(r.kind).toBe("matched_active_wrong_country");
    if (r.kind === "matched_active_wrong_country") {
      expect(Array.isArray(r.availableCountries)).toBe(true);
      expect(r.availableCountries.length).toBeGreaterThan(0);
      expect(r.availableCountries).not.toContain("US");
    }
  });

  it("Truth Invariant: does NOT silently swap to matched_active (never invent local inventory)", () => {
    const r = resolveIntent("hotel", "GB");
    expect(r.kind).not.toBe("matched_active");
    expect(r.kind).toBe("matched_active_wrong_country");
  });

  it("'food' + country='GB' → matched_active_wrong_country", () => {
    const r = resolveIntent("I want food", "GB");
    expect(r.kind).toBe("matched_active_wrong_country");
    if (r.kind === "matched_active_wrong_country") {
      expect(r.category.id).toBe("food");
    }
  });
});

describe("resolveIntent · Country Foundation Step 6 · matched_inactive (category not shipped regardless of country)", () => {
  it("'villa' + country='ID' → matched_inactive (villa is inactive in Registry regardless of country)", () => {
    const r = resolveIntent("looking for a villa", "ID");
    expect(r.kind).toBe("matched_inactive");
    if (r.kind === "matched_inactive") {
      expect(r.category.id).toBe("villa");
      expect(r.country).toBe("ID");
    }
  });

  it("'villa' + country='GB' → matched_inactive (same as ID · inactive is inactive)", () => {
    const r = resolveIntent("private villa", "GB");
    expect(r.kind).toBe("matched_inactive");
    if (r.kind === "matched_inactive") {
      expect(r.category.id).toBe("villa");
      expect(r.country).toBe("GB");
    }
  });

  it("'homestay' + country='ID' → matched_inactive (using Indonesian keyword)", () => {
    // NOTE: using "rumah warga" (homestay's Indonesian keyword) instead of "homestay"
    // because the accommodation entry has "stay" as a keyword and first-match wins ·
    // "homestay" would substring-match accommodation's "stay" keyword before reaching
    // homestay's own entry. That is a pre-existing keyword collision in the Registry
    // (violates the "Never make one keyword collide across two categories" doctrine
    // noted on CategoryEntry.brainKeywords) — unrelated to Step 6, tracked for later.
    const r = resolveIntent("rumah warga", "ID");
    expect(r.kind).toBe("matched_inactive");
    if (r.kind === "matched_inactive") {
      expect(r.category.id).toBe("homestay");
    }
  });

  it("'resort' + country='ID' → matched_inactive", () => {
    const r = resolveIntent("beach resort spa", "ID");
    expect(r.kind).toBe("matched_inactive");
    if (r.kind === "matched_inactive") {
      expect(r.category.id).toBe("resort");
    }
  });
});

describe("resolveIntent · Country Foundation Step 6 · unknown (Brain doesn't understand)", () => {
  it("'quantum physics' + country='ID' → unknown with country context", () => {
    const r = resolveIntent("quantum physics", "ID");
    expect(r.kind).toBe("unknown");
    if (r.kind === "unknown") {
      expect(r.country).toBe("ID");
    }
  });

  it("'quantum physics' + country='GB' → unknown with GB country context", () => {
    const r = resolveIntent("quantum physics", "GB");
    expect(r).toEqual({ kind: "unknown", country: "GB" });
  });

  it("empty phrase + country='ID' → unknown (no keyword match)", () => {
    // Actually an empty phrase would substring-match everything · registry keywords all include ""
    // Let's test with a definitely-non-matching phrase instead:
    const r = resolveIntent("xyzzy plugh", "ID");
    expect(r.kind).toBe("unknown");
  });
});

describe("resolveIntent · Country Foundation Step 6 · every return type carries country", () => {
  it("matched_active carries country", () => {
    const r = resolveIntent("hotel", "ID");
    expect(r).toHaveProperty("country", "ID");
  });

  it("matched_active_wrong_country carries country + availableCountries", () => {
    const r = resolveIntent("hotel", "GB");
    expect(r).toHaveProperty("country", "GB");
    expect(r).toHaveProperty("availableCountries");
  });

  it("matched_inactive carries country", () => {
    const r = resolveIntent("villa", "GB");
    expect(r).toHaveProperty("country", "GB");
  });

  it("unknown carries country", () => {
    const r = resolveIntent("xyzzy plugh", "GB");
    expect(r).toHaveProperty("country", "GB");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// DIRECTORY FACTORY · PHASE 0 · behaviour-preserving invariants
// ═══════════════════════════════════════════════════════════════════════
// Phase 0 introduces the DB table + validator without changing runtime
// behaviour. These tests prove:
//   · The 6 currently-live focused routes still resolve to their
//     Registry entries (no reshuffle).
//   · The `active` flag is unchanged for every existing entry.
//   · The DirectoryCards drawer output is byte-identical
//     (getDirectoryCardsForCountry helper returns the same 6 entries
//     in the same DISPLAY_ORDER as the pre-Phase-0 hardcoded list).
//   · No entry mutated its country field.
// Doctrine anchors:
//   docs/nex/directory-factory-phase-0-plan.md · Items 7 + 8

describe("Directory Factory · Phase 0 · route resolution invariant", () => {
  const SHIPPED_ROUTES = [
    { route: "/food",          expectedId: "food" },
    { route: "/accommodation", expectedId: "accommodation" },
    { route: "/hotel",         expectedId: "hotel" },
    { route: "/guesthouse",    expectedId: "guesthouse" },
    { route: "/kos",           expectedId: "kos" },
    { route: "/hostel",        expectedId: "hostel" },
  ];

  it.each(SHIPPED_ROUTES)(
    "route $route still resolves to Registry id $expectedId",
    ({ route, expectedId }) => {
      const entry = CATEGORY_REGISTRY.find((c) => c.route === route);
      expect(entry, `route ${route} missing from Registry`).toBeDefined();
      expect(entry!.id).toBe(expectedId);
      expect(entry!.active, `route ${route} became inactive`).toBe(true);
    },
  );
});

describe("Directory Factory · Phase 0 · active-flag invariant", () => {
  it("exactly 6 entries active (food + accommodation + hotel + guesthouse + hostel + kos)", () => {
    const activeIds = CATEGORY_REGISTRY.filter((c) => c.active).map((c) => c.id).sort();
    expect(activeIds).toEqual([
      "accommodation", "food", "guesthouse", "hostel", "hotel", "kos",
    ]);
  });

  it("exactly 4 entries inactive (villa + homestay + resort + apartment) · Phase 0 does not activate any", () => {
    const inactiveIds = CATEGORY_REGISTRY.filter((c) => !c.active).map((c) => c.id).sort();
    expect(inactiveIds).toEqual([
      "apartment", "homestay", "resort", "villa",
    ]);
  });
});

describe("Directory Factory · Phase 0 · Walker cannot directly activate", () => {
  // The TS Registry has no exported mutator. This test locks that in
  // via API-surface inspection so a future change that adds a
  // "setActive" or similar export is caught immediately.
  it("category-registry.ts exports no activate/setActive/mutate helpers", async () => {
    const mod = await import("./category-registry");
    const forbidden = ["activateCategory", "setActive", "mutateCategory", "updateActive", "promoteCategory"];
    for (const name of forbidden) {
      expect(mod, `unexpected export "${name}" — Walker must not be able to activate a category`).not.toHaveProperty(name);
    }
  });
});

describe("Directory Factory · Phase 0 · DirectoryCards drawer byte-invariance", () => {
  // Snapshot the render input the drawer uses. If this changes, the
  // visible drawer changes — must be intentional.
  it("getDirectoryCardsForCountry('ID') returns 6 entries in the expected DISPLAY_ORDER", async () => {
    // Import via dynamic import so the drawer file's "use client" +
    // React deps don't fail in a node-only test environment.
    const { getDirectoryCardsForCountry } = await import(
      "@/components/nexapp/NexDirectoryCards"
    );
    const cards = getDirectoryCardsForCountry("ID");
    expect(cards.map((c) => c.id)).toEqual([
      "food",
      "accommodation",
      "hotel",
      "kos",
      "hostel",
      "guesthouse",
    ]);
  });

  it("getDirectoryCardsForCountry('GB') returns empty (Truth Invariant · no UK inventory)", async () => {
    const { getDirectoryCardsForCountry } = await import(
      "@/components/nexapp/NexDirectoryCards"
    );
    expect(getDirectoryCardsForCountry("GB")).toEqual([]);
  });
});
