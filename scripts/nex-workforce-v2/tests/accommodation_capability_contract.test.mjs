// NEX Workforce v2 · Slice A1 · Accommodation Capability Contract
// ─────────────────────────────────────────────────────────────────────────────
// Philip 2026-09-07 · registration + routing proof only.
//
// This file is the strict A1 boundary: it proves the accommodation category
// is REGISTERED in the v2 step-registry and ROUTES to the correct step-library
// modules. It does NOT:
//
//   · call Overpass (uses fetch spy to prove zero HTTP)
//   · touch Postgres (no pg import · no pool)
//   · seed work_items
//   · run the fetch_and_stage step's execute() body
//   · activate acquisition in any form
//
// Contract asserted:
//   R1  registerAll() registers (accommodation, overpass-observe-only)
//   R2  registerAll() registers (accommodation, overpass)
//   R3  resolve("accommodation", "overpass") returns the observe_and_stage module
//   R4  resolve("accommodation", "overpass-observe-only") returns observe module
//   R5  TAG_QUERIES.accommodation exists in both step modules
//   R6  the accommodation query targets the tourism tag family (matches P1's
//       proven classifier scope)
//   R7  plan() with a valid bbox produces the fetch_and_stage step (does not
//       execute) · zero fetch call
//   R8  plan() with a missing bbox throws BboxInvalidError · zero fetch call
//   R9  the 4 pre-existing categories still register (regression guard)
//   R10 seedCursor() returns the expected phase='started' initial cursor
//
// No production behavior is exercised. No side effects outside vitest.

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as StepRegistry from "../lib/step_registry.mjs";
import * as overpassObserve from "../steps/overpass_observe.mjs";
import * as overpassObserveAndStage from "../steps/overpass_observe_and_stage.mjs";
import { registerAll } from "../steps/index.mjs";
import { BboxInvalidError } from "../lib/bbox_validator.mjs";

// Yogyakarta-shaped bbox · well within max span · matches P1's proven target.
const YOGYA_BBOX = {
  sw: { lat: -7.82, lon: 110.34 },
  ne: { lat: -7.75, lon: 110.42 },
};

beforeEach(() => {
  StepRegistry._resetForTests();
});

describe("Slice A1 · accommodation registration", () => {
  it("R1 · registerAll() registers (accommodation, overpass-observe-only)", () => {
    registerAll();
    expect(StepRegistry.has("accommodation", "overpass-observe-only")).toBe(true);
  });

  it("R2 · registerAll() registers (accommodation, overpass)", () => {
    registerAll();
    expect(StepRegistry.has("accommodation", "overpass")).toBe(true);
  });

  it("R3 · resolve('accommodation','overpass') returns the observe_and_stage module (identity check)", () => {
    registerAll();
    const resolved = StepRegistry.resolve("accommodation", "overpass");
    expect(resolved).toBe(overpassObserveAndStage);
    expect(typeof resolved.seedCursor).toBe("function");
    expect(typeof resolved.plan).toBe("function");
    expect(typeof resolved.totals).toBe("function");
  });

  it("R4 · resolve('accommodation','overpass-observe-only') returns the observe module (identity check)", () => {
    registerAll();
    const resolved = StepRegistry.resolve("accommodation", "overpass-observe-only");
    expect(resolved).toBe(overpassObserve);
    expect(typeof resolved.seedCursor).toBe("function");
    expect(typeof resolved.plan).toBe("function");
  });
});

describe("Slice A1 · accommodation query shape", () => {
  it("R5 · TAG_QUERIES.accommodation exists in observe module", () => {
    expect(overpassObserve.TAG_QUERIES.accommodation).toBeDefined();
    expect(typeof overpassObserve.TAG_QUERIES.accommodation).toBe("string");
  });

  it("R5 · TAG_QUERIES.accommodation exists in observe_and_stage module", () => {
    expect(overpassObserveAndStage.TAG_QUERIES.accommodation).toBeDefined();
    expect(typeof overpassObserveAndStage.TAG_QUERIES.accommodation).toBe("string");
  });

  it("R5 · both modules share the same accommodation query (identical adapter shape)", () => {
    expect(overpassObserveAndStage.TAG_QUERIES.accommodation)
      .toBe(overpassObserve.TAG_QUERIES.accommodation);
  });

  it("R6 · accommodation query targets the tourism tag family (not amenity)", () => {
    const q = overpassObserveAndStage.TAG_QUERIES.accommodation;
    expect(q).toContain('"tourism"');
    expect(q).not.toMatch(/"amenity"="restaurant"/);
    expect(q).not.toMatch(/"amenity"="cafe"/);
  });

  it("R6 · accommodation query covers hotel/guest_house/hostel/apartment/motel/chalet", () => {
    const q = overpassObserveAndStage.TAG_QUERIES.accommodation;
    for (const subtype of ["hotel", "guest_house", "hostel", "apartment", "motel", "chalet"]) {
      expect(q, `query must reference subtype: ${subtype}`).toContain(subtype);
    }
  });

  it("R6 · accommodation query still uses the {{bbox}} placeholder (fail-closed bbox contract)", () => {
    const q = overpassObserveAndStage.TAG_QUERIES.accommodation;
    expect(q).toContain("{{bbox}}");
    expect(q).not.toContain("-90,-180,90,180"); // NO whole-world literal
  });
});

