// scripts/nex-canonical/_tier-coordination-probe.mjs
//
// NEX Directory · Related-Businesses · tier coordination probe.
//
// Authored by Agent B (end-to-end proof) · 2026-10-10.
//
// WHAT THIS SCRIPT IS
//   A CLI that supports Playwright's three-tier related-businesses
//   spec by:
//     · Finding anchors with known tier-1/tier-2 declarations (or the
//       honest absence thereof).
//     · Seeding temporary `services_products` jsonb payloads on a
//       chosen anchor (with provided[] + partners[]), after backing
//       up the original payload to a scratch table.
//     · Restoring the original payload on request.
//
// WHAT THIS SCRIPT IS NOT
//   · Not a schema migration. The scratch table `nex._e2e_bcbackup`
//     is a local-only convenience; see --init-scratch.
//   · Not a canonical mutator in production shape. The seed function
//     writes jsonb into services_products but NEVER changes
//     lifecycle_state, name_canonical, coordinates, or any other
//     identity field.
//   · Not an API caller. All assertions on the related API shape
//     live in the Playwright spec.
//
// COMMANDS
//   --init-scratch
//       Idempotent: creates `nex._e2e_bcbackup (canonical_business_id uuid PK,
//       services_products jsonb, backed_up_at timestamptz default now())`.
//
//   --find-anchor-with-no-declarations
//       Returns a VERIFIED anchor with coords whose services_products
//       is NULL or empty, suitable for tier-3-only tests.
//
//   --find-anchor-with-partners
//       Returns a VERIFIED anchor that already has partners[] in
//       services_products. Likely zero exist today.
//
//   --find-anchor-with-coords
//       Returns the first VERIFIED anchor with coords (any shape).
//
//   --find-discovered-canonical
//       Returns a DISCOVERED (unpublishable) canonical for partner-
//       filter tests.
//
//   --seed-tier-fixture <anchor_canonical_id> --provided <csv> --partner-id <uuid> [--partner-label <s>]
//       Backs up current services_products, then writes:
//         { provided: [...csv split], partners: [{canonical_business_id, label?}] }
//       Future invocations overwrite the fixture but DO NOT re-back up
//       (so repeated runs still restore to the ORIGINAL).
//
//   --restore-fixture <anchor_canonical_id>
//       Reads from scratch backup and restores services_products.
//       Deletes the scratch row.
//
//   --cleanup-scratch
//       Drops the scratch table entirely (idempotent).
//
// EXIT · 0 ok · 1 error · stdout always one-line JSON.

import "node:process";
import pg from "pg";

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
  if (r.rows[0].db !== "nex_dev") {
    fail("identity_gate_failed", `expected nex_dev got ${r.rows[0].db}`);
  }
}

