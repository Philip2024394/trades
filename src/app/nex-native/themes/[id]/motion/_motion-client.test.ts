// src/app/nex-native/themes/[id]/motion/_motion-client.test.ts
//
// Animation Gallery UX + Colour · regression guard · sealed 2026-10-06.
//
// Protects the three founder-sealed requirements:
//
//   1. Universal Theme Colour Rule applies to the Animation Gallery ·
//      every surface derives from the active world's resolved
//      ThemePackage · zero generic NEX palette inline · zero per-id
//      branches.
//   2. User-facing copy is experiential · never developer-tone (no
//      "reads X" / RGB / scanline / "toxic" / radial / etc).
//   3. 1–2 animations carry a data-driven NEW flag · the badge is
//      theme-aware · not hardcoded into the layout.
//
// Four coverage sections:
//
//   A · data file carries user-friendly labels + descriptions · NEW
//       flag is sparse (1–2 total) · specific renames landed
//   B · motion/page.tsx (server) derives from resolveGalleryColours ·
//       no hardcoded palette · heading + subcopy are experiential
//   C · motion/_motion-client.tsx (client) consumes colours prop ·
//       no joker-only palette · NEW badge wired · # badges removed
//   D · architectural guards · no per-id colour branches · no second
//       colour system · doctrine comment present in both files

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { JOKER_MOTION_INDEX } from "../_joker-motion-data";

const REPO_ROOT = path.resolve(__dirname, "../../../../../..");
const PAGE = path.join(
  REPO_ROOT,
  "src/app/nex-native/themes/[id]/motion/page.tsx",
);
const CLIENT = path.join(
  REPO_ROOT,
  "src/app/nex-native/themes/[id]/motion/_motion-client.tsx",
);
const DATA = path.join(
  REPO_ROOT,
  "src/app/nex-native/themes/[id]/_joker-motion-data.ts",
);
const RESOLVER = path.join(
  REPO_ROOT,
  "src/app/nex-native/themes/[id]/motion/_resolve-gallery-engine.ts",
);

// ─── A · data file · user copy + NEW flag ──────────────────────────

describe("A · _joker-motion-data.ts carries user-facing copy + NEW metadata", () => {
  test("still has 10 animation variants (none dropped)", () => {
    expect(JOKER_MOTION_INDEX).toHaveLength(10);
  });

  test("every row has a label + description + variant", () => {
    for (const row of JOKER_MOTION_INDEX) {
      expect(row.variant).toBeTruthy();
      expect(row.label).toBeTruthy();
      expect(row.description).toBeTruthy();
    }
  });

  test("specific renames landed (Rain → Rainfall · Toxic Bubbles → Rising Bubbles · Confetti Chaos → Confetti · CRT Glitch → Glitch)", () => {
    const byVariant = Object.fromEntries(
      JOKER_MOTION_INDEX.map((r) => [r.variant, r.label] as const),
    );
    expect(byVariant.rain).toBe("Rainfall");
    expect(byVariant.bubbles).toBe("Rising Bubbles");
    expect(byVariant.confetti).toBe("Confetti");
    expect(byVariant.glitch).toBe("Glitch");
  });

  test("exactly 1 or 2 variants are marked isNew: true (NEW stays meaningful)", () => {
    const newCount = JOKER_MOTION_INDEX.filter((r) => r.isNew === true).length;
    expect(newCount).toBeGreaterThanOrEqual(1);
    expect(newCount).toBeLessThanOrEqual(2);
  });

  test("descriptions use experiential language · no developer-tone words", () => {
    // These phrases are the signature of the pre-sealed developer
    // copy · their presence anywhere in a user-facing description
    // is a regression.
    const forbiddenPhrases = [
      /reads\s+(calm|moody|industrial|dangerous|gothic|theatrical|playful|mischievous|dramatic|high-stakes|poison|potion|covert|smouldering|warm|digital|broken-mirror)/i,
      /\bRGB shift/i,
      /\bradial-gradient/i,
      /\bscanline/i,
      /\btranslucent streaks/i,
      /\btoxic\b/i,
      /\bpixel\b/i,
      /every \d+-\d+s/i,
      /~\d+ms/i,
    ];
    for (const row of JOKER_MOTION_INDEX) {
      for (const pat of forbiddenPhrases) {
        expect(
          row.description,
          `${row.variant} description must not contain developer-tone pattern ${pat}`,
        ).not.toMatch(pat);
      }
    }
  });

  test("descriptions stay short + welcoming · under 120 characters each", () => {
    for (const row of JOKER_MOTION_INDEX) {
      expect(row.description.length, `${row.variant} description too long`).toBeLessThanOrEqual(120);
    }
  });

  test("isNew is optional (future-additions ergonomic)", () => {
    // A row omitting `isNew` must still typecheck · verified at the
    // data level by presence of a row without the key.
    const withoutFlag = JOKER_MOTION_INDEX.filter(
      (r) => r.isNew === undefined,
    );
    expect(withoutFlag.length).toBeGreaterThan(0);
  });
});

