// src/lib/nex/city-registry.test.ts

import { describe, it, expect } from "vitest";
import {
  CITY_REGISTRY,
  cityFromSlug,
  cityFromName,
  slugFromCanonical,
  allCitySlugs,
  citiesInRegion,
} from "./city-registry";
import { TRACKED_CITIES } from "@/lib/nex-hq/discovery-rotation";

describe("CITY_REGISTRY · single source of truth", () => {
  it("has 8 cities · matches TRACKED_CITIES count (doctrine: registries kept in sync)", () => {
    expect(CITY_REGISTRY.length).toBe(TRACKED_CITIES.length);
  });

  it("every canonical name is present in TRACKED_CITIES", () => {
    const tracked = new Set<string>(TRACKED_CITIES);
    for (const c of CITY_REGISTRY) expect(tracked.has(c.canonical)).toBe(true);
  });

  it("all slugs are unique and lowercase-hyphenated", () => {
    const slugs = CITY_REGISTRY.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/);
  });

  it("all canonical names are unique", () => {
    const names = CITY_REGISTRY.map((c) => c.canonical);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every city has plausible centroid inside its own bbox", () => {
    for (const c of CITY_REGISTRY) {
      const { lat, lng } = c.centroid;
      const [swLat, swLng] = c.bboxSw;
      const [neLat, neLng] = c.bboxNe;
      expect(lat).toBeGreaterThanOrEqual(swLat);
      expect(lat).toBeLessThanOrEqual(neLat);
      expect(lng).toBeGreaterThanOrEqual(swLng);
      expect(lng).toBeLessThanOrEqual(neLng);
    }
  });
});

describe("cityFromSlug", () => {
  it("resolves canonical slug", () => {
    expect(cityFromSlug("sleman")?.canonical).toBe("Sleman");
  });

  it("case-insensitive", () => {
    expect(cityFromSlug("SLEMAN")?.canonical).toBe("Sleman");
  });

  it("resolves hyphenated slug (kulon-progo)", () => {
    expect(cityFromSlug("kulon-progo")?.canonical).toBe("Kulon Progo");
  });

  it("returns null for unknown slug (never fake a city)", () => {
    expect(cityFromSlug("bali")).toBeNull();
    expect(cityFromSlug("")).toBeNull();
    expect(cityFromSlug(null)).toBeNull();
    expect(cityFromSlug(undefined)).toBeNull();
  });
});

describe("cityFromName · canonical + aliases", () => {
  it("resolves canonical name", () => {
    expect(cityFromName("Yogyakarta")?.slug).toBe("yogyakarta");
  });

  it("resolves alias 'Jogja' to Yogyakarta", () => {
    expect(cityFromName("Jogja")?.slug).toBe("yogyakarta");
  });

  it("resolves alias 'Surakarta' to Solo", () => {
    expect(cityFromName("Surakarta")?.slug).toBe("solo");
  });

  it("returns null for unknown names", () => {
    expect(cityFromName("Nowhereville")).toBeNull();
  });
});

describe("slugFromCanonical", () => {
  it("returns slug for canonical name", () => {
    expect(slugFromCanonical("Kulon Progo")).toBe("kulon-progo");
  });

  it("returns null for unknown canonical", () => {
    // 2026-08-24 · Phase 2 · Denpasar was added to the catalogue · pick a
    // genuinely absent city for the null case.
    expect(slugFromCanonical("Nowhereville-XYZ")).toBeNull();
  });
});

describe("allCitySlugs / citiesInRegion", () => {
  it("allCitySlugs returns unique slugs matching CITY_REGISTRY count", () => {
    expect(allCitySlugs().length).toBe(CITY_REGISTRY.length);
    expect(new Set(allCitySlugs()).size).toBe(CITY_REGISTRY.length);
  });

  it("citiesInRegion('DIY') returns cities whose region is 'DIY'", () => {
    const diy = citiesInRegion("DIY");
    for (const c of diy) expect(c.region).toBe("DIY");
    // At least the founding DIY set is present
    const diyNames = diy.map((c) => c.canonical).sort();
    for (const expected of ["Yogyakarta", "Sleman", "Bantul", "Kulon Progo", "Gunungkidul"]) {
      expect(diyNames).toContain(expected);
    }
  });

  it("citiesInRegion('Central Java') returns the Central Java founding cities", () => {
    const cj = citiesInRegion("Central Java");
    const names = cj.map((c) => c.canonical).sort();
    for (const expected of ["Klaten", "Magelang", "Solo"]) {
      expect(names).toContain(expected);
    }
  });
});

// ── Phase 1 drift protection · 2026-08-24 ────────────────────────────
// Prove the single source of truth is the shared catalogue file and every
// downstream import matches it exactly. If someone adds a city to the JSON
// but forgets to restart something, or if a mirror silently drifts, these
// tests fail loud.

describe("Phase 1 · SINGLE SOURCE OF TRUTH · data/nex-city-catalogue.json", () => {
  it("CITY_REGISTRY exactly matches the JSON catalogue (loaded via loader)", async () => {
    // Import the .mjs loader dynamically so we exercise the same runtime
    // path the acquisition scripts use (fs.readFileSync of the JSON file).
    const loader = await import("../../../scripts/nex-city-catalogue/loader.mjs");
    const mjsCities = (loader.allCities() as CityRegistryEntry[]).map((c) => c.canonical).sort();
    const tsCities  = CITY_REGISTRY.map((c) => c.canonical).sort();
    expect(mjsCities).toEqual(tsCities);
  });

  it("trackedCityNames() matches TRACKED_CITIES exactly", async () => {
    const loader = await import("../../../scripts/nex-city-catalogue/loader.mjs");
    const mjsList = loader.trackedCityNames().slice().sort();
    const tsList = TRACKED_CITIES.slice().sort();
    expect(mjsList).toEqual(tsList);
  });

  it("every catalogue city has the fields walkers need (bboxes + jurisdiction)", async () => {
    const loader = await import("../../../scripts/nex-city-catalogue/loader.mjs");
    for (const c of CITY_REGISTRY) {
      const bbox = loader.bboxForCity(c.canonical);
      expect(bbox, `${c.canonical} bbox missing`).not.toBeNull();
      expect(bbox.sw).toEqual(c.bboxSw);
      expect(bbox.ne).toEqual(c.bboxNe);
      const jur = loader.jurisdictionForCity(c.canonical);
      expect(jur, `${c.canonical} jurisdiction missing`).not.toBeNull();
      expect(typeof jur).toBe("string");
      expect(jur.startsWith("ID/")).toBe(true);
    }
  });
});
