// §36-W-3 · W-3 · 2026-09-15 · workstation-execution-bridge
// NEX bounded infrastructure · style-overrides tests · 2026-09-15

import { describe, expect, it } from "vitest";
import { applyOverridesToTinyCalculatorSpec, applyStructuredCommandToOverrides, overridesHasEffect } from "../style-overrides";
import { buildTinyCalculatorSpec } from "../../route-2d-small-app-authoring/first-app-tiny-calculator-spec";
import { EMPTY_STYLE_OVERRIDES } from "../execution-bridge-types";
import type { StructuredCommand } from "../../command-parser/command-parser-types";
import { authorSmallApplication } from "../../route-2d-small-app-authoring/route-2d";

// ── §A · applyStructuredCommandToOverrides ─────────────────────────────

describe("§36-W-3 · §A · applyStructuredCommandToOverrides", () => {
  it("A-1 · calculator_buttons + corners: rounded_md → sets both digit_button_style and action_button_style", () => {
    const cmd: StructuredCommand = { target_app: "tiny-calculator", element: "calculator_buttons", property: "corners", value: "rounded_md" };
    const next = applyStructuredCommandToOverrides(EMPTY_STYLE_OVERRIDES, cmd, "2026-09-15T12:00:00.000Z");
    expect(next.digit_button_style?.corners).toBe("rounded_md");
    expect(next.action_button_style?.corners).toBe("rounded_md");
    expect(next.applied_at).toBe("2026-09-15T12:00:00.000Z");
  });
  it("A-2 · previous overrides preserved when new command targets same key", () => {
    const first = applyStructuredCommandToOverrides(EMPTY_STYLE_OVERRIDES, { target_app: "tiny-calculator", element: "calculator_buttons", property: "corners", value: "rounded_md" }, "2026-09-15T12:00:00.000Z");
    const second = applyStructuredCommandToOverrides(first, { target_app: "tiny-calculator", element: "calculator_buttons", property: "corners", value: "rounded_full" }, "2026-09-15T12:05:00.000Z");
    expect(second.digit_button_style?.corners).toBe("rounded_full");
    expect(second.action_button_style?.corners).toBe("rounded_full");
  });
  it("A-3 · determinism · identical inputs produce identical output", () => {
    const cmd: StructuredCommand = { target_app: "tiny-calculator", element: "calculator_buttons", property: "corners", value: "sharp" };
    const a = applyStructuredCommandToOverrides(EMPTY_STYLE_OVERRIDES, cmd, "2026-09-15T12:00:00.000Z");
    const b = applyStructuredCommandToOverrides(EMPTY_STYLE_OVERRIDES, cmd, "2026-09-15T12:00:00.000Z");
    expect(a).toEqual(b);
  });
});

// ── §B · applyOverridesToTinyCalculatorSpec (merge) ────────────────────

describe("§36-W-3 · §B · applyOverridesToTinyCalculatorSpec", () => {
  it("B-1 · empty overrides → merged spec === base spec (structurally)", () => {
    const base = buildTinyCalculatorSpec();
    const merged = applyOverridesToTinyCalculatorSpec(base, EMPTY_STYLE_OVERRIDES);
    expect(merged.app_name).toBe(base.app_name);
    expect(merged.style_tokens.length).toBe(base.style_tokens.length);
    // Every base binding preserved · no corners key added
    for (let i = 0; i < base.style_tokens.length; i++) {
      const orig = base.style_tokens[i];
      const merg = merged.style_tokens[i];
      expect(merg.style_ref).toBe(orig.style_ref);
      // Same key count as base (no new keys from empty overrides)
      expect(merg.tokens.length).toBe(orig.tokens.length);
    }
  });
  it("B-2 · corners: rounded_md override on digit_button_style → binding now has corners token", () => {
    const base = buildTinyCalculatorSpec();
    const overrides = applyStructuredCommandToOverrides(EMPTY_STYLE_OVERRIDES, { target_app: "tiny-calculator", element: "calculator_buttons", property: "corners", value: "rounded_md" }, "2026-09-15T12:00:00.000Z");
    const merged = applyOverridesToTinyCalculatorSpec(base, overrides);
    const digitBinding = merged.style_tokens.find((b) => b.style_ref === "digit_button_style")!;
    const actionBinding = merged.style_tokens.find((b) => b.style_ref === "action_button_style")!;
    expect(digitBinding.tokens.some((t) => t.key === "corners" && t.value === "rounded_md")).toBe(true);
    expect(actionBinding.tokens.some((t) => t.key === "corners" && t.value === "rounded_md")).toBe(true);
  });
  it("B-3 · merged spec emits successfully through authorSmallApplication with rounded-md", () => {
    const base = buildTinyCalculatorSpec();
    const overrides = applyStructuredCommandToOverrides(EMPTY_STYLE_OVERRIDES, { target_app: "tiny-calculator", element: "calculator_buttons", property: "corners", value: "rounded_md" }, "2026-09-15T12:00:00.000Z");
    const merged = applyOverridesToTinyCalculatorSpec(base, overrides);
    const emission = authorSmallApplication({ spec: merged, emit_tests: true });
    if (!emission.ok) throw new Error(`emission failed: ${emission.refusal_code}`);
    const component = emission.emitted_files.find((f) => f.path.endsWith("TinyCalculator.tsx"))!;
    expect(component.content).toContain("rounded-md");
  });
  it("B-4 · determinism · same base + same overrides → byte-identical emission", () => {
    const base = buildTinyCalculatorSpec();
    const overrides = applyStructuredCommandToOverrides(EMPTY_STYLE_OVERRIDES, { target_app: "tiny-calculator", element: "calculator_buttons", property: "corners", value: "rounded_full" }, "2026-09-15T12:00:00.000Z");
    const mergedA = applyOverridesToTinyCalculatorSpec(base, overrides);
    const mergedB = applyOverridesToTinyCalculatorSpec(base, overrides);
    const a = authorSmallApplication({ spec: mergedA, emit_tests: true });
    const b = authorSmallApplication({ spec: mergedB, emit_tests: true });
    if (!a.ok || !b.ok) throw new Error("emission failed");
    for (let i = 0; i < a.emitted_files.length; i++) {
      expect(a.emitted_files[i].sha256_hex).toBe(b.emitted_files[i].sha256_hex);
    }
  });
});

// ── §C · overridesHasEffect ────────────────────────────────────────────

describe("§36-W-3 · §C · overridesHasEffect", () => {
  it("C-1 · empty overrides → false", () => {
    expect(overridesHasEffect(EMPTY_STYLE_OVERRIDES)).toBe(false);
  });
  it("C-2 · overrides with a single field → true", () => {
    const o = applyStructuredCommandToOverrides(EMPTY_STYLE_OVERRIDES, { target_app: "tiny-calculator", element: "calculator_buttons", property: "corners", value: "sharp" }, "2026-09-15T12:00:00.000Z");
    expect(overridesHasEffect(o)).toBe(true);
  });
});
