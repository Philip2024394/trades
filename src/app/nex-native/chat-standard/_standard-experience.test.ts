// src/app/nex-native/chat-standard/_standard-experience.test.ts
//
// Step 2 · universal Standard Experience asset consumption · sealed
// 2026-10-06.
//
// Protects the architectural rule authorised by the founder: the
// shell renders `pkg.wallpaperUrl` and `pkg.intro.videoUrl`
// universally · no world-specific branches · existing fallback
// behaviour preserved when a package declares the fields as null.
//
// Three layers of coverage:
//
//   A · the Ocean package carries the sealed asset URLs (8672b5a4)
//   B · the shell + overlay actually read those fields in source
//   C · architectural guards · no theme-id branches, no iframes, no
//       category regressions, other Standard Experience packages
//       still leave the fields null (fallback path exercised)

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { OCEAN_PACKAGE } from "./packages/ocean.package";
import { COFFEE_PACKAGE } from "./packages/coffee.package";
import { BOTANICAL_CAFE_PACKAGE } from "./packages/botanical-cafe.package";
import { MIDNIGHT_CAFE_PACKAGE } from "./packages/midnight-cafe.package";
import { FRENCH_CAFE_PACKAGE } from "./packages/french-cafe.package";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const SHELL = path.join(
  REPO_ROOT,
  "src/app/nex-native/chat-standard/_standard-experience.tsx",
);
const INTRO_OVERLAY = path.join(
  REPO_ROOT,
  "src/app/nex-native/chat-standard/_standard-intro-overlay.tsx",
);

// ─── A · Ocean carries the sealed asset URLs ────────────────────────

describe("A · Ocean package carries the sealed Step 2 assets", () => {
  test("ocean.package.ts has `wallpaperUrl: '/nex-themes/ocean-ship.png'`", () => {
    expect(OCEAN_PACKAGE.wallpaperUrl).toBe("/nex-themes/ocean-ship.png");
  });

  test("ocean.package.ts has `intro.videoUrl: '/nex-themes/ocean-intro.mp4'`", () => {
    expect(OCEAN_PACKAGE.intro).toBeDefined();
    expect(OCEAN_PACKAGE.intro?.kind).toBe("standard");
    if (OCEAN_PACKAGE.intro?.kind === "standard") {
      expect(OCEAN_PACKAGE.intro.videoUrl).toBe("/nex-themes/ocean-intro.mp4");
    }
  });

  test("ocean.package.ts intro.playPolicy is twice-then-skip (sealed)", () => {
    if (OCEAN_PACKAGE.intro?.kind === "standard") {
      expect(OCEAN_PACKAGE.intro.playPolicy).toBe("twice-then-skip");
    }
  });
});

// ─── B · the shell + overlay read the package fields ────────────────

