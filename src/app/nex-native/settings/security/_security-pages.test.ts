// src/app/nex-native/settings/security/_security-pages.test.ts
//
// NEX Phase 1.0 Security · universal 5-artefact enforcement test.
// Sealed 2026-10-06 · parity suite for the /settings/security surface.
//
// Pattern: deterministic source-grep + unit-shape. No DB, no network.
// Follows src/app/nex-native/chat-themes-library/_category-grid.test.ts.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  SECURITY_ROUTES,
  getSecurityRoute,
} from "./_security-routes";

const REPO_ROOT = path.resolve(__dirname, "../../../../..");
const SHELL_FILE = path.join(
  REPO_ROOT,
  "src/app/nex-native/settings/security/_security-page-shell.tsx",
);

// ─── A · route registry shape ─────────────────────────────────────────

describe("A · SECURITY_ROUTES registry", () => {
  test("exports exactly 4 routes with expected keys", () => {
    expect(SECURITY_ROUTES.length).toBe(4);
    const keys = SECURITY_ROUTES.map((r) => r.key).sort();
    expect(keys).toEqual(["activity", "devices", "landing", "password"].sort());
  });

  test("getSecurityRoute returns a record for each known key", () => {
    for (const route of SECURITY_ROUTES) {
      const resolved = getSecurityRoute(route.key);
      expect(resolved).not.toBeNull();
      expect(resolved?.key).toBe(route.key);
    }
  });

  test("getSecurityRoute returns null for an unknown key", () => {
    expect(getSecurityRoute("not-a-key")).toBeNull();
    expect(getSecurityRoute("")).toBeNull();
  });
});

// ─── B · every registered file exists on disk ─────────────────────────

describe("B · every registered page.tsx exists on disk", () => {
  for (const route of SECURITY_ROUTES) {
    test(`route "${route.key}" file resolves on disk`, () => {
      const abs = path.join(REPO_ROOT, route.file);
      const stat = fs.statSync(abs);
      expect(stat.isFile()).toBe(true);
    });
  }
});

// ─── C · every page imports SecurityPageShell ─────────────────────────

describe("C · every registered page imports SecurityPageShell", () => {
  for (const route of SECURITY_ROUTES) {
    test(`route "${route.key}" imports SecurityPageShell`, () => {
      const abs = path.join(REPO_ROOT, route.file);
      const src = fs.readFileSync(abs, "utf8");
      expect(src).toContain("SecurityPageShell");
      // Landing page sits next to the shell → ./ import. Deeper pages → ../.
      const landingImport = /from\s+"\.\/_security-page-shell"/.test(src);
      const deeperImport = /from\s+"\.\.\/_security-page-shell"/.test(src);
      expect(landingImport || deeperImport).toBe(true);
    });
  }
});

// ─── D · every page renders <SecurityPageShell ────────────────────────

describe("D · every registered page renders <SecurityPageShell", () => {
  for (const route of SECURITY_ROUTES) {
    test(`route "${route.key}" renders <SecurityPageShell at least once`, () => {
      const abs = path.join(REPO_ROOT, route.file);
      const src = fs.readFileSync(abs, "utf8");
      expect(src).toContain("<SecurityPageShell");
    });
  }
});

// ─── E · every page carries the Phase 1.0 Security doctrine comment ──

describe("E · every registered page carries the doctrine comment", () => {
  for (const route of SECURITY_ROUTES) {
    test(`route "${route.key}" source contains "Phase 1.0 Security"`, () => {
      const abs = path.join(REPO_ROOT, route.file);
      const src = fs.readFileSync(abs, "utf8");
      expect(src).toContain("Phase 1.0 Security");
    });
  }
});

// ─── F · shell exports both components ────────────────────────────────

describe("F · _security-page-shell exports", () => {
  test("exports SecurityPageShell", () => {
    const src = fs.readFileSync(SHELL_FILE, "utf8");
    expect(src).toMatch(/export\s+function\s+SecurityPageShell\s*\(/);
  });

  test("exports SecurityDashboardSnippet", () => {
    const src = fs.readFileSync(SHELL_FILE, "utf8");
    expect(src).toMatch(/export\s+function\s+SecurityDashboardSnippet\s*\(/);
  });
});

// ─── G · dashboard rows carry the data attribute ─────────────────────

describe("G · Dashboard rows carry data-nex-security-dashboard-row", () => {
  test("shell source references the row attribute", () => {
    const src = fs.readFileSync(SHELL_FILE, "utf8");
    expect(src).toContain("data-nex-security-dashboard-row");
  });
});

// ─── H · 2FA row says "Not enabled" ──────────────────────────────────

describe("H · 2FA dashboard row MUST say 'Not enabled'", () => {
  test("shell source contains the exact 'Not enabled' string for 2FA", () => {
    const src = fs.readFileSync(SHELL_FILE, "utf8");
    // Accept either plain "Not enabled" or the richer sealed text.
    const hasPlain = src.includes('"Not enabled"');
    const hasFull = src.includes("Not enabled · Coming in Phase 1.1");
    expect(hasPlain || hasFull).toBe(true);
  });

  test("shell source MUST NOT claim 2FA is enabled", () => {
    const src = fs.readFileSync(SHELL_FILE, "utf8");
    // Grep for the dangerous drift. We tolerate the word "enabled"
    // generally (it appears in "Not enabled") but reject a literal
    // 2FA "Enabled" status string that would mislead the owner.
    expect(src).not.toMatch(/key:\s*"2fa"[^]*?status:\s*"Enabled"/);
  });
});

// ─── I · MaxMind attribution footer ──────────────────────────────────

describe("I · MaxMind attribution is present in the shell", () => {
  test("shell source contains the MaxMind attribution", () => {
    const src = fs.readFileSync(SHELL_FILE, "utf8");
    const hasGeoLite = src.includes("GeoLite2 by MaxMind");
    const hasOriginal = src.includes("GeoLite2 Data created by MaxMind");
    expect(hasGeoLite || hasOriginal).toBe(true);
  });
});

// ─── J · no iframe anywhere in the Security surface ──────────────────

describe("J · sealed anti-iframe doctrine", () => {
  test("no registered page contains <iframe or createElement('iframe'", () => {
    for (const route of SECURITY_ROUTES) {
      const abs = path.join(REPO_ROOT, route.file);
      const src = fs.readFileSync(abs, "utf8");
      expect(src).not.toContain("<iframe");
      expect(src).not.toMatch(/createElement\(\s*["']iframe["']/);
    }
  });

  test("the shell itself does not contain an iframe", () => {
    const src = fs.readFileSync(SHELL_FILE, "utf8");
    expect(src).not.toContain("<iframe");
    expect(src).not.toMatch(/createElement\(\s*["']iframe["']/);
  });
});
