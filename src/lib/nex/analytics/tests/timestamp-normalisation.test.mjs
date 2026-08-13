#!/usr/bin/env node
// timestamp-normalisation.test.mjs · Wave 4 · W4-1 regression
//
// Governed by: docs/headquarters-production-readiness/WAVE-4-VERIFICATION-MATRIX.md §5 (W4-1)
//
// Locks the fix at src/lib/nex/analytics/rollup-worker.ts:92 that turns
// pg-driver-returned Date values into Postgres-safe ISO 8601 strings
// before they are re-cast via `$1::timestamptz` downstream.
//
// Fail-mode reproduced by V-3a on 2026-08-10:
//   `time zone "gmt+0700" not recognized`
// Root cause was `String(dateInstance)` producing a locale-dependent value.
//
// Assertions:
//   W4-1-1 · Date instance → ISO 8601 UTC string ending in `Z`
//   W4-1-2 · already-ISO string passes through unchanged
//   W4-1-3 · null / undefined / empty-string / non-string-non-date → null
//   W4-1-4 · invalid Date (NaN time) → null (not the string "Invalid Date")
//   W4-1-5 · every returned string matches a shape Postgres always accepts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..", "..", "..", "..");

// Load the helper via esbuild transform · avoids importing withClient chain.
const SRC = readFileSync(join(REPO, "src/lib/nex/analytics/rollup-worker.ts"), "utf8");
// Slice just the helper block so we don't drag the full module deps.
const start = SRC.indexOf("export function normalizeTimestamptzForCast");
const end = SRC.indexOf("\n}\n", start) + 3;
const snippet = SRC.slice(start, end).replace(/^export\s+/gm, "");
const t = await esbuild.transform(snippet, { loader: "ts", format: "cjs", target: "node20" });
const mod = { exports: {} };
new Function("module", "exports", t.code + `\nmodule.exports = { normalizeTimestamptzForCast };`)(mod, mod.exports);
const { normalizeTimestamptzForCast } = mod.exports;

// ISO 8601 UTC shape · what Postgres always parses. Example: 2026-08-10T02:15:47.123Z
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

test("W4-1-1 · Date instance → ISO 8601 UTC string ending in Z", () => {
  const d = new Date("2026-08-10T09:59:23.811+07:00");
  const out = normalizeTimestamptzForCast(d);
  assert.equal(typeof out, "string");
  assert.match(out, ISO_UTC, `must match ISO 8601 UTC · got ${out}`);
  // Value equivalence: 09:59:23+07:00 == 02:59:23Z
  assert.equal(out, "2026-08-10T02:59:23.811Z");
  // Explicit non-regression: MUST NOT contain locale artefacts like "GMT+0700"
  assert.ok(!/GMT/i.test(out), "must NOT contain GMT locale artefact");
  assert.ok(!/\([A-Za-z ]+\)/.test(out), "must NOT contain locale name in parentheses");
});

test("W4-1-2 · already-ISO string passes through unchanged", () => {
  const s = "2026-08-10T02:59:23.811Z";
  assert.equal(normalizeTimestamptzForCast(s), s);
  // Also accept ISO with tz offset (Postgres parses both)
  const s2 = "2026-08-10T09:59:23.811+07:00";
  assert.equal(normalizeTimestamptzForCast(s2), s2);
});

test("W4-1-3 · null / undefined / empty-string / non-Date-non-string → null", () => {
  assert.equal(normalizeTimestamptzForCast(null), null);
  assert.equal(normalizeTimestamptzForCast(undefined), null);
  assert.equal(normalizeTimestamptzForCast(""), null);
  assert.equal(normalizeTimestamptzForCast(0), null);
  assert.equal(normalizeTimestamptzForCast({}), null);
  assert.equal(normalizeTimestamptzForCast([]), null);
});

test("W4-1-4 · invalid Date (NaN time) → null · NOT the string 'Invalid Date'", () => {
  const bad = new Date("not a date");
  assert.equal(Number.isFinite(bad.getTime()), false, "sanity · Date should be NaN-time");
  assert.equal(normalizeTimestamptzForCast(bad), null,
    "invalid Date must return null · never the string 'Invalid Date' which would still break ::timestamptz");
});

test("W4-1-5 · Date-out shape always matches Postgres-safe ISO 8601 UTC", () => {
  for (let i = 0; i < 100; i++) {
    const d = new Date(Date.now() - Math.floor(Math.random() * 1e10));
    const out = normalizeTimestamptzForCast(d);
    assert.match(String(out), ISO_UTC, `randomised sample failed shape check · ${out}`);
  }
});
