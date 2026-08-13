// scripts/prove-timeout-injection-live.ts
//
// Wave 3 · H3 · live proof that withBrainRole actually sets statement_timeout
// and idle_in_transaction_session_timeout on the transaction, and that a
// slow query is cancelled at the configured budget.
//
// Governed by: docs/headquarters-production-readiness/WAVE-3-H3-TIMEOUT-BUDGETS.md §5
//
// SAFETY  read-only against local NEX Postgres (localhost:5433/nex_dev per .env.local).
// Does NOT touch Supabase · does NOT enable the supervisor · does NOT run against
// production. Uses pg_sleep to synthesise a slow query · zero row mutations.
//
// USAGE
//   npx tsx --env-file=.env.local scripts/prove-timeout-injection-live.ts
//
// EXIT CODES  0 · PASS · 2 · FAIL · 1 · runner exception

import { Pool } from "pg";
import { withBrainRole } from "@/lib/nex/db/with-brain-role";

async function main(): Promise<void> {
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }

  console.log("=== Wave 3 · H3 · live SET LOCAL injection probe ===\n");

  // --- Probe 1 · read back the SET LOCAL values from inside the transaction ---
  console.log("--- Probe 1 · SHOW statement_timeout + SHOW idle_in_transaction_session_timeout inside withBrainRole ---");
  const seen = await withBrainRole(async (c) => {
    const s = await c.query("SHOW statement_timeout");
    const i = await c.query("SHOW idle_in_transaction_session_timeout");
    return { statement_timeout: (s.rows[0] as { statement_timeout: string }).statement_timeout,
             idle_tx: (i.rows[0] as { idle_in_transaction_session_timeout: string }).idle_in_transaction_session_timeout };
  });
  console.log(`  statement_timeout = ${seen?.statement_timeout}`);
  console.log(`  idle_in_transaction_session_timeout = ${seen?.idle_tx}`);
  const stOk = seen?.statement_timeout === "30s";
  const itOk = seen?.idle_tx === "1min";
  console.log(`  → ${stOk && itOk ? "PASS" : "FAIL"} · defaults propagated · statement_timeout=30s · idle_tx=1min\n`);
  if (!stOk || !itOk) { process.exitCode = 2; return; }

  // --- Probe 2 · env-var override actually reaches the SET LOCAL ---
  console.log("--- Probe 2 · env-var override propagates into SET LOCAL ---");
  process.env.NEX_PG_STATEMENT_TIMEOUT_MS = "5000";
  const seen2 = await withBrainRole(async (c) => {
    const s = await c.query("SHOW statement_timeout");
    return (s.rows[0] as { statement_timeout: string }).statement_timeout;
  });
  console.log(`  after NEX_PG_STATEMENT_TIMEOUT_MS=5000 → statement_timeout = ${seen2}`);
  const overrideOk = seen2 === "5s";
  console.log(`  → ${overrideOk ? "PASS" : "FAIL"} · env-var override propagates\n`);
  delete process.env.NEX_PG_STATEMENT_TIMEOUT_MS;
  if (!overrideOk) { process.exitCode = 2; return; }

  // --- Probe 3 · slow query is cancelled by statement_timeout ---
  console.log("--- Probe 3 · slow query cancelled at statement_timeout ---");
  process.env.NEX_PG_STATEMENT_TIMEOUT_MS = "1000";  // 1s
  const t0 = Date.now();
  let caught: unknown = null;
  try {
    await withBrainRole(async (c) => {
      // pg_sleep for 5 seconds · statement_timeout=1s must abort it well before completion.
      await c.query("SELECT pg_sleep(5)");
      return null;
    });
  } catch (e) {
    caught = e;
  }
  const elapsed = Date.now() - t0;
  delete process.env.NEX_PG_STATEMENT_TIMEOUT_MS;
  const msg = caught instanceof Error ? caught.message : String(caught);
  const code = (caught as { code?: string } | null)?.code;
  console.log(`  elapsed = ${elapsed}ms · caught error code = ${code} · message = ${msg}`);
  const cancelledFast = elapsed < 3000;
  const isCanceledCode = code === "57014" || /canceling statement due to statement timeout/i.test(msg);
  console.log(`  → ${cancelledFast && isCanceledCode ? "PASS" : "FAIL"} · cancelled within ~1s + SQLSTATE 57014\n`);
  if (!cancelledFast || !isCanceledCode) { process.exitCode = 2; return; }

  console.log("PASS · Wave 3 · H3 · SET LOCAL injection + statement_timeout enforcement verified live");
  process.exitCode = 0;
}

main().catch((e) => {
  console.error("runner exception:", e instanceof Error ? (e.stack ?? e.message) : String(e));
  process.exit(1);
});
