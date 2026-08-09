#!/usr/bin/env node
// with-brain-role.test.mjs · Wave 11 · Step 7 · closes F34
//
// Contract tests for the shared withBrainRole / withBrainRoleStrict.
// Assertions:
//   WBR1 · BEGIN + SET LOCAL ROLE fire BEFORE fn (correct ordering)
//   WBR2 · COMMIT fires after fn resolves
//   WBR3 · ROLLBACK fires when fn throws · error re-propagated
//   WBR4 · null return when withClient returns null (pool absent)
//   WBR5 · connection released even on throw path
//   WBR6 · SET LOCAL ROLE uses exact "nex_brain_app" role name
//   WBR7 · ROLLBACK failure does not mask fn's original throw
//   WBR8 · withBrainRoleStrict THROWS with code="pg-not-configured" when pool absent
//   WBR9 · withBrainRoleStrict returns T (unwrapped) on success
//   WBR10 · withBrainRoleStrict rethrows fn errors like the base helper

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

// Load the helper with a stubbed @/lib/nex/db so we control pool state
// per-test. The real db.ts pulls in pg driver + env-var reads · we
// only need withClient to be a function we can control.
async function loadHelper(mockWithClient) {
  const src = readFileSync(join(REPO, "src/lib/nex/db/with-brain-role.ts"), "utf8");
  const stripped = src.replace(/^export\s+/gm, "");
  const t = await esbuild.transform(stripped, { loader: "ts", format: "cjs", target: "node20" });
  const mod = { exports: {} };
  new Function("module", "process", "exports", "require",
    t.code + `\nmodule.exports = { withBrainRole, withBrainRoleStrict };`,
  )(mod, process, mod.exports, (id) => {
    if (id === "@/lib/nex/db") return { withClient: mockWithClient };
    return requireFromHere(id);
  });
  return mod.exports;
}

// Fake pg client that records every query in order.
function makeFakeClient(opts = {}) {
  const calls = [];
  return {
    calls,
    query: async (text, params) => {
      calls.push({ text, params });
      if (opts.throwOn && opts.throwOn.test(text)) {
        throw Object.assign(new Error(`fake-throw-${text}`), { code: "fake-code" });
      }
      return { rows: [], rowCount: null };
    },
    release: () => { calls.push({ text: "__released__" }); },
  };
}

// Fake withClient that supplies our fake client to fn.
function fakeWithClient(fakeClient) {
  return async (fn) => {
    try {
      return await fn(fakeClient);
    } finally {
      fakeClient.release();
    }
  };
}

// ── WBR1-WBR7 · withBrainRole ──────────────────────────────────────

test("WBR1 · BEGIN + SET LOCAL ROLE fire BEFORE fn", async () => {
  const client = makeFakeClient();
  const { withBrainRole } = await loadHelper(fakeWithClient(client));
  let fnRanAtCall = -1;
  await withBrainRole(async (c) => {
    fnRanAtCall = c.calls.length;
    return 42;
  });
  // After fn ran, calls[0] = BEGIN, calls[1] = SET LOCAL ROLE
  // fn ran AFTER those 2, so fnRanAtCall should be 2.
  assert.equal(client.calls[0].text, "BEGIN");
  assert.equal(client.calls[1].text, "SET LOCAL ROLE nex_brain_app");
  assert.equal(fnRanAtCall, 2, `fn must run after BEGIN + SET LOCAL ROLE · ran at call #${fnRanAtCall}`);
});

test("WBR2 · COMMIT fires after fn resolves · returns fn value", async () => {
  const client = makeFakeClient();
  const { withBrainRole } = await loadHelper(fakeWithClient(client));
  const out = await withBrainRole(async () => ({ answer: 42 }));
  const commitCall = client.calls.find((c) => c.text === "COMMIT");
  assert.ok(commitCall, "COMMIT must fire on success");
  assert.deepEqual(out, { answer: 42 });
});

