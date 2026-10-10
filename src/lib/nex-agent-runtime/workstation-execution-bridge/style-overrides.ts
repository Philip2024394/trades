// §36-W-3 · W-3 · 2026-09-15 · workstation-execution-bridge
// NEX bounded infrastructure · style-overrides merge · 2026-09-15
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// Pure function: (baseSpec, overrides, structuredCommand) → mergedSpec.
// The base tiny-calculator spec is immutable; overrides live in a separate
// mutable state file and get applied at emission time. Deterministic.

import type { SmallApplicationSpec, StyleTokenBinding, StyleTokenKey } from "../route-2d-small-app-authoring/route-2d-types";
import type { StructuredCommand } from "../command-parser/command-parser-types";
import type { StyleOverridesFile } from "./execution-bridge-types";

// Mapping from `element` in a StructuredCommand to the style_ref(s) it affects
// in the tiny-calculator spec. Locked · v1.
const ELEMENT_TO_STYLE_REFS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  calculator_buttons: Object.freeze(["digit_button_style", "action_button_style"]),
});

// ── Apply a single command to an overrides file (pure) ─────────────────

export function applyStructuredCommandToOverrides(
  overrides: StyleOverridesFile,
  command: StructuredCommand,
  now_iso: string,
): StyleOverridesFile {
  const styleRefs = ELEMENT_TO_STYLE_REFS[command.element] ?? [];
  const next: StyleOverridesFile = {
    $schema_version: overrides.$schema_version,
    applied_at: now_iso,
    ...(overrides.digit_button_style ? { digit_button_style: { ...overrides.digit_button_style } } : {}),
    ...(overrides.action_button_style ? { action_button_style: { ...overrides.action_button_style } } : {}),
  };
  for (const styleRef of styleRefs) {
    if (styleRef === "digit_button_style") {
      next.digit_button_style = { ...(next.digit_button_style ?? {}), [command.property]: command.value };
    } else if (styleRef === "action_button_style") {
      next.action_button_style = { ...(next.action_button_style ?? {}), [command.property]: command.value };
    }
  }
  return next;
}

// ── Merge overrides into the base spec (pure) ──────────────────────────
//
// For each style_ref in the base spec that has an entry in the overrides,
// we append/replace the overridden (key, value) pairs. All other spec
// fields are copied through unchanged. Result is a fully-formed
// SmallApplicationSpec ready to feed into authorSmallApplication.

export function applyOverridesToTinyCalculatorSpec(
  baseSpec: SmallApplicationSpec,
  overrides: StyleOverridesFile,
): SmallApplicationSpec {
  const overrideByRef = new Map<string, Record<string, string>>();
  if (overrides.digit_button_style) overrideByRef.set("digit_button_style", { ...overrides.digit_button_style });
  if (overrides.action_button_style) overrideByRef.set("action_button_style", { ...overrides.action_button_style });

  const nextStyleTokens: StyleTokenBinding[] = baseSpec.style_tokens.map((binding) => {
    const or = overrideByRef.get(binding.style_ref);
    if (!or) return binding;
    // Take the base tokens; for each override (key, value): replace-or-append.
    const baseByKey = new Map<StyleTokenKey, string>();
    for (const t of binding.tokens) baseByKey.set(t.key as StyleTokenKey, t.value);
    for (const [k, v] of Object.entries(or)) baseByKey.set(k as StyleTokenKey, v);
    // Emit tokens in a deterministic key order.
    const KEY_ORDER: readonly StyleTokenKey[] = ["layout", "spacing", "color_primary", "color_neutral", "size", "alignment", "corners"];
    const tokens: { readonly key: StyleTokenKey; readonly value: string }[] = [];
    for (const k of KEY_ORDER) {
      const v = baseByKey.get(k);
      if (v !== undefined) tokens.push({ key: k, value: v });
    }
    return { style_ref: binding.style_ref, tokens: Object.freeze(tokens) };
  });

  return {
    ...baseSpec,
    style_tokens: Object.freeze(nextStyleTokens),
  };
}

// ── Introspection ──────────────────────────────────────────────────────

export function overridesHasEffect(overrides: StyleOverridesFile): boolean {
  return Boolean(
    (overrides.digit_button_style && Object.keys(overrides.digit_button_style).length > 0) ||
    (overrides.action_button_style && Object.keys(overrides.action_button_style).length > 0),
  );
}
