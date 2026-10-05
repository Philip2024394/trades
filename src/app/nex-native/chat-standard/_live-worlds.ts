// src/app/nex-native/chat-standard/_live-worlds.ts
//
// Production registry of Standard-Experience-backed worlds.
//
// This is the single source of truth for "which theme ids map to a
// code-side Theme Engine package" and is consumed by:
//
//   - /nex-native/themes/[id]/page.tsx           (live-chat route)
//   - /nex-native/dev/standard-experience-preview/_registry.ts
//     (which extends this with developer-only test fixtures)
//
// RULE (sealed 2026-10-05):
//   Any world listed here is reachable at `/nex-native/themes/<id>` as
//   a full live-chat surface — Standard Experience chrome, header
//   icons, bubbles, composer, shop sheet, call actions, + menu — with
//   the theme applied. Adding a new Standard-Experience world is a
//   one-line edit here.

import type { ThemePackage } from "./_engine/types";
import { OCEAN_PACKAGE } from "./packages/ocean.package";
import { COFFEE_PACKAGE } from "./packages/coffee.package";
import { BOTANICAL_CAFE_PACKAGE } from "./packages/botanical-cafe.package";
import { MIDNIGHT_CAFE_PACKAGE } from "./packages/midnight-cafe.package";
import { FRENCH_CAFE_PACKAGE } from "./packages/french-cafe.package";

export const LIVE_WORLD_PACKAGES = {
  ocean: OCEAN_PACKAGE,
  coffee: COFFEE_PACKAGE,
  "botanical-cafe": BOTANICAL_CAFE_PACKAGE,
  "midnight-cafe": MIDNIGHT_CAFE_PACKAGE,
  "french-cafe": FRENCH_CAFE_PACKAGE,
} as const satisfies Record<string, ThemePackage>;

export type LiveWorldId = keyof typeof LIVE_WORLD_PACKAGES;

export const LIVE_WORLD_IDS = Object.keys(LIVE_WORLD_PACKAGES) as LiveWorldId[];

export function isLiveWorldId(id: string | undefined): id is LiveWorldId {
  return !!id && id in LIVE_WORLD_PACKAGES;
}

export function getLiveWorldPackage(id: LiveWorldId): ThemePackage {
  return LIVE_WORLD_PACKAGES[id];
}

/** Human-readable name for a Standard-Experience world. */
export function getLiveWorldDisplayName(id: LiveWorldId): string {
  return LIVE_WORLD_PACKAGES[id].identity.name;
}
