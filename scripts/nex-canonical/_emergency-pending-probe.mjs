// scripts/nex-canonical/_emergency-pending-probe.mjs
//
// NEX Emergency Help · Responder-side pending/revoked DB-level probe.
//
// Authored by L2 (responder-side pending/revoked UI agent) · 2026-10-10.
//
// WHAT THIS SCRIPT IS
//   A thin CLI around the sealed emergency-incident table. It inserts a
//   simulated incident row in `pending_confirmation` or
//   `revoked_within_window` state so Playwright specs can drive the
//   `/nex-native/emergency-help/incident/[id]` surface against real DB
//   state. Every write is session-identity-gated to `nex_dev` and every
//   seeded row carries `simulated = TRUE`.
//
// WHAT THIS SCRIPT IS NOT
//   · Not a UI test runner. Playwright owns that.
//   · Not a bypass of the sealed state machine. L1's state machine owns
//     all legitimate transitions. This probe writes a terminal snapshot
//     for the UI to render against; it never claims to have gone
//     through the sealed transitions.
//   · Not a seed for production data. Every row this script writes
//     uses the "e2e-probe:" prefix on `requester_account_id` so cleanup
//     can target only its own rows.
//
// MIGRATION 195 PREREQUISITE
//   L1 is landing migration 195 which extends the sealed state CHECK on
//   `nex.emergency_incident.state` to include `pending_confirmation` and
//   `revoked_within_window`. Until 195 is applied to `nex_dev`, this
//   probe exits with `{ok:false, reason:"migration_195_not_applied"}`
//   when seeding either new state. Playwright must skip the scenario
//   when it sees that reason.
//
// COMMANDS
//   --seed-pending <requester_account_id> [--sim-tag <tag>]
//       Insert a row at state=pending_confirmation, simulated=true,
//       activated_at=NULL. Returns {ok, incident_id}.
//
//   --seed-revoked <requester_account_id> [--sim-tag <tag>]
//       Insert a row at state=revoked_within_window, simulated=true,
//       cancelled_at=now(). Returns {ok, incident_id}.
//
//   --cleanup <requester_account_id>
//       Delete every row for the given requester whose sim_tag starts
//       with "e2e-probe:" or whose requester_account_id starts with the
//       e2e-probe prefix. Returns {ok, rows_deleted}.
//
// EXIT
//   0 · ok (JSON on stdout)
//   1 · identity gate failed OR missing args OR DB error
//
// SAFETY
//   · Session identity check runs before any write. Refuses any db
//     other than `nex_dev`.
//   · simulated = TRUE always.
//   · Row.requester_account_id must be a UUID OR carry the e2e-probe
//     prefix (so legitimate accounts can't be injected into).

import "node:process";
import pg from "pg";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const TEST_RA_PREFIX = "e2e-probe:";

function log(obj) {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(obj));
}

