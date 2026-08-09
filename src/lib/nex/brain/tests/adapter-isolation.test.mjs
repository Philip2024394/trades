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
//   AI9 · Every method declared on the BrainStore interface must have
//         a matching implementation in every adapter (filesystem ·
//         postgres · supabase). Prevents "silent adapter drift" when
//         someone extends the contract but forgets an adapter.
//   AI10 · KnowledgeJobStatus (brain/types.ts) enum values must equal
//         JobStatus (jobs/fs-store.ts). Two independent declarations
//         exist by F12 AI4 (Brain × NEX Storage separation forbids the
//         cross-import); this drift-catcher keeps them coherent so
//         writeKnowledgeJobTransitionAudit never accepts a value the
//         fs-store cannot produce.
//   KJT1 · Every terminal KnowledgeJob transition (fs-store.updateJob
//         with status ∈ {completed,failed,released}) must be paired
//         with an `applyTerminalKnowledgeJobTransition` call OR carry
//         an inline `// drift-exempt-KJT1:<reason>` comment. Prevents
//         regression of the Phase-1 observability gap (KJ transitions
//         leaving zero audit_log trace).

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
    .filter(f => f.endsWith(".ts") && !f.includes(".test."))
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
    .filter(f => f.endsWith(".ts") && !f.includes(".test."))
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

// ── AI9 · every BrainStore method is implemented in every adapter ──

test("AI9 · every BrainStore interface method has an implementation in every adapter", () => {
  const storageSrc = read(join(BRAIN, "storage.ts"));
  const ifaceMatch = storageSrc.match(/^export interface BrainStore \{[\s\S]*?^\}/m);
  assert.ok(ifaceMatch, "storage.ts must expose an `export interface BrainStore` block");
  const ifaceBlock = ifaceMatch[0];
  const ifaceMethods = [...ifaceBlock.matchAll(/^\s{2}([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:<[^>]*>)?\s*\(/gm)]
    .map((m) => m[1])
    .filter((n) => n && n !== "BrainStore");

  assert.ok(ifaceMethods.length >= 10,
    `BrainStore interface must declare ≥10 methods · found ${ifaceMethods.length}`);

  const adapterFiles = readdirSync(ADAPTERS)
    .filter((f) => f.endsWith(".ts") && !f.includes(".test."))
    .map((f) => join(ADAPTERS, f));

  for (const f of adapterFiles) {
    const src   = read(f);
    const path  = rel(f);
    // A method implementation is `async <name>(` at ≥2-space indent
    // (class-body level). We tolerate ≥1 space so future formatters
    // don't false-fail.
    const declared = new Set(
      [...src.matchAll(/^\s+async\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm)].map((m) => m[1]),
    );
    const missing = ifaceMethods.filter((n) => !declared.has(n));
    assert.equal(missing.length, 0,
      `${path} · adapter missing BrainStore methods · ${missing.join(", ")}`);
  }
});

// ── AI10 · KnowledgeJobStatus stays aligned with fs-store JobStatus ─

test("AI10 · KnowledgeJobStatus (brain/types.ts) values equal JobStatus (jobs/fs-store.ts)", () => {
  const typesSrc = read(join(BRAIN, "types.ts"));
  const fsSrc    = readFileSync(join(REPO, "src/lib/nex/jobs/fs-store.ts"), "utf8");

  function unionMembers(src, typeName) {
    // Match `export type <name> = \n  | "a"\n  | "b" ...` OR inline.
    const re = new RegExp(`export\\s+type\\s+${typeName}\\s*=\\s*([^;]+);`, "m");
    const m = src.match(re);
    if (!m) return null;
    return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).sort();
  }
  const brainSide = unionMembers(typesSrc, "KnowledgeJobStatus");
  const fsSide    = unionMembers(fsSrc,    "JobStatus");
  assert.ok(brainSide,  "brain/types.ts must declare `export type KnowledgeJobStatus`");
  assert.ok(fsSide,     "jobs/fs-store.ts must declare `export type JobStatus`");
  assert.deepEqual(brainSide, fsSide,
    `KnowledgeJobStatus (${brainSide.join(",")}) must equal JobStatus (${fsSide.join(",")}) · ` +
    `update one of the type declarations to keep them aligned`);
});

// ── KJT1 · terminal KJ transitions must pair with the audit helper ──

test("KJT1 · fs-store.updateJob terminal transitions are paired with applyTerminalKnowledgeJobTransition (or exempted)", () => {
  const SEARCH_ROOTS = [
    join(REPO, "src/lib/nex/brain/workers"),
    join(REPO, "src/lib/nex/jobs"),
  ];
  const files = [];
  for (const root of SEARCH_ROOTS) {
    try { files.push(...walk(root)); } catch { /* dir may not exist */ }
  }

  const TERMINAL_STATUS_RE = /updateJob\s*\([^)]*status:\s*["'](?:completed|failed|released)["']/g;
  const violations = [];

  for (const f of files) {
    const path = rel(f);
    // The terminal-transition helper itself is where the paired write
    // lives · it MUST use updateJob(...status:completed...) internally.
    if (path === "src/lib/nex/jobs/terminal-transition.ts") continue;
    const src = read(f);
    const matches = [...src.matchAll(TERMINAL_STATUS_RE)];
    for (const m of matches) {
      // Look backward + forward within the enclosing function-ish window
      // for either (a) the helper name in the same file OR (b) an inline
      // exemption comment.
      const idx = m.index;
      const windowStart = Math.max(0, idx - 800);
      const windowEnd   = Math.min(src.length, idx + 800);
      const contextWin  = src.slice(windowStart, windowEnd);
      const hasHelper   = /applyTerminalKnowledgeJobTransition/.test(contextWin) ||
                          /applyTerminalKnowledgeJobTransition/.test(src);
      const hasExempt   = /\/\/\s*drift-exempt-KJT1[\s:]/i.test(contextWin);
      if (!hasHelper && !hasExempt) {
        violations.push({ path, snippet: src.slice(Math.max(0, idx - 60), idx + 80).replace(/\s+/g, " ") });
      }
    }
  }

  assert.equal(violations.length, 0,
    `KJT1 · terminal KnowledgeJob transitions must go through applyTerminalKnowledgeJobTransition ` +
    `(or carry a "// drift-exempt-KJT1:<reason>" comment). Violations:\n` +
    violations.map((v) => `  · ${v.path} :: …${v.snippet}…`).join("\n"));
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
