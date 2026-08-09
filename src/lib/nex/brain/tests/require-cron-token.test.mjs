#!/usr/bin/env node
// require-cron-token.test.mjs · Wave 11 remediation · closes F14 · F15 · F30
//
// Contract tests for the shared cron-authentication boundary at
// src/lib/nex/brain/auth/require-cron-token.ts.
//
// Per Philip's directive (2026-08-10): tests MUST cover BOTH production
// AND development configurations "so nobody later 'fixes' the P0 by
// breaking local development." Six scenarios below plus edge cases.
//
// Pattern: read the TS source, strip imports/exports, transform via
// esbuild inline, exec as CJS — matches the pattern used by
// reverse-shadow.test.mjs and heartbeat-liveness.test.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");
const SRC       = readFileSync(join(REPO, "src/lib/nex/brain/auth/require-cron-token.ts"), "utf8");

const stripped    = SRC.replace(/^export\s+/gm, "");
const transformed = await esbuild.transform(stripped, { loader: "ts", format: "cjs", target: "node20" });
const mod = { exports: {} };
new Function("module", "process", "exports", "require", "console",
  transformed.code + `
module.exports = { checkCronAuth, cronAuthErrorBody, _resetDevOpenWarningForTests };
`)(mod, process, mod.exports, () => ({}), console);
const { checkCronAuth, cronAuthErrorBody, _resetDevOpenWarningForTests } = mod.exports;

function fakeReq(headers = {}) {
  const m = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
  return { headers: { get: (n) => m.get(String(n).toLowerCase()) ?? null } };
}

// ── SCENARIO 1 · Production + no tokens = 500 misconfigured (fail-closed)
test("prod · no tokens → 500 misconfigured", () => {
  const r = checkCronAuth(fakeReq(), { NODE_ENV: "production" });
  assert.equal(r.ok, false);
  assert.equal(r.status, 500);
  assert.equal(r.code, "misconfigured");
});

test("prod · CRON_SECRET set to empty string → still misconfigured", () => {
  const r = checkCronAuth(fakeReq(), { NODE_ENV: "production", CRON_SECRET: "" });
  assert.equal(r.ok, false);
  assert.equal(r.code, "misconfigured");
});

// ── SCENARIO 2 · Production + one token set + no auth header = 401
test("prod · CRON_SECRET set · no auth header → 401", () => {
  const r = checkCronAuth(fakeReq(), { NODE_ENV: "production", CRON_SECRET: "vercel-secret" });
  assert.equal(r.ok, false);
  assert.equal(r.status, 401);
  assert.equal(r.code, "unauthorized");
});

test("prod · NEX_BRAIN_CRON_TOKEN set · no auth header → 401", () => {
  const r = checkCronAuth(fakeReq(), { NODE_ENV: "production", NEX_BRAIN_CRON_TOKEN: "brain-tok" });
  assert.equal(r.ok, false);
  assert.equal(r.status, 401);
});

// ── SCENARIO 3 · Production + correct auth = 200
test("prod · CRON_SECRET + matching Authorization Bearer → ok", () => {
  const r = checkCronAuth(
    fakeReq({ authorization: "Bearer vercel-secret" }),
    { NODE_ENV: "production", CRON_SECRET: "vercel-secret" },
  );
  assert.equal(r.ok, true);
});

test("prod · NEX_BRAIN_CRON_TOKEN + matching Bearer → ok", () => {
  const r = checkCronAuth(
    fakeReq({ authorization: "Bearer brain-tok" }),
    { NODE_ENV: "production", NEX_BRAIN_CRON_TOKEN: "brain-tok" },
  );
  assert.equal(r.ok, true);
});

test("prod · NEX_BRAIN_CRON_TOKEN + matching x-brain-cron-token header → ok", () => {
  const r = checkCronAuth(
    fakeReq({ "x-brain-cron-token": "brain-tok" }),
    { NODE_ENV: "production", NEX_BRAIN_CRON_TOKEN: "brain-tok" },
  );
  assert.equal(r.ok, true);
});

// ── SCENARIO 4 · Dev + no tokens = 200 ok (dev convenience preserved)
test("dev · no tokens → ok (dev convenience preserved · warning fires once)", () => {
  _resetDevOpenWarningForTests();
  const origWarn = console.warn;
  let warnCount = 0;
  console.warn = () => { warnCount++; };
  try {
    const r1 = checkCronAuth(fakeReq(), { NODE_ENV: "development" });
    const r2 = checkCronAuth(fakeReq(), { NODE_ENV: "development" });
    const r3 = checkCronAuth(fakeReq(), {});
    assert.equal(r1.ok, true);
    assert.equal(r2.ok, true);
    assert.equal(r3.ok, true);
    assert.equal(warnCount, 1, `expected exactly 1 warn · got ${warnCount}`);
  } finally {
    console.warn = origWarn;
  }
});

// ── SCENARIO 5 · Dev + one token set + wrong auth = 401
test("dev · CRON_SECRET set · wrong auth → 401", () => {
  const r = checkCronAuth(
    fakeReq({ authorization: "Bearer wrong-secret" }),
    { NODE_ENV: "development", CRON_SECRET: "vercel-secret" },
  );
  assert.equal(r.ok, false);
  assert.equal(r.status, 401);
});

// ── SCENARIO 6 · Dev + one token set + correct auth = 200
test("dev · CRON_SECRET set · correct auth → ok", () => {
  const r = checkCronAuth(
    fakeReq({ authorization: "Bearer vercel-secret" }),
    { NODE_ENV: "development", CRON_SECRET: "vercel-secret" },
  );
  assert.equal(r.ok, true);
});

// ── EXTRA · both tokens set · either match works
test("both tokens set · brain match wins even when vercel doesn't match", () => {
  const r = checkCronAuth(
    fakeReq({ authorization: "Bearer brain-tok" }),
    { NODE_ENV: "production", CRON_SECRET: "vercel-secret", NEX_BRAIN_CRON_TOKEN: "brain-tok" },
  );
  assert.equal(r.ok, true);
});

test("both tokens set · neither matches → 401", () => {
  const r = checkCronAuth(
    fakeReq({ authorization: "Bearer some-other" }),
    { NODE_ENV: "production", CRON_SECRET: "vercel-secret", NEX_BRAIN_CRON_TOKEN: "brain-tok" },
  );
  assert.equal(r.ok, false);
  assert.equal(r.status, 401);
});

// ── EXTRA · error body helper
test("cronAuthErrorBody returns the code as the error string", () => {
  const body = cronAuthErrorBody({ ok: false, status: 500, code: "misconfigured", message: "x" });
  assert.deepEqual(body, { ok: false, error: "misconfigured" });
});
