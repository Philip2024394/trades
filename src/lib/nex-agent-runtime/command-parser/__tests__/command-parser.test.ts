// §36-CMD-1 · CMD-1 · 2026-09-15 · command-parser
// NEX bounded infrastructure · command-parser tests · 2026-09-15

import { describe, expect, it } from "vitest";
import { LOCKED_PHRASE_IDS, parseFounderCommand } from "../command-parser";
import type { ParseCommandFailure, ParseCommandSuccess } from "../command-parser-types";

function asSuccess(r: ReturnType<typeof parseFounderCommand>): ParseCommandSuccess {
  if (!r.ok) throw new Error(`unexpected refusal: ${(r as ParseCommandFailure).refusal_code} · ${(r as ParseCommandFailure).reason}`);
  return r;
}

// ── §A · Founder's demo phrase maps deterministically ──────────────────

describe("§36-CMD-1 · §A · founder demo phrase", () => {
  it("A-1 · 'make the calculator buttons rounded' → rounded_md (exact founder demo)", () => {
    const r = asSuccess(parseFounderCommand("make the calculator buttons rounded"));
    expect(r.structured).toEqual({
      target_app: "tiny-calculator",
      element: "calculator_buttons",
      property: "corners",
      value: "rounded_md",
    });
    expect(r.matched_phrase_id).toBe("buttons_rounded_md");
  });
  it("A-2 · 'make the buttons rounded' (without 'calculator') → same rounded_md", () => {
    const r = asSuccess(parseFounderCommand("make the buttons rounded"));
    expect(r.structured.value).toBe("rounded_md");
  });
  it("A-3 · 'make buttons rounded' (minimal) → rounded_md", () => {
    const r = asSuccess(parseFounderCommand("make buttons rounded"));
    expect(r.structured.value).toBe("rounded_md");
  });
  it("A-4 · leading/trailing whitespace tolerated", () => {
    const r = asSuccess(parseFounderCommand("   make the calculator buttons rounded   "));
    expect(r.structured.value).toBe("rounded_md");
  });
  it("A-5 · case-insensitive", () => {
    const r = asSuccess(parseFounderCommand("MAKE THE CALCULATOR BUTTONS ROUNDED"));
    expect(r.structured.value).toBe("rounded_md");
  });
});

// ── §B · Other locked phrases ──────────────────────────────────────────

describe("§36-CMD-1 · §B · locked phrase variants", () => {
  it("B-1 · 'make the buttons pill' → rounded_full", () => {
    const r = asSuccess(parseFounderCommand("make the buttons pill"));
    expect(r.structured.value).toBe("rounded_full");
  });
  it("B-2 · 'make the buttons fully rounded' → rounded_full", () => {
    const r = asSuccess(parseFounderCommand("make the buttons fully rounded"));
    expect(r.structured.value).toBe("rounded_full");
  });
  it("B-3 · 'make the buttons slightly rounded' → rounded_sm", () => {
    const r = asSuccess(parseFounderCommand("make the buttons slightly rounded"));
    expect(r.structured.value).toBe("rounded_sm");
  });
  it("B-4 · 'make the buttons square' → sharp", () => {
    const r = asSuccess(parseFounderCommand("make the buttons square"));
    expect(r.structured.value).toBe("sharp");
  });
  it("B-5 · 'make the buttons sharp' → sharp", () => {
    const r = asSuccess(parseFounderCommand("make the buttons sharp"));
    expect(r.structured.value).toBe("sharp");
  });
});

// ── §C · Refuse-first · phrases explicitly out of scope ────────────────

describe("§36-CMD-1 · §C · refuse-first outside locked table", () => {
  const REFUSE_CASES: readonly string[] = [
    "make everything beautiful",
    "change whatever looks bad",
    "make the buttons slightly more rounded", // 'more' not in table
    "add a shadow",
    "redesign the calculator",
    "add a decimal button",
    "rewrite the calculator",
    "change the CSS",
    "build me a completely different app",
    "make the buttons red",
    "make the display bigger",
    "add a login page",
  ];
  for (const phrase of REFUSE_CASES) {
    it(`C · '${phrase}' → CMD_UNKNOWN_PATTERN`, () => {
      const r = parseFounderCommand(phrase);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.refusal_code).toBe("CMD_UNKNOWN_PATTERN");
    });
  }
});

// ── §D · Invalid input ─────────────────────────────────────────────────

describe("§36-CMD-1 · §D · invalid input", () => {
  it("D-1 · null → CMD_INVALID_INPUT", () => {
    const r = parseFounderCommand(null as never);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal_code).toBe("CMD_INVALID_INPUT");
  });
  it("D-2 · empty string → CMD_INVALID_INPUT", () => {
    const r = parseFounderCommand("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal_code).toBe("CMD_INVALID_INPUT");
  });
  it("D-3 · whitespace-only → CMD_INVALID_INPUT", () => {
    const r = parseFounderCommand("     ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal_code).toBe("CMD_INVALID_INPUT");
  });
  it("D-4 · too long (> 200 chars) → CMD_INVALID_INPUT", () => {
    const r = parseFounderCommand("make the buttons rounded ".repeat(50));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal_code).toBe("CMD_INVALID_INPUT");
  });
  it("D-5 · contains eval( → CMD_INVALID_INPUT (prohibited substring)", () => {
    const r = parseFounderCommand("make the buttons rounded; eval(bad)");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal_code).toBe("CMD_INVALID_INPUT");
  });
  it("D-6 · contains <script → CMD_INVALID_INPUT", () => {
    const r = parseFounderCommand("<script>make buttons rounded</script>");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal_code).toBe("CMD_INVALID_INPUT");
  });
});

// ── §E · Determinism ───────────────────────────────────────────────────

describe("§36-CMD-1 · §E · determinism", () => {
  it("E-1 · identical input produces identical structured output", () => {
    const a = asSuccess(parseFounderCommand("make the calculator buttons rounded"));
    const b = asSuccess(parseFounderCommand("make the calculator buttons rounded"));
    expect(a.structured).toEqual(b.structured);
    expect(a.matched_phrase_id).toBe(b.matched_phrase_id);
  });
});

// ── §F · Introspection ─────────────────────────────────────────────────

describe("§36-CMD-1 · §F · locked phrase-id catalogue", () => {
  it("F-1 · LOCKED_PHRASE_IDS lists exactly 4 phrase ids (v1)", () => {
    expect(LOCKED_PHRASE_IDS.length).toBe(4);
    expect(LOCKED_PHRASE_IDS).toEqual([
      "buttons_rounded_md",
      "buttons_rounded_full",
      "buttons_rounded_sm",
      "buttons_sharp",
    ]);
  });
});

// ── §G · Grep marker ───────────────────────────────────────────────────

describe("§36-CMD-1 · §G · grep marker", () => {
  it("G-1 · success carries §36-CMD-1 marker", () => {
    const r = parseFounderCommand("make the calculator buttons rounded");
    expect(r.grep_marker).toBe("§36-CMD-1 · CMD-1 · 2026-09-15 · command-parser");
  });
  it("G-2 · failure carries §36-CMD-1 marker", () => {
    const r = parseFounderCommand("");
    expect(r.grep_marker).toBe("§36-CMD-1 · CMD-1 · 2026-09-15 · command-parser");
  });
});
