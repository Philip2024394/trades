// scripts/nex-canonical/_cross-db-identity-verifier.mjs
//
// NEX Directory · Cross-DB Identity Verifier · READ-ONLY probe
//
// WHAT THIS DOES
//   READ-ONLY audit of the NEX side of the cross-DB owner link. It
//   verifies the invariants that must hold before AND after the
//   Supabase-side WIP migration is applied. No writes are performed
//   on either database.
//
//   Specifically:
//     1. Counts VERIFIED claims by account-id shape:
//        · Supabase UUID shape (candidates for reconciler link)
//        · anon:* fingerprints (not reconcilable until admin link)
//        · NULL (should be zero — CHECK ck_bcl_state_fields_consistency
//          forbids VERIFIED with NULL account id)
//     2. Verifies the uniqueness invariant: at most one VERIFIED claim
//        per canonical_business_id.
//     3. Reports the breakdown of all claim states for context.
//     4. Reports draft counts (migration 190) for cross-check against
//        Agent O's wave summary.
//
// CRITICAL IDENTITY GATE
//   SELECT current_database() MUST equal 'nex_dev' before any read.
//   The script refuses to touch any other database.
//
// NEVER CONNECTS TO SUPABASE
//   This is a NEX-side probe. The Supabase side is covered by the
//   operator runbook's §2 and §4 pre/post-migration SQL probes.
//
// USAGE
//   node --env-file=.env.local scripts/nex-canonical/_cross-db-identity-verifier.mjs
//
// EXIT
//   0 · all invariants hold
//   1 · identity gate failed
//   2 · invariant violation detected

