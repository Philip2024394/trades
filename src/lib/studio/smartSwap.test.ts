// Universal Smart Section Engine — deterministic tests.
//
// Run with the codebase test runner (Vitest/Jest). Covers:
//   • role-based carry across differently-named keys
//   • same-key fallback for pre-role sections
//   • orphan collection
//   • defaulted fields when no match
//   • type incompatibility handling
//   • empty / whitespace values treated as absence
//
// These tests intentionally use local fixtures (not the real registry)
// so they stay stable when we add new sections.

import { smartSwap } from "./smartSwap";
import type { SectionRegistration } from "./sectionTypes";

/** Minimal registration fixture — only the fields smartSwap reads. */
function reg(
  id: string,
  fields: SectionRegistration["editableFields"],
  defaults: Record<string, unknown> = {}
): Pick<SectionRegistration, "id" | "editableFields" | "defaultConfig"> {
  return {
    id,
    editableFields: fields,
    defaultConfig: () => {
      const out: Record<string, unknown> = {};
      for (const f of fields) {
        out[f.key] = defaults[f.key] ?? f.default;
      }
      return out;
    }
  };
}

// ─── Test 1: role match across differently-named keys ───────────
{
  const source = reg("hero.a", [
    { key: "heading", label: "Headline", type: { kind: "text" }, default: "", role: "headline" },
    { key: "subheading", label: "Sub", type: { kind: "text" }, default: "", role: "subhead" }
  ]);
  const target = reg("hero.b", [
    { key: "mainTitle", label: "Title", type: { kind: "text" }, default: "Default title", role: "headline" },
    { key: "supportingLine", label: "Sub", type: { kind: "text" }, default: "Default sub", role: "subhead" }
  ]);
  const result = smartSwap({
    source: { registration: source, config: { heading: "Real work.", subheading: "Real pricing." } },
    target: { registration: target }
  });

  console.assert(
    result.targetConfig.mainTitle === "Real work.",
    "Test 1a: role match should copy `heading` → `mainTitle`"
  );
  console.assert(
    result.targetConfig.supportingLine === "Real pricing.",
    "Test 1b: role match should copy `subheading` → `supportingLine`"
  );
  console.assert(
    result.summary.carriedCount === 2 &&
      result.summary.defaultedCount === 0 &&
      result.summary.orphanedCount === 0,
    "Test 1c: perfect role swap produces zero orphans / zero defaults"
  );
}

// ─── Test 2: same-key fallback when source has no roles ─────────
{
  const source = reg("legacy.a", [
    { key: "heading", label: "H", type: { kind: "text" }, default: "" }
  ]);
  const target = reg("hero.b", [
    { key: "heading", label: "H", type: { kind: "text" }, default: "Default", role: "headline" }
  ]);
  const result = smartSwap({
    source: { registration: source, config: { heading: "Legacy value" } },
    target: { registration: target }
  });
  console.assert(
    result.targetConfig.heading === "Legacy value",
    "Test 2: same-key fallback carries when target role has no source-role match"
  );
  console.assert(
    result.carried[0].via === "same-key",
    "Test 2: carry entry marked as via=same-key"
  );
}

// ─── Test 3: orphan detection ───────────────────────────────────
{
  const source = reg("hero.a", [
    { key: "heading", label: "H", type: { kind: "text" }, default: "", role: "headline" },
    { key: "specialField", label: "S", type: { kind: "text" }, default: "" }
  ]);
  const target = reg("hero.b", [
    { key: "mainTitle", label: "T", type: { kind: "text" }, default: "", role: "headline" }
  ]);
  const result = smartSwap({
    source: {
      registration: source,
      config: { heading: "Kept", specialField: "Nowhere to go" }
    },
    target: { registration: target }
  });
  console.assert(
    result.orphaned.length === 1 &&
      result.orphaned[0].sourceKey === "specialField" &&
      result.orphaned[0].value === "Nowhere to go",
    "Test 3: source field with no target match becomes an orphan"
  );
}

// ─── Test 4: empty source value falls back to target default ────
{
  const source = reg("hero.a", [
    { key: "heading", label: "H", type: { kind: "text" }, default: "", role: "headline" }
  ]);
  const target = reg("hero.b", [
    { key: "mainTitle", label: "T", type: { kind: "text" }, default: "Default title", role: "headline" }
  ]);
  const result = smartSwap({
    source: { registration: source, config: { heading: "   " } }, // whitespace
    target: { registration: target }
  });
  console.assert(
    result.targetConfig.mainTitle === "Default title",
    "Test 4: whitespace source value treated as absent; target default kept"
  );
  console.assert(
    result.defaulted.some((d) => d.targetKey === "mainTitle"),
    "Test 4: defaulted entry recorded for the target field"
  );
}

// ─── Test 5: type incompatibility on same-key fallback ──────────
{
  const source = reg("legacy.a", [
    { key: "value", label: "V", type: { kind: "text" }, default: "" }
  ]);
  const target = reg("hero.b", [
    { key: "value", label: "V", type: { kind: "number" }, default: 0 }
  ]);
  const result = smartSwap({
    source: { registration: source, config: { value: "not a number" } },
    target: { registration: target }
  });
  console.assert(
    result.targetConfig.value === 0,
    "Test 5: type mismatch on same-key falls back to default"
  );
}

console.log("Universal Smart Section Engine — all smoke tests passed.");
