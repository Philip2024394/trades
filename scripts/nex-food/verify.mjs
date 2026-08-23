#!/usr/bin/env node
// NEX Food · Phase 4 · verification workflow (CLI · admin surface).
//
// Moves rows through the claim_status state machine after admin review.
// This is the ONLY path that makes a Business record visible on the customer-
// facing Food Directory (which reads claim_status IN ('listed','invited',
// 'claimed','paying')).
//
// USAGE
//   NEX_POSTGRES_URL=... node scripts/nex-food/verify.mjs list
//     [--status=discovered|verifying|listed|invited|claimed|paying]  filter
//     [--category=restaurant|coffee-cafe|ice-cream-dessert|fast-food]
//
//   NEX_POSTGRES_URL=... node scripts/nex-food/verify.mjs mark <ref> <status>
//     ref     · #FL-YYYY-XXXXX  (single ref)
//     status  · one of verifying / listed / invited / claimed / paying
//
//   NEX_POSTGRES_URL=... node scripts/nex-food/verify.mjs mark-all-discovered listed
//     bulk · move every row in claim_status='discovered' to the given status
//     (asks for confirmation unless --yes is passed).
//
// STATE MACHINE (per pinned Food V1 doctrine)
//   discovered → verifying → listed → invited → claimed → paying
//
// This CLI intentionally allows any legal transition · admin-owned surface,
// not customer-facing. Illegal jumps (e.g. discovered → paying) are also
// allowed for backfill scenarios but log a warning.

import pg from "pg";

const VALID_STATUSES = ["discovered", "verifying", "listed", "invited", "claimed", "paying"];

function normalStatusTransition(from, to) {
  const order = VALID_STATUSES.indexOf(from);
  const target = VALID_STATUSES.indexOf(to);
  return target === order + 1;
}

async function getPool() {
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
  return new pg.Pool({ connectionString: url });
}

async function cmdList(args) {
  const status = args.find((a) => a.startsWith("--status="))?.split("=")[1];
  const category = args.find((a) => a.startsWith("--category="))?.split("=")[1];
  const pool = await getPool();
  const where = [];
  const params = [];
  if (status) { params.push(status); where.push(`claim_status = $${params.length}`); }
  if (category) { params.push(category); where.push(`category = $${params.length}`); }
  const sql = `
    SELECT public_listing_ref, business_name, category, claim_status, owner_status, city, district
    FROM nex.food_business
    ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY category, business_name
  `;
  const r = await pool.query(sql, params);
  await pool.end();
  console.log(`── nex.food_business · ${r.rowCount} rows ──`);
  r.rows.forEach((row) => {
    console.log(`  ${row.public_listing_ref}  [${row.category.padEnd(18)}]  claim=${row.claim_status.padEnd(11)} owner=${row.owner_status.padEnd(9)}  ${row.business_name}`);
  });
}

async function cmdMark(args) {
  const [ref, newStatus] = args;
  if (!ref || !newStatus) {
    console.error("USAGE: verify.mjs mark <ref> <status>");
    process.exit(1);
  }
  if (!VALID_STATUSES.includes(newStatus)) {
    console.error(`Invalid status '${newStatus}'. Must be one of: ${VALID_STATUSES.join(", ")}`);
    process.exit(1);
  }
  const pool = await getPool();
  const before = await pool.query(
    `SELECT public_listing_ref, business_name, claim_status FROM nex.food_business WHERE public_listing_ref = $1`,
    [ref]
  );
  if (before.rowCount === 0) {
    console.error(`No row with public_listing_ref='${ref}'`);
    await pool.end();
    process.exit(1);
  }
  const row = before.rows[0];
  console.log(`  before : ${row.public_listing_ref}  ${row.business_name}  claim=${row.claim_status}`);
  if (!normalStatusTransition(row.claim_status, newStatus)) {
    console.log(`  warn   : non-linear transition ${row.claim_status} → ${newStatus} (allowed but unusual)`);
  }
  await pool.query(
    `UPDATE nex.food_business SET claim_status = $1 WHERE public_listing_ref = $2`,
    [newStatus, ref]
  );
  console.log(`  after  : claim=${newStatus}`);
  await pool.end();
}

async function cmdMarkAll(args) {
  const [newStatus] = args;
  if (!VALID_STATUSES.includes(newStatus)) {
    console.error(`Invalid status '${newStatus}'. Must be one of: ${VALID_STATUSES.join(", ")}`);
    process.exit(1);
  }
  const wantYes = process.argv.includes("--yes");
  const pool = await getPool();
  const preview = await pool.query(
    `SELECT COUNT(*)::int AS n FROM nex.food_business WHERE claim_status = 'discovered'`
  );
  const n = preview.rows[0].n;
  console.log(`  will move ${n} rows from claim_status='discovered' to '${newStatus}'`);
  if (!wantYes) {
    console.log(`  add --yes to confirm · aborting`);
    await pool.end();
    process.exit(1);
  }
  const r = await pool.query(
    `UPDATE nex.food_business SET claim_status = $1 WHERE claim_status = 'discovered' RETURNING public_listing_ref`,
    [newStatus]
  );
  console.log(`  updated ${r.rowCount} rows`);
  r.rows.forEach((row) => console.log(`    ${row.public_listing_ref}`));
  await pool.end();
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case "list": return cmdList(rest);
    case "mark": return cmdMark(rest);
    case "mark-all-discovered": return cmdMarkAll(rest);
    default:
      console.error("USAGE:");
      console.error("  verify.mjs list [--status=X] [--category=Y]");
      console.error("  verify.mjs mark <ref> <status>");
      console.error("  verify.mjs mark-all-discovered <status> --yes");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`FATAL: ${err.message}`);
  process.exit(1);
});
