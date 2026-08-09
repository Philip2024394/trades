#!/usr/bin/env node
// pg.test.mjs · Wave 11 · Step 11 · F28 contract tests
//
// Pure contract tests for `src/lib/nex/config/pg.ts`. No PG required.
// Assertions injected via the `env` parameter · zero pollution of
// process.env. Every branch of the strict/nullable/boolean helpers
// is exercised.
//
// Assertion legend:
//   CFG1  · getPostgresUrl returns a valid URL when set (non-prod)
//   CFG2  · getPostgresUrl throws in production when unset
//   CFG3  · getPostgresUrl throws in dev when unset (different code)
//   CFG4  · getPostgresUrl throws on malformed URL (any NODE_ENV)
//   CFG5  · getPostgresUrl trims whitespace and rejects whitespace-only
//   CFG6  · getPostgresUrlOrNull returns null on unset (never throws)
//   CFG7  · getPostgresUrlOrNull returns null on whitespace-only
//   CFG8  · getPostgresUrlOrNull throws on malformed URL (bad URL is bug)
//   CFG9  · hasPostgresUrl returns true on valid URL
//   CFG10 · hasPostgresUrl returns false on unset / malformed / whitespace
//   CFG11 · every error carries a stable .code (drift-catcher for callers)

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

// Load the module standalone (no @/ alias resolution needed · no
// deps outside the file itself).
const SRC = readFileSync(join(REPO, "src/lib/nex/config/pg.ts"), "utf8");
const stripped = SRC.replace(/^export\s+/gm, "");
const transformed = await esbuild.transform(stripped, { loader: "ts", format: "cjs", target: "node20" });
const mod = { exports: {} };
new Function("module", "process", "exports", "require",
  transformed.code + `\nmodule.exports = { getPostgresUrl, getPostgresUrlOrNull, hasPostgresUrl };`,
)(mod, process, mod.exports, () => ({}));
const { getPostgresUrl, getPostgresUrlOrNull, hasPostgresUrl } = mod.exports;

const VALID = "postgresql://postgres:secret@localhost:5433/nex_dev";

// ── CFG1 ─────────────────────────────────────────────────────────────

test("CFG1 · getPostgresUrl returns the URL when set (dev NODE_ENV)", () => {
  const result = getPostgresUrl({ NEX_POSTGRES_URL: VALID, NODE_ENV: "development" });
  assert.equal(result, VALID);
});

// ── CFG2 ─────────────────────────────────────────────────────────────

test("CFG2 · getPostgresUrl throws in production when unset · code=missing-postgres-url-in-production", () => {
  try {
    getPostgresUrl({ NODE_ENV: "production" });
    assert.fail("expected throw");
  } catch (err) {
    assert.equal(err.code, "missing-postgres-url-in-production",
      "prod-unset must throw with the exact code the deploy pipeline greps for");
    assert.match(err.message, /required in production/);
  }
});

// ── CFG3 ─────────────────────────────────────────────────────────────

test("CFG3 · getPostgresUrl throws in dev when unset · code=missing-postgres-url (distinguishable)", () => {
  try {
    getPostgresUrl({ NODE_ENV: "development" });
    assert.fail("expected throw");
  } catch (err) {
    assert.equal(err.code, "missing-postgres-url",
      "dev-unset must throw a DIFFERENT code so runtime can react to prod vs dev misconfig");
    assert.match(err.message, /getPostgresUrlOrNull/);
  }
});

// ── CFG4 ─────────────────────────────────────────────────────────────

test("CFG4 · getPostgresUrl throws on malformed URL · code=invalid-postgres-url", () => {
  const cases = ["yes", "PGURL=set", "localhost:5433", "http://foo"];
  for (const val of cases) {
    try {
      getPostgresUrl({ NEX_POSTGRES_URL: val, NODE_ENV: "development" });
      assert.fail(`expected throw for malformed value: ${val}`);
    } catch (err) {
      assert.equal(err.code, "invalid-postgres-url", `${val} must be rejected`);
    }
  }
});

// ── CFG5 ─────────────────────────────────────────────────────────────

