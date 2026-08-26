// scripts/nex-release-orphan-leases.mjs
// STEP 1 ONLY · Release ONLY expired orphan leases (released_at IS NULL
// AND expires_at < now()). Do not touch zombies. Do not change governor
// config. Do not restart anything. Capture BEFORE + AFTER evidence.

import pg from "pg";
const { Pool } = pg;
const url = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new Pool({ connectionString: url });

const b = (t) => `\n${"═".repeat(70)}\n  ${t}\n${"═".repeat(70)}`;
const p = (r) => console.log(JSON.stringify(r, null, 2));
const q = async (sql, params = []) => (await pool.query(sql, params)).rows;

try {
  console.log(b("STEP 1 · release expired orphan leases · " + new Date().toISOString()));

  console.log(b("BEFORE · all open leases (released_at IS NULL)"));
  const before = await q(`
    SELECT lease_id, provider, walker_id, acquired_at, expires_at,
           (expires_at < now()) AS is_expired,
           now() - expires_at AS overdue_by
    FROM nex.provider_rate_lease
    WHERE released_at IS NULL
    ORDER BY acquired_at ASC
  `);
  p(before);
  console.log(`  total open: ${before.length}  ·  expired: ${before.filter(l => l.is_expired).length}  ·  live: ${before.filter(l => !l.is_expired).length}`);

  console.log(b("ACTION · release expired orphans only"));
  const released = await q(`
    UPDATE nex.provider_rate_lease
    SET released_at = now()
    WHERE released_at IS NULL
      AND expires_at < now()
    RETURNING lease_id, provider, walker_id, acquired_at, expires_at, released_at
  `);
  console.log(`  ${released.length} lease(s) marked released`);
  p(released);

  console.log(b("AFTER · open leases (should exclude the ones we released)"));
  const after = await q(`
    SELECT lease_id, provider, walker_id, acquired_at, expires_at,
           (expires_at < now()) AS is_expired
    FROM nex.provider_rate_lease
    WHERE released_at IS NULL
    ORDER BY acquired_at ASC
  `);
  p(after);
  console.log(`  total open: ${after.length}  ·  expired: ${after.filter(l => l.is_expired).length}  ·  live: ${after.filter(l => !l.is_expired).length}`);

  console.log(b("BASELINE for 5-min observation window"));
  const baseline = await q(`
    SELECT
      (SELECT count(*) FROM nex.worker_cycle_run WHERE started_at >= now() - interval '1 minute') AS cycles_started_last_1min,
      (SELECT count(*) FROM nex.worker_cycle_run WHERE finished_at >= now() - interval '1 minute') AS cycles_finished_last_1min,
      (SELECT count(*) FROM nex.worker_heartbeat WHERE last_heartbeat_at >= now() - interval '1 minute') AS heartbeats_last_1min,
      (SELECT max(started_at)::text FROM nex.worker_cycle_run) AS most_recent_cycle_start,
      (SELECT max(finished_at)::text FROM nex.worker_cycle_run) AS most_recent_cycle_finish,
      (SELECT max(acquired_at)::text FROM nex.provider_rate_lease) AS most_recent_lease_acquire,
      (SELECT max(released_at)::text FROM nex.provider_rate_lease WHERE released_at IS NOT NULL) AS most_recent_lease_release
  `);
  p(baseline);

  await pool.end();
} catch (err) {
  console.error("STEP 1 FAILED:", err.message);
  try { await pool.end(); } catch {}
  process.exit(1);
}
