#!/usr/bin/env node
// adapter-isolation.test.mjs · Wave 11 · Step 10 · F12 drift-catcher
//
// This is the ARCHITECTURAL invariant test for F12. It enforces the
// stronger scope Philip locked on 2026-08-11:
//
//   "The whole point of F12 is to finish the extraction without
//    recreating the historical Brain × NEX Storage duplication."
//
// The eight invariants below are checked statically (no runtime
// imports · no live PG · pure regex over the source). If a future
// PR introduces a violation, one of AI1–AI8 fails loudly with a
// pointer to the offending file.
//
//   AI1 · storage.ts contains exactly ONE Brain selector (`brainStore`).
//   AI2 · adapters/*.ts export only classes · no selector functions ·
//         no cached singletons · no env-var branching inside adapters.
//   AI3 · storage.ts imports NO provider SDK (@supabase/supabase-js ·
//         pg · resend · sqlite · @neondatabase/serverless).
//   AI4 · adapters/*.ts do NOT import from src/lib/nex/storage/*
//         (Brain × NEX Storage separation · the F12 anti-duplication
//         invariant).
//   AI5 · exactly ONE dual-write decorator exists in the Brain module
//         (MirrorToSupabaseBrainStore in pg-to-supabase-shadow.ts) ·
//         gated behind NEX_BRAIN_SHADOW_SUPABASE=1.
//   AI6 · provider SDK imports inside src/lib/nex/brain/** are confined
//         to adapters/*.ts · with a documented F12.b exception list
//         (audit-log.ts · warehouse.ts) that the drift-catcher enforces
//         cannot GROW.
//   AI7 · NEX_BRAIN_BACKEND env var is read ONLY in storage.ts (Brain ×
//         Env-var boundary invariant).
//   AI8 · NEX_STORAGE_BACKEND env var is read ONLY in
//         src/lib/nex/storage/registry.ts (NEX Storage × Env-var
//         boundary invariant · proves Brain doesn't inadvertently
//         reach into NEX Storage's config surface).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");
const BRAIN     = join(REPO, "src/lib/nex/brain");
const ADAPTERS  = join(BRAIN, "adapters");
const STORAGE   = join(REPO, "src/lib/nex/storage");

// ── helpers ──────────────────────────────────────────────────────────

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (entry === "tests" || entry === "__tests__" || entry === "node_modules") continue;
      out.push(...walk(p));
    } else if (entry.endsWith(".ts")) {
      out.push(p);
    }
  }
  return out;
}

function read(p) { return readFileSync(p, "utf8"); }
function rel(p)  { return relative(REPO, p).replace(/\\/g, "/"); }

