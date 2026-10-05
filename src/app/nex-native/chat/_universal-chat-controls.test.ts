// src/app/nex-native/chat/_universal-chat-controls.test.ts
//
// Stage 1 universal-chrome convergence · parity tests · sealed 2026-10-05.
//
// Static source-file assertions that prove, without a DOM render, that
// the production real-chat pages carry the universal functional chrome
// natively through PortraitBloomShell and that no theme-id branches
// remain in those pages.
//
// This spec is intentionally structural (grep-like) · it catches drift
// across every production chat route at once rather than one mount at
// a time.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  getAtmosphereForTheme,
  listAtmosphereThemeIds,
} from "@/lib/nex-native/chat-render/atmosphere-registry";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const PEER_CHAT_PAGE = path.join(
  REPO_ROOT,
  "src/app/nex-native/chat/peer/[accountId]/page.tsx",
);
const BUSINESS_CHAT_PAGE = path.join(
  REPO_ROOT,
  "src/app/nex-native/conversations/[conversationId]/page.tsx",
);
const PORTRAIT_BLOOM_SHELL = path.join(
  REPO_ROOT,
  "src/app/nex-native/chat/_portrait-bloom-shell.tsx",
);
const UNIVERSAL_CHAT_CONTROLS = path.join(
  REPO_ROOT,
  "src/app/nex-native/chat/_universal-chat-controls.tsx",
);
const JOKER_CONTROLLER = path.join(
  REPO_ROOT,
  "src/app/nex-native/themes/[id]/_joker-controller.tsx",
);
const JOKER_CHAT_OVERLAYS = path.join(
  REPO_ROOT,
  "src/app/nex-native/themes/[id]/_joker-chat-overlays.tsx",
);
const THEME_ATMOSPHERE_LAYER = path.join(
  REPO_ROOT,
  "src/app/nex-native/chat/_theme-atmosphere-layer.tsx",
);

function read(p: string): string {
  return fs.readFileSync(p, "utf8");
}

// ─── A · UniversalChatControls carries the sealed universal actions ──

describe("A · UniversalChatControls carries every universal NEX action", () => {
  test("component source declares all five universal actions", () => {
    const src = read(UNIVERSAL_CHAT_CONTROLS);
    expect(src).toContain('data-nex-universal-chat-action="call"');
    expect(src).toContain('data-nex-universal-chat-action="video"');
    expect(src).toContain('data-nex-universal-chat-action="mic"');
    expect(src).toContain('data-nex-universal-chat-action="status"');
    expect(src).toContain('data-nex-universal-chat-action="trust-scan"');
  });

  test("Status action routes to the status viewer", () => {
    const src = read(UNIVERSAL_CHAT_CONTROLS);
    expect(src).toContain('href="/nex-native/dev/status-viewer-v1"');
  });

  test("Trust Scan is a universal shell feature, not a theme feature", () => {
    const src = read(UNIVERSAL_CHAT_CONTROLS);
    expect(src).toContain("TrustScan");
    expect(src).toContain("scannedAccountId");
    expect(src).toContain("viewerAccountId");
  });

  test("the component is a client component (needs state for the 3-dots menu + Trust Scan)", () => {
    const src = read(UNIVERSAL_CHAT_CONTROLS);
    expect(src.trimStart()).toMatch(/^"use client"/);
  });
});

// ─── B · PortraitBloomShell renders UniversalChatControls NATIVELY ──

describe("B · PortraitBloomShell carries universal chat controls natively", () => {
  test("shell imports UniversalChatControls", () => {
    const src = read(PORTRAIT_BLOOM_SHELL);
    expect(src).toContain('import { UniversalChatControls }');
    expect(src).toContain('from "./_universal-chat-controls"');
  });

  test("shell renders <UniversalChatControls /> inside its JSX tree", () => {
    const src = read(PORTRAIT_BLOOM_SHELL);
    expect(src).toContain("<UniversalChatControls");
    // Precondition for universal rendering · the shell MUST accept the
    // scannedAccountId + viewerAccountId props so pages thread them.
    expect(src).toMatch(/scannedAccountId\?:/);
    expect(src).toMatch(/viewerAccountId\?:/);
  });

  test("shell threads scannedAccountId + viewerAccountId into UniversalChatControls", () => {
    const src = read(PORTRAIT_BLOOM_SHELL);
    expect(src).toMatch(
      /<UniversalChatControls[\s\S]{0,300}scannedAccountId=\{scannedAccountId\}[\s\S]{0,100}viewerAccountId=\{viewerAccountId\}/,
    );
  });
});

// ─── C · No theme-id branches in production chat pages ──────────────

