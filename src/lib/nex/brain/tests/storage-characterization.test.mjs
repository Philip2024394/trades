#!/usr/bin/env node
// storage-characterization.test.mjs · Wave 11 · Step 10 · F12
//
// Characterization tests capture the CURRENT observable surface of
// storage.ts BEFORE any extraction. Their job is to fail loudly if
// the F12 refactor accidentally changes:
//
//   · the selector's public exports (brainStore · activeBackend ·
//     newId · nowIso · _resetBrainStoreForTests)
//   · the selector's backend-choice logic (which store class is
//     returned for a given env combination)
//   · the shape of the BrainStore interface each adapter implements
//   · the composition of MirrorToSupabaseBrainStore when both
//     shadow gates are set
//
// These tests do NOT hit real Postgres or Supabase · they read the
// source + verify the selector code path statically. Real-adapter
// contract tests already live in brain-adapter-contract.test.mjs
// (untouched by this test) and cover behavioral correctness.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");
const STORAGE   = readFileSync(join(REPO, "src/lib/nex/brain/storage.ts"), "utf8");
// Wave 11 · Step 10 · F12 · All three concrete adapters extracted to
// dedicated files · load their sources too for the class-body checks.
const POSTGRES_ADAPTER   = readFileSync(join(REPO, "src/lib/nex/brain/adapters/postgres.ts"), "utf8");
const FILESYSTEM_ADAPTER = readFileSync(join(REPO, "src/lib/nex/brain/adapters/filesystem.ts"), "utf8");
const SUPABASE_ADAPTER   = readFileSync(join(REPO, "src/lib/nex/brain/adapters/supabase.ts"), "utf8");

// ── SC1-SC5 · public selector exports MUST remain stable ──────────

test("SC1 · brainStore is exported and returns BrainStore", () => {
  assert.match(STORAGE, /export function brainStore\(\): BrainStore/,
    "brainStore() public signature is a load-bearing external contract");
});

test("SC2 · activeBackend is exported returning the exact 3-value union", () => {
  assert.match(STORAGE, /export function activeBackend\(\): "filesystem" \| "supabase" \| "postgres"/);
});

test("SC3 · newId + nowIso helpers exported for cross-module use", () => {
  assert.match(STORAGE, /export function newId\(\): string/);
  assert.match(STORAGE, /export function nowIso\(\): string/);
});

test("SC4 · _resetBrainStoreForTests exported (contract tests depend on it)", () => {
  assert.match(STORAGE, /export function _resetBrainStoreForTests\(\): void/);
});

test("SC5 · isSupabaseConfigured + isPostgresConfigured helpers present (private)", () => {
  assert.match(STORAGE, /function isSupabaseConfigured\(\)/);
  assert.match(STORAGE, /function isPostgresConfigured\(\)/);
});

// ── SC6-SC10 · selector decision tree · precedence and composition ─

test("SC6 · brainStore() checks Postgres FIRST when both PG + Supabase configured", () => {
  const selectorBlock = STORAGE.match(/export function brainStore\(\): BrainStore \{[\s\S]*?^\}/m)?.[0] ?? "";
  assert.notEqual(selectorBlock.length, 0);
  const pgIdx    = selectorBlock.indexOf("isPostgresConfigured()");
  const supaIdx  = selectorBlock.indexOf("isSupabaseConfigured()");
  assert.ok(pgIdx !== -1 && supaIdx !== -1, "both configuration checks present in selector");
  assert.ok(pgIdx < supaIdx, "Postgres check MUST precede Supabase check · precedence is a load-bearing invariant");
});

test("SC7 · brainStore() falls through to FilesystemStore when no backend configured", () => {
  const selectorBlock = STORAGE.match(/export function brainStore\(\): BrainStore \{[\s\S]*?^\}/m)?.[0] ?? "";
  assert.match(selectorBlock, /new FilesystemStore\(\)/, "filesystem fallback must remain (dev safety)");
});

test("SC8 · brainStore() constructs PostgresBrainStore when Postgres configured", () => {
  const selectorBlock = STORAGE.match(/export function brainStore\(\): BrainStore \{[\s\S]*?^\}/m)?.[0] ?? "";
  assert.match(selectorBlock, /new PostgresBrainStore\(\)/);
});

test("SC9 · brainStore() constructs SupabaseStore in the Supabase branch", () => {
  const selectorBlock = STORAGE.match(/export function brainStore\(\): BrainStore \{[\s\S]*?^\}/m)?.[0] ?? "";
  assert.match(selectorBlock, /new SupabaseStore\(\)/);
});

test("SC10 · MirrorToSupabaseBrainStore composes ONLY when strict AND of both shadow gates + Supabase configured", () => {
  const selectorBlock = STORAGE.match(/export function brainStore\(\): BrainStore \{[\s\S]*?^\}/m)?.[0] ?? "";
  // Three conditions ALL required (Wave 7 shadow strict-AND)
  assert.match(selectorBlock, /NEX_BRAIN_SHADOW_SUPABASE === "1"/);
  assert.match(selectorBlock, /isSupabaseConfigured\(\)/);
  assert.match(selectorBlock, /MirrorToSupabaseBrainStore/);
  // Lazy-require pattern preserved (avoid circular import)
  assert.match(selectorBlock, /require\("\.\/pg-to-supabase-shadow"\)/);
});