import pg from "pg";

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[identity-verifier] ${msg}`);
}

function assert(cond, msg) {
  if (!cond) {
    log(`FAIL · ${msg}`);
    process.exit(2);
  }
  log(`PASS · ${msg}`);
}

async function main() {
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) {
    log("FATAL · NEX_POSTGRES_URL is not set");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  const idRes = await client.query(
    "SELECT current_database() AS db, current_user AS usr",
  );
  const db = idRes.rows[0].db;
  const usr = idRes.rows[0].usr;
  log(`session identity · db=${db} · user=${usr}`);
  if (db !== "nex_dev") {
    log(`FATAL · expected db='nex_dev' got='${db}' · refusing to read`);
    await client.end();
    process.exit(1);
  }

  // ─── Section A · Overall state breakdown ─────────────────────────
  log("\n── Section A · nex.business_claim state breakdown ──");
  const totalRes = await client.query(
    `SELECT COUNT(*)::int AS n FROM nex.business_claim`,
  );
  log(`total nex.business_claim rows · ${totalRes.rows[0].n}`);

  const stateRes = await client.query(
    `SELECT state, COUNT(*)::int AS n
       FROM nex.business_claim
      GROUP BY state
      ORDER BY state`,
  );
  if (stateRes.rows.length === 0) {
    log("no claim rows exist yet · the directory has no owner claims");
  } else {
    for (const r of stateRes.rows) {
      log(`  state=${r.state} · ${r.n}`);
    }
  }

  // ─── Section B · VERIFIED by account-id shape ────────────────────
  log("\n── Section B · VERIFIED claims by account-id shape ──");
  const verifiedShape = await client.query(`
    SELECT
      SUM(CASE WHEN state = 'VERIFIED' AND claimed_by_account_id IS NULL                                   THEN 1 ELSE 0 END)::int AS verified_null,
      SUM(CASE WHEN state = 'VERIFIED' AND claimed_by_account_id LIKE 'anon:%'                              THEN 1 ELSE 0 END)::int AS verified_anon,
      SUM(CASE WHEN state = 'VERIFIED'
               AND claimed_by_account_id IS NOT NULL
               AND claimed_by_account_id NOT LIKE 'anon:%'
               AND claimed_by_account_id ~ '^[0-9a-fA-F-]{36}$'                                             THEN 1 ELSE 0 END)::int AS verified_uuid_shape,
      SUM(CASE WHEN state = 'VERIFIED'
               AND claimed_by_account_id IS NOT NULL
               AND claimed_by_account_id NOT LIKE 'anon:%'
               AND claimed_by_account_id !~ '^[0-9a-fA-F-]{36}$'                                            THEN 1 ELSE 0 END)::int AS verified_other
      FROM nex.business_claim
  `);
  const vs = verifiedShape.rows[0];
  log(`  VERIFIED with NULL account        · ${vs.verified_null ?? 0}`);
  log(`  VERIFIED with anon:* fingerprint  · ${vs.verified_anon ?? 0}`);
  log(`  VERIFIED with UUID-shape account  · ${vs.verified_uuid_shape ?? 0}  (reconciler-eligible)`);
  log(`  VERIFIED with other shape         · ${vs.verified_other ?? 0}  (unexpected · investigate)`);

  // Invariant: VERIFIED must have non-null account per migration 176.
  assert(
    (vs.verified_null ?? 0) === 0,
    "Invariant B1 · no VERIFIED row has NULL claimed_by_account_id (CHECK ck_bcl_state_fields_consistency)",
  );

  // Expected: no "other" shape (either UUID or anon: prefix).
  assert(
    (vs.verified_other ?? 0) === 0,
    "Invariant B2 · every VERIFIED claimed_by_account_id is either anon:* or UUID-shaped",
  );

  // ─── Section C · Uniqueness: one VERIFIED claim per canonical ───
  log("\n── Section C · one VERIFIED claim per canonical ──");
  const dupe = await client.query(`
    SELECT canonical_business_id::text AS canonical_business_id, COUNT(*)::int AS n
      FROM nex.business_claim
     WHERE state = 'VERIFIED'
     GROUP BY canonical_business_id
     HAVING COUNT(*) > 1
     ORDER BY n DESC
     LIMIT 20
  `);
  if (dupe.rows.length === 0) {
    log("  no canonical has more than one VERIFIED claim · uniqueness holds");
  } else {
    log(`  FOUND ${dupe.rows.length} canonical rows with multiple VERIFIED claims:`);
    for (const r of dupe.rows) {
      log(`    canonical=${r.canonical_business_id} · verified_count=${r.n}`);
    }
  }
  assert(
    dupe.rows.length === 0,
    "Invariant C · no canonical has more than one VERIFIED claim",
  );

  // ─── Section D · PENDING codes with expired-at past ──────────────
  log("\n── Section D · PENDING claim codes past expiry ──");
  const expired = await client.query(`
    SELECT COUNT(*)::int AS n
      FROM nex.business_claim
     WHERE state = 'PENDING'
       AND expires_at IS NOT NULL
       AND expires_at < now()
  `);
  log(`  PENDING rows past expires_at · ${expired.rows[0].n}  (should be swept by sealed verifyClaim or admin)`);

  // ─── Section E · OWNER_CLAIMED canonicals cross-check ────────────
  log("\n── Section E · canonical lifecycle_state cross-check ──");
  const ownerClaimed = await client.query(`
    SELECT COUNT(*)::int AS n
      FROM nex.business_canonical
     WHERE lifecycle_state = 'OWNER_CLAIMED'
  `);
  log(`  canonical rows in OWNER_CLAIMED · ${ownerClaimed.rows[0].n}`);

  const verifiedCount = await client.query(`
    SELECT COUNT(*)::int AS n FROM nex.business_claim WHERE state = 'VERIFIED'
  `);
  log(`  VERIFIED claims                   · ${verifiedCount.rows[0].n}`);
  if (ownerClaimed.rows[0].n !== verifiedCount.rows[0].n) {
    log(`  NOTE · counts differ · may indicate orphaned OWNER_CLAIMED or VERIFIED-without-promotion. Not necessarily an error (admin may have revoked and left the canonical state intact pending audit), but worth investigation.`);
  } else {
    log(`  counts match · lifecycle_state and VERIFIED claim counts are consistent`);
  }

  // ─── Section F · Draft table counts (migration 190) ──────────────
  log("\n── Section F · nex.business_claim_draft (migration 190) ──");
  const draftExists = await client.query(
    `SELECT to_regclass('nex.business_claim_draft') AS reg`,
  );
  if (draftExists.rows[0].reg === null) {
    log("  nex.business_claim_draft does NOT exist · migration 190 not applied yet");
  } else {
    const draftTotal = await client.query(
      `SELECT COUNT(*)::int AS n FROM nex.business_claim_draft`,
    );
    log(`  total draft rows · ${draftTotal.rows[0].n}`);
    const draftStates = await client.query(`
      SELECT status, COUNT(*)::int AS n
        FROM nex.business_claim_draft
       GROUP BY status
       ORDER BY status
    `);
    if (draftStates.rows.length === 0) {
      log("  no draft rows exist yet");
    } else {
      for (const r of draftStates.rows) {
        log(`    status=${r.status} · ${r.n}`);
      }
    }
  }

  // ─── Summary ─────────────────────────────────────────────────────
  log("\n── SUMMARY ──");
  log(`  total claims                           · ${totalRes.rows[0].n}`);
  log(`  VERIFIED claims (reconciler-eligible)  · ${vs.verified_uuid_shape ?? 0}`);
  log(`  VERIFIED claims (anon · not eligible)  · ${vs.verified_anon ?? 0}`);
  log(`  canonicals in OWNER_CLAIMED            · ${ownerClaimed.rows[0].n}`);
  log("  all invariants held · READ-ONLY probe complete");

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`[identity-verifier] UNEXPECTED · ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
