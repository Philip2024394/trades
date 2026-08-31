#!/usr/bin/env node
// scripts/nex-commercial/run-qualification.mjs
//
// NEX Commercial Substrate · Qualification runner · Philip 2026-08-27.
//
// Reads nex.service_business rows whose commercial_status is in the
// qualification band (discovered/qualified/contactable/marketing_ready),
// applies the deterministic qualify() engine, and UPDATEs the row when the
// derived status differs. Idempotent · safe to re-run any time.
//
// DOES NOT contact any business. DOES NOT touch marketing-owned states
// (attempted/engaged/invited/trial/paid/declined).
//
// Usage:
//   node scripts/nex-commercial/run-qualification.mjs          # scan all
//   node scripts/nex-commercial/run-qualification.mjs --dry    # no writes
//   node scripts/nex-commercial/run-qualification.mjs --limit=100
//
// Emits a worker_cycle_run row so /nex-head-quarters/workers + workforce
// pages see it. worker_type='commercial:qualification' · distinct from
// discovery walkers so HQ can separate qualification runs from acquisition.

import pg from "pg";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  qualify,
  QUALIFICATION_STATES,
  COMMERCIAL_STATES,
} from "./_commercial-states.mjs";

const NEX_POSTGRES_URL = process.env.NEX_POSTGRES_URL
  ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";

function parseArgs(argv) {
  const out = { dry: false, limit: null };
  for (const a of argv.slice(2)) {
    if (a === "--dry") out.dry = true;
    const m = a.match(/^--limit=(\d+)$/);
    if (m) out.limit = parseInt(m[1], 10);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const pool = new pg.Pool({ connectionString: NEX_POSTGRES_URL, max: 3 });

  const workerId    = randomUUID();
  const cycleRunId  = randomUUID();
  const workerType  = "commercial:qualification";
  const workerConfig = "commercial:qualification:service_business";
  const startMs     = Date.now();

  const counters = {
    mode: "commercial_qualification",
    dry_run: args.dry,
    rows_scanned: 0,
    rows_changed: 0,
    transitions: {},           // { "discovered→qualified": N, ... }
    per_status_before: {},
    per_status_after:  {},
    errors: 0,
  };

  // Write cycle_run at start (running) · finalize at end.
  try {
    await pool.query(
      `INSERT INTO nex.worker_cycle_run
         (id, worker_id, worker_type, worker_config,
          started_at, status, errors_count, summary)
       VALUES ($1::uuid, $2, $3, $4, to_timestamp($5::bigint/1000.0), 'running', 0, '{}'::jsonb)`,
      [cycleRunId, workerId, workerType, workerConfig, startMs],
    );
  } catch (err) {
    console.error(`[qualification] cycle_run start failed: ${err.message}`);
  }

  // Read rows qualification MAY touch · order deterministic for observability.
  let scanQuery =
    `SELECT public_listing_ref, business_name, website, phone, whatsapp_number,
            hero_image_url, commercial_status
       FROM nex.service_business
      WHERE commercial_status = ANY($1::text[])
      ORDER BY created_at ASC`;
  const params = [QUALIFICATION_STATES];
  if (args.limit) {
    scanQuery += ` LIMIT $2`;
    params.push(args.limit);
  }

  try {
    const rows = (await pool.query(scanQuery, params)).rows;
    counters.rows_scanned = rows.length;

    for (const row of rows) {
      counters.per_status_before[row.commercial_status] =
        (counters.per_status_before[row.commercial_status] ?? 0) + 1;

      const result = qualify(row);
      counters.per_status_after[result.newStatus] =
        (counters.per_status_after[result.newStatus] ?? 0) + 1;

      if (!result.changed) continue;

      const transitionKey = `${row.commercial_status}→${result.newStatus}`;
      counters.transitions[transitionKey] = (counters.transitions[transitionKey] ?? 0) + 1;

      if (args.dry) continue;

      try {
        // Timestamp columns · only set on FIRST promotion into each state.
        // COALESCE preserves earlier values so we don't overwrite the moment
        // this row first became qualified/contactable/marketing_ready.
        const setQualifiedAt =
          result.newStatus === COMMERCIAL_STATES.QUALIFIED       ? "COALESCE(qualified_at, now())"       : "qualified_at";
        const setContactableAt =
          result.newStatus === COMMERCIAL_STATES.CONTACTABLE     ? "COALESCE(contactable_at, now())"     : "contactable_at";
        const setMarketingReadyAt =
          result.newStatus === COMMERCIAL_STATES.MARKETING_READY ? "COALESCE(marketing_ready_at, now())" : "marketing_ready_at";

        await pool.query(
          `UPDATE nex.service_business SET
             commercial_status     = $1,
             qualification_reason  = $2::jsonb,
             qualified_at          = ${setQualifiedAt},
             contactable_at        = ${setContactableAt},
             marketing_ready_at    = ${setMarketingReadyAt},
             updated_at            = now()
           WHERE public_listing_ref = $3`,
          [result.newStatus, JSON.stringify(result.reason), row.public_listing_ref],
        );
      } catch (err) {
        counters.errors += 1;
        console.error(`[qualification] update failed for ${row.public_listing_ref}: ${err.message}`);
      }
      counters.rows_changed += 1;
    }
  } catch (err) {
    counters.errors += 1;
    console.error(`[qualification] scan failed: ${err.message}`);
  }

  const durationMs = Date.now() - startMs;
  const status = counters.errors > 0 ? "completed" : "completed";   // never "failed" for partial errors · single-row failures don't abort the job

  try {
    await pool.query(
      `UPDATE nex.worker_cycle_run SET
         finished_at = now(), duration_ms = $2, status = $3,
         records_processed = $4, records_new = $5,
         records_rejected = $6, errors_count = $7, summary = $8::jsonb
       WHERE id = $1::uuid`,
      [
        cycleRunId, durationMs, status,
        counters.rows_scanned, counters.rows_changed, 0, counters.errors,
        JSON.stringify(counters),
      ],
    );
  } catch (err) {
    console.error(`[qualification] cycle_run finalize failed: ${err.message}`);
  }

  console.log(`[qualification] complete`, {
    cycle_run_id: cycleRunId, duration_ms: durationMs, dry_run: args.dry,
    ...counters,
  });

  await pool.end();
}

const invokedAsScript = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedAsScript) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
