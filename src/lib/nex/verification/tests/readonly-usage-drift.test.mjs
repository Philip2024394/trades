#!/usr/bin/env node
// readonly-usage-drift.test.mjs · STEP 4C · Tier 1 · drift-catcher
//
// Governed by: docs/headquarters-production-readiness/STEP-4B-SAFE-READONLY-ACCESS-DESIGN.md §4
//
// Locks the safety envelope around the readonly-pg helper so future
// code cannot silently bypass the guarantees:
//
//   RU1 · single reader of process.env.NEX_PROD_READONLY_URL
//   RU2 · only files under src/lib/nex/verification/** or the
//         scripts/prove-production-*-readonly.* path may import
//         readOnlyProductionClient
//   RU3 · no file under src/lib/nex/verification/** may import
//         withClient / withBrainRole / raw pg (verification code
//         must never fall back to the write-capable pool)
//   RU4 · readonly-pg.ts source must contain the dev-substring
//         rejection strings ("localhost", "127.0.0.1", "nex_dev")
//         AND the SET SESSION + BEGIN TRANSACTION READ ONLY primitives
//         + validateReadOnlyUrlForTests helper + refusal error class
//
// These 4 assertions are the hard boundary between the runtime write-
// capable credential path and the verification read-only path.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..", "..", "..", "..");
const HELPER = join(REPO, "src/lib/nex/verification/readonly-pg.ts");
const VERIFICATION_DIR = join(REPO, "src/lib/nex/verification");
const SCRIPTS_DIR = join(REPO, "scripts");

function walk(dir, filter) {
  const out = [];
  if (!existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const p = join(cur, e.name);
      if (e.isDirectory()) { stack.push(p); continue; }
      if (filter(p)) out.push(p);
    }
  }
  return out;
}

function rel(p) { return relative(REPO, p).split(sep).join("/"); }
function read(p) { return readFileSync(p, "utf8"); }

// ── RU1 · single reader of NEX_PROD_READONLY_URL ────────────────────

test("RU1 · exactly one file references process.env.NEX_PROD_READONLY_URL", () => {
  // Scan all .ts / .mjs / .js files in the repo (excluding node_modules,
  // .next) for the env var read pattern. Self-exclude the drift-catcher
  // itself (its RU5 test seam legitimately mentions the name to prove
  // rejection contracts · this exclusion mirrors the Phase 6
  // supervisor-fixture-preservation self-exclusion).
  const selfPath = "src/lib/nex/verification/tests/readonly-usage-drift.test.mjs";
  const files = walk(join(REPO, "src"), (p) => /\.(ts|mjs|js)$/.test(p) && !/node_modules|\.next/.test(p))
    .concat(walk(SCRIPTS_DIR, (p) => /\.(ts|mjs|js)$/.test(p)))
    .filter((p) => rel(p) !== selfPath);
  const hits = [];
  const readerRe = /process\.env\.NEX_PROD_READONLY_URL\b/;
  for (const f of files) {
    if (readerRe.test(read(f))) hits.push(rel(f));
  }
  assert.equal(hits.length, 1,
    `NEX_PROD_READONLY_URL must be read exactly once (in the readonly-pg helper) · found in: ${hits.join(" · ")}`);
  assert.equal(hits[0], "src/lib/nex/verification/readonly-pg.ts",
    `NEX_PROD_READONLY_URL must be read only in the helper · found in ${hits[0]}`);
});

// ── RU2 · scope-limited importers of readOnlyProductionClient ───────

