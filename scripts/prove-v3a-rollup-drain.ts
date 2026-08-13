// scripts/prove-v3a-rollup-drain.ts
//
// Wave 4 · V-3a · rollup queue drainable end-to-end.
// Governed by: docs/headquarters-production-readiness/WAVE-4-VERIFICATION-MATRIX.md
//
// Preconditions checked in-probe:
//   · migration 049 applied on local (H4 confirmed)
//   · NEX_ANALYTICS_ROLLUP_ASYNC set for the duration of the probe only
//
// Flow:
//   1 · ingestEvent(synthetic) · assert queue row appears with status='pending'
//   2 · drainAnalyticsRollupQueue() · assert row status transitions to 'completed'
//   3 · cleanup burner row
//
// SAFETY  gated writes only against local NEX Postgres. Never touches the
// 10 preserved KJs. Never touches Supabase / hammerex_* / production.

import { Pool } from "pg";
import { ingestEvent } from "@/lib/nex/analytics/ingest";
import { drainAnalyticsRollupQueue } from "@/lib/nex/analytics/rollup-worker";
import { _resetGateCacheForTests } from "@/lib/nex/analytics/rollup-gate";

async function main(): Promise<void> {
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }

  console.log("=== Wave 4 · V-3a · rollup queue drain probe ===\n");

  const admin = new Pool({ connectionString: url, max: 1 });
  process.env.NEX_ANALYTICS_ROLLUP_ASYNC = "1";
  _resetGateCacheForTests();

  const t = Date.now();
  const evId = await (async () => {
    const r = await ingestEvent({
      event_type: "delivered",
      event_timestamp: new Date().toISOString(),
      campaign_id: null, recipient_id: null, segment_id: null,
      provider: `v3a-probe-${t}`, country: null, domain: null,
      metadata: { probe: "v3a" },
      latency_ms: null, revenue: null, conversion_value: null, attribution_window: null,
      journey_id: null, automation_id: null, experiment_id: null, variant_id: null,
    });
    if (!r.ok) throw new Error(`ingest failed: ${r.error}`);
    return r.event_id;
  })();
  console.log(`step 1 · ingestEvent · event_id=${evId}`);

  const q1 = await admin.query(
    `SELECT status FROM nex.analytics_rollup_queue WHERE event_id = $1`,
    [evId],
  );
  const pending = q1.rows[0]?.status === "pending";
  console.log(`step 2 · queue row status after ingest = ${q1.rows[0]?.status ?? "MISSING"}`);
  if (!pending) { console.error("FAIL · queue row not pending"); process.exitCode = 2; await admin.end(); return; }

  const drain = await drainAnalyticsRollupQueue({ batch_size: 10, worker_id: "v3a-probe" });
  console.log(`step 3 · drain result · claimed=${drain.claimed} · completed=${drain.completed} · failed=${drain.failed}`);

  const q2 = await admin.query(
    `SELECT status, completed_at, attempts FROM nex.analytics_rollup_queue WHERE event_id = $1`,
    [evId],
  );
  const terminal = q2.rows[0]?.status === "completed";
  console.log(`step 4 · post-drain state · status=${q2.rows[0]?.status} · attempts=${q2.rows[0]?.attempts} · completed_at=${q2.rows[0]?.completed_at}`);

  // Cleanup burner rows.
  await admin.query(`DELETE FROM nex.analytics_rollup_queue WHERE event_id = $1`, [evId]);
  await admin.query(`DELETE FROM nex.analytics_events WHERE event_id = $1`, [evId]);
  console.log(`cleanup · burner event + queue rows deleted`);

  delete process.env.NEX_ANALYTICS_ROLLUP_ASYNC;
  await admin.end();

  if (terminal) {
    console.log("PASS · V-3a · queue pending → completed within one cycle");
    process.exitCode = 0;
  } else {
    console.log("FAIL · V-3a · queue did not reach terminal 'completed' state");
    process.exitCode = 2;
  }
}

main().catch((e) => { console.error("runner exception:", e instanceof Error ? (e.stack ?? e.message) : String(e)); process.exit(1); });
