// src/app/nex-native/chat-standard/_controls-visibility.test.ts
//
// Universal Theme Controls Rule · source-level regression guards ·
// sealed 2026-10-06.
//
// Protects the sealed decisions that:
//
//   1 · The Standard Experience shell no longer carries the hard-
//       coded SEND_GREEN / SEND_TEXT constants (every send button is
//       theme-primary via engine.controlsTreatment()).
//   2 · The three universal overlays (header icons · chrome · composer
//       footer) consume `resolveControlsTreatment()` from the shared
//       `_engine/control-resolver.ts` module so a single source of
//       truth drives every surface's solidity + colour.
//   3 · The sealed-away `background: "transparent"` composer pill
//       (R3 revision 2 · 2026-10-05) and the sealed-away
//       `${accent}22` 13%-alpha header buttons do not creep back in.
//
// This file uses source-string checks (same pattern as every other
// architectural guard in this project) so it fails loudly the moment
// anyone re-introduces a forbidden pattern · no runtime rendering
// required.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const SHELL = path.join(
  REPO_ROOT,
  "src/app/nex-native/chat-standard/_standard-experience.tsx",
);
const RESOLVER = path.join(
  REPO_ROOT,
  "src/app/nex-native/chat-standard/_engine/control-resolver.ts",
);
const ENGINE = path.join(
  REPO_ROOT,
  "src/app/nex-native/chat-standard/_engine/theme-engine.tsx",
);
const HEADER_OVERLAY = path.join(
  REPO_ROOT,
  "src/app/nex-native/chat-standard/_universal-header-icons-overlay.tsx",
);
const CHROME_OVERLAY = path.join(
  REPO_ROOT,
  "src/app/nex-native/chat-standard/_universal-chrome-overlay.tsx",
);
const COMPOSER_OVERLAY = path.join(
  REPO_ROOT,
  "src/app/nex-native/chat-standard/_universal-composer-footer.tsx",
);

// ─── A · SEND_GREEN is gone from the shell ──────────────────────────

