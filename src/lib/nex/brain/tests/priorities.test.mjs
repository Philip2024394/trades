#!/usr/bin/env node
// priorities.test.mjs · Wave 11 · Step 9 · F33 remediation
//
// Two suites:
//   1. Contract test for sourcePriority (SP1-SP4)
//   2. Adoption drift-catcher · every migrated site imports from
//      canonical module · no local switch reappears (SPA1-SPA4)
//
// PLUS an explicit F33.b scope-verification assertion (SPA5) that
// documents the divergent storage.ts::priorityForSource site remains
// preserved inline pending product decision.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");
const requireFromHere = createRequire(import.meta.url);

// Load the canonical module standalone.
const SRC = readFileSync(join(REPO, "src/lib/nex/brain/priorities.ts"), "utf8");
const stripped = SRC.replace(/^export\s+/gm, "");
const transformed = await esbuild.transform(stripped, { loader: "ts", format: "cjs", target: "node20" });
const mod = { exports: {} };
new Function("module", "process", "exports", "require",
  transformed.code + `\nmodule.exports = { sourcePriority };`,
)(mod, process, mod.exports, () => ({}));
const { sourcePriority } = mod.exports;

// ── SP1-SP4 · canonical contract ────────────────────────────────────

test("SP1 · every KnowledgeSource maps to the doctrine-specified priority", () => {
  // Explicit table so future drift breaks the test loudly.
  const expected = {
    "gov-standards":       1,
    "chatgpt-approved":    2,
    "claude-generated":    2,
    "customer-qa":         3,
    "raw-research":        4,
    "internet-article":    5,
    "personal-ideas":      6,
    "needs-verification":  7,
  };
  for (const [source, priority] of Object.entries(expected)) {
    assert.equal(sourcePriority(source), priority, `${source} must map to ${priority}`);
  }
});

test("SP2 · unknown source falls back to 5 (safe middle)", () => {
  assert.equal(sourcePriority("brand-new-source-that-doesnt-exist"), 5);
  assert.equal(sourcePriority(""), 5);
  // Non-string coerces via switch fall-through
  assert.equal(sourcePriority(undefined), 5);
  assert.equal(sourcePriority(null), 5);
});

test("SP3 · lower priority runs first (doctrine invariant)", () => {
  assert.ok(sourcePriority("gov-standards") < sourcePriority("chatgpt-approved"));
  assert.ok(sourcePriority("chatgpt-approved") < sourcePriority("customer-qa"));
  assert.ok(sourcePriority("customer-qa") < sourcePriority("raw-research"));
  assert.ok(sourcePriority("raw-research") < sourcePriority("internet-article"));
  assert.ok(sourcePriority("personal-ideas") < sourcePriority("needs-verification"));
});

test("SP4 · every KnowledgeSource has a defined priority (no undefined returns)", () => {
  const sources = [
    "gov-standards", "chatgpt-approved", "claude-generated", "customer-qa",
    "raw-research", "internet-article", "personal-ideas", "needs-verification",
  ];
  for (const s of sources) {
    const p = sourcePriority(s);
    assert.equal(typeof p, "number", `${s} priority must be a number · got ${typeof p}`);
    assert.ok(p >= 1 && p <= 10, `${s} priority ${p} must be in [1, 10]`);
  }
});

// ── SPA1-SPA5 · Adoption drift-catcher ─────────────────────────────

const MIGRATED = [
  "src/lib/nex/brain/manager.ts",
  "src/lib/nex/brain/workers/knowledge-context.ts",
  "src/lib/nex/brain/workers/voice-context.ts",
  "src/lib/nex/brain/workers/learning-context.ts",
];

test("SPA1 · every migrated site imports sourcePriority from canonical module", () => {
  for (const rel of MIGRATED) {
    const src = readFileSync(join(REPO, rel), "utf8");
    const importsShared = /import\s*\{[^}]*sourcePriority[^}]*\}\s*from\s*["'](?:\.\/priorities|\.\.\/priorities|@\/lib\/nex\/brain\/priorities)["']/.test(src);
    assert.ok(importsShared, `${rel} must import sourcePriority from the canonical module`);
  }
});

test("SPA2 · no migrated site retains a local `function sourcePriority` definition", () => {
  for (const rel of MIGRATED) {
    const src = readFileSync(join(REPO, rel), "utf8");
    const localDef = /(?:export\s+)?function sourcePriority\s*\(/.test(src);
    assert.equal(localDef, false, `${rel} still contains a local sourcePriority function · migrate to canonical`);
  }
});

test("SPA3 · every migrated site actually USES sourcePriority (not dead import)", () => {
  for (const rel of MIGRATED) {
    const src = readFileSync(join(REPO, rel), "utf8");
    const usages = (src.match(/sourcePriority\s*\(/g) ?? []).length;
    // Import statement doesn't have parens · usages counts real call sites.
    assert.ok(usages >= 1, `${rel} imports sourcePriority but never calls it · dead import`);
  }
});

test("SPA4 · exactly ONE file defines sourcePriority (canonical only) across src/lib/nex/**", async () => {
  const { glob } = await import("node:fs/promises");
  const files = [];
  for await (const f of glob("src/lib/nex/**/*.ts", { cwd: REPO })) {
    files.push(f);
  }
  const definers = [];
  for (const f of files) {
    const src = readFileSync(join(REPO, f), "utf8");
    if (/(?:export\s+)?function sourcePriority\s*\(/.test(src)) {
      definers.push(f);
    }
  }
  // Only the canonical module should define the function.
  const nonCanonical = definers.filter((f) => !f.endsWith("brain/priorities.ts") && !f.endsWith("brain\\priorities.ts"));
  assert.deepEqual(nonCanonical, [], `unexpected sourcePriority definitions outside canonical module: ${nonCanonical.join(", ")}`);
});

// ── SPA5 · F33.b scope-verification finding · MUST stay documented ────
//
// Scope-verification during Step 9 discovered a 5th priority-table
// site (storage.ts::runProcessInbox) with DIVERGENT VALUES. It is
// preserved inline pending Philip's product decision. This test
// enforces that the divergence stays EXPLICITLY DOCUMENTED so no
// future edit silently aligns (or forgets) the two tables.

test("SPA5 · F33.b · storage.ts divergent priorityForSource remains explicitly marked and INTENTIONALLY PRESERVED", () => {
  const src = readFileSync(join(REPO, "src/lib/nex/knowledge-inbox/storage.ts"), "utf8");
  // The F33.b block MUST remain present so future editors see the
  // freeze decision. Philip 2026-08-10: "runProcessInbox uses a
  // distinct priority policy. This is intentionally preserved because
  // alignment changes production enqueue ordering. No refactor may
  // silently alter these values."
  assert.match(src, /F33\.b/,
    "storage.ts must retain the F33.b tag so future editors know to seek product approval before aligning");
  assert.match(src, /INTENTIONALLY PRESERVED/,
    "storage.ts must retain the INTENTIONALLY PRESERVED language · signals the freeze decision to any editor");
  assert.match(src, /DO NOT ALIGN THIS TABLE/,
    "storage.ts must retain the explicit DO NOT ALIGN instruction");
  assert.match(src, /explicit .* authorization/i,
    "storage.ts must retain the explicit-authorization requirement");
  // The divergent values MUST still be there (behavior preservation).
  assert.match(src, /"gov-standards":\s+3/,
    "storage.ts's divergent gov-standards=3 value must remain (behavior-preserving)");
});
