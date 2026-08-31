// Stage 3.14 · Phase 7 · Entity Intelligence unit tests.

import { describe, it, expect } from "vitest";
import {
  extractEntities,
  capturePresentedBusinesses,
  mergeEntityWindow,
  findPresentedBusinessByOffset,
} from "./entities";

const AT = "2026-08-31T00:00:00.000Z";

describe("extractEntities · places + areas", () => {
  it("extracts a city (English)", () => {
    const e = extractEntities("I need a hotel in Yogyakarta", AT);
    const places = e.filter((x) => x.kind === "place");
    expect(places).toHaveLength(1);
    expect(places[0].canonical).toBe("yogyakarta");
  });

  it("extracts area", () => {
    const e = extractEntities("Near Malioboro", AT);
    expect(e.some((x) => x.kind === "area" && x.canonical === "malioboro")).toBe(true);
  });

  it("Bahasa alias 'Jogja' canonicalises to yogyakarta", () => {
    const e = extractEntities("Cari hotel di Jogja", AT);
    expect(e.some((x) => x.kind === "place" && x.canonical === "yogyakarta")).toBe(true);
  });
});

describe("extractEntities · ordinals + pronouns", () => {
  it("extracts English ordinals", () => {
    for (const [phrase, expected] of [["the first one", "first"], ["the second", "second"], ["3rd option", "third"]] as const) {
      const e = extractEntities(phrase, AT);
      expect(e.some((x) => x.kind === "ordinal" && x.canonical === expected), `phrase=${phrase}`).toBe(true);
    }
  });

  it("extracts Bahasa ordinals", () => {
    const e = extractEntities("pilihan kedua", AT);
    expect(e.some((x) => x.kind === "ordinal" && x.canonical === "second")).toBe(true);
  });

  it("extracts pronoun 'that one'", () => {
    const e = extractEntities("Book that one", AT);
    expect(e.some((x) => x.kind === "pronoun" && x.canonical === "that_one")).toBe(true);
  });

  it("bare 'it' only captured in strong contexts", () => {
    expect(extractEntities("it is nice", AT).some((x) => x.kind === "pronoun")).toBe(false);
    expect(extractEntities("book it now", AT).some((x) => x.kind === "pronoun" && x.canonical === "it")).toBe(true);
  });
});

describe("extractEntities · dates + quantities", () => {
  it("extracts tonight/tomorrow (EN + ID)", () => {
    expect(extractEntities("Tonight", AT).some((x) => x.kind === "date_ref" && x.canonical === "tonight")).toBe(true);
    expect(extractEntities("besok", AT).some((x) => x.kind === "date_ref" && x.canonical === "tomorrow")).toBe(true);
  });

  it("extracts quantity units", () => {
    const e = extractEntities("for 3 nights, 2 people, 1 room", AT);
    const qs = e.filter((x) => x.kind === "quantity");
    expect(qs.length).toBeGreaterThanOrEqual(2);
    expect(qs.some((q) => /nights/i.test(q.canonical))).toBe(true);
    expect(qs.some((q) => /guests/i.test(q.canonical))).toBe(true);
  });
});

describe("extractEntities · phone / email / url / money", () => {
  it("extracts a phone-shaped span", () => {
    const e = extractEntities("call +62 812 3456 7890", AT);
    expect(e.some((x) => x.kind === "phone")).toBe(true);
  });

  it("extracts an email", () => {
    const e = extractEntities("mail me at hello@example.com", AT);
    expect(e.some((x) => x.kind === "email" && x.canonical === "hello@example.com")).toBe(true);
  });

  it("extracts a URL", () => {
    const e = extractEntities("see https://openstreetmap.org/node/1", AT);
    expect(e.some((x) => x.kind === "url")).toBe(true);
  });

  it("extracts a money-shaped span", () => {
    const e = extractEntities("under IDR 500,000", AT);
    expect(e.some((x) => x.kind === "money")).toBe(true);
  });
});

describe("capturePresentedBusinesses · reply-side capture", () => {
  it("creates one entity per hit with 1-indexed presentedOffset", () => {
    const captured = capturePresentedBusinesses([
      { id: "place:accommodation:osm:node_1", name: "Griya Sentana", category: "accommodation.hotel" },
      { id: "place:accommodation:osm:node_2", name: "Hotel Trim Tiga", category: "accommodation.hotel" },
      { id: "place:accommodation:osm:node_3", name: "Asia Afrika", category: "accommodation.hotel" },
    ], AT);
    expect(captured).toHaveLength(3);
    expect(captured[0].presentedOffset).toBe(1);
    expect(captured[1].presentedOffset).toBe(2);
    expect(captured[2].presentedOffset).toBe(3);
    expect(captured.every((e) => e.source === "nex_reply")).toBe(true);
    expect(captured.every((e) => e.kind === "business_name")).toBe(true);
  });

  it("skips hits with no name", () => {
    const captured = capturePresentedBusinesses([
      { id: "x", name: null },
      { id: "y", name: "Kept" },
    ], AT);
    expect(captured).toHaveLength(1);
    expect(captured[0].canonical).toBe("kept");
  });
});

describe("mergeEntityWindow · uniqueness + capping", () => {
  it("keeps newer entity when id collides", () => {
    const prior = [{ id: "place:yogyakarta", kind: "place", canonical: "yogyakarta", raw: "Yogyakarta", source: "user_message", atIso: "2026-08-30T00:00:00.000Z" } as const];
    const next = [{ id: "place:yogyakarta", kind: "place", canonical: "yogyakarta", raw: "Jogja", source: "user_message", atIso: "2026-08-31T00:00:00.000Z" } as const];
    const merged = mergeEntityWindow(prior, next);
    expect(merged).toHaveLength(1);
    expect(merged[0].atIso).toBe("2026-08-31T00:00:00.000Z");
    expect(merged[0].raw).toBe("Jogja");
  });

  it("caps at windowSize", () => {
    const prior = Array.from({ length: 25 }, (_, i) => ({
      id: `place:city-${i}`, kind: "place" as const, canonical: `city-${i}`, raw: `City${i}`,
      source: "user_message" as const, atIso: AT,
    }));
    const next = Array.from({ length: 25 }, (_, i) => ({
      id: `place:new-${i}`, kind: "place" as const, canonical: `new-${i}`, raw: `New${i}`,
      source: "user_message" as const, atIso: AT,
    }));
    const merged = mergeEntityWindow(prior, next, 30);
    expect(merged).toHaveLength(30);
    // Newest 25 are all present · older prior ones fill remaining 5 slots.
    expect(merged.filter((e) => e.canonical.startsWith("new-")).length).toBe(25);
  });
});

describe("findPresentedBusinessByOffset", () => {
  it("finds the second presented business from the most recent batch", () => {
    const batch1 = capturePresentedBusinesses(
      [{ id: "a", name: "Old-1" }, { id: "b", name: "Old-2" }],
      "2026-08-30T00:00:00.000Z",
    );
    const batch2 = capturePresentedBusinesses(
      [{ id: "c", name: "New-1" }, { id: "d", name: "New-2" }, { id: "e", name: "New-3" }],
      "2026-08-31T00:00:00.000Z",
    );
    const window = mergeEntityWindow(batch1, batch2);
    const second = findPresentedBusinessByOffset(window, 2);
    expect(second?.canonical).toBe("new-2");
  });
});
