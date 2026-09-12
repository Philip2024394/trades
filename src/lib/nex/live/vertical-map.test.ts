// src/lib/nex/live/vertical-map.test.ts
// NEX LIVE · Phase A · vertical mapping bridge

import { describe, it, expect } from "vitest";
import {
  mapLiveVerticalToWorldVertical,
  mapWorldVerticalToLiveVertical,
  hasWorldVerticalIntelligence,
  liveOnlyVerticals,
} from "./vertical-map";

describe("vertical-map · Live → WorldVertical (existing intelligence available)", () => {
  it("live_restaurant → food", () => expect(mapLiveVerticalToWorldVertical("live_restaurant")).toBe("food"));
  it("live_food → food", () => expect(mapLiveVerticalToWorldVertical("live_food")).toBe("food"));
  it("live_seller → commerce", () => expect(mapLiveVerticalToWorldVertical("live_seller")).toBe("commerce"));
  it("live_commerce → commerce", () => expect(mapLiveVerticalToWorldVertical("live_commerce")).toBe("commerce"));
  it("live_accommodation → accommodation", () => expect(mapLiveVerticalToWorldVertical("live_accommodation")).toBe("accommodation"));
  it("live_transport → transport", () => expect(mapLiveVerticalToWorldVertical("live_transport")).toBe("transport"));
  it("live_place → places", () => expect(mapLiveVerticalToWorldVertical("live_place")).toBe("places"));
});

describe("vertical-map · Live-only verticals return null (never invent WorldVertical)", () => {
  const liveOnly = ["live_music", "live_artist", "live_venue", "live_movie", "live_film", "live_creator", "live_people", "live_event", "live_generic"] as const;
  for (const v of liveOnly) {
    it(`${v} → null`, () => expect(mapLiveVerticalToWorldVertical(v)).toBeNull());
  }
});

describe("vertical-map · World → canonical Live", () => {
  it("food → live_restaurant", () => expect(mapWorldVerticalToLiveVertical("food")).toBe("live_restaurant"));
  it("commerce → live_seller", () => expect(mapWorldVerticalToLiveVertical("commerce")).toBe("live_seller"));
  it("places → live_place", () => expect(mapWorldVerticalToLiveVertical("places")).toBe("live_place"));
  it("transport → live_transport", () => expect(mapWorldVerticalToLiveVertical("transport")).toBe("live_transport"));
  it("accommodation → live_accommodation", () => expect(mapWorldVerticalToLiveVertical("accommodation")).toBe("live_accommodation"));
  it("service → live_generic (no dedicated Live vertical yet)", () =>
    expect(mapWorldVerticalToLiveVertical("service")).toBe("live_generic"));
});

describe("vertical-map · hasWorldVerticalIntelligence", () => {
  it("live_restaurant has world intelligence", () => expect(hasWorldVerticalIntelligence("live_restaurant")).toBe(true));
  it("live_music does NOT have world intelligence", () => expect(hasWorldVerticalIntelligence("live_music")).toBe(false));
  it("live_movie does NOT have world intelligence", () => expect(hasWorldVerticalIntelligence("live_movie")).toBe(false));
});

describe("vertical-map · liveOnlyVerticals enumeration", () => {
  it("includes music/artist/venue/movie/film/creator/people/event/generic", () => {
    const set = new Set(liveOnlyVerticals());
    for (const v of ["live_music", "live_artist", "live_venue", "live_movie", "live_film", "live_creator", "live_people", "live_event", "live_generic"] as const) {
      expect(set.has(v)).toBe(true);
    }
  });
  it("does NOT include verticals that map to WorldVertical", () => {
    const set = new Set(liveOnlyVerticals());
    for (const v of ["live_restaurant", "live_food", "live_seller", "live_commerce", "live_accommodation", "live_transport", "live_place"] as const) {
      expect(set.has(v)).toBe(false);
    }
  });
});
