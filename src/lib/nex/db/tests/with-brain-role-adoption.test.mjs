#!/usr/bin/env node
// with-brain-role-adoption.test.mjs · Wave 11 · Step 7 · F34 drift-catcher
//
// Ensures no NEW file reintroduces a local withBrainRole. Every caller
// MUST consume the shared helper from src/lib/nex/db/with-brain-role.
// If a future edit adds a bespoke copy, this test fails and forces
// the author to consolidate.
//
// Also asserts every previously-duplicated site now imports from the
// canonical module.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { glob } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");

const MIGRATED = [
  "src/lib/nex/knowledge-inbox/pg-reads.ts",
  "src/lib/nex/knowledge-inbox/pg-shadow.ts",
  "src/lib/nex/jobs/pg-reads.ts",
  "src/lib/nex/jobs/pg-shadow.ts",
  "src/lib/nex/jobs/pg-claim.ts",
  "src/lib/nex/storage/adapters/object-postgres.ts",
];

test("WBRA1 · every previously-duplicated site imports from the shared module", () => {
  for (const rel of MIGRATED) {
    const src = readFileSync(join(REPO, rel), "utf8");
    const importsShared = /from ["']@\/lib\/nex\/db\/with-brain-role["']/.test(src);
    assert.ok(importsShared, `${rel} must import from @/lib/nex/db/with-brain-role`);
  }
});

test("WBRA2 · no MIGRATED site retains a local `async function withBrainRole<T>` definition", () => {
  for (const rel of MIGRATED) {
    const src = readFileSync(join(REPO, rel), "utf8");
    // The pg-shadow files use `const withBrainRole = sharedWithBrainRole`
    // aliases · that's fine (not a new local definition · just a rename).
    // We forbid the FULL local implementation shape only:
    //   async function withBrainRole<T>...<T | null> { ... "BEGIN" ... "SET LOCAL ROLE" ... "COMMIT" ... "ROLLBACK" ... }
    const hasLocalImpl = /async function withBrainRole<T>[\s\S]{0,120}?withClient[\s\S]{0,80}?BEGIN[\s\S]{0,120}?SET LOCAL ROLE[\s\S]{0,120}?COMMIT/.test(src);
    assert.equal(hasLocalImpl, false, `${rel} still contains a local withBrainRole implementation · migrate to shared helper`);
  }
});

test("WBRA3 · exactly ONE file defines withBrainRole (the canonical module)", async () => {
  // Search src/lib/nex/ for files matching the local-implementation pattern.
  const files = [];
  for await (const f of glob("src/lib/nex/**/*.ts", { cwd: REPO })) {
    files.push(f);
  }
  const withLocalImpl = [];
  for (const f of files) {
    const src = readFileSync(join(REPO, f), "utf8");
    // Match both the exported (canonical) shape AND any local re-def.
    if (/(?:export\s+)?async function withBrainRole<T>/.test(src)) {
      withLocalImpl.push(f);
    }
  }
  // Only the canonical module should own the definition.
  const canonicalOnly = withLocalImpl.filter((f) => !f.endsWith("src/lib/nex/db/with-brain-role.ts") && !f.endsWith("src\\lib\\nex\\db\\with-brain-role.ts"));
  assert.deepEqual(canonicalOnly, [], `unexpected withBrainRole definitions outside canonical module: ${canonicalOnly.join(", ")}`);
});
