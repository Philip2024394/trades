// scripts/nex-canonical/_age-transition-sweep.mjs
//
// NEX Family Safety · CC-3 · Age-transition sweep job.
//
// Finds rows in `nex.parent_custody_link` whose `auto_transfer_at`
// has elapsed and are not yet transferred/revoked. For each row the
// script performs the sealed atomic transition:
//   · UPDATE nex.parent_custody_link SET transferred_at = now()
//   · UPDATE nex.account_minor_profile SET is_minor = FALSE,
//     transferred_at = now()
//
// Both run inside ONE transaction per custody. Any partial failure
// rolls back and increments the `failures` counter.
//
// CRITICAL IDENTITY GATE
//   SELECT current_database() MUST equal 'nex_dev' before any write.
//   The script refuses to touch any other database.
//
// IDEMPOTENCE
//   A second run after a successful transition finds no eligible rows.
//
// USAGE
//   # dry-run (default) · lists eligible rows · writes nothing
//   node --env-file=.env.local scripts/nex-canonical/_age-transition-sweep.mjs
//
//   # live · explicit flag required for the writes
//   node --env-file=.env.local scripts/nex-canonical/_age-transition-sweep.mjs --apply
//
// EXIT
//   0 · dry-run completed OR apply succeeded (incl. zero candidates)
//   1 · identity check failed · aborted before any write
//   2 · migration pre-reqs missing OR unrecoverable error
//
// AUDIT
//   Each live transition prints a JSON line to stdout:
//     { custodyId, childAccountId, action: "age_transfer_completed_auto",
//       actorAccountId: null, at, simulated: true }
//   Callers can tee stdout to a file to persist the sweep history.

import pg from "pg";

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[age-sweep] ${msg}`);
}

function parseArgs(argv) {
  return {
    apply: argv.includes("--apply"),
  };
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
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
    log(`FATAL · expected db='nex_dev' got='${db}' · refusing to proceed`);
    await client.end();
    process.exit(1);
  }

  const schemaRes = await client.query(
    "SELECT 1 FROM pg_namespace WHERE nspname='nex'",
  );
  if ((schemaRes.rowCount ?? 0) === 0) {
    log("FATAL · schema 'nex' not present · apply earlier migrations first");
    await client.end();
    process.exit(2);
  }

  const pclPresent = await client.query(
    "SELECT to_regclass('nex.parent_custody_link') AS t",
  );
  const ampPresent = await client.query(
    "SELECT to_regclass('nex.account_minor_profile') AS t",
  );
  if (pclPresent.rows[0].t === null || ampPresent.rows[0].t === null) {
    log(
      "FATAL · required tables not present · migrations 205 + 206 must be applied first",
    );
    await client.end();
    process.exit(2);
  }
  log("prereq · nex.parent_custody_link + nex.account_minor_profile present");

  const nowIso = new Date().toISOString();

  const candidatesRes = await client.query(
    `SELECT custody_id, parent_account_id, child_account_id, auto_transfer_at
       FROM nex.parent_custody_link
      WHERE auto_transfer_at IS NOT NULL
        AND transferred_at IS NULL
        AND revoked_at IS NULL
        AND auto_transfer_at <= $1
      ORDER BY auto_transfer_at ASC`,
    [nowIso],
  );
  const candidates = candidatesRes.rows ?? [];
  log(
    `scan · ${candidates.length} custody row(s) past auto_transfer_at and not yet transferred`,
  );

  if (!apply) {
    for (const c of candidates) {
      log(
        `[dry-run] custody_id=${c.custody_id} · child=${c.child_account_id} · due=${c.auto_transfer_at}`,
      );
    }
    log(
      candidates.length === 0
        ? "SUMMARY · dry-run · no eligible rows · nothing to do"
        : `SUMMARY · dry-run · pass --apply to perform ${candidates.length} atomic transition(s)`,
    );
    await client.end();
    process.exit(0);
  }

  let transferred = 0;
  let failures = 0;
  for (const c of candidates) {
    try {
      await client.query("BEGIN");

      const u1 = await client.query(
        `UPDATE nex.parent_custody_link
            SET transferred_at = $2
          WHERE custody_id = $1
            AND transferred_at IS NULL
            AND revoked_at IS NULL`,
        [c.custody_id, nowIso],
      );
      if ((u1.rowCount ?? 0) !== 1) {
        await client.query("ROLLBACK");
        failures += 1;
        log(
          `rollback · custody_id=${c.custody_id} · UPDATE custody affected 0 rows`,
        );
        continue;
      }

      const u2 = await client.query(
        `UPDATE nex.account_minor_profile
            SET is_minor = FALSE,
                transferred_at = $2,
                updated_at = $2
          WHERE account_id = $1`,
        [c.child_account_id, nowIso],
      );
      if ((u2.rowCount ?? 0) !== 1) {
        await client.query("ROLLBACK");
        failures += 1;
        log(
          `rollback · child=${c.child_account_id} · UPDATE minor profile affected 0 rows`,
        );
        continue;
      }

      await client.query("COMMIT");
      transferred += 1;
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({
          custodyId: c.custody_id,
          childAccountId: c.child_account_id,
          parentAccountId: c.parent_account_id,
          action: "age_transfer_completed_auto",
          actorAccountId: null,
          at: nowIso,
          simulated: true,
        }),
      );
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* noop */
      }
      failures += 1;
      log(
        `rollback · custody_id=${c.custody_id} · ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  log(
    `SUMMARY · live · scanned=${candidates.length} · transferred=${transferred} · failures=${failures}`,
  );
  await client.end();
  process.exit(failures > 0 ? 2 : 0);
}

main().catch(async (err) => {
  log(
    `FATAL · unexpected · ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(2);
});
