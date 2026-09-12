// src/lib/nex/ui-theme-linter/ui-theme-linter.test.ts
//
// Stage 4 tests · pure-function UI DNA rules.

import { describe, it, expect } from "vitest";
import { lintUiFile, isUiSurface, verifyTokensInSync } from "./index";
import type { DesignTokens } from "./index";

const TEST_TOKENS: DesignTokens = {
  version: "test",
  palette: {
    deep_navy_base:     { hex: "#0B1220", role: "" },
    electric_cyan_tech: { hex: "#22D3EE", role: "" },
    nex_orange_action:  { hex: "#F97316", role: "" },
    soft_white:         { hex: "#F9FAFB", role: "" },
  },
  forbidden_hex_families: { allow_family_prefixes: [] },
  banned_lightmode_backgrounds: ["bg-white", "background: #FFFFFF"],
  banned_shadcn_bare_defaults: ["bg-background", "text-foreground"],
};

describe("isUiSurface", () => {
  it("accepts .tsx / .css / .scss / tailwind config", () => {
    expect(isUiSurface("src/app/foo/page.tsx")).toBe(true);
    expect(isUiSurface("src/app/globals.css")).toBe(true);
    expect(isUiSurface("styles/main.scss")).toBe(true);
    expect(isUiSurface("tailwind.config.ts")).toBe(true);
  });

  it("rejects non-UI files", () => {
    expect(isUiSurface("src/lib/foo.ts")).toBe(false);
    expect(isUiSurface("scripts/foo.mjs")).toBe(false);
    expect(isUiSurface("docs/README.md")).toBe(false);
  });
});

describe("lintUiFile · sec.ui_forbidden_colour", () => {
  it("flags non-palette hex code", () => {
    const violations = lintUiFile(
      TEST_TOKENS,
      "src/app/foo/page.tsx",
      `const c = "#123456";`,
    );
    const codes = violations.map((v) => v.code);
    expect(codes).toContain("sec.ui_forbidden_colour");
  });

  it("accepts sanctioned palette hex", () => {
    const violations = lintUiFile(
      TEST_TOKENS,
      "src/app/foo/page.tsx",
      `<div className="bg-slate-900"><span style={{color:"#F97316"}}>X</span></div>`,
    );
    const codes = violations.map((v) => v.code);
    expect(codes).not.toContain("sec.ui_forbidden_colour");
  });
});

describe("lintUiFile · sec.ui_tailwind_arbitrary_hex", () => {
  it("flags non-palette arbitrary hex in Tailwind", () => {
    const violations = lintUiFile(
      TEST_TOKENS,
      "src/app/foo/page.tsx",
      `<div className="bg-[#ABCDEF]" />`,
    );
    expect(violations.map((v) => v.code)).toContain("sec.ui_tailwind_arbitrary_hex");
  });

  it("accepts palette arbitrary hex", () => {
    const violations = lintUiFile(
      TEST_TOKENS,
      "src/app/foo/page.tsx",
      `<div className="bg-[#0B1220]" />`,
    );
    expect(violations.map((v) => v.code)).not.toContain("sec.ui_tailwind_arbitrary_hex");
  });
});

describe("lintUiFile · sec.ui_lightmode_background", () => {
  it("flags bg-white", () => {
    const violations = lintUiFile(
      TEST_TOKENS,
      "src/app/foo/page.tsx",
      `<div className="bg-white" />`,
    );
    expect(violations.map((v) => v.code)).toContain("sec.ui_lightmode_background");
  });

  it("flags literal #FFFFFF", () => {
    const violations = lintUiFile(
      TEST_TOKENS,
      "src/app/foo/page.tsx",
      `const bg = "#FFFFFF";`,
    );
    expect(violations.map((v) => v.code)).toContain("sec.ui_lightmode_background");
  });
});

describe("lintUiFile · sec.ui_shadcn_bare_default", () => {
  it("flags bg-background", () => {
    const violations = lintUiFile(
      TEST_TOKENS,
      "src/app/foo/page.tsx",
      `<div className="bg-background text-foreground" />`,
    );
    const codes = violations.map((v) => v.code);
    expect(codes).toContain("sec.ui_shadcn_bare_default");
  });
});

describe("lintUiFile · sec.ui_missing_dark_scheme", () => {
  it("flags page.tsx without dark surface", () => {
    const violations = lintUiFile(
      TEST_TOKENS,
      "src/app/foo/page.tsx",
      `export default function Page() { return <div>hi</div>; }`,
    );
    expect(violations.map((v) => v.code)).toContain("sec.ui_missing_dark_scheme");
  });

  it("accepts page.tsx with dark surface", () => {
    const violations = lintUiFile(
      TEST_TOKENS,
      "src/app/foo/page.tsx",
      `export default function Page() { return <div className="bg-slate-900">hi</div>; }`,
    );
    expect(violations.map((v) => v.code)).not.toContain("sec.ui_missing_dark_scheme");
  });

  it("does not check non-page.tsx files for dark scheme", () => {
    const violations = lintUiFile(
      TEST_TOKENS,
      "src/components/foo.tsx",
      `export function X() { return <div>hi</div>; }`,
    );
    expect(violations.map((v) => v.code)).not.toContain("sec.ui_missing_dark_scheme");
  });
});

describe("lintUiFile · sec.ui_broken_focus_ring", () => {
  it("flags outline:none without cyan focus ring", () => {
    const violations = lintUiFile(
      TEST_TOKENS,
      "src/app/foo/page.tsx",
      `<button className="bg-slate-900 outline-none rounded">Go</button>`,
    );
    expect(violations.map((v) => v.code)).toContain("sec.ui_broken_focus_ring");
  });

  it("accepts outline-none paired with focus:ring", () => {
    const violations = lintUiFile(
      TEST_TOKENS,
      "src/app/foo/page.tsx",
      `<button className="bg-slate-900 outline-none focus:ring-2 focus:ring-cyan-400">Go</button>`,
    );
    expect(violations.map((v) => v.code)).not.toContain("sec.ui_broken_focus_ring");
  });
});

describe("verifyTokensInSync", () => {
  it("accepts full tokens", () => {
    const r = verifyTokensInSync(TEST_TOKENS);
    expect(r.ok).toBe(true);
  });

  it("rejects tokens missing deep_navy_base", () => {
    const bad: DesignTokens = {
      ...TEST_TOKENS,
      palette: { nex_orange_action: TEST_TOKENS.palette.nex_orange_action, electric_cyan_tech: TEST_TOKENS.palette.electric_cyan_tech } as any,
    };
    const r = verifyTokensInSync(bad);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("deep_navy_base");
  });
});

describe("lintUiFile · skip non-UI surfaces", () => {
  it("returns [] for .ts files", () => {
    const violations = lintUiFile(
      TEST_TOKENS,
      "src/lib/foo.ts",
      `const c = "#ABCDEF"; const white = "bg-white"; const foo = "bg-background";`,
    );
    expect(violations).toEqual([]);
  });
});