const PROVIDER_SDKS = [
  { name: "@supabase/supabase-js",   pattern: /from\s+["']@supabase\/supabase-js["']/ },
  { name: "pg",                      pattern: /from\s+["']pg["']/ },
  { name: "resend",                  pattern: /from\s+["']resend["']/ },
  { name: "sqlite3",                 pattern: /from\s+["']sqlite3["']/ },
  { name: "better-sqlite3",          pattern: /from\s+["']better-sqlite3["']/ },
  { name: "@neondatabase/serverless",pattern: /from\s+["']@neondatabase\/serverless["']/ },
];

// The F12.b exception list · these files import a provider SDK but
// live outside adapters/. Documented as OPEN in Wave 11. The drift-
// catcher enforces the list may NOT GROW (new violation → new file).
const F12B_KNOWN_EXCEPTIONS = new Set([
  "src/lib/nex/brain/audit-log.ts",
  "src/lib/nex/brain/warehouse.ts",
]);

// ── AI1 · storage.ts is the SOLE Brain selector ─────────────────────

test("AI1 · storage.ts defines brainStore() exactly once · no duplicate selectors", () => {
  const brainFiles = walk(BRAIN);
  let hits = 0;
  const locations = [];
  for (const f of brainFiles) {
    const src = read(f);
    // Only match top-level "export function brainStore(" definitions ·
    // not caller invocations (`brainStore()` with no `function` prefix).
    if (/^\s*export\s+function\s+brainStore\s*\(/m.test(src)) {
      hits++;
      locations.push(rel(f));
    }
  }
  assert.equal(hits, 1,
    `brainStore() must be defined exactly once · found ${hits} definitions in: ${locations.join(", ")}`);
  assert.equal(locations[0], "src/lib/nex/brain/storage.ts",
    `The canonical definition must live in storage.ts · found in ${locations[0]}`);
});

// ── AI2 · adapters/*.ts export only classes · no selector logic ─────

test("AI2 · adapters/*.ts export ONLY classes · no selector functions · no cached singletons", () => {
  const adapterFiles = readdirSync(ADAPTERS)
    .filter(f => f.endsWith(".ts"))
    .map(f => join(ADAPTERS, f));

  assert.ok(adapterFiles.length >= 3, `expected ≥3 adapters · found ${adapterFiles.length}`);

  for (const f of adapterFiles) {
    const src  = read(f);
    const path = rel(f);

    // A · must export at least one class
    assert.ok(/^\s*export\s+class\s+\w+/m.test(src),
      `${path} · adapter must export at least one class`);

    // B · must NOT export a selector-style function ("get*Store" · "select*" ·
    //     "resolve*Store" · "make*Store"). Env-var branching that picks a
    //     backend is a selector — that belongs in storage.ts alone.
    const forbiddenSelectors = [
      /^\s*export\s+function\s+get\w*Store\s*\(/m,
      /^\s*export\s+function\s+select\w*Store\s*\(/m,
      /^\s*export\s+function\s+make\w*Store\s*\(/m,
      /^\s*export\s+function\s+resolve\w*Store\s*\(/m,
      /^\s*export\s+function\s+brainStore\s*\(/m,
    ];
    for (const re of forbiddenSelectors) {
      assert.ok(!re.test(src),
        `${path} · adapters may not define selector functions (matched ${re.source})`);
    }

    // C · must NOT hold a module-scoped cached singleton of a store.
    //     Pattern: `let _<something> : <Something>Store | null = null;`
    //     or `let cached : ...Store | null`.
    assert.ok(
      !/^\s*let\s+(_?cached|_?store|_?instance)\s*:\s*\w*BrainStore\s*\|\s*null/m.test(src),
      `${path} · adapters may not hold a cached singleton · that is a selector concern`);

    // D · must NOT read NEX_BRAIN_BACKEND (backend selection is
    //     storage.ts's job · adapters must not branch on it).
    assert.ok(!/process\.env\.NEX_BRAIN_BACKEND/.test(src),
      `${path} · adapters may not read NEX_BRAIN_BACKEND · that is storage.ts's job`);
  }
});

// ── AI3 · storage.ts imports NO provider SDK ────────────────────────

test("AI3 · storage.ts imports NO provider SDK directly", () => {
  const src  = read(join(BRAIN, "storage.ts"));
  const path = rel(join(BRAIN, "storage.ts"));

  for (const { name, pattern } of PROVIDER_SDKS) {
    assert.ok(!pattern.test(src),
      `${path} · must not import provider SDK "${name}" · move it into adapters/`);
  }
});

// ── AI4 · adapters MUST NOT import from src/lib/nex/storage/* ───────

test("AI4 · brain/adapters/*.ts do NOT import from src/lib/nex/storage/* · Brain × NEX Storage boundary", () => {
  const adapterFiles = readdirSync(ADAPTERS)
    .filter(f => f.endsWith(".ts"))
    .map(f => join(ADAPTERS, f));

  // Every syntactic form that would reach into NEX Storage:
  //   from "@/lib/nex/storage"
  //   from "@/lib/nex/storage/..."
  //   from "../../storage"        (relative escape · brain → nex → storage)
  //   from "../../storage/..."
  //   from "src/lib/nex/storage"
  const forbidden = [
    /from\s+["']@\/lib\/nex\/storage(?:\/|["'])/,
    /from\s+["']\.\.\/\.\.\/storage(?:\/|["'])/,
    /from\s+["']src\/lib\/nex\/storage(?:\/|["'])/,
  ];

  for (const f of adapterFiles) {
    const src  = read(f);
    const path = rel(f);
    for (const re of forbidden) {
      assert.ok(!re.test(src),
        `${path} · Brain adapters must not import from NEX Storage runtime (matched ${re.source})`);
    }
  }
});

// ── AI5 · exactly ONE dual-write decorator ──────────────────────────

test("AI5 · exactly ONE dual-write decorator exists in Brain (MirrorToSupabaseBrainStore) · gated by NEX_BRAIN_SHADOW_SUPABASE", () => {
  const brainFiles = walk(BRAIN);
  const decoratorDefs = [];

  // A decorator has: `class <Name>...BrainStore implements BrainStore`
  // where the class holds MULTIPLE store fields (inner + mirror).
  for (const f of brainFiles) {
    const src = read(f);
    const classMatches = src.matchAll(/export\s+class\s+(\w+)\s+implements\s+BrainStore\b/g);
    for (const m of classMatches) {
      const className = m[1];
      // Locate the class body from the match forward to the next
      // top-level `}` (approximate but robust for well-formed code).
      const start = m.index;
      const bodyEnd = findClassBodyEnd(src, start);
      const body = src.slice(start, bodyEnd);

      // Heuristic · dual-store decorators have BOTH `inner` and
      // `mirror` (or similar decorator-shape) properties AND at least
      // one method that awaits inner + fires mirror without await.
      const hasInnerMirror =
        /\b(?:inner|primary)\b/.test(body) && /\b(?:mirror|secondary|shadow)\b/.test(body);
      const hasDualWriteShape =
        /await\s+this\.(?:inner|primary)\.[a-zA-Z]/.test(body) &&
        /this\.(?:mirror|secondary|shadow)\.[a-zA-Z]/.test(body);

      if (hasInnerMirror && hasDualWriteShape) {
        decoratorDefs.push({ file: rel(f), className });
      }
    }
  }

  assert.equal(decoratorDefs.length, 1,
    `expected exactly ONE dual-write decorator · found ${decoratorDefs.length}: ${decoratorDefs.map(d => `${d.file}::${d.className}`).join(", ")}`);
  assert.equal(decoratorDefs[0].className, "MirrorToSupabaseBrainStore",
    `the sole dual-write decorator must be MirrorToSupabaseBrainStore · found ${decoratorDefs[0].className}`);
  assert.equal(decoratorDefs[0].file, "src/lib/nex/brain/pg-to-supabase-shadow.ts",
    `MirrorToSupabaseBrainStore must live in pg-to-supabase-shadow.ts (Wave 7 safety net) · found ${decoratorDefs[0].file}`);

  // Selector gate check · brainStore() must only instantiate the
  // decorator when NEX_BRAIN_SHADOW_SUPABASE=1 AND isSupabaseConfigured.
  const storageSrc = read(join(BRAIN, "storage.ts"));
  assert.ok(
    /NEX_BRAIN_SHADOW_SUPABASE\s*===\s*["']1["']/.test(storageSrc),
    "storage.ts::brainStore() must gate MirrorToSupabaseBrainStore on NEX_BRAIN_SHADOW_SUPABASE === '1'");
  assert.ok(
    /isSupabaseConfigured\s*\(\s*\)/.test(storageSrc),
    "storage.ts::brainStore() must AND-gate the mirror against isSupabaseConfigured()");
});

function findClassBodyEnd(src, startIdx) {
  const firstBrace = src.indexOf("{", startIdx);
  if (firstBrace === -1) return src.length;
  let depth = 1;
  for (let i = firstBrace + 1; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return src.length;
}

// ── AI6 · provider SDK confinement · F12.b exception list ───────────

test("AI6 · provider SDK imports in src/lib/nex/brain/** are confined to adapters/*.ts · F12.b exception list cannot grow", () => {
  const brainFiles = walk(BRAIN);
  const violations = [];

  for (const f of brainFiles) {
    const path = rel(f);
    if (path.startsWith("src/lib/nex/brain/adapters/")) continue;
    const src = read(f);
    for (const { name, pattern } of PROVIDER_SDKS) {
      if (pattern.test(src)) {
        violations.push({ path, sdk: name });
      }
    }
  }

  // Every violation must be on the known F12.b exception list. If a NEW
  // file appears here, the list must be updated ONLY after Philip
  // authorizes the exception. Growth is a doctrine violation.
  const unauthorized = violations.filter(v => !F12B_KNOWN_EXCEPTIONS.has(v.path));
  assert.equal(unauthorized.length, 0,
    `NEW provider-SDK import outside adapters/ · not on the F12.b list: ` +
    unauthorized.map(v => `${v.path} (${v.sdk})`).join(", "));

  // Also assert that the KNOWN exceptions are still real · if a listed
  // file no longer imports the SDK, the exception should be removed.
  for (const path of F12B_KNOWN_EXCEPTIONS) {
    const still = violations.some(v => v.path === path);
    assert.ok(still,
      `F12.b exception ${path} no longer imports a provider SDK · remove it from F12B_KNOWN_EXCEPTIONS`);
  }
});

// ── AI7 · NEX_BRAIN_BACKEND env var is read only in storage.ts ──────

test("AI7 · NEX_BRAIN_BACKEND is read ONLY in src/lib/nex/brain/storage.ts · single Brain selection boundary", () => {
  const brainFiles = walk(BRAIN);
  const readers = [];
  for (const f of brainFiles) {
    const src = read(f);
    if (/process\.env\.NEX_BRAIN_BACKEND\b/.test(src)) {
      readers.push(rel(f));
    }
  }
  assert.equal(readers.length, 1,
    `NEX_BRAIN_BACKEND must be read exactly once in Brain · found in: ${readers.join(", ")}`);
  assert.equal(readers[0], "src/lib/nex/brain/storage.ts",
    `NEX_BRAIN_BACKEND must be read only in storage.ts · found in ${readers[0]}`);
});

// ── AI8 · NEX_STORAGE_BACKEND is read only in NEX Storage registry ──

test("AI8 · NEX_STORAGE_BACKEND is read ONLY in src/lib/nex/storage/registry.ts · NEX Storage boundary", () => {
  const storageFiles = walk(STORAGE);
  const readers = [];
  for (const f of storageFiles) {
    const src = read(f);
    if (/process\.env\.NEX_STORAGE_BACKEND\b/.test(src)) {
      readers.push(rel(f));
    }
  }
  assert.equal(readers.length, 1,
    `NEX_STORAGE_BACKEND must be read exactly once in NEX Storage · found in: ${readers.join(", ")}`);
  assert.equal(readers[0], "src/lib/nex/storage/registry.ts",
    `NEX_STORAGE_BACKEND must be read only in registry.ts · found in ${readers[0]}`);

  // Bonus · confirm Brain doesn't touch NEX Storage's selector env var.
  const brainFiles = walk(BRAIN);
  const brainLeaks = [];
  for (const f of brainFiles) {
    const src = read(f);
    if (/process\.env\.NEX_STORAGE_BACKEND\b/.test(src)) {
      brainLeaks.push(rel(f));
    }
  }
  assert.equal(brainLeaks.length, 0,
    `Brain must NOT read NEX_STORAGE_BACKEND · that is NEX Storage's env · found in: ${brainLeaks.join(", ")}`);
});
