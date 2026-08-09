#!/usr/bin/env node
// claim-race.test.mjs · Wave 11 remediation · closes part of F26 (fs-store claim path) + F2 static verification
//
// Proves that:
//   CR1  · claimJobIfQueued exists AND has a documented single-dispatcher assumption
//   CR2  · the function uses the read → update → verify pattern (not a simple write)
//   CR3  · the "raced" return case is emitted when re-verify detects another writer
//   CR4  · TWO concurrent claims of the same job_id return exactly ONE claimed=true
//   CR5  · TWO concurrent claims of DIFFERENT job_ids both succeed (no over-serialisation)
//   CR6  · claiming a non-existent job_id returns reason=not_found
//   CR7  · claiming a job whose status is not "queued" returns reason=not_queued
//   CR8  · after successful claim, subsequent claim returns reason=not_queued
//
// Runs against a REAL local JSONL store under a per-test temp directory
// so we exercise the actual code path, not a mock. Cleans up after itself.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import * as esbuild from "esbuild";

const requireFromHere = createRequire(import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");
const SRC       = readFileSync(join(REPO, "src/lib/nex/jobs/fs-store.ts"), "utf8");

// ── STATIC assertions on the source · CR1 · CR2 · CR3 ─────────────

test("CR1 · claimJobIfQueued exported AND uses atomic pg-claim first (Wave 11 F2 remediation)", () => {
  assert.match(SRC, /export async function claimJobIfQueued/, "claimJobIfQueued must be exported");
  assert.match(SRC, /pgAtomicClaimIfQueued/, "must call the atomic pg-claim primitive");
  // The legacy JSONL CAS approximation MUST remain as the fallback path
  // when Postgres is unavailable or the shadow row hasn't landed yet.
  assert.match(SRC, /legacyJsonlClaimIfQueued/, "legacy fallback must remain for pg-unavailable case");
  // The single-dispatcher assumption comment MUST remain — the legacy
  // path is still topology-dependent when Postgres is unavailable.
  assert.match(SRC, /single-dispatcher/i, "legacy fallback assumption must stay documented");
});

test("CR2 · legacy fallback preserves the historical read → update → verify pattern", () => {
  // The invariants moved from the main function to the legacy fallback
  // after Wave 11 remediation. The pattern remains identical there.
  const legacy = SRC.match(/async function legacyJsonlClaimIfQueued[\s\S]*?^\}/m)?.[0] ?? "";
  assert.notEqual(legacy.length, 0, "legacyJsonlClaimIfQueued must exist");
  assert.match(legacy, /await getJob\(job_id\)/,                             "must getJob before mutating");
  assert.match(legacy, /await updateJob\(job_id, \{ status: "claimed" \}\)/, "must update to claimed");
  assert.match(legacy, /const latest = await getJob\(job_id\)/,              "must re-verify after update");
});

test("CR3 · both paths emit the correct reason codes", () => {
  // Main function returns not_queued on atomic lost-race.
  assert.match(SRC, /reason: "not_queued"/, "must emit reason=not_queued on atomic lost race");
  // Legacy fallback emits all three: not_found, not_queued, raced.
  const legacy = SRC.match(/async function legacyJsonlClaimIfQueued[\s\S]*?^\}/m)?.[0] ?? "";
  assert.match(legacy, /reason: "raced"/,      "legacy path must emit reason=raced on re-verify contention");
  assert.match(legacy, /reason: "not_queued"/, "legacy path must emit reason=not_queued");
  assert.match(legacy, /reason: "not_found"/,  "legacy path must emit reason=not_found");
});

// ── LIVE assertions · CR4-CR8 · exercise the real code path ────────

// Rebuild fs-store as CJS with an isolated storage root so we don't
// touch the real data/nex-jobs directory.
const TMP_ROOT = join(tmpdir(), `nex-claim-race-${Date.now()}-${process.pid}`);
mkdirSync(TMP_ROOT, { recursive: true });

// Rewrite the ROOT constant to point at our temp dir.
const rewritten = SRC.replace(
  /const ROOT = path\.join\(process\.cwd\(\), "data", "nex-jobs"\);/,
  `const ROOT = ${JSON.stringify(TMP_ROOT)};`,
);
// Only strip `export` markers so the class/functions are visible in the
// CJS scope after transform. Leave every import in place — esbuild will
// rewrite them to require() calls which our require shim resolves
// against a per-module map.
const stripped = rewritten.replace(/^export\s+/gm, "");

