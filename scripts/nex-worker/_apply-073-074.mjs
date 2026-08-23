import pg from "pg";
import { readFileSync } from "node:fs";
const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });

for (const mig of ["073_conv_turns_cle_tracking.sql", "074_conv_learning_candidate.sql"]) {
  console.log(`── applying ${mig} ──`);
  const sql = readFileSync(`C:/Users/Victus/trades/deploy/postgres/init/${mig}`, "utf8");
  try {
    await pool.query(sql);
    console.log(`  ok · ${mig} applied`);
  } catch (err) {
    console.log(`  FAIL · ${mig}:`, err.message);
    await pool.end();
    process.exit(1);
  }
}

const post = await pool.query(`
  SELECT
    (SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='nex' AND table_name='conv_turns' AND column_name='cle_processed_at')) AS turns_processed_col,
    (SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='nex' AND table_name='conv_turns' AND column_name='cle_cycle_run_id')) AS turns_cycle_col,
    (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='nex' AND table_name='conv_learning_candidate')) AS candidate_table,
    (SELECT COUNT(*)::int FROM nex.conv_learning_candidate) AS candidate_rows,
    (SELECT COUNT(*)::int FROM nex.conv_turns WHERE cle_processed_at IS NULL) AS unprocessed_turns,
    (SELECT COUNT(*)::int FROM nex.conv_turns WHERE speaker='customer' AND cle_processed_at IS NULL) AS unprocessed_customer_turns
`);
console.log("── post-migration ──"); console.log(" ", post.rows[0]);
const p = post.rows[0];
console.log(p.turns_processed_col && p.turns_cycle_col && p.candidate_table ? "GREEN · migrations 073+074 verified" : "AMBER");
await pool.end();