// ─── B · motion/page.tsx · server-side theme derivation ────────────

describe("B · motion/page.tsx derives from the resolved theme palette", () => {
  const src = fs.readFileSync(PAGE, "utf8");

  test("imports and calls resolveGalleryColours(id)", () => {
    expect(src).toContain("resolveGalleryColours");
    expect(src).toMatch(/await\s+resolveGalleryColours\(/);
  });

  test("passes resolved colours to <MotionGalleryClient /> as a prop", () => {
    expect(src).toMatch(/MotionGalleryClient[\s\S]*?colours\s*=\s*\{\s*colours\s*\}/);
  });

  test("heading reads 'Bring your world to life' (not the old dev title)", () => {
    expect(src).toContain("Bring your world to life");
    expect(src).not.toContain("Ten animation effects to choose from");
  });

  test("subcopy is experiential · mentions atmosphere · promises new additions", () => {
    expect(src.toLowerCase()).toContain("atmosphere");
    expect(src.toLowerCase()).toContain("new animations");
    // Pre-sealed subcopy flagged as developer-tone must not return.
    expect(src).not.toContain("Toggle any effect on with the switch");
  });

  test("source does NOT inline the removed joker-era palette hex", () => {
    // These five hexes drove the entire pre-sealed gallery chrome.
    // Their reappearance in page.tsx would prove the rule has been
    // bypassed.
    expect(src).not.toContain("#070b0f");
    expect(src).not.toContain("#8FFF6E");
    expect(src).not.toContain("#8BA9D1");
    expect(src).not.toContain("#F4F7FC");
    expect(src).not.toContain("#DDE9FA");
  });

  test("source does NOT redeclare a generic palette constant", () => {
    expect(src).not.toMatch(/const\s+NEX\s*=\s*\{/);
    expect(src).not.toMatch(/const\s+GALLERY_COLOURS\s*=\s*\{/);
  });

  test("source carries the sealed Universal Theme Colour Rule doctrine comment", () => {
    expect(src.toLowerCase()).toContain("universal theme colour rule");
  });
});

// ─── C · _motion-client.tsx · client-side theme derivation ─────────

describe("C · _motion-client.tsx consumes resolved colours · NEW badge wired", () => {
  const src = fs.readFileSync(CLIENT, "utf8");

  test("accepts `colours: Required<ColourSystem>` as a prop", () => {
    expect(src).toContain("Required<ColourSystem>");
    expect(src).toContain("colours");
  });

  test("source does NOT inline the removed joker-era palette", () => {
    // Original gallery leaned on a joker-green palette (#8FFF6E +
    // supporting greys). None of these may reappear as literals in
    // the client.
    expect(src).not.toContain("#8FFF6E");
    expect(src).not.toContain("#5fcf3f");
    expect(src).not.toContain("#8BA9D1");
    expect(src).not.toContain("#F4F7FC");
    expect(src).not.toContain("#0A2010");
    expect(src).not.toContain("#DDE9FA");
    // Legacy semi-transparent whites/blacks removed when the status
    // strip + card + toggle were theme-tinted.
    expect(src).not.toMatch(/rgba\(143,\s*255,\s*110,/);
    expect(src).not.toMatch(/rgba\(139,\s*169,\s*209,/);
    expect(src).not.toMatch(/rgba\(10,\s*22,\s*36,/);
    expect(src).not.toMatch(/rgba\(255,\s*255,\s*255,/);
    expect(src).not.toMatch(/rgba\(0,\s*0,\s*0,/);
  });

  test("every tint derives from `colours.*` via withAlpha or direct read", () => {
    expect(src).toMatch(/colours\.primary/);
    expect(src).toMatch(/colours\.secondary/);
    expect(src).toMatch(/colours\.deep/);
    expect(src).toMatch(/colours\.highlight/);
  });

  test("number badge pattern (#01 … #10) is REMOVED from the card chrome", () => {
    // The pre-sealed card prominently rendered `#01`-`#10` number
    // badges · the founder sealed their removal as a developer-style
    // treatment that doesn't belong in the user experience.
    expect(src).not.toMatch(/String\(number\)\.padStart\(2,\s*["']0["']\)/);
    expect(src).not.toContain("number: number");
  });

  test("NEW badge is rendered conditionally when row.isNew is true", () => {
    expect(src).toContain("data-nex-new-badge");
    expect(src).toMatch(/isNew\s*&&/);
    expect(src).toContain("New");
  });

  test("NEW badge is a UNIVERSAL NEX semantic indicator · theme-independent gold (sealed 2026-10-06)", () => {
    // Founder sealed the NEW badge as a universal NEX semantic
    // signal: "there is something new here" needs to be instantly
    // recognisable regardless of World palette. This test guards
    // against a future bridge accidentally re-wiring it back to
    // theme colours.
    const badgeBlock = src.slice(
      src.indexOf("data-nex-new-badge"),
      src.indexOf("</span>", src.indexOf("data-nex-new-badge")),
    );
    // Must reference the centralised universal constants · never a
    // theme-derived colour.
    expect(badgeBlock).toContain("NEW_BADGE_GOLD");
    expect(badgeBlock).toContain("NEW_BADGE_INK");
    expect(badgeBlock).toContain("NEW_BADGE_GLOW");
    expect(badgeBlock).not.toContain("colours.primary");
    expect(badgeBlock).not.toContain("colours.deep");
    expect(badgeBlock).not.toContain("colours.secondary");
    expect(badgeBlock).not.toContain("colours.highlight");
  });

  test("NEW badge gold constant is bright yellow/gold · not an off-theme accent", () => {
    // Pin the exact gold hex so a future tweak flows through this
    // test · the pair must stay bright gold + near-black ink for
    // strong contrast on every World background.
    expect(src).toContain('const NEW_BADGE_GOLD = "#FFD54A"');
    expect(src).toContain('const NEW_BADGE_INK = "#1A1300"');
  });

  test("NEW badge carries a subtle pulse (keyframes mounted · animation applied)", () => {
    // Pulse keyframes must be defined AND actually applied to the
    // badge · if either half is missing the badge sits static.
    expect(src).toContain("@keyframes nex-new-badge-pulse");
    expect(src).toMatch(/animation:\s*["'`]nex-new-badge-pulse/);
    expect(src).toContain("<style>{NEW_BADGE_PULSE_KEYFRAMES}</style>");
  });

  test("source carries the sealed Universal Theme Colour Rule doctrine comment", () => {
    expect(src.toLowerCase()).toContain("universal theme colour rule");
  });
});

// ─── D · architectural guards ───────────────────────────────────────

describe("D · no per-theme-id branches · no second colour system · universal shape", () => {
  const pageSrc = fs.readFileSync(PAGE, "utf8");
  const clientSrc = fs.readFileSync(CLIENT, "utf8");
  const dataSrc = fs.readFileSync(DATA, "utf8");

  const FORBIDDEN_ID_BRANCHES: readonly RegExp[] = [
    /\btheme\s*===\s*["'`]ocean["'`]/,
    /\btheme\s*===\s*["'`]coffee["'`]/,
    /\btheme\s*===\s*["'`]joker["'`]/,
    /\btheme\s*===\s*["'`]cafe["'`]/,
    /\bthemeId\s*===\s*["'`]ocean["'`]/,
    /\bthemeId\s*===\s*["'`]joker["'`]/,
    /\bid\s*===\s*["'`]ocean["'`]/,
    /\bid\s*===\s*["'`]joker["'`]/,
  ];

  test("page.tsx has zero per-theme-id colour branches", () => {
    for (const pat of FORBIDDEN_ID_BRANCHES) {
      expect(pageSrc, `page.tsx must not branch on specific theme id · ${pat}`).not.toMatch(pat);
    }
  });

  test("client has zero per-theme-id colour branches", () => {
    for (const pat of FORBIDDEN_ID_BRANCHES) {
      expect(clientSrc, `client must not branch on specific theme id · ${pat}`).not.toMatch(pat);
    }
  });

  test("data file has zero per-theme-id branches (data is universal)", () => {
    for (const pat of FORBIDDEN_ID_BRANCHES) {
      expect(dataSrc).not.toMatch(pat);
    }
  });

  test("no second colour system invented · resolver imports from engine's live-worlds + chat-theme-service", () => {
    const resolverSrc = fs.readFileSync(RESOLVER, "utf8");
    expect(resolverSrc).toContain("LIVE_WORLD_PACKAGES");
    expect(resolverSrc).toContain("chatThemeService");
    // The resolver MIRRORS the engine's defaults (sealed in-source
    // comment) · the mirror is permitted but a new palette with
    // different values is not.
    expect(resolverSrc).toContain("#00AFFF"); // NEX cyan = engine default
    expect(resolverSrc).toContain("#020914"); // NEX deep = engine default
  });
});
