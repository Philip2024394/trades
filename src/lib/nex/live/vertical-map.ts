// src/lib/nex/live/vertical-map.ts
//
// NEX LIVE · Phase A · LiveVertical ↔ WorldVertical Bridge
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · PHASE A
//
// PURPOSE (§2 · §15)
//   NEX Live must be vertical-independent AND must not duplicate the
//   existing conversational intelligence. Some Live verticals map 1:1 to
//   the existing WorldVertical (live_restaurant → food · live_seller →
//   commerce · live_accommodation → accommodation). Others are Live-only
//   and have no WorldVertical counterpart (live_music · live_artist ·
//   live_venue · live_movie · live_film · live_creator · live_people ·
//   live_event · live_generic).
//
// DISCIPLINE
//   · No fabrication of a WorldVertical for a Live-only vertical.
//   · Mapping is explicit and defensible — never guessed at runtime.
//   · The reverse map (WorldVertical → LiveVertical) exists for
//     preserving Universal Discovery / Wave 6 viewedEntity / Interest
//     slice continuity when a discovered entity later goes Live.

import type { WorldVertical } from "../brain/world-adapters/types";
import type { LiveVertical } from "./types";

// Forward map · declared explicitly. null means "no WorldVertical
// equivalent" — do NOT invent one.
const LIVE_TO_WORLD: Record<LiveVertical, WorldVertical | null> = {
  live_music:          null,
  live_artist:         null,
  live_venue:          null,
  live_restaurant:     "food",
  live_food:           "food",
  live_seller:         "commerce",
  live_commerce:       "commerce",
  live_movie:          null,
  live_film:           null,
  live_creator:        null,
  live_people:         null,
  live_place:          "places",
  live_transport:      "transport",
  live_accommodation:  "accommodation",
  live_event:          null,
  live_generic:        null,
};

export function mapLiveVerticalToWorldVertical(v: LiveVertical): WorldVertical | null {
  return LIVE_TO_WORLD[v] ?? null;
}

/** For a WorldVertical, return the canonical LiveVertical (used when a
 *  discovered WorldRecord subsequently goes Live). Live-only verticals
 *  (music/artist/venue/etc.) are not producible from a WorldVertical —
 *  those must be authored explicitly at Live creation time. */
const WORLD_TO_LIVE_CANONICAL: Record<WorldVertical, LiveVertical> = {
  food:          "live_restaurant",
  commerce:      "live_seller",
  places:        "live_place",
  transport:     "live_transport",
  accommodation: "live_accommodation",
  service:       "live_generic",   // no dedicated Live vertical yet · Phase L may introduce
};

export function mapWorldVerticalToLiveVertical(v: WorldVertical): LiveVertical {
  return WORLD_TO_LIVE_CANONICAL[v] ?? "live_generic";
}

/** Returns true if a Live vertical has a WorldVertical counterpart —
 *  meaning existing WorldVertical intelligence (capability registry,
 *  entity detail SECTION_MAP, discovery adapters) applies to it. */
export function hasWorldVerticalIntelligence(v: LiveVertical): boolean {
  return LIVE_TO_WORLD[v] !== null;
}

/** The full set of Live verticals that are LIVE-ONLY (no WorldVertical
 *  intelligence). Enumerated so downstream code can iterate them
 *  explicitly — e.g. Phase L movie catalogue architecture. */
export function liveOnlyVerticals(): ReadonlyArray<LiveVertical> {
  return (Object.keys(LIVE_TO_WORLD) as LiveVertical[])
    .filter((v) => LIVE_TO_WORLD[v] === null);
}