function requireUuid(id, label) {
  if (
    typeof id !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    fail("invalid_uuid", `${label}: ${id}`);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Scratch backup table (local nex_dev only)
// ─────────────────────────────────────────────────────────────────────

const SCRATCH_DDL = `
  CREATE SCHEMA IF NOT EXISTS nex;
  CREATE TABLE IF NOT EXISTS nex._e2e_bcbackup (
    canonical_business_id uuid PRIMARY KEY,
    services_products jsonb,
    backed_up_at timestamptz NOT NULL DEFAULT now()
  );
`;

async function withClient(fn) {
  const client = new pg.Client({ connectionString: getConn() });
  await client.connect();
  try {
    await identityGate(client);
    return await fn(client);
  } finally {
    await client.end();
  }
}

// ─────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────

async function cmdInitScratch() {
  await withClient(async (client) => {
    await client.query(SCRATCH_DDL);
    log({ ok: true, action: "scratch_ready" });
  });
}

async function cmdFindAnchorWithNoDeclarations() {
  await withClient(async (client) => {
    const r = await client.query(
      `SELECT canonical_business_id, name_canonical, entity_type, lifecycle_state
         FROM nex.business_canonical
        WHERE lifecycle_state = 'VERIFIED'
          AND coordinates IS NOT NULL
          AND (
                services_products IS NULL
             OR services_products::text = '{}'
             OR NOT (services_products ? 'provided')
             AND NOT (services_products ? 'partners')
          )
        LIMIT 1`,
    );
    if (r.rowCount === 0) {
      log({ ok: true, found: false });
      return;
    }
    log({
      ok: true,
      found: true,
      canonical_business_id: r.rows[0].canonical_business_id,
      name_canonical: r.rows[0].name_canonical,
      entity_type: r.rows[0].entity_type,
      lifecycle_state: r.rows[0].lifecycle_state,
    });
  });
}

async function cmdFindAnchorWithPartners() {
  await withClient(async (client) => {
    const r = await client.query(
      `SELECT canonical_business_id, name_canonical,
              services_products
         FROM nex.business_canonical
        WHERE lifecycle_state = 'VERIFIED'
          AND services_products ? 'partners'
          AND jsonb_typeof(services_products->'partners') = 'array'
          AND jsonb_array_length(services_products->'partners') > 0
        LIMIT 1`,
    );
    if (r.rowCount === 0) {
      log({ ok: true, found: false });
      return;
    }
    log({
      ok: true,
      found: true,
      canonical_business_id: r.rows[0].canonical_business_id,
      name_canonical: r.rows[0].name_canonical,
      services_products: r.rows[0].services_products,
    });
  });
}

async function cmdFindAnchorWithCoords() {
  await withClient(async (client) => {
    const r = await client.query(
      `SELECT canonical_business_id, name_canonical, entity_type
         FROM nex.business_canonical
        WHERE lifecycle_state = 'VERIFIED'
          AND coordinates IS NOT NULL
        ORDER BY name_canonical
        LIMIT 1`,
    );
    if (r.rowCount === 0) {
      log({ ok: true, found: false });
      return;
    }
    log({
      ok: true,
      found: true,
      canonical_business_id: r.rows[0].canonical_business_id,
      name_canonical: r.rows[0].name_canonical,
      entity_type: r.rows[0].entity_type,
    });
  });
}

async function cmdFindDiscoveredCanonical() {
  await withClient(async (client) => {
    const r = await client.query(
      `SELECT canonical_business_id, name_canonical
         FROM nex.business_canonical
        WHERE lifecycle_state = 'DISCOVERED'
        LIMIT 1`,
    );
    if (r.rowCount === 0) {
      log({ ok: true, found: false });
      return;
    }
    log({
      ok: true,
      found: true,
      canonical_business_id: r.rows[0].canonical_business_id,
      name_canonical: r.rows[0].name_canonical,
    });
  });
}

async function cmdSeedTierFixture(args) {
  const anchorId = args._[0];
  requireUuid(anchorId, "anchor_canonical_id");

  const provided = typeof args.provided === "string"
    ? args.provided.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const partnerId = typeof args["partner-id"] === "string" ? args["partner-id"] : null;
  if (partnerId !== null) requireUuid(partnerId, "partner-id");
  const partnerLabel = typeof args["partner-label"] === "string" ? args["partner-label"] : null;

  if (provided.length === 0 && partnerId === null) {
    fail("empty_fixture", "need --provided or --partner-id");
  }

  await withClient(async (client) => {
    await client.query(SCRATCH_DDL);
    // Fetch current services_products.
    const cur = await client.query(
      `SELECT services_products FROM nex.business_canonical
        WHERE canonical_business_id = $1`,
      [anchorId],
    );
    if (cur.rowCount === 0) fail("canonical_not_found", anchorId);

    // Back up (first time only). If scratch row already exists, keep it.
    await client.query(
      `INSERT INTO nex._e2e_bcbackup (canonical_business_id, services_products)
       VALUES ($1, $2)
       ON CONFLICT (canonical_business_id) DO NOTHING`,
      [anchorId, cur.rows[0].services_products ?? null],
    );

    const fixture = {};
    if (provided.length > 0) fixture.provided = provided;
    if (partnerId !== null) {
      const partner = { canonical_business_id: partnerId };
      if (partnerLabel) partner.label = partnerLabel;
      fixture.partners = [partner];
    }

    await client.query(
      `UPDATE nex.business_canonical
          SET services_products = $2::jsonb,
              updated_at = now()
        WHERE canonical_business_id = $1`,
      [anchorId, JSON.stringify(fixture)],
    );

    log({
      ok: true,
      canonical_business_id: anchorId,
      fixture_applied: fixture,
      backup_present: true,
    });
  });
}

async function cmdRestoreFixture(args) {
  const anchorId = args._[0];
  requireUuid(anchorId, "anchor_canonical_id");

  await withClient(async (client) => {
    await client.query(SCRATCH_DDL);
    const b = await client.query(
      `SELECT services_products FROM nex._e2e_bcbackup
        WHERE canonical_business_id = $1`,
      [anchorId],
    );
    if (b.rowCount === 0) {
      log({ ok: true, action: "no_backup_found", canonical_business_id: anchorId });
      return;
    }
    const original = b.rows[0].services_products;
    await client.query(
      `UPDATE nex.business_canonical
          SET services_products = $2,
              updated_at = now()
        WHERE canonical_business_id = $1`,
      [anchorId, original],
    );
    await client.query(
      `DELETE FROM nex._e2e_bcbackup
        WHERE canonical_business_id = $1`,
      [anchorId],
    );
    log({
      ok: true,
      canonical_business_id: anchorId,
      restored: true,
      restored_to: original,
    });
  });
}

async function cmdCleanupScratch() {
  await withClient(async (client) => {
    // We only drop if ZERO rows remain (safety).
    const r = await client.query(
      `SELECT count(*)::int AS n FROM nex._e2e_bcbackup`,
    );
    if (r.rows[0].n > 0) {
      log({
        ok: false,
        reason: "scratch_not_empty",
        detail: `${r.rows[0].n} backup rows remain · call --restore-fixture first`,
      });
      process.exit(1);
    }
    await client.query(`DROP TABLE IF EXISTS nex._e2e_bcbackup`);
    log({ ok: true, action: "scratch_dropped" });
  });
}

// ─────────────────────────────────────────────────────────────────────
// Dispatcher
// ─────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    fail(
      "usage",
      "commands: --init-scratch|--find-anchor-with-no-declarations|--find-anchor-with-partners|--find-anchor-with-coords|--find-discovered-canonical|--seed-tier-fixture|--restore-fixture|--cleanup-scratch",
    );
  }
  const cmd = argv[0];
  const rest = parseArgs(argv.slice(1));
  switch (cmd) {
    case "--init-scratch":                       return cmdInitScratch();
    case "--find-anchor-with-no-declarations":   return cmdFindAnchorWithNoDeclarations();
    case "--find-anchor-with-partners":          return cmdFindAnchorWithPartners();
    case "--find-anchor-with-coords":            return cmdFindAnchorWithCoords();
    case "--find-discovered-canonical":          return cmdFindDiscoveredCanonical();
    case "--seed-tier-fixture":                  return cmdSeedTierFixture(rest);
    case "--restore-fixture":                    return cmdRestoreFixture(rest);
    case "--cleanup-scratch":                    return cmdCleanupScratch();
    default:
      fail("unknown_command", cmd);
  }
}

main().catch((err) => {
  fail("probe_crashed", err instanceof Error ? err.message : String(err));
});