const transformed = await esbuild.transform(stripped, {
  loader: "ts",
  format: "cjs",
  target: "node20",
});

// require shim: resolves node built-ins via the real require, and
// stubs the shadow/reads/claim/events modules so we don't drag in the
// Postgres / Supabase / events infrastructure for the CR4a legacy
// coverage. CR4b/CR4c (below) exercise the real pg-claim path directly.
const moduleStubs = {
  "./pg-shadow": { shadowUpsertJob: async () => {} },
  "./pg-reads":  {
    isPostgresReadEnabled: () => false,
    listJobsFromPostgres:  async () => null,
    getJobFromPostgres:    async () => null,
    jobStatsFromPostgres:  async () => null,
  },
  // pg-claim stubbed to always report unavailable so the legacy JSONL
  // path is exercised by CR4a — proving the OLD racy behavior remains
  // present as fallback (documented single-dispatcher assumption).
  "./pg-claim": { pgAtomicClaimIfQueued: async () => ({ kind: "pg-unavailable" }) },
  "../events/fs-store": { emitEventSafe: async () => {} },
  // Wave 11 GROUP B · fs-store now uses validateOrDrop for JSONL parsing.
  // Stub with a passthrough so the JSONL parse tests exercise the store
  // in isolation (the observability integration is tested separately in
  // observability-core.test.mjs).
  "@/lib/nex/observability/validate": {
    validateOrDrop: (rows, validator) => {
      const valid = [];
      for (let i = 0; i < rows.length; i++) {
        const r = validator(rows[i], i);
        if (r.ok) valid.push(r.value);
      }
      return { valid, dropped: 0, reasons: new Map() };
    },
  },
};
const shimRequire = (id) => {
  if (id in moduleStubs) return moduleStubs[id];
  return requireFromHere(id);
};

const mod = { exports: {} };
new Function("module", "process", "exports", "require",
  transformed.code + `
module.exports = { createJob, updateJob, claimJobIfQueued, getJob, listJobs };
`)(mod, process, mod.exports, shimRequire);

const { createJob, claimJobIfQueued, getJob } = mod.exports;

async function seedQueuedJob(job_id_override = null) {
  const j = await createJob({
    source: "test",
    owner: "system",
    knowledge_type: "text",
    target_brains: ["misc"],
    title: "race-test",
    content_length: 10,
  });
  return j;
}

// CR4a · DOCUMENTS THE CURRENT RACY BEHAVIOR · proof of Wave 11 F2 defect.
//
// This test asserts what happens TODAY under Promise.all concurrency:
// the JSONL append + re-verify approximation of CAS is NOT atomic, so
// both claimants can observe status=queued, both write claim snapshots,
// and both re-reads pass because each caller's own snapshot compares
// equal to its own updated_at. Both claimants return { claimed: <job> }.
//
// Under the CURRENT single-dispatcher production topology this race is
// not reached (Vercel Cron serialises dispatch cycles). But the code
// itself is racy · if the topology ever gains a second concurrent
// dispatcher or worker, this defect activates in production.
//
// When Group C (Wave 6c write-flip to Postgres nex.claim_next_job
// SKIP LOCKED) lands, this test will fail because the atomic claim
// will prevent double-lease. That failure is the SIGNAL to update this
// assertion (and enable CR4b below).
//
// Do not "fix" this test by weakening it. The right fix is Group C.
test("CR4a · CURRENT BEHAVIOR · two concurrent claims of same job_id can BOTH succeed (proof of F2 race)", async () => {
  const job = await seedQueuedJob();
  const [r1, r2] = await Promise.all([
    claimJobIfQueued(job.job_id),
    claimJobIfQueued(job.job_id),
  ]);
  const winners = [r1, r2].filter((r) => r.claimed !== null);
  // Racy CAS approximation permits 1 OR 2 winners depending on timing.
  // We assert winners.length >= 1 (someone always claims) AND surface
  // the count so operators reading test output see the race incidence.
  assert.ok(winners.length >= 1, `at least one claim must succeed · got ${winners.length}`);
  if (winners.length === 2) {
    // Race hit: both claimed the same job. This is F2 in action.
    console.warn(`  [CR4a] F2 race manifested · both claimed job_id ${job.job_id}`);
  }
});

