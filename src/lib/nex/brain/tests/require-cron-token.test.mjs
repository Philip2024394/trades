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
import { createRequire } from "node:module";
import * as esbuild from "esbuild";
import { createHmac } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");
const SRC       = readFileSync(join(REPO, "src/lib/nex/brain/auth/require-cron-token.ts"), "utf8");
const requireReal = createRequire(import.meta.url);

const stripped    = SRC.replace(/^export\s+/gm, "");
const transformed = await esbuild.transform(stripped, { loader: "ts", format: "cjs", target: "node20" });
const mod = { exports: {} };
// F14 · pass through node:* requires so HMAC verifier can use node:crypto.
new Function("module", "process", "exports", "require", "console",
  transformed.code + `
module.exports = { checkCronAuth, cronAuthErrorBody, _resetDevOpenWarningForTests };
`)(mod, process, mod.exports, (id) => id.startsWith("node:") ? requireReal(id) : ({}), console);
const { checkCronAuth, cronAuthErrorBody, _resetDevOpenWarningForTests } = mod.exports;

// ── F14 · HMAC helpers for tests ─────────────────────────────────
function signHmac(secret, method, path, ts) {
  return "sha256=" + createHmac("sha256", secret).update(`${ts}.${method.toUpperCase()}.${path}`).digest("hex");
}
function nowSec() { return Math.floor(Date.now() / 1000); }

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

// ── F14 · HMAC mode ─────────────────────────────────────────────
test("F14 · HMAC · valid sig within window → ok · auth_mode:hmac", () => {
  const secret = "brain-tok";
  const ts = nowSec();
  const path = "/api/nex/brain/cron-tick";
  const sig = signHmac(secret, "GET", path, ts);
  const r = checkCronAuth(
    { headers: { get: (n) => ({ "x-signature": sig, "x-timestamp": String(ts) })[n.toLowerCase()] ?? null },
      method: "GET", nextUrl: { pathname: path } },
    { NODE_ENV: "production", NEX_BRAIN_CRON_TOKEN: secret },
  );
  assert.equal(r.ok, true);
  assert.equal(r.auth_mode, "hmac");
});

test("F14 · HMAC · valid sig against CRON_SECRET → ok", () => {
  const secret = "vercel-secret";
  const ts = nowSec();
  const path = "/api/nex/brain/cron-tick";
  const sig = signHmac(secret, "GET", path, ts);
  const r = checkCronAuth(
    { headers: { get: (n) => ({ "x-signature": sig, "x-timestamp": String(ts) })[n.toLowerCase()] ?? null },
      method: "GET", nextUrl: { pathname: path } },
    { NODE_ENV: "production", CRON_SECRET: secret },
  );
  assert.equal(r.ok, true);
});

test("F14 · HMAC · timestamp older than 300s → hmac_expired", () => {
  const secret = "brain-tok";
  const ts = nowSec() - 400; // 6m40s ago
  const path = "/api/nex/brain/cron-tick";
  const sig = signHmac(secret, "GET", path, ts);
  const r = checkCronAuth(
    { headers: { get: (n) => ({ "x-signature": sig, "x-timestamp": String(ts) })[n.toLowerCase()] ?? null },
      method: "GET", nextUrl: { pathname: path } },
    { NODE_ENV: "production", NEX_BRAIN_CRON_TOKEN: secret },
  );
  assert.equal(r.ok, false);
  assert.equal(r.code, "hmac_expired");
});

test("F14 · HMAC · wrong secret → hmac_invalid · does NOT fall through to bearer", () => {
  const secret = "brain-tok";
  const wrongSig = signHmac("wrong-secret", "GET", "/api/nex/brain/cron-tick", nowSec());
  const ts = nowSec();
  const r = checkCronAuth(
    { headers: { get: (n) => ({
        "x-signature": wrongSig,
        "x-timestamp": String(ts),
        "authorization": "Bearer brain-tok", // valid bearer!
      })[n.toLowerCase()] ?? null },
      method: "GET", nextUrl: { pathname: "/api/nex/brain/cron-tick" } },
    { NODE_ENV: "production", NEX_BRAIN_CRON_TOKEN: secret },
  );
  // Present-but-invalid HMAC MUST deny · never fall through to bearer
  assert.equal(r.ok, false);
  assert.equal(r.code, "hmac_invalid");
});

test("F14 · HMAC · malformed X-Signature (missing sha256= prefix) → hmac_invalid", () => {
  const ts = nowSec();
  const r = checkCronAuth(
    { headers: { get: (n) => ({ "x-signature": "abc123", "x-timestamp": String(ts) })[n.toLowerCase()] ?? null },
      method: "GET", nextUrl: { pathname: "/x" } },
    { NODE_ENV: "production", NEX_BRAIN_CRON_TOKEN: "brain-tok" },
  );
  assert.equal(r.ok, false);
  assert.equal(r.code, "hmac_invalid");
});

