// src/lib/nex/live/city-live-groupings.ts
//
// NEX · Phase D · City Live grouping helpers
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase D
//
// PURPOSE (§11 §12 §35 §36)
//   Pure helpers for grouping /api/nex-live/tonight items by status
//   band, filtering by category, and deriving the honest category-chip
//   list. Category chips with zero backing items are never emitted.
//
// PURE FUNCTIONS.  No I/O.  No React.  No DOM.

import type { EntityLiveCard } from "@/components/nex-app/live/EntityLiveCarousel";

/** Matches the fields we consume from /api/nex-live/tonight items. */
export type CityLiveApiItem = {
  media_id: string;
  fixture_id: string | null;
  entity_id: string | null;
  entity_name: string | null;
  category: string | null;
  city_slug: string | null;
  mode: "MUSIC" | "VIDEO";
  live_status: "LIVE_NOW" | "STARTING_SOON" | "TONIGHT" | "UPCOMING" | "ENDED" | "STALE" | "UNKNOWN";
  status_label: string;
  is_mock_fixture: boolean;
  title: string | null;
  poster_url: string | null;
  playback_url: string | null;
};

export type CityLiveCategory =
  | "all"
  | "music"
  | "food"
  | "gym"
  | "events"
  | "hotel"
  | "venue"
  | "activity"
  | "artist";

/** Mapping · raw item.category → display bucket. NEVER guessed. */
const CATEGORY_BUCKET: Record<string, Exclude<CityLiveCategory, "all">> = {
  music_track:  "music",
  music_video:  "music",
  artist:       "artist",
  restaurant:   "food",
  gym:          "gym",
  hotel:        "hotel",
  venue:        "venue",
  event:        "events",
  activity:     "activity",
  creator:      "artist",
};

const CATEGORY_LABEL: Record<Exclude<CityLiveCategory, "all">, string> = {
  music:    "Music",
  food:     "Food",
  gym:      "Gym",
  events:   "Events",
  hotel:    "Hotels",
  venue:    "Venues",
  activity: "Activities",
  artist:   "Artists",
};

const CATEGORY_ORDER: ReadonlyArray<Exclude<CityLiveCategory, "all">> = [
  "music", "food", "gym", "events", "hotel", "venue", "activity", "artist",
];

function bucketFor(category: string | null): Exclude<CityLiveCategory, "all"> | null {
  if (category === null) return null;
  return CATEGORY_BUCKET[category] ?? null;
}

/** Derives the ordered list of category chips that have at least one
 *  backing item · never emits an empty chip. */
export function availableCategoriesFromItems(items: ReadonlyArray<CityLiveApiItem>): ReadonlyArray<{ id: Exclude<CityLiveCategory, "all">; label: string; count: number }> {
  const counts = new Map<Exclude<CityLiveCategory, "all">, number>();
  for (const it of items) {
    const b = bucketFor(it.category);
    if (b === null) continue;
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  return CATEGORY_ORDER
    .filter((c) => (counts.get(c) ?? 0) > 0)
    .map((c) => ({ id: c, label: CATEGORY_LABEL[c], count: counts.get(c)! }));
}

/** Filter by chip · "all" returns everything · other chips restrict. */
export function filterCityLiveByCategory(items: ReadonlyArray<CityLiveApiItem>, category: CityLiveCategory): CityLiveApiItem[] {
  if (category === "all") return [...items];
  return items.filter((it) => bucketFor(it.category) === category);
}

/** Convert an api item into an EntityLiveCard the carousel renders. */
export function apiItemToCard(it: CityLiveApiItem): EntityLiveCard {
  return {
    media_id: it.media_id,
    title: it.entity_name ? `${it.title ?? "Live"} · ${it.entity_name}` : it.title,
    category: it.category,
    live_status: it.live_status,
    status_label: it.status_label,
    poster_url: it.poster_url,
    playback_url: it.playback_url,
    duration_hint_min: null,
    is_mock_fixture: it.is_mock_fixture,
  };
}

export type CityLiveGroups = {
  liveNow: EntityLiveCard[];
  startingSoon: EntityLiveCard[];
  tonight: EntityLiveCard[];
};

/** Partition items into the three display bands · discards everything
 *  that isn't LIVE_NOW / STARTING_SOON / TONIGHT so the surface can only
 *  claim things it can honestly evidence. */
export function groupCityLiveByStatus(items: ReadonlyArray<CityLiveApiItem>): CityLiveGroups {
  const liveNow: EntityLiveCard[] = [];
  const startingSoon: EntityLiveCard[] = [];
  const tonight: EntityLiveCard[] = [];
  for (const it of items) {
    const card = apiItemToCard(it);
    switch (it.live_status) {
      case "LIVE_NOW":       liveNow.push(card); break;
      case "STARTING_SOON":  startingSoon.push(card); break;
      case "TONIGHT":        tonight.push(card); break;
      default:               /* UPCOMING/ENDED/STALE/UNKNOWN excluded */
    }
  }
  return { liveNow, startingSoon, tonight };
}
