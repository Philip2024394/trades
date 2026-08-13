#!/usr/bin/env node
// timeout-injection.test.mjs · Wave 3 · H3 · SET LOCAL emission contract
//
// Governed by: docs/headquarters-production-readiness/WAVE-3-H3-TIMEOUT-BUDGETS.md
//
// Assertions:
//   TI1 · withBrainRole file sources SET LOCAL statement_timeout + SET LOCAL
//         idle_in_transaction_session_timeout inside the BEGIN..COMMIT block
//   TI2 · PostgresBrainStore::withTx mirrors the same SET LOCALs
//   TI3 · both files import from the shared timeouts config module
//   TI4 · shared pool at src/lib/nex/db.ts passes connectionTimeoutMillis
//         to `new Pool({...})`
//   TI5 · SET LOCALs appear AFTER SET LOCAL ROLE (order matters · the ROLE
//         switch must land first so subsequent SET LOCALs run under the
//         nex_brain_app role)
//
// Static source verification. No live DB required. Runtime verification
// of the actual SET LOCAL effect is covered by the timeout budgets design
// doc's live PG verification (WORLD-CLASS-OPS-W-C-LIVE-VERIFICATION.md §12.1).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..", "..", "..", "..");
const WITH_BRAIN_ROLE = join(REPO, "src/lib/nex/db/with-brain-role.ts");
const PG_ADAPTER = join(REPO, "src/lib/nex/brain/adapters/postgres.ts");
const SHARED_POOL = join(REPO, "src/lib/nex/db.ts");

function read(p) { return readFileSync(p, "utf8"); }

test("TI1 · withBrainRole emits SET LOCAL statement_timeout + SET LOCAL idle_in_transaction_session_timeout", () => {
  const src = read(WITH_BRAIN_ROLE);
  assert.match(src, /SET LOCAL statement_timeout/,
    "withBrainRole must SET LOCAL statement_timeout");
  assert.match(src, /SET LOCAL idle_in_transaction_session_timeout/,
    "withBrainRole must SET LOCAL idle_in_transaction_session_timeout");
});

test("TI2 · PostgresBrainStore::withTx emits the same two SET LOCALs", () => {
  const src = read(PG_ADAPTER);
  assert.match(src, /SET LOCAL statement_timeout/,
    "PostgresBrainStore::withTx must SET LOCAL statement_timeout");
  assert.match(src, /SET LOCAL idle_in_transaction_session_timeout/,
    "PostgresBrainStore::withTx must SET LOCAL idle_in_transaction_session_timeout");
});

test("TI3 · both wrappers import from the shared timeouts config module", () => {
  const withBrainRoleSrc = read(WITH_BRAIN_ROLE);
  const pgAdapterSrc = read(PG_ADAPTER);
  const importRe = /from\s+["']@\/lib\/nex\/config\/timeouts["']/;
  assert.match(withBrainRoleSrc, importRe,
    "withBrainRole must import from @/lib/nex/config/timeouts");
  assert.match(pgAdapterSrc, importRe,
    "PostgresBrainStore adapter must import from @/lib/nex/config/timeouts");
});

test("TI4 · shared pool at src/lib/nex/db.ts sets connectionTimeoutMillis (T-3)", () => {
  const src = read(SHARED_POOL);
  assert.match(src, /connectionTimeoutMillis:\s*connectionTimeoutMs\s*\(/,
    "shared pool must pass connectionTimeoutMillis: connectionTimeoutMs() to new Pool");
  assert.match(src, /from\s+["']\.\/config\/timeouts["']/,
    "shared pool must import connectionTimeoutMs from ./config/timeouts");
});

test("TI5 · SET LOCAL statement_timeout appears AFTER SET LOCAL ROLE (order matters)", () => {
  // Match the executable SQL specifically: the `SET LOCAL statement_timeout =`
  // template (with the `=` sign · comments don't include it). Otherwise the
  // header comment referencing the phrase would false-positive at line 1.
  for (const p of [WITH_BRAIN_ROLE, PG_ADAPTER]) {
    const src = read(p);
    const roleIdx = src.indexOf(`SET LOCAL ROLE nex_brain_app`);
    const stIdx   = src.search(/SET LOCAL statement_timeout\s*=/);
    assert.ok(roleIdx >= 0, `${p}: SET LOCAL ROLE not present`);
    assert.ok(stIdx >= 0, `${p}: executable SET LOCAL statement_timeout = ... not present`);
    assert.ok(roleIdx < stIdx,
      `${p}: SET LOCAL statement_timeout (${stIdx}) must come AFTER SET LOCAL ROLE (${roleIdx})`);
  }
});