test("RU2 · only verification/** OR scripts/prove-production-*-readonly.* may import readOnlyProductionClient", () => {
  const importerRe = /from\s+["']@\/lib\/nex\/verification\/readonly-pg["']|from\s+["']\.\.?\/readonly-pg["']/;
  const files = walk(join(REPO, "src"), (p) => /\.(ts|mjs|js|tsx)$/.test(p) && !/node_modules|\.next/.test(p))
    .concat(walk(SCRIPTS_DIR, (p) => /\.(ts|mjs|js)$/.test(p)));
  const offenders = [];
  for (const f of files) {
    if (!importerRe.test(read(f))) continue;
    const rp = rel(f);
    const inVerification = rp.startsWith("src/lib/nex/verification/");
    const isProdReadonlyProbe = /^scripts\/prove-production-.*-readonly\.(ts|mjs|js)$/.test(rp);
    if (!inVerification && !isProdReadonlyProbe) offenders.push(rp);
  }
  assert.equal(offenders.length, 0,
    `readOnlyProductionClient may only be imported from src/lib/nex/verification/** or scripts/prove-production-*-readonly.* · unauthorized importers: ${offenders.join(" · ")}`);
});

// ── RU3 · verification code cannot fall back to the write-capable pool ──

test("RU3 · files under src/lib/nex/verification/** must not import withClient / withBrainRole / raw pg", () => {
  const files = walk(VERIFICATION_DIR, (p) => /\.(ts|mjs|js)$/.test(p) && !/[\/\\]tests[\/\\]/.test(p));
  // readonly-pg.ts is the ONE approved place that touches pg (via lazy require).
  const bannedPatterns = [
    { name: "@/lib/nex/db (withClient)", re: /from\s+["']@\/lib\/nex\/db["']/ },
    { name: "@/lib/nex/db/with-brain-role", re: /from\s+["']@\/lib\/nex\/db\/with-brain-role["']/ },
    { name: "@/lib/nex/delivery/db", re: /from\s+["']@\/lib\/nex\/delivery\/db["']/ },
  ];
  const staticPgImport = /import\s+.*\s+from\s+["']pg["']|import\s+["']pg["']/;
  const offenders = [];
  for (const f of files) {
    const src = read(f);
    for (const b of bannedPatterns) {
      if (b.re.test(src)) offenders.push(`${rel(f)} imports ${b.name}`);
    }
    // Static `import ... from "pg"` also banned in verification code.
    // The helper uses a lazy `require("pg")` behind runtime guards; that
    // pattern is allowed only in readonly-pg.ts.
    if (staticPgImport.test(src)) offenders.push(`${rel(f)} statically imports pg`);
  }
  assert.equal(offenders.length, 0,
    `verification code must not fall back to write-capable pg paths · offenders: ${offenders.join(" · ")}`);
});

// ── RU4 · helper source contains all safety primitives ─────────────

test("RU4 · readonly-pg.ts encodes all Layer 2 rejection strings + Layer 3/4 primitives", () => {
  assert.ok(existsSync(HELPER), "readonly-pg.ts must exist at src/lib/nex/verification/readonly-pg.ts");
  const src = read(HELPER);
  // L2 · dev-substring rejection strings must all appear
  for (const bad of ["localhost", "127.0.0.1", "nex_dev", ":5433"]) {
    assert.ok(src.includes(bad),
      `readonly-pg.ts must reject substring "${bad}" (Layer 2 URL rejection) · not found in source`);
  }
  // L3 · session-level READ ONLY lock
  assert.match(src, /SET SESSION default_transaction_read_only = on/,
    "readonly-pg.ts must set session-level default_transaction_read_only = on");
  // L4 · transaction-level READ ONLY lock
  assert.match(src, /BEGIN TRANSACTION READ ONLY/,
    "readonly-pg.ts must open transactions with BEGIN TRANSACTION READ ONLY");
  // L4 · every fn ends in ROLLBACK · nothing this helper does should commit
  assert.match(src, /ROLLBACK/,
    "readonly-pg.ts must ROLLBACK every read-only transaction");
  // Typed error classes for misconfig + unsafe URLs
  assert.match(src, /class\s+ReadOnlyProductionUrlUnsafeError\b/,
    "readonly-pg.ts must export ReadOnlyProductionUrlUnsafeError");
  assert.match(src, /class\s+ReadOnlyProductionMisconfiguredError\b/,
    "readonly-pg.ts must export ReadOnlyProductionMisconfiguredError");
  // Test seam
  assert.match(src, /function\s+validateReadOnlyUrlForTests\b/,
    "readonly-pg.ts must export validateReadOnlyUrlForTests for the local-live rejection contract test");
});

// ── RU5 · local-live rejection contract via the test seam ──────────
// This exercises the actual rejection logic without opening a pool.

test("RU5 · validateReadOnlyUrlForTests rejects every dev-URL substring", async () => {
  // Load via esbuild transform + require stub, matching the pattern used by
  // other verification tests in this repo (avoid path-alias resolution).
  const esbuild = await import("esbuild");
  const src = readFileSync(HELPER, "utf8").replace(/^export\s+/gm, "");
  const t = await esbuild.transform(src, { loader: "ts", format: "cjs", target: "node20" });
  const mod = { exports: {} };
  new Function("module", "process", "exports", "require",
    t.code + `\nmodule.exports = { validateReadOnlyUrlForTests, ReadOnlyProductionUrlUnsafeError, ReadOnlyProductionMisconfiguredError };`,
  )(mod, process, mod.exports, () => ({}));
  const { validateReadOnlyUrlForTests, ReadOnlyProductionUrlUnsafeError, ReadOnlyProductionMisconfiguredError } = mod.exports;

  // unset → misconfigured
  let caught = null;
  try { validateReadOnlyUrlForTests({}); } catch (e) { caught = e; }
  assert.ok(caught instanceof ReadOnlyProductionMisconfiguredError, "unset var must throw ReadOnlyProductionMisconfiguredError");

  // empty → misconfigured
  caught = null;
  try { validateReadOnlyUrlForTests({ NEX_PROD_READONLY_URL: "" }); } catch (e) { caught = e; }
  assert.ok(caught instanceof ReadOnlyProductionMisconfiguredError, "empty var must throw ReadOnlyProductionMisconfiguredError");

  // every banned substring → unsafe
  for (const [label, url] of [
    ["localhost", "postgres://user:pass@localhost/dbx"],
    ["127.0.0.1", "postgres://user:pass@127.0.0.1:5432/dbx"],
    ["nex_dev", "postgres://user:pass@db.example.com:5432/nex_dev"],
    [":5433", "postgres://user:pass@db.example.com:5433/postgres"],
  ]) {
    caught = null;
    try { validateReadOnlyUrlForTests({ NEX_PROD_READONLY_URL: url }); } catch (e) { caught = e; }
    assert.ok(caught instanceof ReadOnlyProductionUrlUnsafeError,
      `URL containing ${label} must throw ReadOnlyProductionUrlUnsafeError · got ${caught?.constructor?.name}`);
    assert.match(caught.message, new RegExp(label.replace(/\./g, "\\.")),
      `error message must name the offending substring ${label}`);
  }

  // valid-looking prod URL → returns host, does not throw
  const host = validateReadOnlyUrlForTests({ NEX_PROD_READONLY_URL: "postgres://user:pass@db.ijvqdvsvwtwxzcqmoqit.supabase.co:5432/postgres" });
  assert.equal(host, "db.ijvqdvsvwtwxzcqmoqit.supabase.co", "valid URL must return the hostname without credentials");
});
