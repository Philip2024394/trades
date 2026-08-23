// scripts/nex-worker/_archive-supabase-heartbeats.mjs
//
// Task #72 Step 1c · Heartbeat unification · 2026-08-22
//
// Archive Supabase nex.worker_heartbeats rows (historical Fly-cluster
// telemetry · Fly destroyed 2026-08-09) into a Postgres archive table
// BEFORE migration 070 drops the plural table. Preserves audit evidence.
//
// Usage:
//   node --env-file=.env.local scripts/nex-worker/_archive-supabase-heartbeats.mjs --dry-run
//   node --env-file=.env.local scripts/nex-worker/_archive-supabase-heartbeats.mjs --archive
//
// Reads:  NEXT_PUBLIC_NEX_SUPABASE_URL + NEX_SUPABASE_SERVICE_ROLE_KEY  (Supabase source)
// Writes: NEX_POSTGRES_URL  →  nex.worker_heartbeats_archive_2026_08_22 (created if missing)
//
// Idempotent by host_id · re-runs are safe · ON CONFLICT DO NOTHING.
//
// Hard stops (per Philip 2026-08-22):
//   · Supabase read fails            → exit 1
//   · Row count mismatch             → exit 1
//   · Missing required env vars      → exit 1
//   · --dry-run and --archive both   → exit 1
//   · Neither --dry-run nor --archive → exit 1
//
// Never touches: knowledge_inbox · knowledge_dump_jobs · delivery_jobs ·
// social_scheduled_posts · nex.worker_heartbeat (singular) · any Networkers table.

import pg from "pg";

const args = new Set(process.argv.slice(2));
const isDryRun = args.has("--dry-run");
const isArchive = args.has("--archive");

if (isDryRun && isArchive) { console.error("ERROR · pass exactly one of --dry-run or --archive"); process.exit(1); }
if (!isDryRun && !isArchive) { console.error("ERROR · pass exactly one of --dry-run or --archive"); process.exit(1); }

const SUPABASE_URL = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY;
const POSTGRES_URL = process.env.NEX_POSTGRES_URL;
if (!SUPABASE_URL) { console.error("ERROR · NEXT_PUBLIC_NEX_SUPABASE_URL missing"); process.exit(1); }
if (!SUPABASE_KEY) { console.error("ERROR · NEX_SUPABASE_SERVICE_ROLE_KEY missing"); process.exit(1); }
if (!POSTGRES_URL) { console.error("ERROR · NEX_POSTGRES_URL missing"); process.exit(1); }

const ARCHIVE_TABLE = "nex.worker_heartbeats_archive_2026_08_22";
const ARCHIVE_REASON = "Fly cluster destroyed 2026-08-09 · Task #72 Step 1c heartbeat unification 2026-08-22";

// ── Read every row from Supabase worker_heartbeats ──────────────────────────
// Note (2026-08-22): db/migrations/003 created the table without schema prefix
// (Supabase default = public). Migration 042 later created a distinct copy in
// nex.worker_heartbeats on Postgres. Supabase REST API only exposes public +
// graphql_public schemas by default. So the historical Fly telemetry lives at
// public.worker_heartbeats on Supabase, not nex.worker_heartbeats.
async function fetchSupabaseRows() {
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/worker_heartbeats?select=*`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "count=exact",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "<no body>");
    throw new Error(`Supabase read failed HTTP ${res.status} · ${body.slice(0, 200)}`);
  }
  const total = res.headers.get("content-range")?.split("/")?.[1] ?? "unknown";
  const rows = await res.json();
  return { rows, totalHeader: total };
}

// ── Create archive table if missing ────────────────────────────────────────
async function ensureArchiveTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${ARCHIVE_TABLE} (
      host_id            TEXT PRIMARY KEY,
      last_seen_at       TIMESTAMPTZ NOT NULL,
      uptime_ms          BIGINT NOT NULL DEFAULT 0,
      cycles_total       INTEGER NOT NULL DEFAULT 0,
      cycles_failed      INTEGER NOT NULL DEFAULT 0,
      last_error         TEXT,
      last_cycle_summary JSONB,
      metadata           JSONB,
      archived_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      archived_reason    TEXT NOT NULL DEFAULT $1
    )
  `.replace("$1", `'${ARCHIVE_REASON}'`));
  await pool.query(`COMMENT ON TABLE ${ARCHIVE_TABLE} IS 'Frozen Supabase worker_heartbeats snapshot · Task #72 Step 1c 2026-08-22 · never written to after archive · kept for audit.'`);
}