describe("B · _standard-experience.tsx consumes pkg.wallpaperUrl", () => {
  const src = fs.readFileSync(SHELL, "utf8");

  test("reads engine.package.wallpaperUrl", () => {
    expect(src).toContain("engine.package.wallpaperUrl");
  });

  test("renders backgroundImage when wallpaperUrl is set", () => {
    expect(src).toContain("backgroundImage");
    expect(src).toContain("packageWallpaperUrl");
  });

  test("preserves the existing gradient fallback branch", () => {
    expect(src).toMatch(/wallpaperFallback\s*===\s*["'`]theme-gradient["'`]/);
    expect(src).toMatch(/radial-gradient\(ellipse at 50% 10%/);
  });

  test("mounts <StandardIntroOverlay engine={engine} /> at the top of the render", () => {
    expect(src).toContain("<StandardIntroOverlay");
    expect(src).toContain('from "./_standard-intro-overlay"');
  });

  test("tags the DOM with data-nex-wallpaper-mode so Playwright / audits can observe which branch rendered", () => {
    expect(src).toContain('data-nex-wallpaper-mode={packageWallpaperUrl ? "image" : "fallback"}');
  });
});

describe("B · _standard-intro-overlay.tsx consumes pkg.intro.videoUrl universally", () => {
  const src = fs.readFileSync(INTRO_OVERLAY, "utf8");

  test("reads engine.package.intro + videoUrl", () => {
    expect(src).toContain("engine.package");
    expect(src).toContain("intro.videoUrl");
  });

  test("respects the sealed twice-then-skip play policy via localStorage counter", () => {
    expect(src).toContain("STANDARD_PLAY_LIMIT");
    expect(src).toContain("twice-then-skip");
    expect(src).toContain("localStorage");
  });

  test("skips the overlay when videoUrl is null", () => {
    // Early return guard · `if (!videoUrl) return null;`
    expect(src).toMatch(/if\s*\(\s*!\s*videoUrl\s*\)\s*return\s+null/);
  });

  test("skips the overlay once the play limit is reached", () => {
    expect(src).toMatch(/playCount\s*>=\s*STANDARD_PLAY_LIMIT/);
  });

  test("handles BusinessIntro `always-when-on` policy without using the twice-then-skip cap", () => {
    expect(src).toContain("isBusinessIntro");
    // The guard that enforces the cap is skipped for BusinessIntro.
    expect(src).toMatch(/if\s*\(\s*isBusinessIntro\s*\)\s*return/);
  });

  test("skip button sits above the video with a stable data attribute", () => {
    expect(src).toContain("data-nex-standard-intro-skip");
    expect(src).toContain('aria-label="Skip intro"');
  });
});

// ─── C · architectural guards ───────────────────────────────────────

describe("C · no world-specific branches · fallback preserved · other packages still null", () => {
  const shellSrc = fs.readFileSync(SHELL, "utf8");
  const overlaySrc = fs.readFileSync(INTRO_OVERLAY, "utf8");

  const FORBIDDEN_ID_BRANCHES: readonly RegExp[] = [
    /pkg\.identity\.id\s*===\s*["'`]ocean["'`]/,
    /engine\.package\.identity\.id\s*===\s*["'`]ocean["'`]/,
    /theme\s*===\s*["'`]ocean["'`]/,
    /themeId\s*===\s*["'`]ocean["'`]/,
    /world\s*===\s*["'`]ocean["'`]/,
    /pkg\.identity\.id\s*===\s*["'`]coffee["'`]/,
    /pkg\.identity\.id\s*===\s*["'`]botanical-cafe["'`]/,
  ];

  test("shell has zero world-specific id checks", () => {
    for (const pat of FORBIDDEN_ID_BRANCHES) {
      expect(shellSrc, `shell must not branch on specific theme id · ${pat}`).not.toMatch(pat);
    }
  });

  test("intro overlay has zero world-specific id checks", () => {
    for (const pat of FORBIDDEN_ID_BRANCHES) {
      expect(overlaySrc, `intro overlay must not branch on specific theme id · ${pat}`).not.toMatch(pat);
    }
  });

  test("shell does not reintroduce an iframe (sealed-away in 8f805d7d)", () => {
    expect(shellSrc.toLowerCase()).not.toContain("<iframe");
  });

  test("intro overlay does not reintroduce an iframe either", () => {
    expect(overlaySrc.toLowerCase()).not.toContain("<iframe");
  });

  test("other Standard Experience packages still declare null for the Step 2 fields (fallback path exercised)", () => {
    // Fallback behaviour is observable only if some packages still
    // declare the fields as null. If every world suddenly carried a
    // wallpaper URL, the fallback branch would be dead code and we
    // couldn't trust the "existing fallback behaviour" guarantee.
    const otherPackages = [
      { name: "coffee", pkg: COFFEE_PACKAGE },
      { name: "botanical-cafe", pkg: BOTANICAL_CAFE_PACKAGE },
      { name: "midnight-cafe", pkg: MIDNIGHT_CAFE_PACKAGE },
      { name: "french-cafe", pkg: FRENCH_CAFE_PACKAGE },
    ] as const;
    for (const { name, pkg } of otherPackages) {
      expect(
        pkg.wallpaperUrl,
        `${name} must still declare wallpaperUrl: null (fallback path exercised)`,
      ).toBeNull();
      if (pkg.intro?.kind === "standard") {
        expect(
          pkg.intro.videoUrl,
          `${name} must still declare intro.videoUrl: null (fallback path exercised)`,
        ).toBeNull();
      }
    }
  });

  test("ocean world's identity.id remains 'ocean' (Step 3 unmade)", () => {
    expect(OCEAN_PACKAGE.identity.id).toBe("ocean");
  });

  test("no 'waterworld' string in the shell or overlay (Step 3 unmade)", () => {
    expect(shellSrc.toLowerCase()).not.toContain("waterworld");
    expect(overlaySrc.toLowerCase()).not.toContain("waterworld");
  });

  test("no changes to _standard-experience-live-client.tsx are required · the fix is in the shell", () => {
    // The shell is what the live-client renders. Step 2 keeps the
    // live-client unchanged by design · the StandardExperienceLiveClient
    // continues to pass only `pkg` to StandardExperience and the shell
    // reads the new fields internally.
    const liveClient = fs.readFileSync(
      path.join(
        REPO_ROOT,
        "src/app/nex-native/themes/[id]/_standard-experience-live-client.tsx",
      ),
      "utf8",
    );
    expect(liveClient).not.toContain("wallpaperUrl");
    expect(liveClient).not.toContain("videoUrl");
    expect(liveClient).not.toContain("StandardIntroOverlay");
  });
});

// ─── D · wallpaper + intro are UNIVERSAL (future-world shape test) ──

describe("D · future-world shape · the shell works for any package that declares the fields", () => {
  test("a package with wallpaperUrl: null + intro.videoUrl: null still renders (gradient + no intro)", () => {
    // Static assertion · the fallback branch in the shell + the early
    // return in the overlay prove this via source read; the pure
    // behaviour is tested here by checking that no code path requires
    // the fields to be non-null.
    const shellSrc = fs.readFileSync(SHELL, "utf8");
    // Shell: the `: {` branch after `packageWallpaperUrl ? {...} : {...}`
    // exists and uses the pre-Step-2 gradient logic.
    expect(shellSrc).toMatch(/packageWallpaperUrl\s*\?\s*\{[\s\S]*?\}\s*:\s*\{/);
    const overlaySrc = fs.readFileSync(INTRO_OVERLAY, "utf8");
    // Overlay: `videoUrl` null OR play count reached ⇒ null render.
    expect(overlaySrc).toMatch(/if\s*\(\s*!\s*videoUrl\s*\)\s*return\s+null/);
  });
});
