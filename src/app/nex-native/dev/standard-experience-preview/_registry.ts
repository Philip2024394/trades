// src/app/nex-native/dev/standard-experience-preview/_registry.ts
//
// Single source of truth for the dev-route theme registry.
//
// Both the server page (`page.tsx`) and the client fixture
// (`_fixture-client.tsx`) import from here so adding a new world is
// a one-line edit, not a two-file sync.
//
// Pure data · no React · no `"use client"` directive · safe to import
// from either side of the server/client boundary.
//
// Rules:
//   - PRODUCTION_WORLD_IDS is the only list shown in the chip-row
//     navigation at the top of the dev page.
//   - TEST_FIXTURE_IDS are developer-only verification worlds (prefix
//     with `_test-`) · reachable only via explicit ?theme=...
//   - THEME_PACKAGES is the resolved id → package map used by the
//     fixture client.

import type { ThemePackage } from "../../chat-standard/_engine/types";
import { OCEAN_PACKAGE } from "../../chat-standard/packages/ocean.package";
import { COFFEE_PACKAGE } from "../../chat-standard/packages/coffee.package";
import { BOTANICAL_CAFE_PACKAGE } from "../../chat-standard/packages/botanical-cafe.package";
import { MIDNIGHT_CAFE_PACKAGE } from "../../chat-standard/packages/midnight-cafe.package";
import { FRENCH_CAFE_PACKAGE } from "../../chat-standard/packages/french-cafe.package";
import { BUNDLE_A_FIXTURE } from "../../chat-standard/packages/_test-fixtures/bundle-a-fixture.package";
import { BUNDLE_B_FIXTURE } from "../../chat-standard/packages/_test-fixtures/bundle-b-fixture.package";
import { BUNDLE_C_FIXTURE } from "../../chat-standard/packages/_test-fixtures/bundle-c-fixture.package";

/** Themes shown in the chip-row at the top of the dev preview. */
export const PRODUCTION_WORLD_IDS = [
  "ocean",
  "coffee",
  "botanical-cafe",
  "midnight-cafe",
  "french-cafe",
] as const;

/** Developer-only capability verification worlds. Not shown in the
 *  chip-row · reachable only via explicit `?theme=_test-bundle-*`. */
export const TEST_FIXTURE_IDS = [
  "_test-bundle-a",
  "_test-bundle-b",
  "_test-bundle-c",
] as const;

/** All theme IDs the dev route accepts via `?theme=...`. */
export const ALL_THEME_IDS = [
  ...PRODUCTION_WORLD_IDS,
  ...TEST_FIXTURE_IDS,
] as const;

export type ThemeId = (typeof ALL_THEME_IDS)[number];

/** Resolved registry · one entry per allowed id. The map is exhaustive
 *  so `isAllowedThemeId(id)` + `THEME_PACKAGES[id]` is always safe. */
export const THEME_PACKAGES: Record<ThemeId, ThemePackage> = {
  ocean: OCEAN_PACKAGE,
  coffee: COFFEE_PACKAGE,
  "botanical-cafe": BOTANICAL_CAFE_PACKAGE,
  "midnight-cafe": MIDNIGHT_CAFE_PACKAGE,
  "french-cafe": FRENCH_CAFE_PACKAGE,
  "_test-bundle-a": BUNDLE_A_FIXTURE,
  "_test-bundle-b": BUNDLE_B_FIXTURE,
  "_test-bundle-c": BUNDLE_C_FIXTURE,
};

export function isAllowedThemeId(x: string | undefined): x is ThemeId {
  return (ALL_THEME_IDS as readonly string[]).includes(x ?? "");
}
