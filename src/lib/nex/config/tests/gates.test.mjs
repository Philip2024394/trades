#!/usr/bin/env node
// gates.test.mjs · Wave 11 · Step 11 · F29 contract tests
//
// Pure contract tests for `src/lib/nex/config/gates.ts`. No PG required.
// Every gate coercer + the composite snapshot are exercised.
//
// Assertion legend:
//   G1 · every gate resolves to "unset" on empty env (honest default)
//   G2 · brain_backend accepts postgres | supabase | filesystem
//   G3 · storage_backend accepts postgres | jsonl | dual-write (case-insensitive)
//   G4 · inbox_read_backend accepts postgres | filesystem (case-insensitive)
//   G5 · shadow gates distinguish "1"=on, other=off, missing=unset
//   G6 · object_backend accepts postgres | filesystem (case-insensitive)
//   G7 · postgres_url_present tracks NEX_POSTGRES_URL validity
//   G8 · GATE_ENV_NAMES is the exact canonical set (drift-catcher)
//   G9 · getFeatureGates never throws (even on garbage input)
//   G10 · getFeatureGates returns a NEW object each call (no shared state)

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");

async function loadModule(relPath, exportNames) {
  const src = readFileSync(join(REPO, relPath), "utf8");
  // Strip export + convert @/lib imports to relative stubs (only pg.ts here).
  const stripped = src
    .replace(/^export\s+/gm, "")
    .replace(/from\s+["']\.\/pg["']/g, `from "./pg-stub"`);
  const transformed = await esbuild.transform(stripped, { loader: "ts", format: "cjs", target: "node20" });
  const mod = { exports: {} };
  const pgStub = {
    hasPostgresUrl: (env) => {
      const raw = env?.NEX_POSTGRES_URL;
      if (typeof raw !== "string") return false;
      const trimmed = raw.trim();
      if (trimmed.length === 0) return false;
      return /^postgres(ql)?:\/\//.test(trimmed);
    },
  };
  const req = (id) => (id === "./pg-stub" ? pgStub : {});
  const exportList = exportNames.join(", ");
  new Function("module", "process", "exports", "require",
    transformed.code + `\nmodule.exports = { ${exportList} };`,
  )(mod, process, mod.exports, req);
  return mod.exports;
}

const { getFeatureGates, GATE_ENV_NAMES } = await loadModule(
  "src/lib/nex/config/gates.ts",
  ["getFeatureGates", "GATE_ENV_NAMES"],
);

// ── G1 ───────────────────────────────────────────────────────────────

test("G1 · every gate resolves to a stable default on empty env · honest 'unset' not fabricated 'off'", () => {
  const snap = getFeatureGates({});
  assert.equal(snap.brain_backend,         "unset");
  assert.equal(snap.storage_backend,       "unset");
  assert.equal(snap.inbox_read_backend,    "unset");
  assert.equal(snap.inbox_shadow_postgres, "unset");
  assert.equal(snap.brain_shadow_supabase, "unset");
  assert.equal(snap.object_backend,        "unset");
  assert.equal(snap.postgres_url_present,  false);
});

// ── G2 ───────────────────────────────────────────────────────────────

test("G2 · brain_backend accepts postgres | supabase | filesystem", () => {
  for (const v of ["postgres", "supabase", "filesystem"]) {
    assert.equal(getFeatureGates({ NEX_BRAIN_BACKEND: v }).brain_backend, v);
  }
  assert.equal(getFeatureGates({ NEX_BRAIN_BACKEND: "invalid" }).brain_backend, "unset");
});

// ── G3 ───────────────────────────────────────────────────────────────

test("G3 · storage_backend accepts postgres | jsonl | dual-write (case-insensitive)", () => {
  for (const v of ["postgres", "jsonl", "dual-write"]) {
    assert.equal(getFeatureGates({ NEX_STORAGE_BACKEND: v.toUpperCase() }).storage_backend, v,
      "must lowercase-coerce to match the registry.ts selector");
  }
  assert.equal(getFeatureGates({ NEX_STORAGE_BACKEND: "invalid" }).storage_backend, "unset");
});

// ── G4 ───────────────────────────────────────────────────────────────

test("G4 · inbox_read_backend accepts postgres | filesystem (case-insensitive)", () => {
  assert.equal(getFeatureGates({ NEX_INBOX_READ_BACKEND: "POSTGRES" }).inbox_read_backend, "postgres");
  assert.equal(getFeatureGates({ NEX_INBOX_READ_BACKEND: "Filesystem" }).inbox_read_backend, "filesystem");
  assert.equal(getFeatureGates({ NEX_INBOX_READ_BACKEND: "" }).inbox_read_backend, "unset");
});

// ── G5 ───────────────────────────────────────────────────────────────

test("G5 · shadow gates distinguish 1=on · anything-else=off · missing=unset", () => {
  assert.equal(getFeatureGates({}).inbox_shadow_postgres, "unset");
  assert.equal(getFeatureGates({ NEX_INBOX_SHADOW_POSTGRES: "1" }).inbox_shadow_postgres, "on");
  assert.equal(getFeatureGates({ NEX_INBOX_SHADOW_POSTGRES: "0" }).inbox_shadow_postgres, "off");
  assert.equal(getFeatureGates({ NEX_INBOX_SHADOW_POSTGRES: "true" }).inbox_shadow_postgres, "off",
    "the shadow protocol expects '1' · not 'true' · anything-else means the operator disabled it");

  assert.equal(getFeatureGates({}).brain_shadow_supabase, "unset");
  assert.equal(getFeatureGates({ NEX_BRAIN_SHADOW_SUPABASE: "1" }).brain_shadow_supabase, "on");
  assert.equal(getFeatureGates({ NEX_BRAIN_SHADOW_SUPABASE: "0" }).brain_shadow_supabase, "off");
});

// ── G6 ───────────────────────────────────────────────────────────────

test("G6 · object_backend accepts postgres | filesystem (case-insensitive)", () => {
  assert.equal(getFeatureGates({ NEX_OBJECT_BACKEND: "postgres" }).object_backend, "postgres");
  assert.equal(getFeatureGates({ NEX_OBJECT_BACKEND: "Filesystem" }).object_backend, "filesystem");
  assert.equal(getFeatureGates({ NEX_OBJECT_BACKEND: "s3" }).object_backend, "unset");
});

// ── G7 ───────────────────────────────────────────────────────────────

test("G7 · postgres_url_present tracks NEX_POSTGRES_URL validity", () => {
  assert.equal(getFeatureGates({ NEX_POSTGRES_URL: "postgresql://a:b@h/d" }).postgres_url_present, true);
  assert.equal(getFeatureGates({ NEX_POSTGRES_URL: "postgres://a:b@h/d" }).postgres_url_present, true);
  assert.equal(getFeatureGates({ NEX_POSTGRES_URL: "bogus" }).postgres_url_present, false);
  assert.equal(getFeatureGates({}).postgres_url_present, false);
});

// ── G8 ───────────────────────────────────────────────────────────────

test("G8 · GATE_ENV_NAMES is the exact canonical set (drift-catcher)", () => {
  const canonical = [
    "NEX_BRAIN_BACKEND",
    "NEX_STORAGE_BACKEND",
    "NEX_INBOX_READ_BACKEND",
    "NEX_INBOX_SHADOW_POSTGRES",
    "NEX_BRAIN_SHADOW_SUPABASE",
    "NEX_OBJECT_BACKEND",
  ];
  assert.deepEqual([...GATE_ENV_NAMES], canonical,
    "adding/removing/renaming a gate requires updating the API contract AND this test AND .env.example");
});

// ── G9 ───────────────────────────────────────────────────────────────

test("G9 · getFeatureGates never throws · even on garbage input", () => {
  const garbageCases = [
    { NEX_BRAIN_BACKEND: "🚀" },
    { NEX_STORAGE_BACKEND: "\0\0\0" },
    { NEX_INBOX_SHADOW_POSTGRES: JSON.stringify({ x: 1 }) },
    { NEX_OBJECT_BACKEND: " ".repeat(1000) },
  ];
  for (const env of garbageCases) {
    // Must not throw. Result may be all "unset" · that is the honest report.
    const snap = getFeatureGates(env);
    assert.ok(typeof snap === "object" && snap !== null);
  }
});

// ── G10 ──────────────────────────────────────────────────────────────

test("G10 · getFeatureGates returns a NEW object each call · no shared mutable state", () => {
  const a = getFeatureGates({ NEX_BRAIN_BACKEND: "postgres" });
  const b = getFeatureGates({ NEX_BRAIN_BACKEND: "postgres" });
  assert.notEqual(a, b, "callers should not share references · dashboard polling must see fresh snapshots");
  assert.deepEqual(a, b, "equal values though");
});
