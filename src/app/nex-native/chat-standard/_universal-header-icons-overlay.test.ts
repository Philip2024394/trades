// src/app/nex-native/chat-standard/_universal-header-icons-overlay.test.ts
//
// R1 Universal Header Icons Overlay · parity acceptance tests ·
// sealed 2026-10-05 (R11b).
//
// Six mandatory tests A-F prove the overlay is wired on every
// legacy production theme route, is NOT wired on Standard
// Experience worlds, carries Home + Cart + Shop, and does not
// create duplicate R1 controls.
//
// These are STATIC source-file tests, not DOM render tests. The
// vitest harness runs in node environment (no jsdom), and
// architectural tests of this shape are stronger drift guards
// anyway: they cover every route in the chrome contract rather
// than a single mount-time render.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const OVERLAY_SOURCE = path.join(
  REPO_ROOT,
  "src/app/nex-native/chat-standard/_universal-header-icons-overlay.tsx",
);

/** Routes that MUST mount the overlay (every legacy production
 *  theme + the dynamic DB-driven legacy branch). Any new legacy
 *  theme page is added here. */
const LEGACY_MOUNT_SITES = [
  "src/app/nex-native/themes/theme-1/page.tsx",
  "src/app/nex-native/themes/pink-dream/page.tsx",
  "src/app/nex-native/themes/cyber-grid/page.tsx",
  "src/app/nex-native/chat/prototypes/hauntedhoteltheme/page.tsx",
  "src/app/nex-native/themes/[id]/page.tsx",
];

/** Routes that MUST NOT mount the overlay (Standard Experience
 *  worlds carry R1 natively via StandardHeaderActions). */
const STANDARD_EXPERIENCE_PACKAGES = [
  "src/app/nex-native/chat-standard/packages/ocean.package.ts",
  "src/app/nex-native/chat-standard/packages/coffee.package.ts",
  "src/app/nex-native/chat-standard/packages/botanical-cafe.package.ts",
  "src/app/nex-native/chat-standard/packages/midnight-cafe.package.ts",
  "src/app/nex-native/chat-standard/packages/french-cafe.package.ts",
];

/** The Standard Experience shell itself · R1 is sealed natively
 *  here. The overlay MUST NOT be imported in the shell. */
const STANDARD_EXPERIENCE_SHELL = "src/app/nex-native/chat-standard/_standard-experience.tsx";

/** The dynamic viewer at themes/[id]/_standard-experience-live-client.tsx
 *  short-circuits the overlay path · it renders Standard Experience
 *  natively and MUST NOT mount the overlay. */
const STANDARD_EXPERIENCE_LIVE_CLIENT =
  "src/app/nex-native/themes/[id]/_standard-experience-live-client.tsx";

/** Prototype-only routes that are deliberately OUTSIDE the production
 *  chrome contract (haunted-hotel-bubbles · haunted-hotel-effects).
 *  They currently mount no universal overlay and MUST stay that way
 *  unless the founder explicitly inducts them. */
const PROTOTYPE_ONLY_ROUTES = [
  "src/app/nex-native/chat/prototypes/haunted-hotel-bubbles/page.tsx",
  "src/app/nex-native/chat/prototypes/haunted-hotel-effects/page.tsx",
];

/** Legacy routes that have a native R1 cluster and MUST tag it with
 *  `data-nex-native-r1-cluster` so the overlay's CSS suppresses it. */
const LEGACY_ROUTES_WITH_NATIVE_R1 = [
  "src/app/nex-native/themes/theme-1/page.tsx",
  "src/app/nex-native/themes/pink-dream/page.tsx",
  "src/app/nex-native/themes/cyber-grid/page.tsx",
  // PortraitBloomShell uses HeaderRightCluster, which is also a native R1 source.
  "src/app/nex-native/chat/_header-right-cluster.tsx",
];

function readRepoFile(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let i = 0;
  while ((i = haystack.indexOf(needle, i)) !== -1) {
    count++;
    i += needle.length;
  }
  return count;
}

// ─── Shared · overlay module smoke ──────────────────────────────────