test("F14 · HMAC · no HMAC headers → falls through to bearer path (backward compat)", () => {
  const r = checkCronAuth(
    fakeReq({ authorization: "Bearer brain-tok" }),
    { NODE_ENV: "production", NEX_BRAIN_CRON_TOKEN: "brain-tok" },
  );
  assert.equal(r.ok, true);
  assert.equal(r.auth_mode, "bearer");
});

test("F14 · cronAuthErrorBody surfaces detail for HMAC errors", () => {
  const body = cronAuthErrorBody({ ok: false, status: 401, code: "hmac_expired", message: "X-Timestamp outside ±300s window" });
  assert.equal(body.error, "hmac_expired");
  assert.equal(body.detail, "X-Timestamp outside ±300s window");
});

// ── D4 · scoped cron tokens ─────────────────────────────────────
test("D4 · scoped token present · shared tokens ignored · correct scoped auth → ok", () => {
  const r = checkCronAuth(
    fakeReq({ authorization: "Bearer scoped-brain-key" }),
    { NODE_ENV: "production", CRON_SECRET: "shared-vercel-key", CRON_SECRET_BRAIN: "scoped-brain-key" },
    { scope: "brain" },
  );
  assert.equal(r.ok, true);
  assert.equal(r.auth_mode, "bearer");
});

test("D4 · scoped token present · shared token DOES NOT authorise this scope", () => {
  const r = checkCronAuth(
    fakeReq({ authorization: "Bearer shared-vercel-key" }),
    { NODE_ENV: "production", CRON_SECRET: "shared-vercel-key", CRON_SECRET_BRAIN: "scoped-brain-key" },
    { scope: "brain" },
  );
  assert.equal(r.ok, false);
  assert.equal(r.status, 401);
});

test("D4 · scoped token absent · falls through to shared tokens", () => {
  const r = checkCronAuth(
    fakeReq({ authorization: "Bearer shared-vercel-key" }),
    { NODE_ENV: "production", CRON_SECRET: "shared-vercel-key" },  // no CRON_SECRET_BRAIN
    { scope: "brain" },
  );
  assert.equal(r.ok, true);
});

test("D4 · scope name with hyphen · normalises to underscore", () => {
  const r = checkCronAuth(
    fakeReq({ authorization: "Bearer key-for-social" }),
    { NODE_ENV: "production", CRON_SECRET: "other", CRON_SECRET_COMMS_SOCIAL: "key-for-social" },
    { scope: "comms-social" },
  );
  assert.equal(r.ok, true);
});

test("D4 · production · no scoped token AND no shared tokens → misconfigured (fail-closed)", () => {
  const r = checkCronAuth(
    fakeReq({ authorization: "Bearer x" }),
    { NODE_ENV: "production" },
    { scope: "brain" },
  );
  assert.equal(r.ok, false);
  assert.equal(r.status, 500);
  assert.equal(r.code, "misconfigured");
});

test("D4 · HMAC signed with scoped key succeeds; HMAC signed with shared key fails when scope active", () => {
  const scoped = "scoped-key";
  const shared = "shared-key";
  const ts = nowSec();
  const path = "/api/nex/brain/cron-tick";
  const sigOk  = signHmac(scoped, "GET", path, ts);
  const sigBad = signHmac(shared, "GET", path, ts);
  // Signed with scoped → ok
  const rOk = checkCronAuth(
    { headers: { get: (n) => ({ "x-signature": sigOk, "x-timestamp": String(ts) })[n.toLowerCase()] ?? null }, method: "GET", nextUrl: { pathname: path } },
    { NODE_ENV: "production", CRON_SECRET: shared, CRON_SECRET_BRAIN: scoped },
    { scope: "brain" },
  );
  assert.equal(rOk.ok, true);
  assert.equal(rOk.auth_mode, "hmac");
  // Signed with shared → fails because scoped is active
  const rBad = checkCronAuth(
    { headers: { get: (n) => ({ "x-signature": sigBad, "x-timestamp": String(ts) })[n.toLowerCase()] ?? null }, method: "GET", nextUrl: { pathname: path } },
    { NODE_ENV: "production", CRON_SECRET: shared, CRON_SECRET_BRAIN: scoped },
    { scope: "brain" },
  );
  assert.equal(rBad.ok, false);
  assert.equal(rBad.code, "hmac_invalid");
});