// CR4b · TARGET INVARIANT · exactly-one-winner via pgAtomicClaimIfQueued
// (Wave 11 F2 remediation · Group C · 2026-08-10).
//
// This exercises the ATOMIC PRIMITIVE directly against a real Postgres
// row. Skipped when NEX_POSTGRES_URL is unset (dev with no PG).
//
// Setup:
//   1. Read .env.local for NEX_POSTGRES_URL
//   2. Import the real pg-claim.ts (NOT the stub)
//   3. Seed a fresh nex.knowledge_dump_jobs row with status='queued'
//   4. Fire Promise.all pgAtomicClaimIfQueued × 2
//   5. Assert: exactly ONE returns kind="claimed" · other returns
//              kind="lost-race" with observed_status="claimed"
//   6. Assert: subsequent claim on the same job returns kind="lost-race"
//   7. Cleanup: delete the seed row

import { readFileSync as _readFile } from "node:fs";
const ENV_FILE = (() => { try { return _readFile(".env.local", "utf8"); } catch { return ""; } })();
const PG_URL = (ENV_FILE.match(/^NEX_POSTGRES_URL=(\S+)/m) || [])[1] || process.env.NEX_POSTGRES_URL || "";

test("CR4b · ATOMIC INVARIANT · two concurrent Promise.all claims on same job_id → exactly one winner (live pg)", async (t) => {
  if (!PG_URL) {
    t.skip("NEX_POSTGRES_URL not configured · skip live-pg atomic proof");
    return;
  }

  // Load the real pg-claim.ts (not the stub used by the CJS-wrapped fs-store)
  // via a separate esbuild pass that preserves the @/lib/nex/db import.
  const pgClaimSrc = _readFile(join(REPO, "src/lib/nex/jobs/pg-claim.ts"), "utf8");
  const pgClaimStripped = pgClaimSrc.replace(/^export\s+/gm, "");
  const pgClaimTransformed = await esbuild.transform(pgClaimStripped, {
    loader: "ts", format: "cjs", target: "node20",
  });
  // Provide a real db module that connects to the configured PG.
  process.env.NEX_POSTGRES_URL = PG_URL;
  const dbSrc = _readFile(join(REPO, "src/lib/nex/db.ts"), "utf8");
  const dbStripped = dbSrc.replace(/^export\s+/gm, "");
  const dbTransformed = await esbuild.transform(dbStripped, { loader: "ts", format: "cjs", target: "node20" });
  const dbMod = { exports: {} };
  new Function("module", "process", "exports", "require",
    dbTransformed.code + `\nmodule.exports = { withClient };`,
  )(dbMod, process, dbMod.exports, requireFromHere);

  // Wave 11 · Step 7 · load shared withBrainRole helper for the shim.
  const wbrSrc = _readFile(join(REPO, "src/lib/nex/db/with-brain-role.ts"), "utf8");
  const wbrStripped = wbrSrc.replace(/^export\s+/gm, "");
  const wbrTransformed = await esbuild.transform(wbrStripped, { loader: "ts", format: "cjs", target: "node20" });
  const wbrMod = { exports: {} };
  new Function("module", "process", "exports", "require",
    wbrTransformed.code + `\nmodule.exports = { withBrainRole, withBrainRoleStrict };`,
  )(wbrMod, process, wbrMod.exports, (id) => id === "@/lib/nex/db" ? dbMod.exports : requireFromHere(id));

  const claimMod = { exports: {} };
  const claimShim = (id) => {
    if (id === "@/lib/nex/db") return dbMod.exports;
    if (id === "@/lib/nex/db/with-brain-role") return wbrMod.exports;
    return requireFromHere(id);
  };
  new Function("module", "process", "exports", "require",
    pgClaimTransformed.code + `\nmodule.exports = { pgAtomicClaimIfQueued };`,
  )(claimMod, process, claimMod.exports, claimShim);

  const { pgAtomicClaimIfQueued } = claimMod.exports;
  const { withClient } = dbMod.exports;

  // Seed a fresh unique job row directly via SQL (bypass shadow so we
  // control the state exactly).
  const job_id = `cr4b-atomic-${Date.now()}-${process.pid}`;
  const now = new Date().toISOString();
  const seeded = await withClient(async (c) => {
    await c.query("BEGIN");
    try {
      await c.query("SET LOCAL ROLE nex_brain_app");
      await c.query(
        `INSERT INTO nex.knowledge_dump_jobs
           (job_id, source, owner, knowledge_type, target_brains,
            status, progress, completion_result,
            inbox_item_id, title, content_length,
            created_at, updated_at, shadow_written_at, shadow_updated_at)
         VALUES ($1,'test','system','text','{misc}','queued',0,NULL,NULL,'cr4b-race',0,
                 $2::timestamptz,$2::timestamptz,NOW(),NOW())`,
        [job_id, now],
      );
      await c.query("COMMIT");
      return true;
    } catch (e) {
      await c.query("ROLLBACK").catch(() => {});
      throw e;
    }
  });
  if (seeded === null) {
    t.skip("withClient returned null · pg pool did not initialise · skip");
    return;
  }

  try {
    // THE INVARIANT · two concurrent atomic claims MUST yield exactly one winner.
    const [r1, r2] = await Promise.all([
      pgAtomicClaimIfQueued(job_id),
      pgAtomicClaimIfQueued(job_id),
    ]);
    const winners = [r1, r2].filter((r) => r.kind === "claimed");
    const losers  = [r1, r2].filter((r) => r.kind === "lost-race");
    assert.equal(winners.length, 1, `exactly ONE winner · got ${winners.length} · r1=${r1.kind} r2=${r2.kind}`);
    assert.equal(losers.length,  1, `exactly ONE loser · got ${losers.length}`);
    assert.equal(losers[0].observed_status, "claimed", `loser must observe status=claimed · got ${losers[0].observed_status}`);
    // Subsequent claim on same job MUST return lost-race.
    const r3 = await pgAtomicClaimIfQueued(job_id);
    assert.equal(r3.kind, "lost-race", `subsequent claim on already-claimed job must be lost-race · got ${r3.kind}`);
  } finally {
    // Cleanup · delete the seed row so re-runs are clean.
    await withClient(async (c) => {
      await c.query("BEGIN");
      try {
        await c.query("SET LOCAL ROLE nex_brain_app");
        await c.query(`DELETE FROM nex.knowledge_dump_jobs WHERE job_id = $1`, [job_id]);
        await c.query("COMMIT");
      } catch { await c.query("ROLLBACK").catch(() => {}); }
    });
  }
});

