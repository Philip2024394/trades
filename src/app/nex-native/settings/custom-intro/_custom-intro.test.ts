// src/app/nex-native/settings/custom-intro/_custom-intro.test.ts
//
// NEX Phase 1.0 · Custom Intro settings + upload + video serve parity.
// Sealed 2026-10-06.
//
// Source-grep only. Confirms:
//   · page imports the real client + presentation state helper + price
//   · service layer exports the sealed function surface
//   · upload API uses NEX object storage AND verifies entitlement
//   · video serve API enforces ownership
//   · zero client-side "paid = true" fakes anywhere in the surface

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../../..");

const PAGE_FILE = path.join(
  REPO_ROOT,
  "src/app/nex-native/settings/custom-intro/page.tsx",
);
const SERVICE_FILE = path.join(
  REPO_ROOT,
  "src/lib/nex-native/custom-intro-service.ts",
);
const UPLOAD_FILE = path.join(
  REPO_ROOT,
  "src/app/api/nex-native/custom-intro/upload/route.ts",
);
const VIDEO_FILE = path.join(
  REPO_ROOT,
  "src/app/api/nex-native/custom-intro/video/route.ts",
);
const CUSTOM_INTRO_DIR = path.join(
  REPO_ROOT,
  "src/app/nex-native/settings/custom-intro",
);
const SETTINGS_DIR = path.join(REPO_ROOT, "src/app/nex-native/settings");

function readFile(abs: string): string {
  return fs.readFileSync(abs, "utf8");
}

// ─── A · page imports the real client + helpers ──────────────────────

describe("A · page.tsx wires the real surface", () => {
  test("imports CustomIntroClient", () => {
    const src = readFile(PAGE_FILE);
    expect(src).toContain("CustomIntroClient");
  });

  test("imports getCustomIntroPresentationState from the service", () => {
    const src = readFile(PAGE_FILE);
    expect(src).toContain("getCustomIntroPresentationState");
  });

  test("reads CUSTOM_INTRO_PRICE_IDR (symbol or literal 500_000)", () => {
    const src = readFile(PAGE_FILE);
    const hasSymbol = src.includes("CUSTOM_INTRO_PRICE_IDR");
    const hasLiteral = src.includes("500_000");
    expect(hasSymbol || hasLiteral).toBe(true);
  });
});

// ─── B · service exports the sealed function surface ────────────────

describe("B · custom-intro-service exports the sealed surface", () => {
  const REQUIRED = [
    "getCustomIntroRow",
    "getActiveCustomIntroForOwner",
    "getCustomIntroPresentationState",
    "grantEntitlementManual",
    "recordUploadedVideo",
    "setEnabledForOwner",
    "clearUploadedVideoForOwner",
    "validateVideo",
  ] as const;
  for (const fn of REQUIRED) {
    test(`exports ${fn}`, () => {
      const src = readFile(SERVICE_FILE);
      // Accept EITHER a direct function declaration OR a named
      // re-export from a sibling module (`export { fn } from "./..."`).
      // Phase 1.0 moved validateVideo + the config constants into
      // ./custom-intro-config.ts for client-safety · the service
      // re-exports them so backward-compat importers stay valid.
      const direct = new RegExp(
        `export\\s+(?:async\\s+)?function\\s+${fn}\\b`,
      );
      const reExport = new RegExp(
        `export\\s*\\{[^}]*\\b${fn}\\b[^}]*\\}\\s*from\\s*["']`,
      );
      expect(direct.test(src) || reExport.test(src)).toBe(true);
    });
  }
});

// ─── C · upload API uses NEX object storage + entitlement check ─────

describe("C · upload API shape", () => {
  test("calls getObjectStorage()", () => {
    const src = readFile(UPLOAD_FILE);
    expect(src).toContain("getObjectStorage()");
  });

  test("calls recordUploadedVideo", () => {
    const src = readFile(UPLOAD_FILE);
    expect(src).toContain("recordUploadedVideo");
  });

  test("verifies entitlement via getCustomIntroRow", () => {
    const src = readFile(UPLOAD_FILE);
    expect(src).toContain("getCustomIntroRow");
  });

  test("returns 403 when entitlement missing", () => {
    const src = readFile(UPLOAD_FILE);
    expect(src).toContain("403");
  });
});

// ─── D · video serve API enforces ownership ─────────────────────────

describe("D · video serve API enforces ownership", () => {
  test("uses getActiveCustomIntroForOwner for cross-account access", () => {
    const src = readFile(VIDEO_FILE);
    expect(src).toContain("getActiveCustomIntroForOwner");
  });

  test("uses getCustomIntroRow for owner preview access", () => {
    const src = readFile(VIDEO_FILE);
    expect(src).toContain("getCustomIntroRow");
  });
});

// ─── E · no client-side "paid = true" fakes anywhere ────────────────

describe("E · no client-side paid/customIntroEnabled fakes", () => {
  function walkFiles(dir: string): string[] {
    const out: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) {
        continue;
      }
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        out.push(...walkFiles(full));
      } else if (
        entry.name.endsWith(".ts") ||
        entry.name.endsWith(".tsx")
      ) {
        out.push(full);
      }
    }
    return out;
  }

  test("no 'paid = true' or 'customIntroEnabled = true' in custom-intro dir", () => {
    for (const file of walkFiles(CUSTOM_INTRO_DIR)) {
      const src = fs.readFileSync(file, "utf8");
      expect(src, `${file}`).not.toContain("paid = true");
      expect(src, `${file}`).not.toContain("customIntroEnabled = true");
    }
  });

  test("no 'paid = true' or 'customIntroEnabled = true' in settings dir", () => {
    // Note: this walks the whole settings tree. We only reject the two
    // sealed anti-patterns · everything else may contain the word "paid"
    // (e.g. a comment).
    for (const file of walkFiles(SETTINGS_DIR)) {
      const src = fs.readFileSync(file, "utf8");
      expect(src, `${file}`).not.toContain("paid = true");
      expect(src, `${file}`).not.toContain("customIntroEnabled = true");
    }
  });
});