test("WBR3 · ROLLBACK fires when fn throws · error re-propagated with code preserved", async () => {
  const client = makeFakeClient();
  const { withBrainRole } = await loadHelper(fakeWithClient(client));
  let caught = null;
  try {
    await withBrainRole(async () => {
      throw Object.assign(new Error("fn-boom"), { code: "boom-code" });
    });
  } catch (e) {
    caught = e;
  }
  assert.ok(caught, "error must propagate");
  assert.equal(caught.message, "fn-boom");
  assert.equal(caught.code, "boom-code", "err.code must be preserved through rollback");
  const rb = client.calls.find((c) => c.text === "ROLLBACK");
  assert.ok(rb, "ROLLBACK must fire on throw");
  const commit = client.calls.find((c) => c.text === "COMMIT");
  assert.equal(commit, undefined, "COMMIT must NOT fire when fn throws");
});

test("WBR4 · null return when withClient returns null (pool absent)", async () => {
  const { withBrainRole } = await loadHelper(async () => null);
  const out = await withBrainRole(async () => 42);
  assert.equal(out, null);
});

test("WBR5 · connection released even on throw path", async () => {
  const client = makeFakeClient();
  const { withBrainRole } = await loadHelper(fakeWithClient(client));
  try {
    await withBrainRole(async () => { throw new Error("x"); });
  } catch { /* expected */ }
  const releaseCall = client.calls.find((c) => c.text === "__released__");
  assert.ok(releaseCall, "connection must be released even when fn throws");
});

test("WBR6 · exact role name 'nex_brain_app' · no drift", async () => {
  const client = makeFakeClient();
  const { withBrainRole } = await loadHelper(fakeWithClient(client));
  await withBrainRole(async () => 1);
  const roleCall = client.calls.find((c) => c.text.startsWith("SET LOCAL ROLE"));
  assert.equal(roleCall.text, "SET LOCAL ROLE nex_brain_app",
    `role name must be exactly "nex_brain_app" · got "${roleCall.text}"`);
});

test("WBR7 · ROLLBACK failure does not mask fn's original throw", async () => {
  // ROLLBACK itself throws — the helper's .catch(() => {}) on rollback
  // MUST swallow the rollback error so fn's original throw wins.
  const client = makeFakeClient({ throwOn: /^ROLLBACK$/ });
  const { withBrainRole } = await loadHelper(fakeWithClient(client));
  let caught = null;
  try {
    await withBrainRole(async () => { throw new Error("original-fn-error"); });
  } catch (e) { caught = e; }
  assert.equal(caught.message, "original-fn-error", "fn's error must win · not rollback's");
});

// ── WBR8-WBR10 · withBrainRoleStrict ───────────────────────────────

test("WBR8 · withBrainRoleStrict THROWS with code='pg-not-configured' when pool absent", async () => {
  const { withBrainRoleStrict } = await loadHelper(async () => null);
  let caught = null;
  try {
    await withBrainRoleStrict(async () => 1, "test-context");
  } catch (e) { caught = e; }
  assert.ok(caught, "must throw");
  assert.equal(caught.code, "pg-not-configured");
  assert.match(caught.message, /test-context/, "context tag included in message for server-side log");
});

test("WBR9 · withBrainRoleStrict returns T (unwrapped) on success", async () => {
  const client = makeFakeClient();
  const { withBrainRoleStrict } = await loadHelper(fakeWithClient(client));
  const out = await withBrainRoleStrict(async () => ({ ok: true, value: 42 }));
  assert.deepEqual(out, { ok: true, value: 42 });
  // Types would prevent this being null · runtime confirms.
  assert.notEqual(out, null);
});

test("WBR10 · withBrainRoleStrict rethrows fn errors like the base helper", async () => {
  const client = makeFakeClient();
  const { withBrainRoleStrict } = await loadHelper(fakeWithClient(client));
  let caught = null;
  try {
    await withBrainRoleStrict(async () => { throw Object.assign(new Error("y"), { code: "y-code" }); });
  } catch (e) { caught = e; }
  assert.equal(caught.message, "y");
  assert.equal(caught.code, "y-code");
});