test("CR4c · ATOMIC INVARIANT · a job cannot be processed twice (10× concurrent Promise.all · exactly one winner)", async (t) => {
  if (!PG_URL) {
    t.skip("NEX_POSTGRES_URL not configured · skip live-pg atomic proof");
    return;
  }
  // Reuse the pg-claim module already loaded in CR4b · re-load minimal
  // path so this test is self-contained. Wave 11 · Step 7 · also shim
  // the new @/lib/nex/db/with-brain-role dependency.
  const pgClaimSrc = _readFile(join(REPO, "src/lib/nex/jobs/pg-claim.ts"), "utf8");
  const dbSrc      = _readFile(join(REPO, "src/lib/nex/db.ts"), "utf8");
  const wbrSrc     = _readFile(join(REPO, "src/lib/nex/db/with-brain-role.ts"), "utf8");
  const pcT  = await esbuild.transform(pgClaimSrc.replace(/^export\s+/gm, ""), { loader: "ts", format: "cjs", target: "node20" });
  const dbT  = await esbuild.transform(dbSrc.replace(/^export\s+/gm, ""),      { loader: "ts", format: "cjs", target: "node20" });
  const wbrT = await esbuild.transform(wbrSrc.replace(/^export\s+/gm, ""),     { loader: "ts", format: "cjs", target: "node20" });
  process.env.NEX_POSTGRES_URL = PG_URL;
  const dbMod = { exports: {} };
  new Function("module", "process", "exports", "require",
    dbT.code + `\nmodule.exports = { withClient };`,
  )(dbMod, process, dbMod.exports, requireFromHere);
  const wbrMod = { exports: {} };
  new Function("module", "process", "exports", "require",
    wbrT.code + `\nmodule.exports = { withBrainRole, withBrainRoleStrict };`,
  )(wbrMod, process, wbrMod.exports, (id) => id === "@/lib/nex/db" ? dbMod.exports : requireFromHere(id));
  const claimMod = { exports: {} };
  const claimShim = (id) => {
    if (id === "@/lib/nex/db") return dbMod.exports;
    if (id === "@/lib/nex/db/with-brain-role") return wbrMod.exports;
    return requireFromHere(id);
  };
  new Function("module", "process", "exports", "require",
    pcT.code + `\nmodule.exports = { pgAtomicClaimIfQueued };`,
  )(claimMod, process, claimMod.exports, claimShim);
  const { pgAtomicClaimIfQueued } = claimMod.exports;
  const { withClient } = dbMod.exports;

  const job_id = `cr4c-10way-${Date.now()}-${process.pid}`;
  const now = new Date().toISOString();
  await withClient(async (c) => {
    await c.query("BEGIN");
    try {
      await c.query("SET LOCAL ROLE nex_brain_app");
      await c.query(
        `INSERT INTO nex.knowledge_dump_jobs
           (job_id, source, owner, knowledge_type, target_brains, status, progress,
            completion_result, inbox_item_id, title, content_length,
            created_at, updated_at, shadow_written_at, shadow_updated_at)
         VALUES ($1,'test','system','text','{misc}','queued',0,NULL,NULL,'cr4c',0,
                 $2::timestamptz,$2::timestamptz,NOW(),NOW())`,
        [job_id, now],
      );
      await c.query("COMMIT");
    } catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; }
  });

  try {
    // 10-way concurrent claim · exactly one winner allowed.
    const results = await Promise.all(
      Array.from({ length: 10 }, () => pgAtomicClaimIfQueued(job_id)),
    );
    const winners = results.filter((r) => r.kind === "claimed");
    const losers  = results.filter((r) => r.kind === "lost-race");
    assert.equal(winners.length, 1, `exactly ONE winner across 10 concurrent claims · got ${winners.length}`);
    assert.equal(losers.length, 9, `9 losers expected · got ${losers.length}`);
    for (const l of losers) {
      assert.equal(l.observed_status, "claimed", `each loser must observe status=claimed · got ${l.observed_status}`);
    }
  } finally {
    await withClient(async (c) => {
      await c.query("BEGIN");
      try {
        await c.query("SET LOCAL ROLE nex_brain_app");
        await c.query(`DELETE FROM nex.knowledge_dump_jobs WHERE job_id = $1`, [job_id]);
        await c.query("COMMIT");
      } catch { await c.query("ROLLBACK").catch(() => {}); }
    });
  }
});