// ── Insert rows (idempotent · ON CONFLICT DO NOTHING) ──────────────────────
async function insertRows(pool, rows) {
  let inserted = 0;
  let skipped = 0;
  for (const r of rows) {
    const res = await pool.query(
      `INSERT INTO ${ARCHIVE_TABLE}
        (host_id, last_seen_at, uptime_ms, cycles_total, cycles_failed,
         last_error, last_cycle_summary, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
       ON CONFLICT (host_id) DO NOTHING`,
      [
        r.host_id,
        r.last_seen_at,
        r.uptime_ms ?? 0,
        r.cycles_total ?? 0,
        r.cycles_failed ?? 0,
        r.last_error ?? null,
        r.last_cycle_summary ? JSON.stringify(r.last_cycle_summary) : null,
        r.metadata ? JSON.stringify(r.metadata) : null,
      ]
    );
    if (res.rowCount === 1) inserted++;
    else skipped++;
  }
  return { inserted, skipped };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[archive] mode=${isDryRun ? "DRY-RUN" : "ARCHIVE"} · target=${ARCHIVE_TABLE}`);
  console.log(`[archive] reading Supabase ${SUPABASE_URL} · schema=nex`);

  let src;
  try {
    src = await fetchSupabaseRows();
  } catch (err) {
    console.error(`[archive] FAILED to read Supabase: ${err.message}`);
    process.exit(1);
  }

  const rows = Array.isArray(src.rows) ? src.rows : [];
  console.log(`[archive] Supabase returned ${rows.length} rows (Content-Range total=${src.totalHeader})`);

  if (rows.length === 0) {
    console.log("[archive] no rows to archive · nothing to do");
    process.exit(0);
  }

  // Show sample so operator can eyeball what's being archived
  const sample = rows.slice(0, 5).map((r) => ({
    host_id: r.host_id,
    last_seen_at: r.last_seen_at,
    cycles_total: r.cycles_total,
    cycles_failed: r.cycles_failed,
    runtime_kind: r.metadata?.runtime_kind ?? "(none)",
  }));
  console.log("[archive] sample (first 5):");
  console.table(sample);

  if (isDryRun) {
    console.log(`[archive] DRY-RUN complete · would archive ${rows.length} rows · no writes performed`);
    process.exit(0);
  }

  // ── Archive path ────────────────────────────────────────────────────────
  const pool = new pg.Pool({ connectionString: POSTGRES_URL });
  try {
    await ensureArchiveTable(pool);
    const preCount = (await pool.query(`SELECT COUNT(*)::int AS n FROM ${ARCHIVE_TABLE}`)).rows[0].n;
    console.log(`[archive] archive table pre-count: ${preCount}`);

    const { inserted, skipped } = await insertRows(pool, rows);
    console.log(`[archive] insert result · inserted=${inserted} · skipped_duplicate=${skipped}`);

    const postCount = (await pool.query(`SELECT COUNT(*)::int AS n FROM ${ARCHIVE_TABLE}`)).rows[0].n;
    console.log(`[archive] archive table post-count: ${postCount}`);

    // Hard reconciliation: archive must contain at least every row we read
    const expectedMin = Math.max(preCount, rows.length);
    if (postCount < expectedMin) {
      console.error(`[archive] RECONCILIATION FAIL · post-count ${postCount} < expected min ${expectedMin}`);
      await pool.end();
      process.exit(1);
    }
    console.log(`[archive] RECONCILED · post-count ${postCount} >= expected min ${expectedMin}`);
    console.log(`[archive] Supabase side left in place · drop separately via Supabase UI or REST after verification.`);
  } catch (err) {
    console.error(`[archive] FAILED: ${err.message}`);
    await pool.end();
    process.exit(1);
  }
  await pool.end();
}

await main();
