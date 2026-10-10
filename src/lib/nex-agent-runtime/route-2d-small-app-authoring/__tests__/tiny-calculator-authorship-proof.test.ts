// §36-2D · ROUTE-2D · 2026-09-14 · route-2d-small-app-authoring
// NEX bounded infrastructure · tiny-calculator authorship-proof harness · 2026-09-14
//
// Persists the three NEX1-emitted tiny-calculator files to real repo paths
// on first run and, on every subsequent run, VERIFIES the persisted files
// are byte-identical to the primitive's deterministic emission. Divergence
// fails the test suite. Hand-editing the emitted files is a governance
// violation caught here.

import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import * as path from "node:path";
import { authorSmallApplication } from "../route-2d";
import { buildTinyCalculatorSpec } from "../first-app-tiny-calculator-spec";
// §36-W-3 · 2026-09-15 · harness now merges style-overrides state file
// so the invariant is "persisted files = deterministic emission of (base ⊕ overrides)"
// rather than just base. Both are equally deterministic; the overrides file is
// tracked in git as the record of applied founder commands.
import { applyOverridesToTinyCalculatorSpec } from "../../workstation-execution-bridge/style-overrides";
import { EMPTY_STYLE_OVERRIDES } from "../../workstation-execution-bridge/execution-bridge-types";
import type { StyleOverridesFile } from "../../workstation-execution-bridge/execution-bridge-types";

const REPO_ROOT = process.cwd();

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

// Load the current style-overrides state (produced by §36-W-3 execution bridge · founder commands).
// If missing, the harness compares against the CLEAN base spec.
function loadOverrides(): StyleOverridesFile {
  const overridesPath = path.resolve(REPO_ROOT, "data/route-2d-tiny-calculator/style-overrides.json");
  try {
    if (!require("node:fs").existsSync(overridesPath)) return EMPTY_STYLE_OVERRIDES;
    const raw = require("node:fs").readFileSync(overridesPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && parsed.$schema_version === "route-2d-tiny-calculator-overrides-v1") return parsed;
  } catch { /* fall through */ }
  return EMPTY_STYLE_OVERRIDES;
}

function emit() {
  const base = buildTinyCalculatorSpec();
  const overrides = loadOverrides();
  const merged = applyOverridesToTinyCalculatorSpec(base, overrides);
  const r = authorSmallApplication({ spec: merged, emit_tests: true });
  if (!r.ok) throw new Error(`authoring failed: ${r.refusal_code} · ${r.reason}`);
  return r;
}

function absPath(rel: string): string {
  return path.resolve(REPO_ROOT, rel);
}

// ── Persist on first run · verify on every subsequent run ──────────────

beforeAll(() => {
  const r = emit();
  for (const f of r.emitted_files) {
    const abs = absPath(f.path);
    const dir = path.dirname(abs);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (!existsSync(abs)) writeFileSync(abs, f.content, "utf8");
  }
});

// ── §A · Persistence + byte-identity ──────────────────────────────────

describe("§36-2D · Route 2d · tiny-calculator authorship proof", () => {
  it("A-1 · all 3 emitted files exist at expected paths", () => {
    expect(existsSync(absPath("src/app/nex-generated/tiny-calculator/page.tsx"))).toBe(true);
    expect(existsSync(absPath("src/app/nex-generated/tiny-calculator/TinyCalculator.tsx"))).toBe(true);
    expect(existsSync(absPath("src/app/nex-generated/tiny-calculator/TinyCalculator.test.tsx"))).toBe(true);
  });

  it("A-2 · persisted bytes are byte-identical to the primitive's deterministic emission", () => {
    const r = emit();
    for (const f of r.emitted_files) {
      const persisted = readFileSync(absPath(f.path), "utf8");
      expect(sha256Hex(persisted)).toBe(f.sha256_hex);
    }
  });

  it("A-3 · every persisted file carries 'Coded by NEX1 via route_2d_small_application' header", () => {
    for (const rel of [
      "src/app/nex-generated/tiny-calculator/page.tsx",
      "src/app/nex-generated/tiny-calculator/TinyCalculator.tsx",
      "src/app/nex-generated/tiny-calculator/TinyCalculator.test.tsx",
    ]) {
      const content = readFileSync(absPath(rel), "utf8");
      expect(content).toContain("Coded by NEX1 via route_2d_small_application");
      expect(content).toContain("§36-2D · ROUTE-2D · 2026-09-14 · route-2d-small-app-authoring");
    }
  });

  it("A-4 · page.tsx declares 'use client' and imports TinyCalculator component", () => {
    const page = readFileSync(absPath("src/app/nex-generated/tiny-calculator/page.tsx"), "utf8");
    expect(page).toContain('"use client"');
    expect(page).toContain("TinyCalculator");
  });

  it("A-5 · TinyCalculator.tsx imports runtime handlers from event-handler-runtime", () => {
    const c = readFileSync(absPath("src/app/nex-generated/tiny-calculator/TinyCalculator.tsx"), "utf8");
    expect(c).toContain("handlePressDigit");
    expect(c).toContain("handlePressOperator");
    expect(c).toContain("handlePressEquals");
    expect(c).toContain("handlePressClear");
    expect(c).toContain("event-handler-runtime");
  });

  it("A-6 · determinism · re-emitting the primitive produces identical bytes", () => {
    const a = emit();
    const b = emit();
    for (let i = 0; i < a.emitted_files.length; i++) {
      expect(a.emitted_files[i].sha256_hex).toBe(b.emitted_files[i].sha256_hex);
    }
    expect(a.spec_sha256).toBe(b.spec_sha256);
  });

  it("A-7 · authorship provenance separation (spec = MAI, bytes = NEX1)", () => {
    const spec = readFileSync(
      absPath("src/lib/nex-agent-runtime/route-2d-small-app-authoring/first-app-tiny-calculator-spec.ts"),
      "utf8",
    );
    expect(spec).toContain("NEX bounded infrastructure");
    // Emitted files are NEX1-authored (verified in A-3)
  });

  it("A-8 · TinyCalculator.test.tsx exists and contains the declared test scenarios (§36-2D-a formula-display fix)", () => {
    const t = readFileSync(absPath("src/app/nex-generated/tiny-calculator/TinyCalculator.test.tsx"), "utf8");
    expect(t).toContain("initial-state");
    expect(t).toContain("press-sequence-42");
    expect(t).toContain("formula-1-plus-keeps-both");
    expect(t).toContain("formula-1-plus-2-visible");
    expect(t).toContain("add-2-plus-3-eq-5-shown");
    expect(t).toContain("clear-resets");
  });

  it("A-9 · TinyCalculator.tsx contains all 12 event handlers derived from spec", () => {
    const c = readFileSync(absPath("src/app/nex-generated/tiny-calculator/TinyCalculator.tsx"), "utf8");
    for (let d = 0; d < 10; d++) expect(c).toContain(`handleEvent_press_digit_${d}`);
    expect(c).toContain("handleEvent_press_operator_add");
    expect(c).toContain("handleEvent_press_equals");
    expect(c).toContain("handleEvent_press_clear");
  });

  it("A-10 · TinyCalculator.tsx contains no arbitrary/injected code patterns", () => {
    const c = readFileSync(absPath("src/app/nex-generated/tiny-calculator/TinyCalculator.tsx"), "utf8");
    expect(c).not.toContain("eval(");
    expect(c).not.toContain("child_process");
    expect(c).not.toContain("dangerouslySetInnerHTML");
    expect(c).not.toContain("onerror=");
    expect(c).not.toContain("javascript:");
  });
});