describe("Slice A1 · plan() routing for accommodation · zero side effects", () => {
  it("R7 · plan() with a valid bbox produces the fetch_and_stage step · no fetch call", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const workItem = {
        id: "wi-a1-acc-1",
        generation: 1,
        category_slug: "accommodation",
        city_slug: "yogyakarta",
        source_slug: "overpass",
        bbox_json: YOGYA_BBOX,
      };
      const steps = overpassObserveAndStage.plan({ cursor: null, workItem });
      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps[0].id).toBe("fetch_and_stage");
      // Crucially: plan() only BUILDS the step object · it does NOT execute
      // execute() · zero HTTP call must have fired.
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("R8 · plan() with missing bbox throws BboxInvalidError · no fetch call", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const workItem = {
        id: "wi-a1-acc-2",
        generation: 1,
        category_slug: "accommodation",
        city_slug: "yogyakarta",
        source_slug: "overpass",
        // bbox_json intentionally absent
      };
      expect(() => overpassObserveAndStage.plan({ cursor: null, workItem }))
        .toThrow(BboxInvalidError);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("R10 · seedCursor() returns the expected initial cursor shape", () => {
    const cursor = overpassObserveAndStage.seedCursor();
    expect(cursor.capability).toBe("overpass_observe_and_stage@1");
    expect(cursor.phase).toBe("started");
  });

  it("R7b · plan() with cursor.phase='completed' returns empty step array (no re-run)", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const workItem = {
        id: "wi-a1-acc-3",
        generation: 1,
        category_slug: "accommodation",
        city_slug: "yogyakarta",
        source_slug: "overpass",
        bbox_json: YOGYA_BBOX,
      };
      const steps = overpassObserveAndStage.plan({
        cursor: { capability: "overpass_observe_and_stage@1", phase: "completed" },
        workItem,
      });
      expect(steps).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe("Slice A1 · regression · pre-existing categories still register", () => {
  it("R9 · all 4 pre-existing categories remain registered under 'overpass'", () => {
    registerAll();
    for (const cat of ["restaurants", "cafes", "retail-fashion", "retail-books"]) {
      expect(StepRegistry.has(cat, "overpass"), `pre-existing category must still register: ${cat}`).toBe(true);
    }
  });

  it("R9 · all 4 pre-existing categories remain registered under 'overpass-observe-only'", () => {
    registerAll();
    for (const cat of ["restaurants", "cafes", "retail-fashion", "retail-books"]) {
      expect(StepRegistry.has(cat, "overpass-observe-only"), `pre-existing observe-only registration: ${cat}`).toBe(true);
    }
  });

  it("R9 · pre-existing restaurants query is byte-identical (no accidental drift)", () => {
    expect(overpassObserveAndStage.TAG_QUERIES.restaurants)
      .toBe('[out:json][timeout:60];node["amenity"="restaurant"]({{bbox}});out center;');
  });

  it("R9 · pre-existing cafes query is byte-identical (no accidental drift)", () => {
    expect(overpassObserveAndStage.TAG_QUERIES.cafes)
      .toBe('[out:json][timeout:60];node["amenity"="cafe"]({{bbox}});out center;');
  });

  it("R9 · pre-existing retail-fashion query is byte-identical (no accidental drift)", () => {
    expect(overpassObserveAndStage.TAG_QUERIES["retail-fashion"])
      .toBe('[out:json][timeout:60];node["shop"~"clothes|fashion"]({{bbox}});out center;');
  });

  it("R9 · pre-existing retail-books query is byte-identical (no accidental drift)", () => {
    expect(overpassObserveAndStage.TAG_QUERIES["retail-books"])
      .toBe('[out:json][timeout:60];node["shop"="books"]({{bbox}});out center;');
  });

  it("R9 · __default__ fallback query is byte-identical (no accidental drift)", () => {
    expect(overpassObserveAndStage.TAG_QUERIES.__default__)
      .toBe('[out:json][timeout:60];node["amenity"]({{bbox}});out center;');
  });
});
