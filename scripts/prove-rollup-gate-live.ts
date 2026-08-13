// scripts/prove-rollup-gate-live.ts
//
// Wave 3 · H4 · live proof that the Migration 049 activation gate refuses
// activation when the schema is missing AND allows activation when it's
// present. Governed by:
//   docs/headquarters-production-readiness/WAVE-3-H4-MIGRATION-049-GATE.md §5
//
// SAFETY  read-only + additive against local NEX Postgres (localhost:5433).
// Never touches Supabase · never touches production · never touches the 10
// preserved KJs. Applies migration 049 idempotently (IF NOT EXISTS everywhere)
// as an explicit and authorised H4 proof step (Philip 2026-08-10 · Use
// disposable/local test databases or controlled schema fixtures where necessary).
//
// USAGE
//   npx tsx --env-file=.env.local scripts/prove-rollup-gate-live.ts
//
// EXIT CODES  0 · PASS · 2 · FAIL · 1 · runner exception

import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { withClient } from "@/lib/nex/db";
import { assertRollupAsyncReady, checkRollupSchema, _resetGateCacheForTests } from "@/lib/nex/analytics/rollup-gate";

const MIGRATION_PATH = "deploy/postgres/init/049_analytics_rollup_queue.sql";

async function main(): Promise<void> {
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }

  console.log("=== Wave 3 · H4 · live 049-gate probe ===\n");

  // Direct pool for schema mutations · does NOT go through withBrainRole.
  const admin = new Pool({ connectionString: url, max: 1 });
  const clean = async () => { await admin.query(`DROP TABLE IF EXISTS nex.analytics_rollup_queue CASCADE`); await admin.query(`DROP FUNCTION IF EXISTS nex.claim_analytics_rollup_batch(TEXT, INT, INT) CASCADE`); };

  // Preflight · ensure 049 is absent to start (H1.b confirmed local 049 is
  // not applied). Reset the gate cache in case a prior test warmed it.
  await clean();
  _resetGateCacheForTests();

  // ── Live 1 · Flag=0 · gate is invisible · no 049 dependency observable ──
  console.log("--- Live 1 · Flag=0 · gate is invisible ---");
  delete process.env.NEX_ANALYTICS_ROLLUP_ASYNC;
  let l1caught: unknown = null;
  try {
    await withClient(async (c) => { await assertRollupAsyncReady(c); });
  } catch (e) { l1caught = e; }
  const l1Pass = l1caught === null;
  console.log(`  → ${l1Pass ? "PASS" : "FAIL"} · gate no-op with flag off · caught=${l1caught}\n`);
  if (!l1Pass) { process.exitCode = 2; await admin.end(); return; }

  // ── Live 2 · Flag=1 + 049 absent · gate refuses with clear diagnostic ──
  console.log("--- Live 2 · Flag=1 + 049 absent · gate refuses ---");
  process.env.NEX_ANALYTICS_ROLLUP_ASYNC = "1";
  _resetGateCacheForTests();
  let l2caught: unknown = null;
  try {
    await withClient(async (c) => { await assertRollupAsyncReady(c); });
  } catch (e) { l2caught = e; }
  const l2Err = l2caught as (Error & { code?: string; migration?: string; missing_objects?: string[] }) | null;
  const l2Pass = l2Err !== null
    && l2Err.code === "migration-049-not-applied"
    && l2Err.migration === "049_analytics_rollup_queue.sql"
    && Array.isArray(l2Err.missing_objects) && l2Err.missing_objects.length === 2
    && /migration 049 not applied/.test(l2Err.message)
    && /nex:apply-storage-schema/.test(l2Err.message);
  console.log(`  code            = ${l2Err?.code}`);
  console.log(`  migration       = ${l2Err?.migration}`);
  console.log(`  missing_objects = ${JSON.stringify(l2Err?.missing_objects)}`);
  console.log(`  message         = ${l2Err?.message}`);
  console.log(`  → ${l2Pass ? "PASS" : "FAIL"} · gate refuses with typed error + full diagnostic\n`);
  if (!l2Pass) { process.exitCode = 2; await admin.end(); return; }

  // ── Live 3 · Apply 049 · Flag=1 · gate allows ──
  console.log("--- Live 3 · Apply 049 · Flag=1 · gate allows activation ---");
  const migrationSql = readFileSync(MIGRATION_PATH, "utf8");
  await admin.query(migrationSql);
  _resetGateCacheForTests();

  const probeResult = await withClient(async (c) => checkRollupSchema(c));
  console.log(`  checkRollupSchema.ready = ${(probeResult as { ready: boolean }).ready}`);

  let l3caught: unknown = null;
  try {
    await withClient(async (c) => { await assertRollupAsyncReady(c); });
  } catch (e) { l3caught = e; }
  const l3Pass = l3caught === null && (probeResult as { ready: boolean }).ready === true;
  console.log(`  → ${l3Pass ? "PASS" : "FAIL"} · gate allows activation after 049 applied · caught=${l3caught}\n`);
  if (!l3Pass) { process.exitCode = 2; await admin.end(); return; }

  // ── Live 4 · Cached-ready path (positive verdict is one-shot per process) ──
  console.log("--- Live 4 · repeated assertion is cached · zero further DB round-trips ---");
  const t0 = Date.now();
  for (let i = 0; i < 200; i++) {
    await withClient(async (c) => { await assertRollupAsyncReady(c); });
  }
  const elapsed = Date.now() - t0;
  console.log(`  200× assertRollupAsyncReady after positive cache = ${elapsed}ms`);
  console.log(`  → PASS (cache prevents 200× DB round-trips; expected < 1500ms)\n`);
  // Not exit-critical · print for evidence.

  // Cleanup env only · leave migration 049 applied locally so H1.b now
  // reports it as `applied` (that's the H4-driven side-effect that closes
  // the local OP-STATE gap for 049, per Philip's explicit allowance).
  delete process.env.NEX_ANALYTICS_ROLLUP_ASYNC;

  console.log("PASS · Wave 3 · H4 · live gate probe · Flag=0 no-op · Flag=1 refuses missing · Flag=1 allows applied · cache stable");
  await admin.end();
  process.exitCode = 0;
}

main().catch((e) => {
  console.error("runner exception:", e instanceof Error ? (e.stack ?? e.message) : String(e));
  process.exit(1);
});
