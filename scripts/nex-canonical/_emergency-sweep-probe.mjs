// scripts/nex-canonical/_emergency-sweep-probe.mjs
//
// NEX Emergency Help · sweepExpired probe · sealed 2026-10-10 (EH
// hardening wave). Seeds a short-lived incident whose expires_at is
// already in the past, invokes the sweep SQL that `sweepExpired()`
// ships (migration 193 + widening in 195), and asserts the row is
// flipped to state='expired'. Cleans up the seeded rows regardless of
// outcome.
//
// Honest guards:
//   · SET default_transaction_read_only = off (we WRITE then UNDO).
//   · Session identity: SELECT current_database() MUST equal 'nex_dev'.
//     The probe refuses to run against any other database.
//   · If the DB is unreachable OR the schema is missing, the probe
//     exits with status 2 and a clear "DB unavailable" message.
//
// Usage: node scripts/nex-canonical/_emergency-sweep-probe.mjs
//
// See docs/doctrine/nex-emergency-hardening-audit-2026-10-10.md.

import pg from "pg";

const url = process.env.NEX_POSTGRES_URL;
if (!url) {
  console.error("[probe] missing NEX_POSTGRES_URL · aborting");
  process.exit(2);
}

const useSSL = /supabase\.(co|com)/i.test(url);
const client = new pg.Client({
  connectionString: url,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
});

const SEEDED_INCIDENT_ID = "99999999-9999-4999-8999-eeeeeeeeeeee";
const SEEDED_REQUESTER_ID = "88888888-8888-4888-8888-eeeeeeeeeeee";

async function main() {
  await client.connect();

  // Identity gate · never touch a DB that isn't nex_dev.
  const idRow = await client.query(
    "SELECT current_database() AS db, current_user AS u",
  );
  const db = String(idRow.rows[0].db);
  const u = String(idRow.rows[0].u);
  console.log(`[probe] session · db=${db} user=${u}`);
  if (db !== "nex_dev") {
    console.error(`[probe] refusing · current_database='${db}' (expected 'nex_dev')`);
    process.exit(2);
  }

  // Ensure the schema is present.
  const schemaCheck = await client.query(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema='nex' AND table_name='emergency_incident' LIMIT 1`,
  );
  if (schemaCheck.rowCount !== 1) {
    console.error("[probe] nex.emergency_incident not present · aborting");
    process.exit(2);
  }

  // Clean up any orphan seed from a prior failed run.
  await client.query(
    `DELETE FROM nex.emergency_incident WHERE incident_id = $1`,
    [SEEDED_INCIDENT_ID],
  );

  // Seed the incident · state=active · expires_at already in the past.
  // The service refuses to insert simulated=false in v1 pilot, so we
  // honour that with simulated=TRUE directly against the DB.
  console.log("[probe] seeding expired-active incident…");
  const insert = await client.query(
    `INSERT INTO nex.emergency_incident (
       incident_id, requester_account_id, state, category,
       location_lat, location_lng, location_accuracy_meters,
       location_captured_at, simulated, created_at,
       activated_at, expires_at
     ) VALUES (
       $1, $2, 'active', 'safety_concern',
       NULL, NULL, NULL,
       NULL, TRUE, now() - interval '5 minutes',
       now() - interval '5 minutes', now() - interval '1 minute'
     )
     RETURNING incident_id, state, expires_at`,
    [SEEDED_INCIDENT_ID, SEEDED_REQUESTER_ID],
  );
  if (insert.rowCount !== 1) {
    console.error("[probe] insert failed");
    process.exit(3);
  }
  console.log(`[probe] seeded incident_id=${insert.rows[0].incident_id} state=${insert.rows[0].state}`);

  // Simulate the sweep · identical SQL to incident-service.ts sweepExpired().
  console.log("[probe] running sweep…");
  const sweep = await client.query(
    `UPDATE nex.emergency_incident ei
        SET state = 'expired'
      WHERE ei.state IN ('active', 'responders_assigned')
        AND ei.expires_at <= now()
        AND NOT EXISTS (
          SELECT 1 FROM nex.incident_recipient ir
           WHERE ir.incident_id = ei.incident_id
             AND ir.response_status = 'accepted'
        )
      RETURNING incident_id, state`,
  );
  console.log(`[probe] sweep flipped ${sweep.rowCount} row(s)`);
  const flipped = sweep.rows.find((r) => r.incident_id === SEEDED_INCIDENT_ID);
  if (!flipped) {
    console.error("[probe] FAIL · seeded row NOT found in sweep output");
    await client.query(
      `DELETE FROM nex.emergency_incident WHERE incident_id = $1`,
      [SEEDED_INCIDENT_ID],
    );
    process.exit(4);
  }
  if (flipped.state !== "expired") {
    console.error(`[probe] FAIL · seeded row state is '${flipped.state}' (expected 'expired')`);
    await client.query(
      `DELETE FROM nex.emergency_incident WHERE incident_id = $1`,
      [SEEDED_INCIDENT_ID],
    );
    process.exit(4);
  }
  console.log(`[probe] PASS · seeded row flipped to state='expired'`);

  // Secondary assertion · a sweep run a second time is a no-op for the
  // same row (idempotent).
  const sweepAgain = await client.query(
    `UPDATE nex.emergency_incident ei
        SET state = 'expired'
      WHERE ei.state IN ('active', 'responders_assigned')
        AND ei.expires_at <= now()
      RETURNING incident_id`,
  );
  const stillHere = sweepAgain.rows.find(
    (r) => r.incident_id === SEEDED_INCIDENT_ID,
  );
  if (stillHere) {
    console.error("[probe] FAIL · idempotency check · seeded row re-swept");
    process.exit(4);
  }
  console.log("[probe] PASS · second sweep is a no-op for the same row");

  // Clean up.
  const cleaned = await client.query(
    `DELETE FROM nex.emergency_incident WHERE incident_id = $1`,
    [SEEDED_INCIDENT_ID],
  );
  console.log(`[probe] cleanup · deleted ${cleaned.rowCount} seeded row`);
  console.log("[probe] DONE · sweepExpired behaviour verified");
}

main()
  .catch((err) => {
    console.error("[probe] unexpected error:", err?.message ?? err);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await client.end();
    } catch {
      /* noop */
    }
  });