// ── SC11-SC15 · adapter classes must implement BrainStore ─────────

test("SC11 · FilesystemStore is defined and implements BrainStore (F12 · now in adapters/filesystem.ts)", () => {
  assert.match(FILESYSTEM_ADAPTER, /export class FilesystemStore implements BrainStore/);
  // storage.ts must NOT re-define the class (drift-catcher for F12 rollback).
  assert.doesNotMatch(STORAGE, /class FilesystemStore implements BrainStore/,
    "FilesystemStore was extracted · storage.ts must not re-inline it");
});

test("SC12 · SupabaseStore is defined and implements BrainStore (F12 · now in adapters/supabase.ts)", () => {
  assert.match(SUPABASE_ADAPTER, /class SupabaseStore implements BrainStore/);
  // storage.ts must NOT re-define the class (drift-catcher for F12 rollback).
  assert.doesNotMatch(STORAGE, /class SupabaseStore implements BrainStore/,
    "SupabaseStore was extracted · storage.ts must not re-inline it");
});

test("SC13 · PostgresBrainStore is defined and implements BrainStore (F12 · now in adapters/postgres.ts)", () => {
  assert.match(POSTGRES_ADAPTER, /class PostgresBrainStore implements BrainStore/);
  // storage.ts must NOT re-define the class (drift-catcher for F12 rollback).
  assert.doesNotMatch(STORAGE, /class PostgresBrainStore implements BrainStore/,
    "PostgresBrainStore was extracted · storage.ts must not re-inline it");
});

test("SC14 · every BrainStore method appears in each adapter (contract-shape spot check)", () => {
  // Sample methods that MUST exist on every adapter · not exhaustive.
  const requiredMethods = [
    "insertRecord", "getRecord", "listRecords",
    "insertEdge", "listEdges",
    "enqueueJob", "claimNextJob", "completeJob", "failJob",
    "insertResult", "insertAudit",
  ];
  // Wave 11 F12 · all three concrete adapters extracted to their own files.
  const sources = {
    FilesystemStore:     FILESYSTEM_ADAPTER,
    SupabaseStore:       SUPABASE_ADAPTER,
    PostgresBrainStore:  POSTGRES_ADAPTER,
  };
  for (const [cls, src] of Object.entries(sources)) {
    const start = src.indexOf(`class ${cls} implements BrainStore`);
    assert.notEqual(start, -1, `${cls} must be present`);
    const nextClass = src.slice(start + 1).search(/^class \w+ implements BrainStore/m);
    const end = nextClass === -1 ? src.length : start + 1 + nextClass;
    const body = src.slice(start, end);
    for (const m of requiredMethods) {
      const re = new RegExp(`async ${m}\\s*\\(`);
      assert.match(body, re, `${cls} must implement async ${m}`);
    }
  }
});

test("SC15 · FS_ROOT filesystem path constant present (behavior anchor · moved to adapters/filesystem.ts with the class)", () => {
  assert.match(FILESYSTEM_ADAPTER, /const FS_ROOT = path\.join\(process\.cwd\(\), "data", "nex-brain"\)/);
  // storage.ts must NOT retain FS_ROOT (drift-catcher for extraction).
  assert.doesNotMatch(STORAGE, /const FS_ROOT = path\.join/,
    "FS_ROOT was moved with FilesystemStore · storage.ts must not retain a duplicate");
});

// ── SC16 · F12 extraction drift-catcher · FilesystemStore + helpers must stay in adapters/ ──

test("SC16 · adapters/filesystem.ts exports FilesystemStore AND owns the fs I/O primitives", () => {
  // Class is exported so storage.ts can construct it.
  assert.match(FILESYSTEM_ADAPTER, /export class FilesystemStore implements BrainStore/);
  // Private helpers moved with it — storage.ts no longer touches fs/path.
  assert.match(FILESYSTEM_ADAPTER, /async function ensureFsRoot\(\)/);
  assert.match(FILESYSTEM_ADAPTER, /async function readTable<T>/);
  assert.match(FILESYSTEM_ADAPTER, /async function writeTable<T>/);
  // storage.ts must have shed the fs/path imports entirely.
  assert.doesNotMatch(STORAGE, /from "node:fs"/,
    "storage.ts no longer needs node:fs · every fs call moved to adapters/filesystem.ts");
  assert.doesNotMatch(STORAGE, /from "node:path"/,
    "storage.ts no longer needs node:path · every path call moved to adapters/filesystem.ts");
  // Selector still constructs FilesystemStore from the extracted module.
  assert.match(STORAGE, /import \{ FilesystemStore \} from "\.\/adapters\/filesystem"/);
});
