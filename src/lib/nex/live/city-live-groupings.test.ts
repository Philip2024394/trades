// src/lib/nex/live/city-live-groupings.test.ts
//
// NEX · Phase D · City Live grouping tests
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase D

import { describe, it, expect } from "vitest";
import {
  groupCityLiveByStatus,
  filterCityLiveByCategory,
  availableCategoriesFromItems,
  apiItemToCard,
  type CityLiveApiItem,
} from "./city-live-groupings";

function make(overrides: Partial<CityLiveApiItem>): CityLiveApiItem {
  return {
    media_id: "m1",
    fixture_id: "fx1",
    entity_id: "ent1",
    entity_name: "Test Entity",
    category: "restaurant",
    city_slug: "yogyakarta",
    mode: "VIDEO",
    live_status: "LIVE_NOW",
    status_label: "LIVE",
    is_mock_fixture: true,
    title: "Kitchen Live",
    poster_url: null,
    playback_url: "/api/nex-live/media/stream/m1",
    ...overrides,
  };
}

describe("groupCityLiveByStatus · §11 §35 · honest partitioning", () => {
  it("splits items into LIVE_NOW / STARTING_SOON / TONIGHT buckets", () => {
    const items = [
      make({ media_id: "a", live_status: "LIVE_NOW" }),
      make({ media_id: "b", live_status: "STARTING_SOON" }),
      make({ media_id: "c", live_status: "TONIGHT" }),
      make({ media_id: "d", live_status: "LIVE_NOW" }),
    ];
    const g = groupCityLiveByStatus(items);
    expect(g.liveNow.map((c) => c.media_id)).toEqual(["a", "d"]);
    expect(g.startingSoon.map((c) => c.media_id)).toEqual(["b"]);
    expect(g.tonight.map((c) => c.media_id)).toEqual(["c"]);
  });

  it("discards UPCOMING / ENDED / STALE / UNKNOWN · never surfaces them as Live", () => {
    const items = [
      make({ media_id: "a", live_status: "UPCOMING" }),
      make({ media_id: "b", live_status: "ENDED" }),
      make({ media_id: "c", live_status: "STALE" }),
      make({ media_id: "d", live_status: "UNKNOWN" }),
    ];
    const g = groupCityLiveByStatus(items);
    expect(g.liveNow).toEqual([]);
    expect(g.startingSoon).toEqual([]);
    expect(g.tonight).toEqual([]);
  });

  it("empty input yields empty groups · never a fake card", () => {
    const g = groupCityLiveByStatus([]);
    expect(g.liveNow).toEqual([]);
    expect(g.startingSoon).toEqual([]);
    expect(g.tonight).toEqual([]);
  });
});

describe("availableCategoriesFromItems · §36 never emits empty chips", () => {
  it("only categories with backing items are returned", () => {
    const items = [
      make({ category: "restaurant" }),
      make({ media_id: "m2", category: "gym" }),
      make({ media_id: "m3", category: "music_track" }),
    ];
    const chips = availableCategoriesFromItems(items);
    const ids = chips.map((c) => c.id);
    expect(ids).toContain("food");
    expect(ids).toContain("gym");
    expect(ids).toContain("music");
    // Nothing else should appear
    expect(ids).not.toContain("events");
    expect(ids).not.toContain("hotel");
  });

  it("returns nothing when items are empty · no ghost chips", () => {
    expect(availableCategoriesFromItems([])).toEqual([]);
  });

  it("null category is ignored · never counted", () => {
    const items = [make({ category: null }), make({ media_id: "m2", category: null })];
    expect(availableCategoriesFromItems(items)).toEqual([]);
  });

  it("counts stack across items in the same bucket", () => {
    const items = [
      make({ category: "restaurant" }),
      make({ media_id: "m2", category: "restaurant" }),
      make({ media_id: "m3", category: "restaurant" }),
    ];
    const chips = availableCategoriesFromItems(items);
    expect(chips).toHaveLength(1);
    expect(chips[0]).toEqual({ id: "food", label: "Food", count: 3 });
  });
});

describe("filterCityLiveByCategory · §11", () => {
  const items = [
    make({ media_id: "a", category: "restaurant" }),
    make({ media_id: "b", category: "gym" }),
    make({ media_id: "c", category: "music_track" }),
  ];
  it('"all" returns everything', () => {
    expect(filterCityLiveByCategory(items, "all").map((i) => i.media_id)).toEqual(["a", "b", "c"]);
  });
  it("food matches restaurant items", () => {
    expect(filterCityLiveByCategory(items, "food").map((i) => i.media_id)).toEqual(["a"]);
  });
  it("gym matches gym items", () => {
    expect(filterCityLiveByCategory(items, "gym").map((i) => i.media_id)).toEqual(["b"]);
  });
  it("music matches music_track items", () => {
    expect(filterCityLiveByCategory(items, "music").map((i) => i.media_id)).toEqual(["c"]);
  });
});

describe("apiItemToCard · §14 zero fabrication", () => {
  it("preserves is_mock_fixture flag exactly", () => {
    expect(apiItemToCard(make({ is_mock_fixture: true })).is_mock_fixture).toBe(true);
    expect(apiItemToCard(make({ is_mock_fixture: false })).is_mock_fixture).toBe(false);
  });
  it("never fabricates duration_hint_min · always null", () => {
    expect(apiItemToCard(make({})).duration_hint_min).toBeNull();
  });
  it("passes through playback_url as-is", () => {
    expect(apiItemToCard(make({ playback_url: null })).playback_url).toBeNull();
    expect(apiItemToCard(make({ playback_url: "/x" })).playback_url).toBe("/x");
  });
});