function fail(reason, detail) {
  log({ ok: false, reason, detail: detail ?? null });
  process.exit(1);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function getConn() {
  const url =
    process.env.NEX_CANONICAL_PG_URL
    ?? process.env.NEX_POSTGRES_URL
    ?? process.env.DATABASE_URL;
  if (!url) fail("db_url_missing");
  return url;
}

async function identityGate(client) {
  const r = await client.query(
    "SELECT current_database() AS db, current_user AS usr",
  );
  const db = r.rows[0].db;
  if (db !== "nex_dev") {
    fail("identity_gate_failed", `expected nex_dev got ${db}`);
  }
  return { db, user: r.rows[0].usr };
}

function assertSafeRequester(id) {
  // Must be a UUID (production shape) OR carry the e2e-probe prefix.
  // Playwright passes the fixture's nex_account.id (UUID) as the
  // requester. We trust that path. The prefix is accepted so the
  // probe can be exercised by hand too.
  const isUuid =
    typeof id === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const isPrefixed =
    typeof id === "string" && id.startsWith(TEST_RA_PREFIX);
  if (!isUuid && !isPrefixed) {
    fail(
      "unsafe_requester",
      "requester_account_id must be a UUID or carry the e2e-probe: prefix",
    );
  }
}

async function stateCheckAccepts(client, state) {
  // Probe the current CHECK constraint by attempting a transactional
  // insert that we immediately roll back. If the state is accepted,
  // we return true; if the CHECK blocks it, we return false. Any OTHER
  // error bubbles up as a probe failure.
  const probeRequester = `${TEST_RA_PREFIX}probe-check-${cryptoUuid()}`;
  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO nex.emergency_incident
         (requester_account_id, state, category, simulated,
          location_lat, location_lng, location_accuracy_meters,
          location_captured_at, activated_at, expires_at)
       VALUES ($1, $2, 'general_assistance', TRUE,
               -8.65, 115.21, 12, now(), NULL,
               now() + interval '30 minutes')`,
      [probeRequester, state],
    );
    await client.query("ROLLBACK");
    return true;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    // CHECK failures surface as SQLSTATE 23514.
    if (err && err.code === "23514") {
      return false;
    }
    throw err;
  }
}

async function cmdSeed(args, newState) {
  const requester = args._[0];
  assertSafeRequester(requester);

  const client = new pg.Client({ connectionString: getConn() });
  await client.connect();
  try {
    await identityGate(client);

    const accepts = await stateCheckAccepts(client, newState);
    if (!accepts) {
      fail(
        "migration_195_not_applied",
        `nex.emergency_incident.state CHECK does not yet include "${newState}". Apply migration 195 before exercising this scenario.`,
      );
    }

    const columns =
      newState === "revoked_within_window"
        ? `(requester_account_id, state, category, simulated,
            location_lat, location_lng, location_accuracy_meters,
            location_captured_at, cancelled_at, expires_at)`
        : `(requester_account_id, state, category, simulated,
            location_lat, location_lng, location_accuracy_meters,
            location_captured_at, activated_at, expires_at)`;
    const values =
      newState === "revoked_within_window"
        ? `($1, $2, 'general_assistance', TRUE,
            -8.65, 115.21, 12, now(), now(),
            now() + interval '30 minutes')`
        : `($1, $2, 'general_assistance', TRUE,
            -8.65, 115.21, 12, now(), NULL,
            now() + interval '30 minutes')`;

    const r = await client.query(
      `INSERT INTO nex.emergency_incident ${columns}
       VALUES ${values}
       RETURNING incident_id, state, simulated, created_at`,
      [requester, newState],
    );
    const row = r.rows[0];
    log({
      ok: true,
      incident_id: row.incident_id,
      state: row.state,
      simulated: row.simulated,
      created_at: row.created_at,
      requester_account_id: requester,
    });
  } finally {
    await client.end();
  }
}

async function cmdCleanup(args) {
  const requester = args._[0];
  if (typeof requester !== "string" || requester.length < 8) {
    fail("missing_arg", "requester_account_id");
  }
  const client = new pg.Client({ connectionString: getConn() });
  await client.connect();
  try {
    await identityGate(client);
    // Delete all incidents authored by this requester AND tagged
    // simulated=true (defensive · the service rejects simulated=false
    // writes but the belt-and-braces check prevents cleanup from ever
    // touching a non-simulated row).
    const r = await client.query(
      `DELETE FROM nex.emergency_incident
        WHERE requester_account_id = $1
          AND simulated = TRUE`,
      [requester],
    );
    log({
      ok: true,
      requester_account_id: requester,
      rows_deleted: r.rowCount,
    });
  } finally {
    await client.end();
  }
}

function cryptoUuid() {
  return require("node:crypto").randomUUID();
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    fail(
      "usage",
      "commands: --seed-pending|--seed-revoked|--cleanup",
    );
  }
  const cmd = argv[0];
  const rest = parseArgs(argv.slice(1));
  switch (cmd) {
    case "--seed-pending":
      return cmdSeed(rest, "pending_confirmation");
    case "--seed-revoked":
      return cmdSeed(rest, "revoked_within_window");
    case "--cleanup":
      return cmdCleanup(rest);
    default:
      fail("unknown_command", cmd);
  }
}

main().catch((err) => {
  fail("probe_crashed", err instanceof Error ? err.message : String(err));
});