test("CR5 · two concurrent claims of DIFFERENT job_ids → both succeed", async () => {
  const jA = await seedQueuedJob();
  const jB = await seedQueuedJob();
  const [rA, rB] = await Promise.all([
    claimJobIfQueued(jA.job_id),
    claimJobIfQueued(jB.job_id),
  ]);
  assert.ok(rA.claimed !== null, `A must succeed · got ${JSON.stringify(rA)}`);
  assert.ok(rB.claimed !== null, `B must succeed · got ${JSON.stringify(rB)}`);
});

test("CR6 · claiming a non-existent job_id returns not_found", async () => {
  const r = await claimJobIfQueued("does-not-exist-" + Date.now());
  assert.equal(r.claimed, null);
  assert.equal(r.reason, "not_found");
});

test("CR7 · claiming an already-claimed job returns not_queued", async () => {
  const job = await seedQueuedJob();
  const r1  = await claimJobIfQueued(job.job_id);
  assert.ok(r1.claimed !== null, "first claim must succeed");
  const r2  = await claimJobIfQueued(job.job_id);
  assert.equal(r2.claimed, null);
  assert.equal(r2.reason, "not_queued");
  assert.equal(r2.observed_status, "claimed");
});

test("CR8 · cleanup", () => {
  try { rmSync(TMP_ROOT, { recursive: true, force: true }); } catch {}
  assert.equal(existsSync(TMP_ROOT), false);
});