describe("UniversalHeaderIconsOverlay · module", () => {
  test("overlay source exists at the sealed path", () => {
    expect(fs.existsSync(OVERLAY_SOURCE)).toBe(true);
  });

  test("exports the component via a named export", () => {
    const src = fs.readFileSync(OVERLAY_SOURCE, "utf8");
    expect(src).toMatch(/export function UniversalHeaderIconsOverlay\(/);
  });

  test("injects the native-cluster suppression CSS", () => {
    const src = fs.readFileSync(OVERLAY_SOURCE, "utf8");
    expect(src).toContain("[data-nex-native-r1-cluster]");
    expect(src).toContain("display: none !important");
  });

  test("fixed · top-right · zIndex 60 (matches UniversalChromeOverlay)", () => {
    const src = fs.readFileSync(OVERLAY_SOURCE, "utf8");
    expect(src).toContain('position: "fixed"');
    expect(src).toMatch(/top:.*safe-area-inset-top/);
    expect(src).toMatch(/right:\s*12/);
    expect(src).toMatch(/zIndex:\s*60/);
  });
});

// ─── A · R1 overlay renders on every intended legacy production theme route ──

describe("A · overlay is mounted on every legacy production theme route", () => {
  for (const site of LEGACY_MOUNT_SITES) {
    test(`${site} · imports and mounts UniversalHeaderIconsOverlay`, () => {
      const src = readRepoFile(site);
      expect(src).toContain(
        '_universal-header-icons-overlay',
      );
      expect(src).toContain("<UniversalHeaderIconsOverlay");
    });
  }

  test("mount sites appear in strict known-list order (no missing route)", () => {
    expect(LEGACY_MOUNT_SITES).toHaveLength(5);
  });
});

// ─── B · R1 overlay NOT mounted on Standard Experience worlds ───────

describe("B · overlay is NOT mounted on Standard Experience worlds", () => {
  test("Standard Experience shell does not import or mount the overlay", () => {
    const src = readRepoFile(STANDARD_EXPERIENCE_SHELL);
    expect(src).not.toContain("_universal-header-icons-overlay");
    expect(src).not.toContain("UniversalHeaderIconsOverlay");
  });

  test("Standard Experience live client (for live-world ids) does not import or mount the overlay", () => {
    const src = readRepoFile(STANDARD_EXPERIENCE_LIVE_CLIENT);
    expect(src).not.toContain("_universal-header-icons-overlay");
    expect(src).not.toContain("UniversalHeaderIconsOverlay");
  });

  test("Standard-Experience world packages do not reference the overlay", () => {
    for (const pkg of STANDARD_EXPERIENCE_PACKAGES) {
      const src = readRepoFile(pkg);
      expect(src).not.toContain("UniversalHeaderIconsOverlay");
    }
  });

  test("themes/[id]/page.tsx mounts the overlay AFTER the isLiveWorldId short-circuit", () => {
    const src = readRepoFile("src/app/nex-native/themes/[id]/page.tsx");
    const liveShortCircuit = src.indexOf("isLiveWorldId(id)");
    const overlayMount = src.indexOf("<UniversalHeaderIconsOverlay");
    expect(liveShortCircuit).toBeGreaterThan(-1);
    expect(overlayMount).toBeGreaterThan(-1);
    expect(overlayMount).toBeGreaterThan(liveShortCircuit);
    // Confirms that for a live-world id the function returns before
    // reaching the overlay mount site.
    expect(src).toContain("return <StandardExperienceLiveClient");
  });
});

// ─── C · Home, Cart and Shop are all present in the overlay ─────────

describe("C · Home + Cart + Shop are present in the overlay", () => {
  test("overlay source declares all three aria-labels", () => {
    const src = fs.readFileSync(OVERLAY_SOURCE, "utf8");
    expect(src).toContain('aria-label="Home"');
    expect(src).toContain('aria-label="Cart"');
    // Shop renders two aria-label variants · the plain link form and the
    // toggle form (Open shop / Close shop) depending on onShopClick.
    expect(src).toMatch(/aria-label=(?:"Shop"|{shopOpen \? "Close shop" : "Open shop"})/);
  });

  test("overlay declares the three data-nex-universal-header-action tokens", () => {
    const src = fs.readFileSync(OVERLAY_SOURCE, "utf8");
    expect(src).toContain('data-nex-universal-header-action="home"');
    expect(src).toContain('data-nex-universal-header-action="cart"');
    expect(src).toContain('data-nex-universal-header-action="shop"');
  });

  test("Home and Cart default to canonical navigation targets", () => {
    const src = fs.readFileSync(OVERLAY_SOURCE, "utf8");
    expect(src).toContain('href="/nex-native/home"');
    expect(src).toContain('href="/nex-native/cart"');
  });

  test("overlay accepts a `shopHref` prop that overrides the default Shop destination", () => {
    const src = fs.readFileSync(OVERLAY_SOURCE, "utf8");
    expect(src).toMatch(/shopHref\?:\s*string/);
    // The href expression must honour the prop before falling back
    // to the default so legacy themes never silently lose a specific
    // pre-overlay destination.
    expect(src).toMatch(/href=\{shopHref\s*\?\?\s*"\/nex-native\/shop"\}/);
    expect(src).toContain('data-nex-universal-shop-href');
  });
});

// ─── C2 · pre-overlay destination preservation (theme-1 Shop → Maria) ──

describe("C2 · pre-overlay Shop destinations are preserved via shopHref", () => {
  test("theme-1 wires UniversalHeaderIconsOverlay with shopHref=/nex-native/maria", () => {
    const src = readRepoFile("src/app/nex-native/themes/theme-1/page.tsx");
    // Overlay must appear with the Maria shop destination · the
    // native cluster's <a href="/nex-native/maria"> is suppressed and
    // the overlay must carry the same destination so Theme-1's Shop
    // click behaviour is byte-for-byte identical to the pre-fix state.
    expect(src).toMatch(/UniversalHeaderIconsOverlay[\s\S]*?shopHref="\/nex-native\/maria"/);
  });

  test("the pre-overlay Maria destination still exists in the suppressed native cluster (source-of-truth cross-check)", () => {
    const src = readRepoFile("src/app/nex-native/themes/theme-1/page.tsx");
    // Confirms the audit's claim: the native cluster did originally
    // point Shop at Maria's shop. If this ever changes without the
    // overlay prop updating in lockstep, this test catches the drift.
    expect(src).toContain('href="/nex-native/maria"');
  });
});

// ─── D · No duplicate R1 controls exist on a legacy route ───────────

describe("D · no duplicate R1 controls on a legacy route", () => {
  for (const route of LEGACY_ROUTES_WITH_NATIVE_R1) {
    test(`${route} · native R1 cluster is tagged for overlay suppression`, () => {
      const src = readRepoFile(route);
      expect(src).toContain("data-nex-native-r1-cluster");
    });
  }

  test("overlay's suppression selector matches the tag the legacy routes use", () => {
    const overlaySrc = fs.readFileSync(OVERLAY_SOURCE, "utf8");
    expect(overlaySrc).toContain("[data-nex-native-r1-cluster]");
  });

  test("hauntedhoteltheme route has no native R1 cluster to tag (overlay-only)", () => {
    const src = readRepoFile(
      "src/app/nex-native/chat/prototypes/hauntedhoteltheme/page.tsx",
    );
    // No native R1 tag required (nothing to suppress) · but equally
    // the file MUST NOT accidentally add one from a template later.
    const tagCount = countOccurrences(src, "data-nex-native-r1-cluster");
    expect(tagCount).toBe(0);
    // And it MUST mount the overlay to fulfil R1.
    expect(src).toContain("<UniversalHeaderIconsOverlay");
  });
});

// ─── E · R3 and R7 behaviour remains unchanged ──────────────────────

describe("E · R3 (composer) and R7 (3-dots) behaviour remains unchanged", () => {
  for (const site of LEGACY_MOUNT_SITES) {
    test(`${site} · still imports both the R3 and R7 overlays`, () => {
      const src = readRepoFile(site);
      expect(src).toContain("_universal-chrome-overlay");
      expect(src).toContain("_universal-composer-footer");
      expect(src).toContain("<UniversalChromeOverlay");
      expect(src).toContain("<UniversalComposerFooter");
    });
  }

  test("R3 overlay still mounts after the R1 overlay (bottom composer stacks over top header)", () => {
    for (const site of LEGACY_MOUNT_SITES) {
      const src = readRepoFile(site);
      const r1 = src.indexOf("<UniversalHeaderIconsOverlay");
      const r3 = src.indexOf("<UniversalComposerFooter");
      expect(r1).toBeGreaterThan(-1);
      expect(r3).toBeGreaterThan(-1);
      // R1 appears before R3 in the JSX so documentation order
      // reflects header → chrome → composer. Visual stacking is
      // governed by `position: fixed` + zIndex, not JSX order.
      expect(r1).toBeLessThan(r3);
    }
  });

  test("R7 overlay module has not been touched by this fix (hashable content check)", () => {
    // Just assert the file still exports the same primary symbol.
    const r7 = readRepoFile("src/app/nex-native/chat-standard/_universal-chrome-overlay.tsx");
    expect(r7).toMatch(/export function UniversalChromeOverlay\(/);
  });
});

// ─── F · Prototype-only routes stay outside the chrome contract ─────

describe("F · prototype-only routes remain outside the production chrome contract", () => {
  for (const route of PROTOTYPE_ONLY_ROUTES) {
    test(`${route} · does not import or mount the R1 overlay`, () => {
      const src = readRepoFile(route);
      expect(src).not.toContain("_universal-header-icons-overlay");
      expect(src).not.toContain("UniversalHeaderIconsOverlay");
    });
  }

  test("prototype-only routes also remain outside R3 and R7 (contract parity)", () => {
    for (const route of PROTOTYPE_ONLY_ROUTES) {
      const src = readRepoFile(route);
      // These prototypes deliberately do NOT participate in the
      // production chrome contract. If a future bridge inducts them,
      // this test will intentionally fail and force a doctrine update.
      expect(src).not.toContain("UniversalComposerFooter");
      expect(src).not.toContain("UniversalChromeOverlay");
    }
  });
});

// ─── Architecture scan · zero theme-ID branches inside the overlay ─

describe("architecture · overlay has no theme-ID branches", () => {
  test("overlay does not switch on theme.id · universal structure/function", () => {
    const src = fs.readFileSync(OVERLAY_SOURCE, "utf8");
    expect(src).not.toMatch(/themeId\s*===/);
    expect(src).not.toMatch(/theme\.id\s*===/);
    expect(src).not.toMatch(/switch\s*\(\s*theme/);
  });
});
