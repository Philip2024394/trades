// Stage 3.7 · Unit tests for the accommodation slot extractor.
// Bilingual EN + ID · deterministic · no LLM.

import { describe, it, expect } from "vitest";
import {
  extractAccommodationSlots,
  mergeAccommodationSlots,
  describeSlots,
  newSlotsIntroduced,
} from "./accommodation-slots";

describe("extractAccommodationSlots · English", () => {
  it("extracts type + location from 'I need a hotel in Yogyakarta'", () => {
    const r = extractAccommodationSlots("I need a hotel in Yogyakarta");
    expect(r.slots).toMatchObject({ type: "hotel", location: "yogyakarta", action: "discover" });
    expect(r.correction).toBe(false);
    expect(r.isKnowledgeQuestion).toBe(false);
  });

  it("extracts budget from 'Cheap'", () => {
    const r = extractAccommodationSlots("Cheap");
    expect(r.slots.budget).toBe("budget");
  });

  it("extracts area from 'Near Malioboro'", () => {
    const r = extractAccommodationSlots("Near Malioboro");
    expect(r.slots.area).toBe("malioboro");
  });

  it("extracts amenity from 'With a pool'", () => {
    const r = extractAccommodationSlots("With a pool");
    expect(r.slots.amenities).toEqual(["pool"]);
  });

  it("extracts guests from 'For two people'", () => {
    const r = extractAccommodationSlots("For two people");
    expect(r.slots.guests).toBe(2);
  });

  it("extracts guests count from 'For 3 people'", () => {
    const r = extractAccommodationSlots("For 3 people");
    expect(r.slots.guests).toBe(3);
  });

  it("extracts date from 'Tonight'", () => {
    const r = extractAccommodationSlots("Tonight");
    expect(r.slots.date).toBe("tonight");
  });

  it("extracts action=book from 'Book this hotel tonight'", () => {
    const r = extractAccommodationSlots("Book this hotel tonight");
    expect(r.slots.action).toBe("book");
    expect(r.slots.type).toBe("hotel");
    expect(r.slots.date).toBe("tonight");
  });

  it("extracts multiple amenities from 'wifi and breakfast'", () => {
    const r = extractAccommodationSlots("With wifi and breakfast");
    expect(new Set(r.slots.amenities)).toEqual(new Set(["wifi", "breakfast"]));
  });

  it("detects correction marker 'actually'", () => {
    const r = extractAccommodationSlots("Actually, find me a guesthouse instead");
    expect(r.correction).toBe(true);
    expect(r.slots.type).toBe("guesthouse");
  });

  it("detects knowledge phrasing 'what is a kos-kosan'", () => {
    const r = extractAccommodationSlots("What is a kos-kosan?");
    expect(r.isKnowledgeQuestion).toBe(true);
    expect(r.slots.type).toBe("kos");
  });
});

describe("extractAccommodationSlots · Bahasa Indonesia", () => {
  it("extracts type + location from 'Cari hotel di Jogja'", () => {
    const r = extractAccommodationSlots("Cari hotel di Jogja");
    expect(r.slots).toMatchObject({ type: "hotel", location: "yogyakarta", action: "discover" });
  });

  it("extracts budget from 'Yang murah'", () => {
    const r = extractAccommodationSlots("Yang murah");
    expect(r.slots.budget).toBe("budget");
  });

  it("extracts area from 'Dekat Malioboro'", () => {
    const r = extractAccommodationSlots("Dekat Malioboro");
    expect(r.slots.area).toBe("malioboro");
  });

  it("extracts amenity 'kolam renang' as pool", () => {
    const r = extractAccommodationSlots("Ada kolam renang?");
    expect(r.slots.amenities).toEqual(["pool"]);
  });

  it("extracts guests from 'untuk 2 orang'", () => {
    const r = extractAccommodationSlots("Untuk 2 orang");
    expect(r.slots.guests).toBe(2);
  });

  it("extracts action=book from 'pesan hotel'", () => {
    const r = extractAccommodationSlots("Pesan hotel ini");
    expect(r.slots.action).toBe("book");
    expect(r.slots.type).toBe("hotel");
  });

  it("detects correction marker 'sebenarnya'", () => {
    const r = extractAccommodationSlots("Sebenarnya, cari homestay saja");
    expect(r.correction).toBe(true);
    expect(r.slots.type).toBe("homestay");
  });
});

describe("mergeAccommodationSlots", () => {
  it("latest turn wins on overlapping slots", () => {
    const prior = { type: "hotel", location: "yogyakarta" } as const;
    const next = { type: "guesthouse" as const };
    const m = mergeAccommodationSlots(prior, next);
    expect(m).toEqual({ type: "guesthouse", location: "yogyakarta" });
  });

  it("amenities accumulate (union) across turns", () => {
    const prior = { amenities: ["pool"] };
    const next = { amenities: ["wifi", "breakfast"] };
    const m = mergeAccommodationSlots(prior, next);
    expect(new Set(m.amenities)).toEqual(new Set(["pool", "wifi", "breakfast"]));
  });

  it("prior with no matching slot is preserved", () => {
    const prior = { location: "yogyakarta", type: "hotel" as const, area: "malioboro" };
    const next = { budget: "budget" as const };
    const m = mergeAccommodationSlots(prior, next);
    expect(m).toEqual({ location: "yogyakarta", type: "hotel", area: "malioboro", budget: "budget" });
  });

  it("newSlotsIntroduced reports only fresh slots", () => {
    const prior = { location: "yogyakarta", type: "hotel" as const };
    const introduced = newSlotsIntroduced(prior, { budget: "budget", type: "hotel" });
    expect(introduced).toEqual(["budget"]);
  });
});

describe("describeSlots", () => {
  it("renders 'budget hotels in Yogyakarta'", () => {
    const s = describeSlots({ type: "hotel", location: "yogyakarta", budget: "budget" });
    expect(s.toLowerCase()).toContain("budget");
    expect(s.toLowerCase()).toContain("hotel");
    expect(s.toLowerCase()).toContain("yogyakarta");
  });

  it("renders 'stays near Malioboro' when type is unknown", () => {
    const s = describeSlots({ area: "malioboro" });
    expect(s.toLowerCase()).toContain("stays");
    expect(s.toLowerCase()).toContain("malioboro");
  });
});
