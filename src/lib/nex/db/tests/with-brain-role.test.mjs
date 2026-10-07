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
//   WBR11 · (2026-10-07 regression) withBrainRoleStrict PASSES THROUGH
//            null when the pool is available and fn legitimately returns
//            null — previously the strict wrapper misreported "pg-not-
//            configured" because it inferred availability from fn's
//            return value, breaking PostgresObjectStorage.head() /
//            .get() on missing keys and §M.3 reconciliation.
//   WBR12 · (2026-10-07 regression) withBrainRoleStrict decides pool
//            availability from getPool() BEFORE fn runs. If getPool
//            returns null, fn must NOT run (no side effects) and the
//            throw must be the "pg-not-configured" sentinel.

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
//
// 2026-10-07 · withBrainRoleStrict now ALSO consults getPool() directly
// to decide pool availability before running fn (see WBR11/WBR12). The
// loader accepts an optional mockGetPool that returns null for the
// "pool absent" cases and a truthy sentinel for the "pool present"
// cases. When unspecified, defaults to a non-null sentinel so existing
// base-helper tests keep passing with no edits.
async function loadHelper(mockWithClient, mockGetPool) {
  const src = readFileSync(join(REPO, "src/lib/nex/db/with-brain-role.ts"), "utf8");
  const stripped = src.replace(/^export\s+/gm, "");
  const t = await esbuild.transform(stripped, { loader: "ts", format: "cjs", target: "node20" });
  const mod = { exports: {} };
  const defaultGetPool = mockGetPool ?? (async () => ({ _sentinel: "pool-present" }));
  new Function("module", "process", "exports", "require",
    t.code + `\nmodule.exports = { withBrainRole, withBrainRoleStrict };`,
  )(mod, process, mod.exports, (id) => {
    if (id === "@/lib/nex/db") return { withClient: mockWithClient, getPool: defaultGetPool };
    // Wave 3 · H3 · with-brain-role.ts imports statement_timeout / idle_tx
    // config values from the shared timeouts module. The tests don't need the
    // real values · stub to defaults so call-count assertions stay stable.
    if (id === "@/lib/nex/config/timeouts") return {
      statementTimeoutMs: () => 30000,
      idleInTransactionTimeoutMs: () => 60000,
    };
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

test("WBR1 · BEGIN + SET LOCAL ROLE + SET LOCAL timeouts fire BEFORE fn (Wave 3 H3)", async () => {
  const client = makeFakeClient();
  const { withBrainRole } = await loadHelper(fakeWithClient(client));
  let fnRanAtCall = -1;
  await withBrainRole(async (c) => {
    fnRanAtCall = c.calls.length;
    return 42;
  });
  // Post-H3 order:
  //   calls[0] = BEGIN
  //   calls[1] = SET LOCAL ROLE nex_brain_app
  //   calls[2] = SET LOCAL statement_timeout = 30000
  //   calls[3] = SET LOCAL idle_in_transaction_session_timeout = 60000
  // fn ran AFTER those 4 · fnRanAtCall = 4.
  assert.equal(client.calls[0].text, "BEGIN");
  assert.equal(client.calls[1].text, "SET LOCAL ROLE nex_brain_app");
  assert.match(client.calls[2].text, /^SET LOCAL statement_timeout\s*=\s*30000$/);
  assert.match(client.calls[3].text, /^SET LOCAL idle_in_transaction_session_timeout\s*=\s*60000$/);
  assert.equal(fnRanAtCall, 4, `fn must run after BEGIN + SET LOCAL ROLE + 2× SET LOCAL timeouts · ran at call #${fnRanAtCall}`);
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
  // getPool returns null → strict wrapper throws BEFORE touching fn.
  const client = makeFakeClient();
  const { withBrainRoleStrict } = await loadHelper(fakeWithClient(client), async () => null);
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

// ── WBR11-WBR12 · 2026-10-07 regression · pool-availability conflation ──

test("WBR11 · withBrainRoleStrict PASSES THROUGH null when pool is available and fn returns null", async () => {
  // Reproduces the exact bug surfaced by the A.6 Playwright proof:
  // PostgresObjectStorage.head() on a missing key returns null from
  // its inner function. The strict wrapper previously misread that
  // null as "pool unavailable" and threw pg-not-configured. With the
  // availability-first fix, a null from fn now returns null to the
  // caller, letting head() correctly report "object not found".
  const client = makeFakeClient();
  const { withBrainRoleStrict } = await loadHelper(fakeWithClient(client));
  const out = await withBrainRoleStrict(async () => null, "object-pg");
  assert.equal(out, null, "null fn result must pass through when pool is live");
});

test("WBR12 · withBrainRoleStrict decides availability from getPool() BEFORE fn runs (no fn side-effects on absent pool)", async () => {
  let fnRan = false;
  const client = makeFakeClient();
  const { withBrainRoleStrict } = await loadHelper(fakeWithClient(client), async () => null);
  let caught = null;
  try {
    await withBrainRoleStrict(async () => {
      fnRan = true;
      return 1;
    }, "test-context");
  } catch (e) { caught = e; }
  assert.ok(caught, "must throw when pool is unavailable");
  assert.equal(caught.code, "pg-not-configured");
  assert.equal(fnRan, false, "fn must NOT run when pool is unavailable · no side effects");
  // No DB queries at all when pool is absent.
  assert.equal(client.calls.length, 0, "no SQL queries fired when pool is absent");
});

test("WBR11b · withBrainRoleStrict preserves non-null falsy values when pool is live (0, empty string, false)", async () => {
  const client = makeFakeClient();
  const { withBrainRoleStrict } = await loadHelper(fakeWithClient(client));
  assert.equal(await withBrainRoleStrict(async () => 0), 0);
  assert.equal(await withBrainRoleStrict(async () => ""), "");
  assert.equal(await withBrainRoleStrict(async () => false), false);
});