test("CFG5 · getPostgresUrl trims whitespace · rejects whitespace-only", () => {
  const padded = `  ${VALID}\n`;
  assert.equal(getPostgresUrl({ NEX_POSTGRES_URL: padded, NODE_ENV: "development" }), VALID,
    "leading/trailing whitespace must be trimmed");

  try {
    getPostgresUrl({ NEX_POSTGRES_URL: "   \t\n  ", NODE_ENV: "production" });
    assert.fail("whitespace-only must be treated as unset");
  } catch (err) {
    assert.equal(err.code, "missing-postgres-url-in-production");
  }
});

// ── CFG6 ─────────────────────────────────────────────────────────────

test("CFG6 · getPostgresUrlOrNull returns null when unset · never throws", () => {
  assert.equal(getPostgresUrlOrNull({ NODE_ENV: "production" }), null,
    "prod without URL still returns null via the nullable variant");
  assert.equal(getPostgresUrlOrNull({ NODE_ENV: "development" }), null,
    "dev without URL returns null");
  assert.equal(getPostgresUrlOrNull({}), null, "no NODE_ENV set → still null");
});

// ── CFG7 ─────────────────────────────────────────────────────────────

test("CFG7 · getPostgresUrlOrNull returns null on empty / whitespace-only", () => {
  assert.equal(getPostgresUrlOrNull({ NEX_POSTGRES_URL: "" }), null);
  assert.equal(getPostgresUrlOrNull({ NEX_POSTGRES_URL: "   " }), null);
});

// ── CFG8 ─────────────────────────────────────────────────────────────

test("CFG8 · getPostgresUrlOrNull STILL throws on malformed URL · bad URL is a bug", () => {
  try {
    getPostgresUrlOrNull({ NEX_POSTGRES_URL: "not-a-url" });
    assert.fail("malformed URL should throw even in the nullable variant");
  } catch (err) {
    assert.equal(err.code, "invalid-postgres-url");
  }
});

// ── CFG9 ─────────────────────────────────────────────────────────────

test("CFG9 · hasPostgresUrl returns true on valid URL", () => {
  assert.equal(hasPostgresUrl({ NEX_POSTGRES_URL: VALID }), true);
  assert.equal(hasPostgresUrl({ NEX_POSTGRES_URL: "postgres://a:b@h/db" }), true,
    "the short postgres:// form is also valid");
});

// ── CFG10 ────────────────────────────────────────────────────────────

test("CFG10 · hasPostgresUrl returns false on unset / whitespace-only / malformed · NEVER throws", () => {
  assert.equal(hasPostgresUrl({}), false);
  assert.equal(hasPostgresUrl({ NEX_POSTGRES_URL: "" }), false);
  assert.equal(hasPostgresUrl({ NEX_POSTGRES_URL: "   " }), false);
  // Backend selection MUST NOT throw on a bad URL · it should just pick
  // a different backend. hasPostgresUrl swallows the malformed case.
  assert.equal(hasPostgresUrl({ NEX_POSTGRES_URL: "not-a-url" }), false);
});

// ── CFG11 ────────────────────────────────────────────────────────────

test("CFG11 · every thrown error carries a stable .code field", () => {
  // Deploy pipeline greps for these exact code strings. Renaming a code
  // is a breaking change · this test locks the vocabulary.
  const CODES = new Set([
    "missing-postgres-url-in-production",
    "missing-postgres-url",
    "invalid-postgres-url",
  ]);
  const attempts = [
    () => getPostgresUrl({ NODE_ENV: "production" }),
    () => getPostgresUrl({ NODE_ENV: "development" }),
    () => getPostgresUrl({ NEX_POSTGRES_URL: "bad" }),
    () => getPostgresUrlOrNull({ NEX_POSTGRES_URL: "bad" }),
  ];
  for (const attempt of attempts) {
    try { attempt(); assert.fail("expected throw"); }
    catch (err) {
      assert.ok(CODES.has(err.code),
        `unknown error code emitted: ${err.code} · vocabulary must be one of ${[...CODES].join("|")}`);
    }
  }
});
