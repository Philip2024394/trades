// src/app/nex-native/settings/_settings-ia.test.ts
//
// NEX Settings · Information Architecture regression · sealed
// 2026-10-06.
//
// Guards the Phase 1 scaffold against:
//   · dead links in the Settings landing's grouped rows
//   · fake toggles / fake payment / fake upload surfaces
//   · drift from the sealed universal theme controls doctrine
//     (Settings is a functional surface · solid NEX palette · not
//     per-World tinted)
//   · duplicating existing settings surfaces (profile · tier ·
//     language · chat-themes-library)
//
// Source-level tests · no runtime rendering. Vitest can read these
// files without a dev server.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { SETTINGS_GROUPS, ALL_SETTINGS_ROWS } from "./_sections";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

function pageExists(route: string): boolean {
  // Convert `/nex-native/settings/foo` → `src/app/nex-native/settings/foo/page.tsx`
  // External routes (/nex-native/chat-themes-library, /nex-native/settings/profile
  // etc.) are checked against `src/app/<route>/page.tsx`.
  const trimmed = route.replace(/^\//, "");
  return fs.existsSync(path.join(REPO_ROOT, "src/app", trimmed, "page.tsx"));
}

// ─── A · IA shape ───────────────────────────────────────────────────

describe("A · Settings IA · groups + rows are declared", () => {
  test("there are 7 top-level groups (sealed §4 architecture)", () => {
    expect(SETTINGS_GROUPS.length).toBe(7);
  });

  test("every row has a unique key", () => {
    const keys = ALL_SETTINGS_ROWS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("every row has a non-empty title and subtitle", () => {
    for (const row of ALL_SETTINGS_ROWS) {
      expect(row.title.length).toBeGreaterThan(0);
      expect(row.subtitle.length).toBeGreaterThan(0);
    }
  });

  test("the sealed group labels match the founder §4 architecture", () => {
    const labels = SETTINGS_GROUPS.map((g) => g.label);
    expect(labels).toEqual([
      "Your account",
      "Your NEX",
      "Messages",
      "Privacy & Safety",
      "Storage & Data",
      "Payments & NEX Wallet",
      "Help",
    ]);
  });
});

// ─── B · every linked row routes somewhere · zero dead links ────────

describe("B · every linked row has a backing page.tsx (no dead links)", () => {
  const linkedRows = ALL_SETTINGS_ROWS.filter((r) => r.href !== null);

  for (const row of linkedRows) {
    test(`${row.key} · href="${row.href}" has a page.tsx on disk`, () => {
      expect(row.href).not.toBeNull();
      expect(pageExists(row.href!)).toBe(true);
    });
  }
});

// ─── C · existing-surface reuse · no duplicates ─────────────────────

describe("C · Phase 1 reuses existing surfaces where they already exist", () => {
  test("Profile row routes to the existing /settings/profile", () => {
    const row = ALL_SETTINGS_ROWS.find((r) => r.key === "profile");
    expect(row?.href).toBe("/nex-native/settings/profile");
  });

  test("Plan row routes to the existing /settings/tier", () => {
    const row = ALL_SETTINGS_ROWS.find((r) => r.key === "plan");
    expect(row?.href).toBe("/nex-native/settings/tier");
  });

  test("Language row routes to the existing /settings/language", () => {
    const row = ALL_SETTINGS_ROWS.find((r) => r.key === "language");
    expect(row?.href).toBe("/nex-native/settings/language");
  });

  test("Chat World row routes to the existing /chat-themes-library (not a duplicate settings/theme route)", () => {
    const row = ALL_SETTINGS_ROWS.find((r) => r.key === "chat-world");
    expect(row?.href).toBe("/nex-native/chat-themes-library");
  });

  test("Chat World row is called 'Chat World' not 'Chat theme' (founder §17 product language)", () => {
    const row = ALL_SETTINGS_ROWS.find((r) => r.key === "chat-world");
    expect(row?.title).toBe("Chat World");
  });
});

// ─── D · no fake backends · scaffold is honest ──────────────────────

describe("D · scaffold does not fake backends that don't exist", () => {
  const WORLD_INTRO_PAGE = path.join(
    REPO_ROOT,
    "src/app/nex-native/settings/world-intro/page.tsx",
  );
  const CUSTOM_INTRO_PAGE = path.join(
    REPO_ROOT,
    "src/app/nex-native/settings/custom-intro/page.tsx",
  );
  const LANDING_PAGE = path.join(
    REPO_ROOT,
    "src/app/nex-native/settings/page.tsx",
  );

  test("World Intro page wires the real toggle to setWorldIntroEnabledAction (Phase 1.0)", () => {
    const src = fs.readFileSync(WORLD_INTRO_PAGE, "utf8");
    // Phase 1.0 (sealed 2026-10-06) · the toggle now writes a real
    // nex_account.world_intro_enabled flag via the server action.
    // The former "coming soon" scaffold + NEX1 intent routing is
    // retired · a real HTML form posting to the action is the sealed
    // shape.
    expect(src).toContain("setWorldIntroEnabledAction");
    expect(src).toContain("world_intro_enabled");
    expect(src).toContain("data-nex-world-intro-form");
    // The former scaffold strings must not return.
    expect(src).not.toContain("intent=world_intro_pref");
    expect(src).not.toContain("Switch coming soon");
  });

  test("Custom Intro page keeps the sealed NEX1 payment pattern + mounts the real upload client (Phase 1.0)", () => {
    const src = fs.readFileSync(CUSTOM_INTRO_PAGE, "utf8");
    // Phase 1.0 (sealed 2026-10-06) · the page mounts CustomIntroClient
    // which exposes the four presentation states (not_purchased,
    // purchased_no_video, active, disabled). The upload surface is
    // real; the payment is still sealed NEX1-manual (unchanged).
    expect(src).toContain("CustomIntroClient");
    expect(src).toContain("getCustomIntroPresentationState");
    // Payment pathway UNCHANGED · NEX1-manual intent still fires for
    // the not_purchased state (sealed design).
    expect(src).toContain("intent=custom_intro_500k");
    // No client-side ownership fakes.
    expect(src).not.toMatch(/hasCustomIntro\s*=/);
    expect(src).not.toMatch(/localStorage.*custom.?intro/i);
    // Price must still be stated honestly.
    expect(src).toContain("CUSTOM_INTRO_PRICE_IDR");
  });

  test("Landing page carries sealed doctrine comment on solid NEX palette", () => {
    const src = fs.readFileSync(LANDING_PAGE, "utf8");
    // Settings is not World-tinted · it uses the solid NEX settings
    // palette. The in-source doctrine comment is the regression anchor.
    expect(src.toLowerCase()).toContain("solid nex palette");
  });
});

// ─── E · universal theme colour rule compliance ─────────────────────

describe("E · Settings uses the solid NEX palette · never World-tinted", () => {
  const SHELL = path.join(
    REPO_ROOT,
    "src/app/nex-native/settings/_settings-shell.tsx",
  );

  test("settings shell exports NEX_SETTINGS palette constant", () => {
    const src = fs.readFileSync(SHELL, "utf8");
    expect(src).toContain("export const NEX_SETTINGS");
    // The palette must include deep + text + accent anchors.
    expect(src).toMatch(/bg:\s*["']#020914["']/);
    expect(src).toMatch(/panel:\s*["']#03101D["']/);
  });

  test("settings shell does NOT import from the chat-standard engine", () => {
    const src = fs.readFileSync(SHELL, "utf8");
    // Settings is a functional surface · it must NOT consume World
    // ThemePackage colours (founder §13).
    expect(src).not.toMatch(/from\s+["'][^"']*chat-standard\/_engine/);
    expect(src).not.toMatch(/resolveControlsTreatment/);
  });
});

// ─── F · placeholder pages share the same Coming Soon shell ─────────

describe("F · Coming Soon placeholder pages reuse the shared shell", () => {
  // Phase 1.0 note: `security` graduated OUT of the Coming Soon shell on
  // 2026-10-06 · it's now a real surface with its own shell + 4 pages
  // (landing + devices + activity + password). It is intentionally
  // absent from this list · the Phase 1.0 Security brief is the
  // regression anchor instead.
  const PLACEHOLDER_ROUTES = [
    "notifications",
    "chat-settings",
    "privacy",
    "blocked",
    "storage",
    "data-usage",
    "help",
    "about",
  ];

  for (const route of PLACEHOLDER_ROUTES) {
    test(`${route}/page.tsx uses the shared ComingSoonSettingsPage helper`, () => {
      const file = path.join(
        REPO_ROOT,
        `src/app/nex-native/settings/${route}/page.tsx`,
      );
      const src = fs.readFileSync(file, "utf8");
      expect(src).toContain("ComingSoonSettingsPage");
      // No fake toggles / forms / inputs leaking into placeholder.
      expect(src).not.toMatch(/type=["']checkbox["']/);
      expect(src).not.toMatch(/role=["']switch["']/);
      expect(src).not.toMatch(/type=["']file["']/);
    });
  }
});

// ─── G · Custom Intro highlighted (founder: discover directly) ──────

describe("G · Custom Intro is discoverable directly from Settings (founder note)", () => {
  test("Custom Intro row is marked highlighted on the landing", () => {
    const row = ALL_SETTINGS_ROWS.find((r) => r.key === "custom-intro");
    expect(row?.highlighted).toBe(true);
  });

  test("Custom Intro row lives in the 'Your NEX' group (not buried under Payments)", () => {
    const group = SETTINGS_GROUPS.find((g) => g.key === "your-nex");
    expect(group?.rows.some((r) => r.key === "custom-intro")).toBe(true);
  });
});