describe("C · zero theme-id branches in production chat pages", () => {
  const PRODUCTION_CHAT_PAGES = [PEER_CHAT_PAGE, BUSINESS_CHAT_PAGE];
  const FORBIDDEN_PATTERNS: readonly RegExp[] = [
    /peerThemeRow\?\.id\s*===\s*"theme-0"/,
    /peerThemeRow\?\.id\s*===\s*"haunted-hotel"/,
    /theme\.id\s*===\s*"theme-0"/,
    /theme\.id\s*===\s*"haunted-hotel"/,
    /themeId\s*===\s*"theme-0"/,
    /themeId\s*===\s*"haunted-hotel"/,
  ];

  for (const page of PRODUCTION_CHAT_PAGES) {
    test(`${path.basename(path.dirname(page))}/page.tsx carries no theme-id branches`, () => {
      const src = read(page);
      for (const pat of FORBIDDEN_PATTERNS) {
        expect(src, `pattern ${pat} must not appear in production chat page`).not.toMatch(pat);
      }
    });
  }

  test("peer chat page does not import JokerChatOverlays / HauntedHotelChrome directly", () => {
    const src = read(PEER_CHAT_PAGE);
    expect(src).not.toContain('from "@/app/nex-native/themes/[id]/_joker-chat-overlays"');
    expect(src).not.toContain('from "@/components/nex-native/HauntedHotelChrome"');
  });

  test("peer chat page mounts the declarative ThemeAtmosphereLayer instead", () => {
    const src = read(PEER_CHAT_PAGE);
    expect(src).toContain("ThemeAtmosphereLayer");
    expect(src).toMatch(/<ThemeAtmosphereLayer[\s\S]{0,200}themeId=\{peerThemeRow\?\.id/);
  });
});

// ─── D · Both production chat pages thread the universal props ──────

describe("D · peer + business chat pages thread universal props into the shell", () => {
  test("peer chat passes scannedAccountId + viewerAccountId", () => {
    const src = read(PEER_CHAT_PAGE);
    expect(src).toMatch(/scannedAccountId=\{peer\.id\}/);
    expect(src).toMatch(/viewerAccountId=\{session\.account\.id\}/);
  });

  test("business chat passes a universal viewer context (scannedAccountId=null is intentional)", () => {
    const src = read(BUSINESS_CHAT_PAGE);
    expect(src).toContain("scannedAccountId={null}");
    expect(src).toMatch(/viewerAccountId=\{session\.account\.id\}/);
  });
});

// ─── E · ThemeAtmosphereLayer + atmosphere registry wiring ──────────

describe("E · ThemeAtmosphereLayer and atmosphere registry wire correctly", () => {
  test("atmosphere registry carries entries for the two atmospheric themes", () => {
    const ids = listAtmosphereThemeIds();
    expect(ids).toContain("theme-0");
    expect(ids).toContain("haunted-hotel");
  });

  test("getAtmosphereForTheme returns a component for known theme ids", () => {
    expect(getAtmosphereForTheme("theme-0")).not.toBeNull();
    expect(getAtmosphereForTheme("haunted-hotel")).not.toBeNull();
  });

  test("getAtmosphereForTheme returns null for any other theme id", () => {
    expect(getAtmosphereForTheme("motorbike-rental")).toBeNull();
    expect(getAtmosphereForTheme("vitamins")).toBeNull();
    expect(getAtmosphereForTheme("cakes")).toBeNull();
    expect(getAtmosphereForTheme("ocean")).toBeNull();
    expect(getAtmosphereForTheme(null)).toBeNull();
    expect(getAtmosphereForTheme(undefined)).toBeNull();
  });

  test("ThemeAtmosphereLayer wrapper file exists and reads the registry", () => {
    const src = read(THEME_ATMOSPHERE_LAYER);
    expect(src).toContain("getAtmosphereForTheme");
    expect(src).toContain("ThemeAtmosphereLayer");
  });
});

// ─── F · Trust Scan is removed from Joker's panel (now universal) ───

describe("F · Joker atmosphere no longer owns Trust Scan", () => {
  test("JokerController does not mount Trust Scan + does not export onOpenTrustScan handler usage", () => {
    const src = read(JOKER_CONTROLLER);
    expect(src).not.toMatch(/ActionCard[\s\S]{0,100}NEX Trust Scan/);
    expect(src).not.toMatch(/onOpenTrustScan\(\)/);
    expect(src).not.toMatch(/onOpenTrustScan\?\(\)/);
  });

  test("JokerChatOverlays bundle no longer imports or renders TrustScan component", () => {
    const src = read(JOKER_CHAT_OVERLAYS);
    expect(src).not.toContain("import { TrustScan }");
    expect(src).not.toContain("<TrustScan");
    expect(src).not.toContain("trustScanProvider");
  });

  test("JokerChatOverlays exposes the universal registry-shaped export JokerAtmosphereBundle", () => {
    const src = read(JOKER_CHAT_OVERLAYS);
    expect(src).toContain("JokerAtmosphereBundle");
    expect(src).toMatch(/export function JokerAtmosphereBundle/);
  });
});

// ─── G · Architecture guard · no overlay sibling added at page level ──

describe("G · universal controls are PART OF the shell, not an overlay sibling", () => {
  test("peer chat page does not mount UniversalChatControls as a sibling", () => {
    const src = read(PEER_CHAT_PAGE);
    expect(src).not.toContain("<UniversalChatControls");
  });

  test("business chat page does not mount UniversalChatControls as a sibling", () => {
    const src = read(BUSINESS_CHAT_PAGE);
    expect(src).not.toContain("<UniversalChatControls");
  });

  test("UniversalChatControls lives inside PortraitBloomShell exactly once", () => {
    const src = read(PORTRAIT_BLOOM_SHELL);
    const occurrences = (src.match(/<UniversalChatControls/g) ?? []).length;
    expect(occurrences).toBe(1);
  });
});