describe("A · SEND_GREEN is retired from the Standard Experience shell", () => {
  const src = fs.readFileSync(SHELL, "utf8");

  test("shell no longer declares SEND_GREEN or SEND_TEXT constants", () => {
    expect(src).not.toMatch(/const\s+SEND_GREEN\s*=/);
    expect(src).not.toMatch(/const\s+SEND_TEXT\s*=/);
  });

  test("shell does not inline the retired joker-green hex", () => {
    expect(src).not.toContain("#8FFF6E");
    expect(src).not.toContain("#0A2010");
  });

  test("send button renders via engine.controlsTreatment().sendButton", () => {
    expect(src).toMatch(/controls\.sendButton\(/);
  });
});

// ─── B · shell routes every control through controlsTreatment ──────

describe("B · shell consumes controlsTreatment() for all four control sites", () => {
  const src = fs.readFileSync(SHELL, "utf8");

  test("header actions use controls.headerButton / headerButtonActive", () => {
    expect(src).toContain("controls.headerButton");
    expect(src).toContain("controls.headerButtonActive");
  });

  test("+ button uses controls.plusButton / plusButtonActive", () => {
    expect(src).toContain("controls.plusButton");
    expect(src).toContain("controls.plusButtonActive");
  });

  test("3-dots lower-right builds from controls.headerButton", () => {
    expect(src).toMatch(/\.\.\.controls\.headerButton/);
  });

  test("shell carries the Universal Theme Controls Rule doctrine comment", () => {
    expect(src.toLowerCase()).toContain("universal theme controls rule");
  });
});

// ─── C · engine composer background is NO LONGER transparent ───────

describe("C · engine composerTreatment container is solid (R3 revision 2 superseded)", () => {
  const src = fs.readFileSync(ENGINE, "utf8");

  test("composerTreatment returns a solid resolved material (not 'transparent')", () => {
    // Pin the specific sealed-away pattern · if a future bridge
    // reintroduces `background: "transparent"` for the composer
    // container this fails loudly.
    const composerBlock = src.slice(
      src.indexOf("function composerTreatment"),
      src.indexOf("function emojiTreatment"),
    );
    expect(composerBlock).toMatch(/background:\s*containerBg/);
    expect(composerBlock).not.toMatch(/background:\s*["'`]transparent["'`]\s*,\s*border:\s*containerBorder/);
  });

  test("engine exposes controlsTreatment method", () => {
    expect(src).toMatch(/controlsTreatment\(\)\s*:\s*ControlsTreatment/);
    expect(src).toContain("resolveControlsTreatment(colours)");
  });
});

// ─── D · overlays consume the shared resolver ──────────────────────

describe("D · universal overlays route surface colours through the shared resolver", () => {
  const header = fs.readFileSync(HEADER_OVERLAY, "utf8");
  const chrome = fs.readFileSync(CHROME_OVERLAY, "utf8");
  const composer = fs.readFileSync(COMPOSER_OVERLAY, "utf8");

  test("header icons overlay imports + calls resolveControlsTreatment", () => {
    expect(header).toContain('from "./_engine/control-resolver"');
    expect(header).toContain("resolveControlsTreatment({");
  });

  test("chrome overlay imports + calls resolveControlsTreatment", () => {
    expect(chrome).toContain('from "./_engine/control-resolver"');
    expect(chrome).toContain("resolveControlsTreatment({");
  });

  test("composer overlay imports + calls resolveControlsTreatment", () => {
    expect(composer).toContain('from "./_engine/control-resolver"');
    expect(composer).toContain("resolveControlsTreatment({");
  });

  test("all three overlays accept `highlight` + `deep` props", () => {
    for (const [name, src] of [
      ["header", header],
      ["chrome", chrome],
      ["composer", composer],
    ] as const) {
      expect(src, `${name} overlay must accept highlight prop`).toMatch(
        /highlight\?:\s*string/,
      );
      expect(src, `${name} overlay must accept deep prop`).toMatch(
        /deep\?:\s*string/,
      );
    }
  });

  test("header overlay no longer uses the retired ${accent}22 low-alpha pattern", () => {
    // The 13%-alpha background was the sealed-away pattern that
    // disappeared against dark wallpapers.
    expect(header).not.toMatch(/background:\s*`\$\{accent\}22`/);
    // Likewise the sealed `${accent}99` low-alpha border on the
    // non-active state (replaced by solid primary).
    expect(header).not.toMatch(/border:\s*`1px solid \$\{accent\}99`,\s*background:/);
  });

  test("composer overlay no longer renders the pill with background: 'transparent'", () => {
    // Pin the retired pattern · the composer pill is now solid.
    expect(composer).not.toMatch(
      /borderRadius:\s*999,\s*\/\/[^\n]*\n[^\n]*background:\s*["'`]transparent["'`]/m,
    );
    // Overlay delegates the pill style to controls.composerContainer.
    expect(composer).toContain("controls.composerContainer");
  });

  test("composer overlay send + plus buttons delegate to controls.sendButton / plusButton", () => {
    expect(composer).toMatch(/controls\.sendButton\(/);
    expect(composer).toMatch(/controls\.plusButton/);
    expect(composer).toMatch(/controls\.plusButtonActive/);
  });
});

// ─── E · architectural guards · no per-theme-id branches ───────────

describe("E · no per-theme-id branches in the controls contract", () => {
  const FILES = [SHELL, RESOLVER, ENGINE, HEADER_OVERLAY, CHROME_OVERLAY, COMPOSER_OVERLAY];
  const FORBIDDEN = [
    /\btheme\s*===\s*["'`](ocean|coffee|joker|cafe|french-cafe|motorbike-rental|cakes|vitamins)["'`]/,
    /\bthemeId\s*===\s*["'`](ocean|coffee|joker|cafe)["'`]/,
    /\baccent\s*===\s*["'`]#[0-9A-Fa-f]{3,6}["'`]/,
  ];

  for (const file of FILES) {
    const name = path.basename(file);
    const src = fs.readFileSync(file, "utf8");
    test(`${name} · no per-theme-id or per-hex branch`, () => {
      for (const pat of FORBIDDEN) {
        expect(src, `${name} must not branch on specific theme/colour · ${pat}`).not.toMatch(pat);
      }
    });
  }
});
