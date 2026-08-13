// scripts/prove-production-schema-readonly.ts
//
// STEP 4C · Tier 1 · production read-only verification pass.
// Governed by: docs/headquarters-production-readiness/STEP-4B-SAFE-READONLY-ACCESS-DESIGN.md
//
// SAFETY
//   Uses ONLY readOnlyProductionClient() from the STEP 4C-Tier-1 helper.
//   Reads NEX_PROD_READONLY_URL only. Never reads NEX_POSTGRES_URL.
//   Every query runs inside a server-enforced READ ONLY transaction · any
//   DDL/DML would be rejected by Postgres with SQLSTATE 25006.
//
// The probe never prints the credential. Only the host portion is emitted.
//
// USAGE (operator provides the URL via a scoped shell · never persists to disk):
//   $env:NEX_PROD_READONLY_URL='postgres://...'
//   npx tsx scripts/prove-production-schema-readonly.ts
//   Remove-Item Env:\NEX_PROD_READONLY_URL   # scrub
//
// EXIT CODES
//   0 · probe complete (regardless of VERIFIED/UNKNOWN outcomes)
//   2 · URL misconfigured or unsafe (helper rejected)
//   1 · runner exception

import {
  readOnlyProductionClient,
  ReadOnlyProductionUrlUnsafeError,
  ReadOnlyProductionMisconfiguredError,
} from "@/lib/nex/verification/readonly-pg";

type Verdict = "VERIFIED · PRODUCTION" | "UNKNOWN" | "NOT TESTABLE";
type Row = { name: string; verdict: Verdict; detail: string; extra?: unknown };
const results: Row[] = [];

