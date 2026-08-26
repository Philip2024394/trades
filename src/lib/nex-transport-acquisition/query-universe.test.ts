// src/lib/nex-transport-acquisition/query-universe.test.ts

import { describe, it, expect } from "vitest";
import { generateQueries, QUERY_FAMILIES, YOGYA_LOCATION_TERMS, queriesForProvider } from "./query-universe";

describe("Query universe · family coverage", () => {
  it("has at least the expected 8 families", () => {
    const keys = QUERY_FAMILIES.map((f) => f.familyKey).sort();
    expect(keys).toEqual([
      "courier",
      "driver_ojek",
      "goods_pickup_truck",
      "individual_driver_social",
      "passenger_car",
      "platform_signal",
      "taxi",
      "tourism_airport",
      "van_minibus_bus",
    ]);
  });

  it("includes Indonesian AND English terminology", () => {
    const all = QUERY_FAMILIES.flatMap((f) => [...f.keywordsSingular, ...f.keywordsAlreadyLocalised]).join(" ");
    // Indonesian
    expect(all).toMatch(/ojek/i);
    expect(all).toMatch(/kurir/i);
    expect(all).toMatch(/sewa/i);
    expect(all).toMatch(/pindahan/i);
    expect(all).toMatch(/antar jemput/i);
    // English
    expect(all).toMatch(/driver/i);
    expect(all).toMatch(/courier/i);
    expect(all).toMatch(/shuttle/i);
    expect(all).toMatch(/rental/i);
  });

  it("covers all core Yogyakarta location variants", () => {
    for (const loc of ["Jogja", "Yogyakarta", "Sleman", "Bantul", "Kulon Progo", "Gunungkidul"]) {
      expect(YOGYA_LOCATION_TERMS).toContain(loc);
    }
  });
});

describe("Query universe · platform names are search signals ONLY", () => {
  it("platform family is flagged isPlatformSignal=true", () => {
    const platform = QUERY_FAMILIES.find((f) => f.familyKey === "platform_signal")!;
    expect(platform.isPlatformSignal).toBe(true);
  });

  it("platform family vehicleKindHint is 'unknown' · never fabricates classification", () => {
    const platform = QUERY_FAMILIES.find((f) => f.familyKey === "platform_signal")!;
    expect(platform.vehicleKindHint).toBe("unknown");
  });

  it("generated platform queries carry isPlatformSignal=true", () => {
    const queries = generateQueries();
    const platform = queries.filter((q) => q.isPlatformSignal);
    expect(platform.length).toBeGreaterThan(0);
    for (const q of platform) {
      expect(q.familyKey).toBe("platform_signal");
      expect(q.vehicleKindHint).toBe("unknown");
    }
  });

  it("platform terms mention major Indonesian platforms as vocabulary only", () => {
    const platform = QUERY_FAMILIES.find((f) => f.familyKey === "platform_signal")!;
    const joined = platform.keywordsAlreadyLocalised.join(" ").toLowerCase();
    expect(joined).toMatch(/gojek/);
    expect(joined).toMatch(/grab/);
    expect(joined).toMatch(/maxim/);
    expect(joined).toMatch(/shopee/);
  });
});

describe("Query universe · generation is bounded + deterministic", () => {
  it("returns a deterministic ordering (same input → same output)", () => {
    const a = generateQueries();
    const b = generateQueries();
    expect(a.map((q) => q.query)).toEqual(b.map((q) => q.query));
  });

  it("deduplicates queries so the same string is never emitted twice", () => {
    const queries = generateQueries();
    const set = new Set(queries.map((q) => q.query.toLowerCase()));
    expect(set.size).toBe(queries.length);
  });

  it("keeps total under a reasonable cap (< 220 queries per cycle)", () => {
    const queries = generateQueries();
    expect(queries.length).toBeLessThan(220);
    expect(queries.length).toBeGreaterThan(60);
  });

  it("includes non-platform queries that produce vehicle-kind hints", () => {
    const queries = generateQueries();
    const nonPlatform = queries.filter((q) => !q.isPlatformSignal);
    for (const q of nonPlatform) {
      expect(q.vehicleKindHint).not.toBe("unknown");
    }
  });
});

describe("Query universe · discovered records must NOT inherit platform-affiliation from query keyword", () => {
  it("platform-signal queries never claim vehicle-kind other than 'unknown'", () => {
    // Enforced by the family definition · this is a doctrinal test
    const platform = QUERY_FAMILIES.find((f) => f.familyKey === "platform_signal")!;
    expect(platform.vehicleKindHint).toBe("unknown");
  });

  it("platform queries have empty keywordsSingular · never combined with city terms to fabricate variants", () => {
    const platform = QUERY_FAMILIES.find((f) => f.familyKey === "platform_signal")!;
    expect(platform.keywordsSingular).toEqual([]);
  });
});

describe("Query universe · per-provider filter (public-only rule)", () => {
  it("Nominatim provider does NOT consume individual_driver_social", () => {
    const all = generateQueries();
    const nom = queriesForProvider("nominatim", all);
    expect(nom.every((q) => q.familyKey !== "individual_driver_social")).toBe(true);
  });

  it("Overpass provider does NOT consume individual_driver_social", () => {
    const all = generateQueries();
    const ovp = queriesForProvider("overpass", all);
    expect(ovp.every((q) => q.familyKey !== "individual_driver_social")).toBe(true);
  });

  it("Facebook provider ONLY consumes individual_driver_social + driver_ojek families", () => {
    const all = generateQueries();
    const fb = queriesForProvider("facebook_public", all);
    expect(fb.length).toBeGreaterThan(0);
    for (const q of fb) {
      expect(["individual_driver_social", "driver_ojek"]).toContain(q.familyKey);
    }
  });

  it("individual_driver_social family covers the DIY regencies (Sleman/Bantul/Wates/Prambanan)", () => {
    const fam = QUERY_FAMILIES.find((f) => f.familyKey === "individual_driver_social")!;
    const joined = fam.keywordsAlreadyLocalised.join(" ");
    expect(joined).toMatch(/Sleman/);
    expect(joined).toMatch(/Bantul/);
    expect(joined).toMatch(/Wates/);
    expect(joined).toMatch(/Prambanan/);
    expect(joined).toMatch(/Kulon Progo/);
    expect(joined).toMatch(/Gunungkidul/);
  });
});
