#!/usr/bin/env node
// error-envelope.test.mjs · Wave 11 remediation · closes F24
//
// Contract tests for src/lib/nex/api/error-envelope.ts. The invariant
// the tests enforce is: no error path text ever crosses the boundary
// unless it's an explicit safe code · every response includes a
// correlation_id · and the raw error is logged server-side under
// that correlation_id.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");
const SRC       = readFileSync(join(REPO, "src/lib/nex/api/error-envelope.ts"), "utf8");
const requireFromHere = createRequire(import.meta.url);

const stripped = SRC.replace(/^export\s+/gm, "");
const transformed = await esbuild.transform(stripped, { loader: "ts", format: "cjs", target: "node20" });
const mod = { exports: {} };
new Function("module", "process", "exports", "require",
  transformed.code + `
module.exports = { toClientError, _safeCodesForTests };
`,
)(mod, process, mod.exports, requireFromHere);
const { toClientError, _safeCodesForTests } = mod.exports;

// Capture console.error output for assertion.
function captureErr(fn) {
  const orig = console.error;
  const captured = [];
  console.error = (...args) => captured.push(args);
  try { fn(); } finally { console.error = orig; }
  return captured;
}

// ── HAPPY PATH ─────────────────────────────────────────────────────

test("EE1 · returns { ok: false, error: <safe code>, correlation_id: <hex> } for a plain Error", () => {
  const captured = captureErr(() => {
    const r = toClientError(new Error("some internal detail"));
    assert.equal(r.ok, false);
    assert.equal(typeof r.error, "string");
    assert.equal(typeof r.correlation_id, "string");
    assert.match(r.correlation_id, /^[0-9a-f]+$/);
  });
  assert.ok(captured.length >= 1, "must log the full error server-side");
});

test("EE2 · surfaces err.code when it is on the safe allowlist", () => {
  const err = Object.assign(new Error("some detail"), { code: "path_escape" });
  const captured = captureErr(() => {
    const r = toClientError(err);
    assert.equal(r.error, "path_escape");
  });
  // correlation_id logged so ops can find full detail
  assert.match(captured[0].join(" "), /correlation=/);
});

test("EE3 · falls back to default when err.code is UNKNOWN (rogue code doesn't leak)", () => {
  const err = Object.assign(new Error("this contains /home/victus/secret.key credentials"), {
    code: "some_rogue_code_that_is_not_allowlisted",
  });
  const captured = captureErr(() => {
    const r = toClientError(err, { defaultCode: "read_failed" });
    assert.equal(r.error, "read_failed", "unknown err.code must collapse to defaultCode");
  });
  // The raw message with the sensitive path is logged (that's fine)
  // but MUST NOT appear in the client response object.
  const rClone = captureErr(() => toClientError(err, { defaultCode: "read_failed" }))[0];
  // (No client-visible check here; the response has no `detail` field at all.)
});

test("EE4 · falls back to default when err has NO code field", () => {
  const err = new Error("ENOENT: no such file or directory, open '/data/nex-brains/staircase/memories.jsonl'");
  captureErr(() => {
    const r = toClientError(err, { defaultCode: "read_failed" });
    assert.equal(r.error, "read_failed");
    // Ensure the client response has NO detail/message/path fields.
    assert.equal(Object.keys(r).sort().join(","), "correlation_id,error,ok");
    assert.equal(r.error.includes("/"), false, "client error string must not contain paths");
  });
});

test("EE5 · logs the raw error server-side with correlation id", () => {
  const err = new Error("ENOENT: /data/nex-brains/secret.jsonl");
  let out;
  const captured = captureErr(() => { out = toClientError(err, { logTag: "unit-test" }); });
  const line = captured[0].join(" ");
  assert.match(line, new RegExp(`\\[unit-test\\].*correlation=${out.correlation_id}`),
    "server log must include the tag AND the correlation id used in the client response");
});

test("EE6 · client response NEVER includes err.message, filesystem paths, or stack frames", () => {
  const err = new Error(
    "read ECONNREFUSED /home/victus/.pgpass at Object.<anonymous> (/app/src/db.ts:42:15)",
  );
  captureErr(() => {
    const r = toClientError(err);
    const serialised = JSON.stringify(r);
    assert.equal(serialised.includes("/"), false, "no slashes anywhere in client response");
    assert.equal(serialised.includes("Object.<anonymous>"), false);
    assert.equal(serialised.includes("ECONNREFUSED"), false);
  });
});

test("EE7 · empty-string err.code coerces to defaultCode", () => {
  const err = Object.assign(new Error("x"), { code: "" });
  captureErr(() => {
    const r = toClientError(err, { defaultCode: "internal_error" });
    assert.equal(r.error, "internal_error");
  });
});

test("EE8 · non-string err.code (number / object) coerces to defaultCode", () => {
  const errN = Object.assign(new Error("x"), { code: 42 });
  const errO = Object.assign(new Error("x"), { code: { evil: "obj" } });
  captureErr(() => {
    assert.equal(toClientError(errN, { defaultCode: "internal_error" }).error, "internal_error");
    assert.equal(toClientError(errO, { defaultCode: "internal_error" }).error, "internal_error");
  });
});

test("EE9 · null / undefined err collapses to internal_error", () => {
  captureErr(() => {
    assert.equal(toClientError(null).error, "internal_error");
    assert.equal(toClientError(undefined).error, "internal_error");
  });
});

test("EE10 · safe-code allowlist includes the codes cited by other Wave 11 findings", () => {
  const safe = _safeCodesForTests();
  for (const required of ["misconfigured", "unauthorized", "path_escape", "unknown_brain", "invalid_json", "not_found"]) {
    assert.ok(safe.has(required), `safe allowlist missing ${required}`);
  }
});