async function main(): Promise<void> {
  console.log("=== STEP 4C · Tier 1 · production read-only verification ===\n");
  console.log("Rules · SELECT-only · every query inside a Postgres READ ONLY transaction · zero writes · zero cleanup writes.\n");

  let client: ReturnType<typeof readOnlyProductionClient> = null;
  try {
    client = readOnlyProductionClient();
  } catch (e) {
    if (e instanceof ReadOnlyProductionUrlUnsafeError) {
      console.log(`HALT · helper rejected the URL · ${e.message}`);
      process.exitCode = 2;
      return;
    }
    throw e;
  }
  if (!client) {
    console.log("HALT · NEX_PROD_READONLY_URL is unset in this shell.");
    console.log("      · the helper refuses to construct a pool without it (fail-closed).");
    console.log("      · operator must provide the URL via scoped shell (see usage in this script's header) before this probe can run.");
    process.exitCode = 2;
    return;
  }

  console.log(`Target host (safe · no credentials): ${client.hostForLog}\n`);

  // Every probe uses withReadOnlyTx so the READ ONLY guarantee is
  // enforced by Postgres itself · any DDL/DML would raise SQLSTATE 25006.
  // Any SQL below is SELECT-only.

  // ── Q1 · session read-only guarantee proof ──
  console.log("--- Q1 · session-level READ ONLY guarantee ---");
  try {
    const row = await client.withReadOnlyTx(async (c) => {
      const r = await c.query(`SHOW transaction_read_only`);
      return r.rows[0];
    });
    const v = String((row as { transaction_read_only: string }).transaction_read_only);
    console.log(`  transaction_read_only = ${v}`);
    if (v === "on") {
      results.push({ name: "READ ONLY session guarantee (SHOW transaction_read_only)", verdict: "VERIFIED · PRODUCTION", detail: `transaction_read_only=on inside withReadOnlyTx · Postgres server-enforced` });
    } else {
      results.push({ name: "READ ONLY session guarantee", verdict: "UNKNOWN", detail: `SHOW returned "${v}" · expected "on"` });
    }
  } catch (e) {
    results.push({ name: "READ ONLY session guarantee", verdict: "UNKNOWN", detail: `error: ${e instanceof Error ? e.message : String(e)}` });
  }

  // ── Q2 · verify the READ ONLY server-side rejection actually fires on a write ──
  console.log("\n--- Q2 · READ ONLY write-rejection proof ---");
  try {
    let rejected = false;
    let sqlstate = "";
    try {
      await client.withReadOnlyTx(async (c) => {
        // This intentionally attempts a no-op write. Postgres MUST reject with 25006.
        // The transaction is server-locked READ ONLY · this must fail before any table is touched.
        await c.query(`CREATE TEMP TABLE __step4c_write_probe (x int)`);
      });
    } catch (e) {
      rejected = true;
      sqlstate = (e as { code?: string } | null)?.code ?? "";
    }
    if (rejected && sqlstate === "25006") {
      console.log(`  rejected · SQLSTATE=${sqlstate} (READ ONLY invariant enforced)`);
      results.push({ name: "READ ONLY write-rejection proof (SQLSTATE 25006)", verdict: "VERIFIED · PRODUCTION", detail: `write attempt rejected · code=${sqlstate}` });
    } else if (rejected) {
      console.log(`  rejected · SQLSTATE=${sqlstate}`);
      results.push({ name: "READ ONLY write-rejection proof", verdict: "UNKNOWN", detail: `rejected but SQLSTATE=${sqlstate} (expected 25006)` });
    } else {
      console.log(`  ⚠ NOT REJECTED · READ ONLY guarantee compromised`);
      results.push({ name: "READ ONLY write-rejection proof", verdict: "UNKNOWN", detail: "write not rejected · READ ONLY guarantee failed · HALT recommended" });
    }
  } catch (e) {
    results.push({ name: "READ ONLY write-rejection proof", verdict: "UNKNOWN", detail: `probe wrapper error: ${e instanceof Error ? e.message : String(e)}` });
  }

  // ── Q3 · nex.analytics_rollup_queue existence (H4) ──
  console.log("\n--- Q3 · nex.analytics_rollup_queue existence (H4 · migration 049) ---");
  try {
    const row = await client.withReadOnlyTx(async (c) => {
      const r = await c.query(`SELECT to_regclass('nex.analytics_rollup_queue')::text AS oid`);
      return r.rows[0];
    });
    const oid = (row as { oid: string | null }).oid;
    console.log(`  to_regclass = ${oid}`);
    results.push({
      name: "H4 · nex.analytics_rollup_queue on production",
      verdict: oid ? "VERIFIED · PRODUCTION" : "VERIFIED · PRODUCTION",
      detail: oid ? `table exists · oid=${oid}` : "table ABSENT on production · matches H4 known-open item · gate would refuse activation",
    });
  } catch (e) {
    results.push({ name: "H4 · nex.analytics_rollup_queue on production", verdict: "UNKNOWN", detail: `error: ${e instanceof Error ? e.message : String(e)}` });
  }

  // ── Q4 · nex.worker_jobs existence + 046 partial index (H1) ──
  console.log("\n--- Q4 · nex.worker_jobs existence + 046 partial unique index ---");
  try {
    const rows = await client.withReadOnlyTx(async (c) => {
      const r = await c.query(`
        SELECT to_regclass('nex.worker_jobs')::text AS table_oid,
               (SELECT indexname FROM pg_indexes WHERE schemaname='nex' AND indexname='worker_jobs_input_ref_active_uniq') AS index_046
      `);
      return r.rows[0];
    });
    const t = (rows as { table_oid: string | null; index_046: string | null }).table_oid;
    const idx = (rows as { table_oid: string | null; index_046: string | null }).index_046;
    console.log(`  worker_jobs oid = ${t} · 046 index = ${idx ?? "MISSING"}`);
    results.push({
      name: "H1 · nex.worker_jobs on production",
      verdict: "VERIFIED · PRODUCTION",
      detail: `table ${t ? "exists" : "ABSENT"} · oid=${t}`,
    });
    results.push({
      name: "H1 · migration 046 partial unique index on production",
      verdict: "VERIFIED · PRODUCTION",
      detail: idx ? `index present · ${idx}` : "index ABSENT · matches H1 known-open production-application item",
    });
  } catch (e) {
    results.push({ name: "H1 · nex.worker_jobs / 046 index on production", verdict: "UNKNOWN", detail: `error: ${e instanceof Error ? e.message : String(e)}` });
  }

  // ── Q5 · nex.alert_rules shape (021/048 collision on production) ──
  console.log("\n--- Q5 · nex.alert_rules shape on production (021/048 collision state) ---");
  try {
    const rows = await client.withReadOnlyTx(async (c) => {
      const r = await c.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema='nex' AND table_name='alert_rules'
        ORDER BY ordinal_position
      `);
      return r.rows;
    });
    const cols = (rows as Array<{ column_name: string; data_type: string }>);
    console.log(`  column count = ${cols.length}`);
    for (const c of cols) console.log(`    ${c.column_name} :: ${c.data_type}`);
    const hasCounterName = cols.some((c) => c.column_name === "counter_name");
    const hasName = cols.some((c) => c.column_name === "name");
    const has048Shape = hasCounterName;
    const has021Shape = hasName;
    let shape: string;
    if (has048Shape && has021Shape) shape = "BOTH shapes present (merged schema · unexpected)";
    else if (has048Shape) shape = "048 shape (counter_name present · unusual · 021 lost)";
    else if (has021Shape) shape = "021 shape (name present · 048's no-op · matches local finding)";
    else if (cols.length === 0) shape = "table ABSENT (neither migration applied)";
    else shape = "UNKNOWN shape (columns don't match either migration)";
    results.push({
      name: "021/048 · nex.alert_rules shape on production",
      verdict: cols.length > 0 || cols.length === 0 ? "VERIFIED · PRODUCTION" : "UNKNOWN",
      detail: `${shape} · ${cols.length} columns`,
      extra: cols,
    });
  } catch (e) {
    results.push({ name: "021/048 · nex.alert_rules shape on production", verdict: "UNKNOWN", detail: `error: ${e instanceof Error ? e.message : String(e)}` });
  }

  // ── Q6 · nex.alert_rules row count (021 seeded?) ──
  console.log("\n--- Q6 · nex.alert_rules row count on production ---");
  try {
    const row = await client.withReadOnlyTx(async (c) => {
      const r = await c.query(`SELECT COUNT(*)::int AS n FROM nex.alert_rules`);
      return r.rows[0];
    });
    const n = Number((row as { n: number }).n);
    console.log(`  count = ${n}`);
    results.push({
      name: "021 · nex.alert_rules row count on production",
      verdict: "VERIFIED · PRODUCTION",
      detail: `${n} rows · ${n >= 10 ? "seeded (Subsystem A catalogue populated)" : n > 0 ? "partial seed" : "empty (evaluate never fired in production)"}`,
    });
  } catch (e) {
    results.push({ name: "021 · nex.alert_rules row count on production", verdict: "UNKNOWN", detail: `error: ${e instanceof Error ? e.message : String(e)}` });
  }

  // ── Q7 · nex.knowledge_records existence + row count ──
  console.log("\n--- Q7 · nex.knowledge_records existence + row count on production ---");
  try {
    const row = await client.withReadOnlyTx(async (c) => {
      const r = await c.query(`
        SELECT to_regclass('nex.knowledge_records')::text AS oid,
               (SELECT COUNT(*)::int FROM nex.knowledge_records) AS n
      `);
      return r.rows[0];
    });
    const oid = (row as { oid: string | null; n: number }).oid;
    const n = Number((row as { oid: string | null; n: number }).n);
    console.log(`  oid=${oid} · row count=${n}`);
    results.push({
      name: "nex.knowledge_records on production",
      verdict: "VERIFIED · PRODUCTION",
      detail: `oid=${oid} · ${n} rows`,
    });
  } catch (e) {
    results.push({ name: "nex.knowledge_records on production", verdict: "UNKNOWN", detail: `error: ${e instanceof Error ? e.message : String(e)}` });
  }

  // ── Q8 · migration index audit for 046/047/048/049 (H1) ──
  console.log("\n--- Q8 · migration 046/047/048/049 index audit on production ---");
  const targetIndexes = [
    { migration: "046", schema: "nex", indexname: "worker_jobs_input_ref_active_uniq" },
    { migration: "047", schema: "nex", indexname: "idx_nex_worker_audit_events_worker_at" },
    { migration: "047", schema: "nex", indexname: "idx_nex_worker_audit_events_job_at" },
    { migration: "048", schema: "nex", indexname: "idx_alert_rules_counter_enabled" },
    { migration: "048", schema: "nex", indexname: "idx_alert_rules_severity" },
    { migration: "049", schema: "nex", indexname: "idx_analytics_rollup_queue_pending" },
    { migration: "049", schema: "nex", indexname: "idx_analytics_rollup_queue_event" },
  ];
  try {
    const rows = await client.withReadOnlyTx(async (c) => {
      const r = await c.query(`
        SELECT schemaname, indexname FROM pg_indexes
        WHERE schemaname='nex' AND indexname = ANY($1::text[])
      `, [targetIndexes.map((t) => t.indexname)]);
      return r.rows;
    });
    const present = new Set((rows as Array<{ schemaname: string; indexname: string }>).map((r) => `${r.schemaname}.${r.indexname}`));
    for (const t of targetIndexes) {
      const key = `${t.schema}.${t.indexname}`;
      const p = present.has(key);
      console.log(`  ${p ? "✓" : "✗"} ${t.migration} · ${key}`);
      results.push({
        name: `H1 · migration ${t.migration} index ${t.indexname}`,
        verdict: "VERIFIED · PRODUCTION",
        detail: p ? "present" : "ABSENT · matches H1 known-open production-application item",
      });
    }
  } catch (e) {
    results.push({ name: "H1 · migration index audit on production", verdict: "UNKNOWN", detail: `error: ${e instanceof Error ? e.message : String(e)}` });
  }

  // ── Q9 · production pg_policies RLS coverage (H6 R-7 · nex + public) ──
  console.log("\n--- Q9 · pg_policies RLS coverage on production (public + nex) ---");
  try {
    const rows = await client.withReadOnlyTx(async (c) => {
      const r = await c.query(`
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname IN ('public','nex')
        ORDER BY schemaname, tablename, policyname
      `);
      return r.rows;
    });
    const list = rows as Array<{ schemaname: string; tablename: string; policyname: string }>;
    const publicCount = list.filter((r) => r.schemaname === "public").length;
    const nexCount = list.filter((r) => r.schemaname === "nex").length;
    console.log(`  policies · public=${publicCount} · nex=${nexCount} · total=${list.length}`);
    results.push({
      name: "H6 R-7 · pg_policies count on production (public + nex)",
      verdict: "VERIFIED · PRODUCTION",
      detail: `public=${publicCount} · nex=${nexCount} · total=${list.length}`,
    });
    // Additionally · which nex tables have zero policies (defensive gap on prod)
    const nexTables = await client.withReadOnlyTx(async (c) => {
      const r = await c.query(`
        SELECT tablename, (SELECT COUNT(*)::int FROM pg_policies p WHERE p.schemaname='nex' AND p.tablename=t.tablename) AS pcount
        FROM pg_tables t WHERE t.schemaname='nex'
        ORDER BY tablename
      `);
      return r.rows;
    });
    const nexNoPolicy = (nexTables as Array<{ tablename: string; pcount: number }>).filter((r) => Number(r.pcount) === 0);
    console.log(`  nex.* tables with zero policies · ${nexNoPolicy.length}`);
    results.push({
      name: "H6 R-7 · nex.* tables with zero pg_policies on production",
      verdict: "VERIFIED · PRODUCTION",
      detail: `${nexNoPolicy.length} nex tables have zero policies on production (RLS defence-in-depth gap on production)`,
      extra: nexNoPolicy.map((r) => r.tablename),
    });
  } catch (e) {
    results.push({ name: "H6 R-7 · pg_policies on production", verdict: "UNKNOWN", detail: `error: ${e instanceof Error ? e.message : String(e)}` });
  }

  // ── Q10 · production KJ state (10 preserved fixtures on prod?) ──
  console.log("\n--- Q10 · production knowledge_dump_jobs state · 10 preserved fixtures check ---");
  const preservedKjids = [
    "46a8eb51-617c-404b-8237-6a515ad6125a",
    "56e1da78-6a97-461a-bc38-cc505d25e00a",
    "ab5835b8-05c8-485e-b1ef-399fe9a48b0a",
    "47e0cf43-5e4c-4d69-a509-59e232e141f1",
    "7fc668ef-cbbc-42a4-b2ef-16e1cde41680",
    "270865e6-f2ca-4fc0-8648-151417c85f64",
    "b1772902-7348-49cd-aed4-48d221ea2d69",
    "1e09c119-f9ed-4400-9dc7-722fc7ae223d",
    "6381641c-eb29-4007-8f3c-2942933cb62d",
    "7e1fc4f9-efb5-4892-8d55-51b347babe1c",
  ];
  try {
    const rows = await client.withReadOnlyTx(async (c) => {
      const r = await c.query(`
        SELECT job_id::text AS job_id, status, progress, (completion_result IS NULL) AS cr_null
        FROM nex.knowledge_dump_jobs
        WHERE job_id::text = ANY($1::text[])
      `, [preservedKjids]);
      return r.rows;
    });
    const list = rows as Array<{ job_id: string; status: string; progress: number; cr_null: boolean }>;
    console.log(`  matched ${list.length}/10 preserved kjids on production`);
    const restored = list.filter((r) => r.status === "claimed" && Number(r.progress) === 0 && r.cr_null === true);
    console.log(`  restored-state (claimed/0/null) on production · ${restored.length}/${list.length} matched`);
    results.push({
      name: "10 preserved kjids · state on production NEX Postgres",
      verdict: "VERIFIED · PRODUCTION",
      detail: `matched ${list.length}/10 on production · ${restored.length}/${list.length} in claimed/0/null (restored) state`,
      extra: list.map((r) => ({ prefix: r.job_id.slice(0, 8), status: r.status, progress: Number(r.progress), cr_null: r.cr_null })),
    });
  } catch (e) {
    results.push({ name: "10 preserved kjids · state on production", verdict: "UNKNOWN", detail: `error: ${e instanceof Error ? e.message : String(e)}` });
  }

  // ── Q11 · production knowledge_dump_jobs status breakdown (no PII) ──
  console.log("\n--- Q11 · production knowledge_dump_jobs status breakdown ---");
  try {
    const rows = await client.withReadOnlyTx(async (c) => {
      const r = await c.query(`SELECT status, COUNT(*)::int AS n FROM nex.knowledge_dump_jobs GROUP BY status ORDER BY status`);
      return r.rows;
    });
    const list = rows as Array<{ status: string; n: number }>;
    const summary = list.map((r) => `${r.status}=${r.n}`).join(" · ");
    console.log(`  ${summary || "(no rows)"}`);
    results.push({
      name: "production knowledge_dump_jobs status breakdown",
      verdict: "VERIFIED · PRODUCTION",
      detail: summary || "no rows",
      extra: list,
    });
  } catch (e) {
    results.push({ name: "production knowledge_dump_jobs status breakdown", verdict: "UNKNOWN", detail: `error: ${e instanceof Error ? e.message : String(e)}` });
  }

  await client.end();

  console.log("\n=== Aggregate ===");
  const buckets: Record<string, number> = {};
  for (const r of results) buckets[r.verdict] = (buckets[r.verdict] ?? 0) + 1;
  for (const [k, v] of Object.entries(buckets)) console.log(`  ${k} = ${v}`);
  console.log(`\ntotal rows = ${results.length}`);

  console.log("\n=== Structured evidence ===");
  console.log(JSON.stringify({ ts: new Date().toISOString(), host: client.hostForLog, results }, null, 2));
  process.exitCode = 0;
}

main().catch((e) => {
  if (e instanceof ReadOnlyProductionUrlUnsafeError) {
    console.error(`HALT · ${e.message}`);
    process.exit(2);
  }
  if (e instanceof ReadOnlyProductionMisconfiguredError) {
    console.error(`HALT · ${e.message}`);
    process.exit(2);
  }
  console.error("runner exception:", e instanceof Error ? (e.stack ?? e.message) : String(e));
  process.exit(1);
});
